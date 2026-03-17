'use client';

import { Input } from '@ratio-diet/ui/components/input';
import { Label } from '@ratio-diet/ui/components/label';

const ADULT_MIN_AGE = 18;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const formatAsDateInput = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value: string): Date | null => {
  if (!DATE_ONLY_REGEX.test(value)) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(year, month - 1, day);

  const isSameDate =
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;

  return isSameDate ? parsed : null;
};

export const getMaximumDateOfBirth = (today: Date = new Date()): string => {
  const maxDate = new Date(today);
  maxDate.setFullYear(maxDate.getFullYear() - ADULT_MIN_AGE);
  return formatAsDateInput(maxDate);
};

const isAdult = (dateOfBirth: Date, today: Date): boolean => {
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  const dayDiff = today.getDate() - dateOfBirth.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age >= ADULT_MIN_AGE;
};

export const validateDateOfBirth = (value: string): string | null => {
  if (!value) {
    return 'Inserisci la data di nascita.';
  }

  const parsedDate = parseDateInput(value);
  if (!parsedDate) {
    return 'Inserisci una data di nascita valida.';
  }

  if (!isAdult(parsedDate, new Date())) {
    return 'Devi avere almeno 18 anni.';
  }

  return null;
};

type DateOfBirthFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  label?: string;
};

const DateOfBirthField = ({
  id,
  value,
  onChange,
  required = false,
  label = 'Data di nascita',
}: DateOfBirthFieldProps) => {
  const validationError = value ? validateDateOfBirth(value) : null;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        value={value}
        max={getMaximumDateOfBirth()}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-invalid={Boolean(validationError)}
        aria-describedby={validationError ? `${id}-error` : undefined}
      />
      {validationError ? (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {validationError}
        </p>
      ) : null}
    </div>
  );
};

export default DateOfBirthField;
