/** Standard icon sizes (px) shared by both apps. Use these instead of numeric icon `size` props. */
export const ICON_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
} as const;

export function capitalizeFirstLetter(value: string): string {
  const firstLetterIndex = value.search(/\S/);
  if (firstLetterIndex === -1) {
    return value;
  }

  return `${value.slice(0, firstLetterIndex)}${value.charAt(firstLetterIndex).toLocaleUpperCase()}${value.slice(firstLetterIndex + 1)}`;
}
