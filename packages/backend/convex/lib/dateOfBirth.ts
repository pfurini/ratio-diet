import { ConvexError } from 'convex/values';

import { parseDateOnly } from './dateOnly';

const ADULT_MIN_AGE = 18;

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
  const parsedDateOfBirth = parseDateOnly(dateOfBirth);
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
