'use client';

import { BadgeCheck } from 'lucide-react';

interface FoodNameProps {
  name: string;
  source: 'crea' | 'custom';
  className?: string;
}

const FoodName = ({ name, source, className }: FoodNameProps) => (
  <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
    {name}
    {source === 'crea' && (
      <BadgeCheck className="text-primary h-4 w-4 shrink-0" aria-label="Verificato CREA" />
    )}
  </span>
);

export default FoodName;
