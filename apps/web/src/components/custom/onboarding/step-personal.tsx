'use client';

import type { AnyFieldApi } from '@tanstack/react-form';

import { Label } from '@ratio-diet/ui/components/label';
import { Input } from '@ratio-diet/ui/components/input';

import DateOfBirthField from '../date-of-birth-field';
import type { AnyReactFormApi } from '@/lib/form-types';

type Props = {
  form: AnyReactFormApi;
};

const SEX_OPTIONS = [
  { value: 'M', label: 'Maschio' },
  { value: 'F', label: 'Femmina' },
] as const;

const BODY_BUILD_OPTIONS = [
  { value: 'snello', label: 'Snello' },
  { value: 'medio', label: 'Medio' },
  { value: 'robusto', label: 'Robusto' },
] as const;

function parseNumberInput(value: string): number | undefined {
  if (value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const StepPersonal = ({ form }: Props) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-semibold">Dati personali</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Questi dati vengono usati per calcolare il tuo fabbisogno calorico.
      </p>
    </div>

    <form.Field name="sex">
      {(field: AnyFieldApi) => (
        <div className="space-y-2">
          <Label id="sex-label">Sesso</Label>
          <div className="flex gap-4" role="radiogroup" aria-labelledby="sex-label">
            {SEX_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="sex"
                  value={opt.value}
                  checked={field.state.value === opt.value}
                  onChange={() => field.handleChange(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </form.Field>

    <form.Field name="dateOfBirth">
      {(field: AnyFieldApi) => (
        <DateOfBirthField
          id="dateOfBirth"
          value={field.state.value}
          onChange={(value) => field.handleChange(value)}
        />
      )}
    </form.Field>

    <form.Field name="heightCm">
      {(field: AnyFieldApi) => (
        <div className="space-y-2">
          <Label htmlFor="heightCm">Altezza (cm)</Label>
          <Input
            id="heightCm"
            type="number"
            min={100}
            max={250}
            value={field.state.value || ''}
            onChange={(e) => field.handleChange(parseNumberInput(e.target.value))}
          />
        </div>
      )}
    </form.Field>

    <form.Field name="weightKg">
      {(field: AnyFieldApi) => (
        <div className="space-y-2">
          <Label htmlFor="weightKg">Peso (kg)</Label>
          <Input
            id="weightKg"
            type="number"
            min={30}
            max={300}
            step={0.1}
            value={field.state.value || ''}
            onChange={(e) => field.handleChange(parseNumberInput(e.target.value))}
          />
        </div>
      )}
    </form.Field>

    <form.Field name="bodyBuild">
      {(field: AnyFieldApi) => (
        <div className="space-y-2">
          <Label id="bodyBuild-label">Corporatura</Label>
          <div className="flex gap-4" role="radiogroup" aria-labelledby="bodyBuild-label">
            {BODY_BUILD_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="bodyBuild"
                  value={opt.value}
                  checked={field.state.value === opt.value}
                  onChange={() => field.handleChange(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </form.Field>
  </div>
);

export default StepPersonal;
