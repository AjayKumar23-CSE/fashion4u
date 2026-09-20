import { compareSizes } from './size-order.js';

describe('compareSizes', () => {
  it('orders apparel sizes smallest to largest', () => {
    expect(['XXL', 'L', 'S', 'XL', 'M'].sort(compareSizes)).toEqual([
      'S',
      'M',
      'L',
      'XL',
      'XXL',
    ]);
  });

  it('puts unknown sizes last', () => {
    expect(['Free', 'M', '32'].sort(compareSizes)).toEqual(['M', '32', 'Free']);
  });
});
