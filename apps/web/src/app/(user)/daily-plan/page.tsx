'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import { Button } from '@ratio-diet/ui/components/button';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';

import type { MealItem, MealType } from '@/components/custom/meal-builder';
import MealBuilder from '@/components/custom/meal-builder';
import PlanMacroSummary from '@/components/custom/plan-macro-summary';
import PlanTemplateBar from '@/components/custom/plan-template-bar';

const getLocalDate = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

interface MealState {
  type: MealType;
  items: MealItem[];
}

const DEFAULT_MEALS: MealState[] = [
  { items: [], type: 'colazione' },
  { items: [], type: 'pranzo' },
  { items: [], type: 'cena' },
];

const SPUNTINI: MealState[] = [
  { items: [], type: 'spuntino_mattina' },
  { items: [], type: 'spuntino_pomeriggio' },
];

interface MacroSnapshot {
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  calorieTarget: number;
  tdee: number;
}

const isSpuntino = (type: MealType) => type === 'spuntino_mattina' || type === 'spuntino_pomeriggio';

const buildActiveMeals = (base: MealState[], show: boolean): MealState[] => (show ? [...base, ...SPUNTINI] : base);

const updateMealItems = (meals: MealState[], mealType: MealType, items: MealItem[]): MealState[] =>
  meals.map((m) => (m.type === mealType ? { ...m, items } : m));

const DatePicker = ({ date, onChange }: { date: string; onChange: (d: string) => void }) => (
  <div className="flex items-center gap-2">
    <label htmlFor="plan-date" className="text-sm font-medium">
      Data
    </label>
    <input
      id="plan-date"
      type="date"
      value={date}
      onChange={(e) => onChange(e.target.value)}
      className="border-input bg-background rounded-md border px-3 py-1.5 text-sm"
    />
  </div>
);

interface OptimizeButtonProps {
  meals: MealState[];
  date: string;
  onOptimized: (id: Id<'dailyPlans'>) => void;
}

const OptimizeButton = ({ meals, date, onOptimized }: OptimizeButtonProps) => {
  const optimize = useMutation(api.dailyPlans.optimize);
  const [loading, setLoading] = useState(false);

  const handleOptimize = async () => {
    setLoading(true);
    const id = await optimize({ date, meals });
    onOptimized(id);
    setLoading(false);
  };

  return (
    <Button type="button" className="w-full" onClick={handleOptimize} disabled={loading}>
      {loading ? 'Calcolo in corso...' : 'Calcola quantità'}
    </Button>
  );
};

const usePlanData = (date: string) => {
  const profile = useQuery(api.userProfiles.get);
  const existingPlan = useQuery(api.dailyPlans.get, { date });
  const macrosTarget = profile?.macros as MacroSnapshot | undefined;
  const macrosAchieved = existingPlan?.macrosAchieved as MacroSnapshot | undefined;
  const resolvedPlanId = (existingPlan?._id as Id<'dailyPlans'> | null) ?? null;
  return { macrosAchieved, macrosTarget, resolvedPlanId };
};

const usePlanHandlers = (
  setMeals: React.Dispatch<React.SetStateAction<MealState[]>>,
  setShowSpuntini: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const handleItemsChange = (mealType: MealType, items: MealItem[]) => {
    setMeals((prev) => updateMealItems(prev, mealType, items));
  };

  const handleLoadTemplate = (loaded: MealState[]) => {
    setMeals(loaded);
    setShowSpuntini(loaded.some((m) => isSpuntino(m.type)));
  };

  return { handleItemsChange, handleLoadTemplate };
};

const DailyPlanPage = () => {
  const [date, setDate] = useState(getLocalDate);
  const [meals, setMeals] = useState<MealState[]>(DEFAULT_MEALS);
  const [showSpuntini, setShowSpuntini] = useState(false);
  const [planId, setPlanId] = useState<Id<'dailyPlans'> | null>(null);

  const baseMeals = meals.filter((m) => !isSpuntino(m.type));
  const activeMeals = buildActiveMeals(baseMeals, showSpuntini);
  const { macrosAchieved, macrosTarget, resolvedPlanId } = usePlanData(date);
  const { handleItemsChange, handleLoadTemplate } = usePlanHandlers(setMeals, setShowSpuntini);
  const effectivePlanId = resolvedPlanId ?? planId;

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Piano giornaliero</h1>
      <DatePicker date={date} onChange={setDate} />
      <div className="space-y-4">
        {activeMeals.map((meal) => (
          <MealBuilder
            key={meal.type}
            mealType={meal.type}
            items={meal.items}
            onItemsChange={(items) => handleItemsChange(meal.type, items)}
          />
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setShowSpuntini((v) => !v)}>
        {showSpuntini ? 'Rimuovi spuntini' : 'Aggiungi spuntini'}
      </Button>
      <OptimizeButton meals={activeMeals} date={date} onOptimized={setPlanId} />
      {macrosAchieved && macrosTarget && <PlanMacroSummary achieved={macrosAchieved} target={macrosTarget} />}
      <PlanTemplateBar meals={activeMeals} onLoadTemplate={handleLoadTemplate} planId={effectivePlanId} />
    </div>
  );
};

export default DailyPlanPage;
