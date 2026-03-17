import { ConvexError } from 'convex/values';

const ADULT_MIN_AGE = 18;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parseDateParts = (dateOfBirth: string): [number, number, number] | null => {
  const [yearText, monthText, dayText] = dateOfBirth.split('-');
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

const parseDateOfBirth = (dateOfBirth: string): Date | null => {
  if (!DATE_ONLY_REGEX.test(dateOfBirth)) {
    return null;
  }
  const parts = parseDateParts(dateOfBirth);
  if (!parts) {
    return null;
  }
  const [year, month, day] = parts;
  return buildValidatedDate(year, month, day);
};

const isAtLeast18YearsOld = (birthDate: Date, today: Date): boolean => {
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age >= ADULT_MIN_AGE;
};

export const assertAdultDateOfBirth = (dateOfBirth: string, now: Date = new Date()): void => {
  const parsedDateOfBirth = parseDateOfBirth(dateOfBirth);
  if (!parsedDateOfBirth) {
    throw new ConvexError({ code: 'VALIDATION', message: 'Data di nascita non valida' });
  }

  if (parsedDateOfBirth > now) {
    throw new ConvexError({ code: 'VALIDATION', message: 'Data di nascita non valida' });
  }

  if (!isAtLeast18YearsOld(parsedDateOfBirth, now)) {
    throw new ConvexError({ code: 'VALIDATION', message: 'Devi avere almeno 18 anni' });
  }
};
