'use client';

import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';

import MealItemRow from './meal-item-row';

type MealType = 'colazione' | 'pranzo' | 'cena' | 'spuntino_mattina' | 'spuntino_pomeriggio';

interface MealItem {
  foodId: Id<'foods'>;
  quantityGrams: number;
}

interface Meal {
  type: MealType;
  items: MealItem[];
}

interface DailyPlan {
  _id: Id<'dailyPlans'>;
  date: string;
  meals: Meal[];
}

interface DayViewProps {
  dailyPlan: DailyPlan;
  weeklyPlanId: Id<'weeklyPlans'>;
  canEdit: boolean;
}

const MEAL_LABELS: Record<MealType, string> = {
  cena: 'Cena',
  colazione: 'Colazione',
  pranzo: 'Pranzo',
  spuntino_mattina: 'Spuntino mattina',
  spuntino_pomeriggio: 'Spuntino pomeriggio',
};

const MEAL_ORDER: MealType[] = ['colazione', 'spuntino_mattina', 'pranzo', 'spuntino_pomeriggio', 'cena'];

interface MealSectionProps {
  meal: Meal;
  dailyPlanId: Id<'dailyPlans'>;
  weeklyPlanId: Id<'weeklyPlans'>;
  canEdit: boolean;
}

const MealSection = ({ meal, dailyPlanId, weeklyPlanId, canEdit }: MealSectionProps) => {
  if (meal.items.length === 0) {
    return null;
  }

  return (
    <div className="mb-3">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {MEAL_LABELS[meal.type]}
      </h4>
      <div className="divide-y divide-border rounded-md border px-3">
        {meal.items.map((item) => (
          <MealItemRow
            key={item.foodId}
            foodId={item.foodId}
            quantityGrams={item.quantityGrams}
            canEdit={canEdit}
            weeklyPlanId={weeklyPlanId}
            dailyPlanId={dailyPlanId}
            mealType={meal.type}
          />
        ))}
      </div>
    </div>
  );
};

const getSortedMeals = (meals: Meal[]): Meal[] =>
  [...meals].sort((a, b) => MEAL_ORDER.indexOf(a.type) - MEAL_ORDER.indexOf(b.type));

const DayView = ({ dailyPlan, weeklyPlanId, canEdit }: DayViewProps) => {
  const sortedMeals = getSortedMeals(dailyPlan.meals);
  const hasContent = sortedMeals.some((m) => m.items.length > 0);

  if (!hasContent) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Nessun pasto pianificato per questo giorno.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {sortedMeals.map((meal) => (
        <MealSection
          key={meal.type}
          meal={meal}
          dailyPlanId={dailyPlan._id}
          weeklyPlanId={weeklyPlanId}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
};

export default DayView;
