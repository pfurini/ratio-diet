'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import { Button } from '@ratio-diet/ui/components/button';
import { Input } from '@ratio-diet/ui/components/input';
import { Label } from '@ratio-diet/ui/components/label';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';

type FoodType = 'animale' | 'vegetale';

interface CustomFoodFormState {
  name: string;
  category: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  foodType: FoodType;
}

const initialState: CustomFoodFormState = {
  carbs: '',
  category: '',
  fat: '',
  foodType: 'vegetale',
  kcal: '',
  name: '',
  protein: '',
};

const parseNum = (val: string): number => parseFloat(val) || 0;

interface CustomFoodFormProps {
  onAdded: () => void;
}

const CustomFoodForm = ({ onAdded }: CustomFoodFormProps) => {
  const [form, setForm] = useState<CustomFoodFormState>(initialState);
  const addCustomFood = useMutation(api.foods.addCustomFood);
  const customCount = useQuery(api.foods.getCustomFoodCount);

  const setField = (field: keyof CustomFoodFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await addCustomFood({
        allergenTags: [],
        carbPer100g: parseNum(form.carbs),
        category: form.category,
        fatPer100g: parseNum(form.fat),
        foodType: form.foodType,
        kcalPer100g: parseNum(form.kcal),
        name: form.name,
        proteinPer100g: parseNum(form.protein),
      });
      setForm(initialState);
      onAdded();
    } catch {
      setError('Impossibile aggiungere alimento');
    }
  };

  const toggleFoodType = () => {
    setForm((prev) => ({ ...prev, foodType: prev.foodType === 'animale' ? 'vegetale' : 'animale' }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
      <p className="text-sm font-medium">Aggiungi alimento personalizzato</p>
      {customCount && (
        <p className="text-muted-foreground text-xs">
          {customCount.count}/{customCount.limit} alimenti personalizzati
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label htmlFor="cf-name">Nome</Label>
          <Input
            id="cf-name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            required
            placeholder="Es. Petto di pollo"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cf-category">Categoria</Label>
          <Input
            id="cf-category"
            value={form.category}
            onChange={(e) => setField('category', e.target.value)}
            required
            placeholder="Es. carni"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cf-kcal">Kcal/100g</Label>
          <Input
            id="cf-kcal"
            type="number"
            min="0"
            value={form.kcal}
            onChange={(e) => setField('kcal', e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cf-protein">Proteine/100g</Label>
          <Input
            id="cf-protein"
            type="number"
            min="0"
            value={form.protein}
            onChange={(e) => setField('protein', e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cf-carbs">Carboidrati/100g</Label>
          <Input
            id="cf-carbs"
            type="number"
            min="0"
            value={form.carbs}
            onChange={(e) => setField('carbs', e.target.value)}
            required
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor="cf-fat">Grassi/100g</Label>
          <Input
            id="cf-fat"
            type="number"
            min="0"
            value={form.fat}
            onChange={(e) => setField('fat', e.target.value)}
            required
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={toggleFoodType}>
          {form.foodType === 'animale' ? 'Animale' : 'Vegetale'}
        </Button>
        <span className="text-muted-foreground text-xs">Tipo alimento</span>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <Button type="submit" size="sm" className="w-full">
        Aggiungi alimento
      </Button>
    </form>
  );
};

export default CustomFoodForm;
