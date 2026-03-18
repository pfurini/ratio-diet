'use client';

import type { AnyFieldApi } from '@tanstack/react-form';

import { Input } from '@ratio-diet/ui/components/input';
import { Label } from '@ratio-diet/ui/components/label';

import type { AnyReactFormApi } from '@/lib/form-types';
import { ALLERGEN_OPTIONS, DIETARY_OPTIONS, toggleAllergen } from '@/lib/profile-options';

type Props = {
  form: AnyReactFormApi;
};

const StepDietary = ({ form }: Props) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-semibold">Preferenze alimentari</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Indica le tue preferenze e allergie alimentari.
      </p>
    </div>

    <form.Field name="dietaryPreference">
      {(field: AnyFieldApi) => (
        <div className="space-y-2">
          <Label>Regime alimentare</Label>
          <div className="flex flex-wrap gap-3">
            {DIETARY_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="dietaryPreference"
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

    <form.Field name="allergies">
      {(field: AnyFieldApi) => (
        <div className="space-y-2">
          <Label>Allergie e intolleranze</Label>
          <div className="flex flex-wrap gap-3">
            {ALLERGEN_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={(field.state.value ?? []).includes(opt.value)}
                  onChange={() =>
                    field.handleChange(toggleAllergen(field.state.value ?? [], opt.value))
                  }
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </form.Field>

    <form.Field name="allergiesOther">
      {(field: AnyFieldApi) => (
        <div className="space-y-2">
          <Label htmlFor="allergiesOther">Altre allergie o intolleranze</Label>
          <Input
            id="allergiesOther"
            type="text"
            placeholder="es. kiwi, sedano..."
            value={field.state.value ?? ''}
            onChange={(e) => field.handleChange(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Queste allergie verranno considerate nella generazione dei piani settimanali (AI),
            ma non nel filtro automatico degli alimenti.
          </p>
        </div>
      )}
    </form.Field>
  </div>
);

export default StepDietary;
