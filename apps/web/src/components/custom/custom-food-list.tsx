'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import { Button } from '@ratio-diet/ui/components/button';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';

import FoodName from './food-name';

interface CustomFood {
  _id: Id<'foods'>;
  name: string;
  source: 'crea' | 'custom';
  kcalPer100g: number;
}

const isCustomFood = (food: { source?: string }): food is CustomFood =>
  food.source === 'custom';

const CustomFoodRow = ({
  food,
  onDelete,
}: {
  food: CustomFood;
  onDelete: (id: Id<'foods'>) => Promise<void>;
}) => {
  const handleDelete = async () => {
    await onDelete(food._id);
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
        aria-label={`Elimina ${food.name}`}
      >
        Elimina
      </Button>
    </div>
  );
};

const CustomFoodList = () => {
  const allFoods = useQuery(api.foods.search, {});
  const customCount = useQuery(api.foods.getCustomFoodCount);
  const deleteCustomFood = useMutation(api.foods.deleteCustomFood);

  const customFoods = allFoods?.filter(isCustomFood) ?? [];

  const handleDelete = async (foodId: Id<'foods'>) => {
    try {
      await deleteCustomFood({ foodId });
      toast.success('Alimento eliminato');
    } catch {
      toast.error('Errore durante l\'eliminazione dell\'alimento.');
    }
  };

  if (allFoods === undefined) {
    return <p className="text-muted-foreground text-sm">Caricamento...</p>;
  }

  return (
    <div className="space-y-3">
      {customCount && (
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
