import 'dotenv/config';
import pg from 'pg';
import { directDatabaseUrl } from '../src/prisma/database-url.js';

// Copies every row from one Postgres database into another that already has
// the schema (run `npm run db:deploy` against the target first). Written
// because PGlite ships no pg_dump, and a plain dump/restore is unavailable on
// a machine without the postgres client tools.
//
//   npm run db:copy -- --from "postgres://..." [--dry-run]
//
// The target is DIRECT_URL (or DATABASE_URL), i.e. the same database the
// migrations run against. Re-running is safe: rows that already exist are left
// alone, so an interrupted copy can simply be repeated.

const arg = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const LOCAL_DEFAULT =
  'postgres://postgres:postgres@localhost:51214/template1?sslmode=disable';
const source = arg('from') ?? LOCAL_DEFAULT;
const target = directDatabaseUrl();
const dryRun = process.argv.includes('--dry-run');

if (source === target) {
  throw new Error('Source and target are the same database.');
}

// The target applied its own migrations, so its history must not be overwritten.
const SKIP = new Set(['_prisma_migrations']);

const src = new pg.Client({ connectionString: source });
const dst = new pg.Client({ connectionString: target });
await src.connect();
await dst.connect();

const tables = (
  await src.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'`,
  )
).rows
  .map((row) => row.table_name)
  .filter((table) => !SKIP.has(table));

// A child table is only safe to fill once every table it points at is filled.
// Self-references are handled row by row instead.
const edges = (
  await src.query<{ child: string; parent: string }>(
    `select tc.table_name as child, ccu.table_name as parent
     from information_schema.table_constraints tc
     join information_schema.constraint_column_usage ccu
       on ccu.constraint_name = tc.constraint_name
     where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`,
  )
).rows.filter((edge) => edge.child !== edge.parent);

const order: string[] = [];
const pending = new Set(tables);
while (pending.size > 0) {
  const ready = [...pending].filter((table) =>
    edges
      .filter((edge) => edge.child === table)
      .every((edge) => !pending.has(edge.parent)),
  );
  if (ready.length === 0) {
    throw new Error(`Circular foreign keys between: ${[...pending].join(', ')}`);
  }
  for (const table of ready) {
    order.push(table);
    pending.delete(table);
  }
}

// jsonb has to be sent as text. Left as an object, node-postgres would turn an
// array value into a Postgres array literal instead of JSON.
const jsonColumns = new Map<string, Set<string>>();
for (const row of (
  await src.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
     where table_schema = 'public' and data_type in ('json', 'jsonb')`,
  )
).rows) {
  const columns = jsonColumns.get(row.table_name) ?? new Set<string>();
  columns.add(row.column_name);
  jsonColumns.set(row.table_name, columns);
}

type Row = Record<string, unknown>;

/** Orders a self-referencing table so a parent is always inserted before its children. */
function parentsFirst(rows: Row[]): Row[] {
  const parentKey = Object.keys(rows[0]).find((key) => /^parent_?id$/i.test(key));
  if (!parentKey) return rows;

  const inserted = new Set<unknown>();
  const ordered: Row[] = [];
  let remaining = rows;

  while (remaining.length > 0) {
    const ready = remaining.filter(
      (row) => !row[parentKey] || inserted.has(row[parentKey]),
    );
    // A parent outside this set would be a broken row in the source; let the
    // foreign key report it rather than looping for ever.
    if (ready.length === 0) return [...ordered, ...remaining];
    for (const row of ready) {
      ordered.push(row);
      inserted.add(row.id);
    }
    remaining = remaining.filter((row) => !ready.includes(row));
  }
  return ordered;
}

const report: string[] = [];
let total = 0;

for (const table of order) {
  const rows = (await src.query<Row>(`select * from "${table}"`)).rows;
  if (rows.length === 0) continue;

  const columns = Object.keys(rows[0]);
  const json = jsonColumns.get(table) ?? new Set<string>();
  const columnList = columns.map((column) => `"${column}"`).join(', ');
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

  if (!dryRun) {
    for (const row of parentsFirst(rows)) {
      const values = columns.map((column) =>
        json.has(column) && row[column] !== null
          ? JSON.stringify(row[column])
          : row[column],
      );
      await dst.query(
        `insert into "${table}" (${columnList}) values (${placeholders})
         on conflict do nothing`,
        values,
      );
    }
  }

  total += rows.length;
  report.push(`  ${table.padEnd(20)} ${String(rows.length).padStart(5)}`);
}

console.log(dryRun ? 'Would copy:' : 'Copied:');
console.log(report.join('\n'));
console.log(`  ${'TOTAL'.padEnd(20)} ${String(total).padStart(5)}`);

await src.end();
await dst.end();
