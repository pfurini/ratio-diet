'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import { Button } from '@ratio-diet/ui/components/button';
import { Input } from '@ratio-diet/ui/components/input';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';

import type { MealItem, MealType } from './meal-builder';

export interface MealState {
  type: MealType;
  items: MealItem[];
}

interface PlanTemplateBarProps {
  meals: MealState[];
  onLoadTemplate: (meals: MealState[]) => void;
  planId: Id<'dailyPlans'> | null;
}

interface TemplateDoc {
  _id: Id<'templates'>;
  name: string;
  meals: Array<{
    type: MealType;
    items: Array<{
      foodId: Id<'foods'>;
      constraintMin?: number;
      constraintMax?: number;
      quantityGrams?: number;
    }>;
  }>;
}

const getErrorDetail = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const TemplateSaveForm = ({ meals }: { meals: MealState[] }) => {
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const saveTemplate = useMutation(api.templates.save);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await saveTemplate({ meals, name: name.trim() });
      setName('');
      setSaved(true);
      setErrorMessage(null);
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaved(false);
      setErrorMessage(
        `Impossibile salvare il template. ${getErrorDetail(
          error,
          'Si è verificato un errore imprevisto.',
        )}`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-1">
      <form onSubmit={handleSave} className="flex gap-2">
        <Input
          placeholder="Nome template..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isSaving}
          className="flex-1"
        />
        <Button type="submit" variant="outline" size="sm" disabled={isSaving}>
          {isSaving ? 'Salvando...' : saved ? 'Salvato!' : 'Salva'}
        </Button>
      </form>
      {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
    </div>
  );
};

interface CompleteButtonProps {
  planId: Id<'dailyPlans'> | null;
}

const CompleteButton = ({ planId }: CompleteButtonProps) => {
  const completePlan = useMutation(api.dailyPlans.complete);
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setDone(false);
    setErrorMessage(null);
  }, [planId]);

  const handleComplete = async () => {
    if (!planId) return;
    try {
      await completePlan({ planId });
      setDone(true);
      setErrorMessage(null);
    } catch (error) {
      setDone(false);
      setErrorMessage(
        `Impossibile completare la giornata. ${getErrorDetail(
          error,
          'Si è verificato un errore imprevisto.',
        )}`,
      );
    }
  };

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="default"
        className="w-full"
        disabled={!planId || done}
        onClick={handleComplete}
      >
        {done ? 'Completato!' : 'Completa giornata'}
      </Button>
      {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
    </div>
  );
};

const PlanTemplateBar = ({ meals, onLoadTemplate, planId }: PlanTemplateBarProps) => {
  const templates = useQuery(api.templates.list);

  const handleLoadTemplate = (template: TemplateDoc) => {
    const loaded: MealState[] = template.meals.map((m) => ({
      items: m.items.map((item) => ({
        constraintMax: item.constraintMax,
        constraintMin: item.constraintMin,
        foodId: item.foodId,
        quantityGrams: item.quantityGrams,
      })),
      type: m.type,
    }));
    onLoadTemplate(loaded);
  };

  return (
    <div className="space-y-3">
      {templates && templates.length > 0 && (
        <div className="space-y-1">
          <label htmlFor="template-select" className="text-sm font-medium">
            Carica template
          </label>
          <select
            id="template-select"
            className="border-input bg-background w-full rounded-md border px-3 py-1.5 text-sm"
            defaultValue=""
            onChange={(e) => {
              const t = templates.find((tpl) => tpl._id === e.target.value);
              if (t) handleLoadTemplate(t);
              e.target.value = '';
            }}
          >
            <option value="" disabled>Seleziona template...</option>
            {templates.map((t) => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">Salva come template</p>
        <TemplateSaveForm meals={meals} />
      </div>
      <CompleteButton planId={planId} />
    </div>
  );
};

export default PlanTemplateBar;
