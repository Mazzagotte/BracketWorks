export const designTokens = {
  colors: {
    brand: '#0f172a',
    accent: '#2563eb',
  },
  spacing: {
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
  },
};

export const availableThemes = ['bracketworks-theme'] as const;

export function capitalizeFirstLetter(value: string): string {
  const firstLetterIndex = value.search(/\S/);
  if (firstLetterIndex === -1) {
    return value;
  }

  return `${value.slice(0, firstLetterIndex)}${value.charAt(firstLetterIndex).toLocaleUpperCase()}${value.slice(firstLetterIndex + 1)}`;
}
