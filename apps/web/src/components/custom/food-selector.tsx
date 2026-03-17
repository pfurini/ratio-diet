'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import { Button } from '@ratio-diet/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@ratio-diet/ui/components/dialog';
import { Input } from '@ratio-diet/ui/components/input';
import { useQuery } from 'convex/react';
import { useState } from 'react';

import CustomFoodForm from './custom-food-form';
import FoodName from './food-name';

interface FoodSelectorProps {
  onSelect: (foodId: Id<'foods'>) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FoodRowProps {
  food: {
    _id: Id<'foods'>;
    name: string;
    source: 'crea' | 'custom';
    category: string;
    kcalPer100g: number;
    proteinPer100g: number;
    carbPer100g: number;
    fatPer100g: number;
  };
  onSelect: (id: Id<'foods'>) => void;
}

const FoodRow = ({ food, onSelect }: FoodRowProps) => (
  <button
    type="button"
    className="hover:bg-muted w-full rounded-md px-3 py-2 text-left transition-colors"
    onClick={() => onSelect(food._id)}
  >
    <div className="flex items-center justify-between">
      <FoodName name={food.name} source={food.source} className="text-sm font-medium" />
      <span className="text-muted-foreground text-xs">{Math.round(food.kcalPer100g)} kcal</span>
    </div>
    <div className="text-muted-foreground mt-0.5 text-xs">
      {food.category} · P: {Math.round(food.proteinPer100g)}g · C: {Math.round(food.carbPer100g)}g
      · F: {Math.round(food.fatPer100g)}g
    </div>
  </button>
);

interface CategoryFilterProps {
  categories: string[];
  selected: string | undefined;
  onSelect: (cat: string | undefined) => void;
}

const CategoryFilter = ({ categories, selected, onSelect }: CategoryFilterProps) => (
  <div className="flex flex-wrap gap-1">
    <Button
      type="button"
      variant={selected === undefined ? 'default' : 'outline'}
      size="sm"
      onClick={() => onSelect(undefined)}
    >
      Tutti
    </Button>
    {categories.map((cat) => (
      <Button
        key={cat}
        type="button"
        variant={selected === cat ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSelect(cat)}
      >
        {cat}
      </Button>
    ))}
  </div>
);

const FoodSelector = ({ onSelect, open, onOpenChange }: FoodSelectorProps) => {
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  const foods = useQuery(api.foods.search, { category, term: term || undefined });
  const categories = useQuery(api.foods.getCategories);

  const handleSelect = (foodId: Id<'foods'>) => {
    onSelect(foodId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Seleziona alimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Cerca alimento..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          {categories && (
            <CategoryFilter
              categories={categories}
              selected={category}
              onSelect={setCategory}
            />
          )}
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {foods?.map((food) => (
              <FoodRow
                key={food._id}
                food={food}
                onSelect={handleSelect}
              />
            ))}
            {foods?.length === 0 && (
              <p className="text-muted-foreground py-4 text-center text-sm">
                Nessun alimento trovato
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Nascondi form' : 'Aggiungi alimento personalizzato'}
          </Button>
          {showForm && <CustomFoodForm onAdded={() => setShowForm(false)} />}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FoodSelector;
