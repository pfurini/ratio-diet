'use client';

import type { AnyFieldApi } from '@tanstack/react-form';

import { Label } from '@ratio-diet/ui/components/label';

import type { AnyReactFormApi } from '@/lib/form-types';
import { ACTIVITY_OPTIONS, GOAL_OPTIONS } from '@/lib/profile-options';

type Props = {
  form: AnyReactFormApi;
};

const StepGoal = ({ form }: Props) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-semibold">Obiettivo e attività</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Seleziona il tuo obiettivo principale e il livello di attività fisica.
      </p>
    </div>

    <form.Field name="goal">
      {(field: AnyFieldApi) => (
        <div className="space-y-2">
          <Label id="goal-label">Obiettivo</Label>
          <div className="space-y-2" role="radiogroup" aria-labelledby="goal-label">
            {GOAL_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
              >
                <input
                  type="radio"
                  name="goal"
                  value={opt.value}
                  checked={field.state.value === opt.value}
                  onChange={() => field.handleChange(opt.value)}
                  onBlur={field.handleBlur}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-muted-foreground text-sm">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
          {field.state.meta.isTouched &&
            field.state.meta.errors?.length > 0 &&
            field.state.meta.errors.map((error: unknown) => (
              <p key={String(error)} className="text-sm text-destructive">
                {(error as { message?: string })?.message ?? String(error)}
              </p>
            ))}
        </div>
      )}
    </form.Field>

    <form.Field name="activityLevel">
      {(field: AnyFieldApi) => (
        <div className="space-y-2">
          <Label id="activityLevel-label">Livello di attività fisica</Label>
          <div className="space-y-2" role="radiogroup" aria-labelledby="activityLevel-label">
            {ACTIVITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
              >
                <input
                  type="radio"
                  name="activityLevel"
                  value={opt.value}
                  checked={field.state.value === opt.value}
                  onChange={() => field.handleChange(opt.value)}
                  onBlur={field.handleBlur}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-muted-foreground text-sm">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
          {field.state.meta.isTouched &&
            field.state.meta.errors?.length > 0 &&
            field.state.meta.errors.map((error: unknown) => (
              <p key={String(error)} className="text-sm text-destructive">
                {(error as { message?: string })?.message ?? String(error)}
              </p>
            ))}
        </div>
      )}
    </form.Field>
  </div>
);

export default StepGoal;
