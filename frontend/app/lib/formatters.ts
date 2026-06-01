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

const parseIsoDateAtLocalMidnight = (isoDate: string): Date => {
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = isoDate.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date(NaN);
  }
  return new Date(year, month - 1, day);
};

export const formatFullDate = (date: Date): string =>
  date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

export const formatLongDate = (date: Date): string =>
  date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export const formatShortDateWithWeekday = (date: Date): string =>
  date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export const formatShortMonthDayYear = (date: Date): string =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const formatIsoDateFull = (isoDate: string): string =>
  formatFullDate(parseIsoDateAtLocalMidnight(isoDate));

export const formatIsoDateLong = (isoDate: string): string =>
  formatLongDate(parseIsoDateAtLocalMidnight(isoDate));

export const formatIsoDateShortWithWeekday = (isoDate: string): string =>
  formatShortDateWithWeekday(parseIsoDateAtLocalMidnight(isoDate));
