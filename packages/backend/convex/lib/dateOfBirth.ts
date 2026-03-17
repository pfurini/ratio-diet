const ADULT_MIN_AGE = 18;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parseDateOfBirth = (dateOfBirth: string): Date | null => {
  if (!DATE_ONLY_REGEX.test(dateOfBirth)) {
    return null;
  }

  const [yearText, monthText, dayText] = dateOfBirth.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(year, month - 1, day);

  const hasValidParts =
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;

  return hasValidParts ? parsed : null;
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

export const assertAdultDateOfBirth = (dateOfBirth: string): void => {
  const parsedDateOfBirth = parseDateOfBirth(dateOfBirth);
  if (!parsedDateOfBirth) {
    throw new Error('Data di nascita non valida');
  }

  if (!isAtLeast18YearsOld(parsedDateOfBirth, new Date())) {
    throw new Error('Devi avere almeno 18 anni');
  }
};
