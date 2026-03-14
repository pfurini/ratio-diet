'use client';

import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import { Button } from '@ratio-diet/ui/components/button';
import { Printer } from 'lucide-react';

interface ShoppingItem {
  foodId: Id<'foods'>;
  name: string;
  totalGrams: number;
  category: string;
}

interface ShoppingListProps {
  shoppingList: ShoppingItem[];
}

const groupByCategory = (items: ShoppingItem[]): Record<string, ShoppingItem[]> => {
  const groups: Record<string, ShoppingItem[]> = {};
  for (const item of items) {
    const cat = item.category || 'Altro';
    if (!groups[cat]) {
      groups[cat] = [];
    }
    groups[cat].push(item);
  }
  return groups;
};

interface CategorySectionProps {
  category: string;
  items: ShoppingItem[];
}

const CategorySection = ({ category, items }: CategorySectionProps) => (
  <div className="mb-4 print:mb-3">
    <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {category}
    </h3>
    <ul className="space-y-1">
      {items.map((item) => (
        <li
          key={item.foodId}
          className="flex items-center justify-between rounded-md px-3 py-1.5 odd:bg-muted/40 print:px-0"
        >
          <span className="text-sm">{item.name}</span>
          <span className="text-sm font-medium tabular-nums">
            {Math.round(item.totalGrams)} g
          </span>
        </li>
      ))}
    </ul>
  </div>
);

const handlePrint = () => {
  window.print();
};

const ShoppingList = ({ shoppingList }: ShoppingListProps) => {
  const grouped = groupByCategory(shoppingList);
  const categories = Object.keys(grouped).sort();

  if (shoppingList.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-4">
        Nessun elemento nella lista della spesa.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h2 className="text-lg font-semibold">Lista della spesa</h2>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="mr-1.5 h-4 w-4" />
          Stampa
        </Button>
      </div>
      <div className="print:m-0">
        {categories.map((cat) => (
          <CategorySection key={cat} category={cat} items={grouped[cat] ?? []} />
        ))}
      </div>
    </div>
  );
};

export default ShoppingList;
