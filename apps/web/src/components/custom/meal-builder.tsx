'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import type { MealType } from '@ratio-diet/backend/convex/schema';
import { Button } from '@ratio-diet/ui/components/button';
import { Input } from '@ratio-diet/ui/components/input';
import { useQuery } from 'convex/react';
import { useCallback, useState } from 'react';

import FoodName from './food-name';
import FoodSelector from './food-selector';

export type { MealType };

export interface MealItem {
  foodId: Id<'foods'>;
  constraintMin?: number;
  constraintMax?: number;
  quantityGrams?: number;
}

interface MealBuilderProps {
  mealType: MealType;
  items: MealItem[];
  onItemsChange: (items: MealItem[]) => void;
}

export const MEAL_LABELS: Record<MealType, string> = {
  cena: 'Cena',
  colazione: 'Colazione',
  pranzo: 'Pranzo',
  spuntino_mattina: 'Spuntino Mattina',
  spuntino_pomeriggio: 'Spuntino Pomeriggio',
};

const parseOptionalNum = (val: string): number | undefined => {
  const n = parseFloat(val);
  return Number.isNaN(n) ? undefined : n;
};

interface FoodItemRowProps {
  item: MealItem;
  index: number;
  onConstraintChange: (index: number, field: 'constraintMin' | 'constraintMax', val: string) => void;
  onRemove: (index: number) => void;
}

const FoodItemRow = ({ item, index, onConstraintChange, onRemove }: FoodItemRowProps) => {
  const food = useQuery(api.foods.getById, { foodId: item.foodId });

  return (
    <div className="bg-muted/50 flex flex-col gap-2 rounded-md p-2">
      <div className="flex items-center justify-between">
        {food ? (
          <FoodName
            name={food.name}
            source={food.source}
            className="text-sm font-medium"
          />
        ) : (
          <span className="text-muted-foreground text-sm" role="status" aria-live="polite" aria-busy="true">Caricamento...</span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          aria-label="Rimuovi alimento"
        >
          ✕
        </Button>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 space-y-0.5">
          <label className="text-muted-foreground text-xs" htmlFor={`min-${index}`}>
            Min (g)
          </label>
          <Input
            id={`min-${index}`}
            type="number"
            min="0"
            placeholder="—"
            value={item.constraintMin ?? ''}
            onChange={(e) => onConstraintChange(index, 'constraintMin', e.target.value)}
          />
        </div>
        <div className="flex-1 space-y-0.5">
          <label className="text-muted-foreground text-xs" htmlFor={`max-${index}`}>
            Max (g)
          </label>
          <Input
            id={`max-${index}`}
            type="number"
            min="0"
            placeholder="—"
            value={item.constraintMax ?? ''}
            onChange={(e) => onConstraintChange(index, 'constraintMax', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

const MealBuilder = ({ mealType, items, onItemsChange }: MealBuilderProps) => {
  const [selectorOpen, setSelectorOpen] = useState(false);

  const handleAdd = useCallback(
    (foodId: Id<'foods'>) => {
      onItemsChange([...items, { foodId }]);
    },
    [items, onItemsChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onItemsChange(items.filter((_, i) => i !== index));
    },
    [items, onItemsChange],
  );

  const handleConstraintChange = useCallback(
    (index: number, field: 'constraintMin' | 'constraintMax', val: string) => {
      const updated = items.map((item, i) => {
        if (i !== index) return item;
        return { ...item, [field]: parseOptionalNum(val) };
      });
      onItemsChange(updated);
    },
    [items, onItemsChange],
  );

  return (
    <section className="rounded-xl border p-4">
      <h3 className="mb-3 font-semibold">{MEAL_LABELS[mealType]}</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <FoodItemRow
            key={`${item.foodId}-${i}`}
            item={item}
            index={i}
            onConstraintChange={handleConstraintChange}
            onRemove={handleRemove}
          />
        ))}
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm">Nessun alimento aggiunto</p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={() => setSelectorOpen(true)}
      >
        Aggiungi alimento
      </Button>
      <FoodSelector
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        onSelect={handleAdd}
      />
    </section>
  );
};

export default MealBuilder;
