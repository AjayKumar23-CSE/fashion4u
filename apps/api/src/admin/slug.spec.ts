import { slugify } from './slug.js';

describe('slugify', () => {
  it('makes readable slugs', () => {
    expect(slugify('Tank Tops')).toBe('tank-tops');
    expect(slugify('  Men’s  T-Shirts & Polos! ')).toBe('men-s-t-shirts-polos');
  });
});
