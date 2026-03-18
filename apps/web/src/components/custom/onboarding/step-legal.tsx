'use client';

import type { AnyFieldApi } from '@tanstack/react-form';

import { Label } from '@ratio-diet/ui/components/label';

import type { AnyReactFormApi } from '@/lib/form-types';

type Props = {
  form: AnyReactFormApi;
};

const StepLegal = ({ form }: Props) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-semibold">Consenso e dichiarazioni</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Prima di procedere, leggi e accetta le seguenti dichiarazioni.
      </p>
    </div>

    <form.Field name="isOver18">
      {(field: AnyFieldApi) => (
        <div className="flex items-start gap-3">
          <input
            id="isOver18"
            type="checkbox"
            className="mt-1 h-4 w-4 cursor-pointer"
            checked={field.state.value}
            onChange={(e) => field.handleChange(e.target.checked)}
          />
          <Label htmlFor="isOver18" className="cursor-pointer leading-relaxed">
            Dichiaro di avere almeno 18 anni di età.
          </Label>
        </div>
      )}
    </form.Field>

    <form.Field name="noPathologies">
      {(field: AnyFieldApi) => (
        <div className="flex items-start gap-3">
          <input
            id="noPathologies"
            type="checkbox"
            className="mt-1 h-4 w-4 cursor-pointer"
            checked={field.state.value}
            onChange={(e) => field.handleChange(e.target.checked)}
          />
          <Label htmlFor="noPathologies" className="cursor-pointer leading-relaxed">
            Dichiaro di non avere patologie che richiedono una dieta medica specifica.
          </Label>
        </div>
      )}
    </form.Field>

    <form.Field name="disclaimerRead">
      {(field: AnyFieldApi) => (
        <div className="flex items-start gap-3">
          <input
            id="disclaimerRead"
            type="checkbox"
            className="mt-1 h-4 w-4 cursor-pointer"
            checked={field.state.value}
            onChange={(e) => field.handleChange(e.target.checked)}
          />
          <Label htmlFor="disclaimerRead" className="cursor-pointer leading-relaxed">
            Ho letto e compreso che i piani generati sono indicativi e non sostituiscono il
            parere di un professionista della nutrizione.
          </Label>
        </div>
      )}
    </form.Field>

    <form.Field name="followedByNutritionist">
      {(field: AnyFieldApi) => (
        <div className="flex items-start gap-3">
          <input
            id="followedByNutritionist"
            type="checkbox"
            className="mt-1 h-4 w-4 cursor-pointer"
            checked={field.state.value}
            onChange={(e) => field.handleChange(e.target.checked)}
          />
          <Label htmlFor="followedByNutritionist" className="cursor-pointer leading-relaxed">
            Sono seguito da un nutrizionista o dietologo.
          </Label>
        </div>
      )}
    </form.Field>
  </div>
);

export default StepLegal;
