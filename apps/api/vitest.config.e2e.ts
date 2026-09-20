import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Refuses to run against anything but a local database; see
    // test/database-guard.ts.
    setupFiles: ['./test/setup-e2e.ts'],
    // Every e2e file drives the same database, so they run one at a time
    // rather than racing each other over shared rows.
    fileParallelism: false,
  },
});
