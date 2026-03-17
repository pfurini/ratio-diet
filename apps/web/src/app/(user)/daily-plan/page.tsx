'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import { Button } from '@ratio-diet/ui/components/button';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { toast } from 'sonner';

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

const MEAL_ORDER: MealType[] = ['colazione', 'pranzo', 'cena', 'spuntino_mattina', 'spuntino_pomeriggio'];

interface MacroSnapshot {
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  calorieTarget: number;
  tdee: number;
  achievedCalories?: number;
  calories?: number;
  caloriesConsumed?: number;
  caloriesAchieved?: number;
  kcal?: number;
}

const isSpuntino = (type: MealType) => type === 'spuntino_mattina' || type === 'spuntino_pomeriggio';

const toEmptyMeal = (type: MealType): MealState => ({ items: [], type });

const DEFAULT_MEALS: MealState[] = MEAL_ORDER.map(toEmptyMeal);

const normalizeMeals = (meals: MealState[]): MealState[] => {
  const byType = new Map(meals.map((meal) => [meal.type, meal]));
  return MEAL_ORDER.map((type) => byType.get(type) ?? toEmptyMeal(type));
};

const getVisibleMeals = (meals: MealState[], showSpuntini: boolean): MealState[] =>
  meals.filter((meal) => showSpuntini || !isSpuntino(meal.type));

const updateMealItems = (meals: MealState[], mealType: MealType, items: MealItem[]): MealState[] =>
  meals.map((m) => (m.type === mealType ? { ...m, items } : m));

const getAchievedCalories = (macrosAchieved: MacroSnapshot): number =>
  macrosAchieved.achievedCalories ??
  macrosAchieved.calories ??
  macrosAchieved.caloriesConsumed ??
  macrosAchieved.caloriesAchieved ??
  macrosAchieved.kcal ??
  0;

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
    try {
      const id = await optimize({ date, meals });
      onOptimized(id);
    } catch (error) {
      console.error('Optimize failed:', error);
      toast.error('Errore durante il calcolo delle quantità. Riprova.');
    } finally {
      setLoading(false);
    }
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
    setMeals(normalizeMeals(loaded));
    setShowSpuntini(loaded.some((m) => isSpuntino(m.type)));
  };

  return { handleItemsChange, handleLoadTemplate };
};

interface OptimizedPlanRef {
  id: Id<'dailyPlans'>;
  date: string;
}

const DailyPlanPage = () => {
  const [date, setDate] = useState(getLocalDate);
  const [meals, setMeals] = useState<MealState[]>(DEFAULT_MEALS);
  const [showSpuntini, setShowSpuntini] = useState(false);
  const [optimizedPlan, setOptimizedPlan] = useState<OptimizedPlanRef | null>(null);

  const visibleMeals = getVisibleMeals(meals, showSpuntini);
  const { macrosAchieved, macrosTarget, resolvedPlanId } = usePlanData(date);
  const { handleItemsChange, handleLoadTemplate } = usePlanHandlers(setMeals, setShowSpuntini);
  const effectivePlanId = resolvedPlanId ?? (optimizedPlan?.date === date ? optimizedPlan.id : null);

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Piano giornaliero</h1>
      <DatePicker date={date} onChange={setDate} />
      <div className="space-y-4">
        {visibleMeals.map((meal) => (
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
      <OptimizeButton meals={visibleMeals} date={date} onOptimized={(id) => setOptimizedPlan({ date, id })} />
      {macrosAchieved && macrosTarget && (
        <PlanMacroSummary
          achieved={{ ...macrosAchieved, calories: getAchievedCalories(macrosAchieved) }}
          target={{ ...macrosTarget, calories: macrosTarget.calorieTarget }}
        />
      )}
      <PlanTemplateBar meals={visibleMeals} onLoadTemplate={handleLoadTemplate} planId={effectivePlanId} />
    </div>
  );
};

export default DailyPlanPage;
