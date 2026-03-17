'use client';

import type { AnyFieldApi, ReactFormExtendedApi } from '@tanstack/react-form';

import { Label } from '@ratio-diet/ui/components/label';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyReactFormApi = ReactFormExtendedApi<any, any, any, any, any, any, any, any, any, any, any, any>;

type Props = {
  form: AnyReactFormApi;
};

const GOAL_OPTIONS = [
  { value: 'dimagrimento', label: 'Dimagrimento', description: 'Perdere peso in modo graduale' },
  { value: 'mantenimento', label: 'Mantenimento', description: 'Mantenere il peso attuale' },
  {
    value: 'aumento_massa',
    label: 'Aumento massa',
    description: 'Guadagnare massa muscolare',
  },
  {
    value: 'ricomposizione',
    label: 'Ricomposizione',
    description: 'Perdere grasso e guadagnare muscolo',
  },
] as const;

const ACTIVITY_OPTIONS = [
  { value: 'sedentario', label: 'Sedentario', description: 'Poco o nessun esercizio' },
  {
    value: 'leggermente_attivo',
    label: 'Leggermente attivo',
    description: 'Esercizio leggero 1–3 giorni/settimana',
  },
  {
    value: 'moderatamente_attivo',
    label: 'Moderatamente attivo',
    description: 'Esercizio moderato 3–5 giorni/settimana',
  },
  {
    value: 'molto_attivo',
    label: 'Molto attivo',
    description: 'Esercizio intenso 6–7 giorni/settimana',
  },
  {
    value: 'atleta',
    label: 'Atleta',
    description: 'Allenamento professionale o doppia sessione',
  },
] as const;

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
          <Label>Obiettivo</Label>
          <div className="space-y-2">
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
                  className="mt-1"
                />
                <div>
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-muted-foreground text-sm">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </form.Field>

    <form.Field name="activityLevel">
      {(field: AnyFieldApi) => (
        <div className="space-y-2">
          <Label>Livello di attività fisica</Label>
          <div className="space-y-2">
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
                  className="mt-1"
                />
                <div>
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-muted-foreground text-sm">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </form.Field>
  </div>
);

export default StepGoal;
