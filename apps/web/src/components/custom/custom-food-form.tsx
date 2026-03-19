'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { FoodCategory, FoodType } from '@ratio-diet/backend/convex/lib/validators';
import { Button } from '@ratio-diet/ui/components/button';
import { Input } from '@ratio-diet/ui/components/input';
import { Label } from '@ratio-diet/ui/components/label';
import { NativeSelect, NativeSelectOption } from '@ratio-diet/ui/components/native-select';
import { ToggleGroup, ToggleGroupItem } from '@ratio-diet/ui/components/toggle-group';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';

import { FOOD_CATEGORY_OPTIONS } from '@/lib/profile-options';

interface CustomFoodFormState {
  name: string;
  category: FoodCategory | '';
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

const parseNum = (val: string): number => {
  const n = parseFloat(val);
  return Number.isNaN(n) ? Number.NaN : n;
};

interface CustomFoodFormProps {
  onAdded: () => void;
}

const CustomFoodForm = ({ onAdded }: CustomFoodFormProps) => {
  const [form, setForm] = useState<CustomFoodFormState>(initialState);
  const addCustomFood = useMutation(api.foods.addCustomFood);
  const customCount = useQuery(api.foods.getCustomFoodCount);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const setField = (field: keyof CustomFoodFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }
    setError('');
    const kcal = parseNum(form.kcal);
    const protein = parseNum(form.protein);
    const carbs = parseNum(form.carbs);
    const fat = parseNum(form.fat);
    if ([kcal, protein, carbs, fat].some(Number.isNaN)) {
      setError('Inserisci valori numerici validi per i macronutrienti');
      return;
    }
    if (!form.category) {
      setError('Seleziona una categoria');
      return;
    }
    const category = form.category as FoodCategory;
    setIsSubmitting(true);
    try {
      await addCustomFood({
        allergenTags: [],
        carbPer100g: carbs,
        category,
        fatPer100g: fat,
        foodType: form.foodType,
        kcalPer100g: kcal,
        name: form.name,
        proteinPer100g: protein,
      });
      setForm(initialState);
      onAdded();
    } catch {
      setError('Impossibile aggiungere alimento');
    } finally {
      setIsSubmitting(false);
    }
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
          <NativeSelect
            id="cf-category"
            value={form.category}
            onChange={(e) => setField('category', e.target.value as FoodCategory)}
            required
          >
            <NativeSelectOption value="">Seleziona categoria</NativeSelectOption>
            {FOOD_CATEGORY_OPTIONS.map((opt) => (
              <NativeSelectOption key={opt.value} value={opt.value}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
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
      <div className="space-y-1">
        <Label>Tipo alimento</Label>
        <ToggleGroup
          variant="outline"
          value={[form.foodType]}
          onValueChange={(val: string[]) => {
            const last = val[val.length - 1] as FoodType | undefined;
            if (last) setField('foodType', last);
          }}
        >
          <ToggleGroupItem value="animale" aria-label="Animale">Animale</ToggleGroupItem>
          <ToggleGroupItem value="vegetale" aria-label="Vegetale">Vegetale</ToggleGroupItem>
          <ToggleGroupItem value="ittico" aria-label="Ittico">Ittico</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      {customCount != null && customCount.count >= customCount.limit && (
        <p className="text-muted-foreground text-xs">Limite raggiunto</p>
      )}
      <Button
        type="submit"
        size="sm"
        className="w-full"
        disabled={isSubmitting || (customCount != null && customCount.count >= customCount.limit)}
      >
        Aggiungi alimento
      </Button>
    </form>
  );
};

export default CustomFoodForm;
