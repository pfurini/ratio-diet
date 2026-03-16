// eslint-disable-next-line import/no-relative-parent-imports
import type { Id } from '../_generated/dataModel';

// --- Types for AI-generated plan shopping list ---

interface ShoppingEntry {
  foodId: Id<'foods'>;
  name: string;
  totalGrams: number;
  category: string;
}

interface FoodDocForShopping {
  _id: Id<'foods'>;
  name: string;
  category: string;
}

export const addFoodToShoppingMap = (
  food: FoodDocForShopping,
  grams: number,
  map: Map<string, ShoppingEntry>
): void => {
  const key = String(food._id);
  const existing = map.get(key);
  if (existing) {
    existing.totalGrams += grams;
  } else {
    map.set(key, { category: food.category, foodId: food._id, name: food.name, totalGrams: grams });
  }
};

export const buildShoppingListFromMap = (map: Map<string, ShoppingEntry>): ShoppingEntry[] => [...map.values()];

// --- Types for DB-stored plan shopping list ---

interface MealItem {
  foodId: string;
  quantityGrams: number;
}

interface Meal {
  type: string;
  items: MealItem[];
}

interface DailyPlan {
  meals: Meal[];
}

interface FoodDoc {
  _id: string;
  name: string;
  category: string;
}

interface ShoppingItem {
  foodId: string;
  name: string;
  totalGrams: number;
  category: string;
}

const accumulateMealItems = (meal: Meal, foodLookup: Map<string, FoodDoc>, map: Map<string, ShoppingItem>): void => {
  for (const item of meal.items) {
    const foodId = String(item.foodId);
    const food = foodLookup.get(foodId);
    if (!food) {
      continue;
    }

    const existing = map.get(foodId);
    if (existing) {
      existing.totalGrams += item.quantityGrams;
    } else {
      map.set(foodId, { category: food.category, foodId, name: food.name, totalGrams: item.quantityGrams });
    }
  }
};

const accumulateDailyPlan = (
  plan: DailyPlan,
  foodLookup: Map<string, FoodDoc>,
  map: Map<string, ShoppingItem>
): void => {
  for (const meal of plan.meals) {
    accumulateMealItems(meal, foodLookup, map);
  }
};

export const buildShoppingList = (
  dailyPlans: (DailyPlan | null)[],
  foodLookup: Map<string, FoodDoc>
): ShoppingItem[] => {
  const map = new Map<string, ShoppingItem>();

  for (const plan of dailyPlans) {
    if (!plan) {
      continue;
    }
    accumulateDailyPlan(plan, foodLookup, map);
  }

  return [...map.values()].map((i) => ({
    ...i,
    totalGrams: Math.round(i.totalGrams),
  }));
};
