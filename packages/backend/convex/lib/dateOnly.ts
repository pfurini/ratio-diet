import { ConvexError } from 'convex/values';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parseDateParts = (dateOnly: string): [number, number, number] | null => {
  const [yearText, monthText, dayText] = dateOnly.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }
  return [year, month, day];
};

const buildValidatedDate = (year: number, month: number, day: number): Date | null => {
  const parsed = new Date(0);
  parsed.setFullYear(year, month - 1, day);
  parsed.setHours(0, 0, 0, 0);
  const hasValidParts = parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
  return hasValidParts ? parsed : null;
};

export const parseDateOnly = (dateOnly: string): Date | null => {
  if (!DATE_ONLY_REGEX.test(dateOnly)) {
    return null;
  }
  const parts = parseDateParts(dateOnly);
  if (!parts) {
    return null;
  }
  const [year, month, day] = parts;
  return buildValidatedDate(year, month, day);
};

export const assertDateOnly = (dateOnly: string, message = 'Data non valida'): void => {
  if (!parseDateOnly(dateOnly)) {
    throw new ConvexError({ code: 'INVALID_INPUT', message });
  }
};
