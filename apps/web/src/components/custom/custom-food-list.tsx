'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import { Button } from '@ratio-diet/ui/components/button';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { toast } from 'sonner';

import FoodName from './food-name';

interface CustomFood {
  _id: Id<'foods'>;
  name: string;
  source: 'crea' | 'custom';
  kcalPer100g: number;
}

function isCustomFood(food: unknown): food is CustomFood {
  if (typeof food !== 'object' || food === null) return false;
  const o = food as Record<string, unknown>;
  return (
    o.source === 'custom' &&
    typeof o._id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.kcalPer100g === 'number'
  );
}

const CustomFoodRow = ({
  food,
  onDelete,
}: {
  food: CustomFood;
  onDelete: (id: Id<'foods'>) => Promise<void>;
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(food._id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
      <div>
        <FoodName name={food.name} source={food.source} />
        <p className="text-muted-foreground text-xs">{food.kcalPer100g} kcal/100g</p>
      </div>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label={`Elimina ${food.name}`}
      >
        {isDeleting ? 'Eliminazione...' : 'Elimina'}
      </Button>
    </div>
  );
};

const CustomFoodList = () => {
  const customFoodsResult = useQuery(api.foods.listCustom);
  const customCount = useQuery(api.foods.getCustomFoodCount);
  const deleteCustomFood = useMutation(api.foods.deleteCustomFood);

  const customFoods = customFoodsResult?.filter(isCustomFood) ?? [];

  const handleDelete = async (foodId: Id<'foods'>) => {
    try {
      await deleteCustomFood({ foodId });
      toast.success('Alimento eliminato');
    } catch {
      toast.error('Errore durante l\'eliminazione dell\'alimento.');
    }
  };

  if (customFoodsResult === undefined) {
    return (
      <p className="text-muted-foreground text-sm" role="status" aria-live="polite" aria-busy="true">
        Caricamento...
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {customCount && customCount.limit !== undefined && (
        <p className="text-muted-foreground text-xs">
          {customCount.count}/{customCount.limit} alimenti personalizzati
        </p>
      )}
      {customFoods.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nessun alimento personalizzato.</p>
      ) : (
        <div className="space-y-2">
          {customFoods.map((food) => (
            <CustomFoodRow key={food._id} food={food} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomFoodList;
