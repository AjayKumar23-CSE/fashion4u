const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];

// Apparel sizes don't sort alphabetically; unknown sizes go last.
export function compareSizes(a: string, b: string): number {
  const rank = (size: string) => {
    const index = SIZE_ORDER.indexOf(size.toUpperCase());
    return index === -1 ? SIZE_ORDER.length : index;
  };
  return rank(a) - rank(b) || a.localeCompare(b);
}
