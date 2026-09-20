import { discountPercent } from './pricing.js';

describe('discountPercent', () => {
  it('matches the badges on the reference listing', () => {
    expect(discountPercent(99900, 44900)).toBe(55);
    expect(discountPercent(99900, 59900)).toBe(40);
  });

  it('is 0 when there is no discount', () => {
    expect(discountPercent(99900, 99900)).toBe(0);
    expect(discountPercent(99900, 109900)).toBe(0);
    expect(discountPercent(0, 0)).toBe(0);
  });
});
