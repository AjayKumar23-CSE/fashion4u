import { randomBytes } from 'node:crypto';

/** Readable, sortable-ish order number, e.g. BR260920X7K2. */
export function generateOrderNumber(now = new Date()): string {
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `BR${date}${suffix}`;
}
