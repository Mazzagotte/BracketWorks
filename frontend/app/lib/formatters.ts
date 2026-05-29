/**
 * Shared formatting utilities used across the application.
 */

/**
 * Formats a numeric value as a USD currency string with no decimal places.
 * e.g. 1234.5 to "$1,235"
 */
export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
