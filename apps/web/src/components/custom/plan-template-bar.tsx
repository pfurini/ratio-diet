'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import { Button } from '@ratio-diet/ui/components/button';
import { Input } from '@ratio-diet/ui/components/input';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';

import type { MealItem, MealType } from './meal-builder';

interface MealState {
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
    items: Array<{ foodId: Id<'foods'>; constraintMin?: number; constraintMax?: number }>;
  }>;
}

const TemplateSaveForm = ({ meals }: { meals: MealState[] }) => {
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  const saveTemplate = useMutation(api.templates.save);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await saveTemplate({ meals, name: name.trim() });
    setName('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSave} className="flex gap-2">
      <Input
        placeholder="Nome template..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="flex-1"
      />
      <Button type="submit" variant="outline" size="sm">
        {saved ? 'Salvato!' : 'Salva'}
      </Button>
    </form>
  );
};

interface CompleteButtonProps {
  planId: Id<'dailyPlans'> | null;
}

const CompleteButton = ({ planId }: CompleteButtonProps) => {
  const completePlan = useMutation(api.dailyPlans.complete);

  const handleComplete = async () => {
    if (!planId) return;
    await completePlan({ planId });
  };

  return (
    <Button
      type="button"
      variant="default"
      className="w-full"
      disabled={!planId}
      onClick={handleComplete}
    >
      Completa giornata
    </Button>
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
      })),
      type: m.type,
    }));
    onLoadTemplate(loaded);
  };

  return (
    <div className="space-y-3">
      {templates && templates.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Carica template</p>
          <div className="flex flex-wrap gap-2">
            {(templates as TemplateDoc[]).map((t) => (
              <Button
                key={t._id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleLoadTemplate(t)}
              >
                {t.name}
              </Button>
            ))}
          </div>
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
