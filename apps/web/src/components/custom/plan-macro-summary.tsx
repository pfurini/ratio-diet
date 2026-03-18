'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import { useQuery } from 'convex/react';

import MacroProgressBar from './macro-progress-bar';
import type { MacroSummary } from '@/types/macros';

interface PlanMacroSummaryProps {
  achieved: MacroSummary;
  target: MacroSummary;
}

const GAP_THRESHOLD = 0.15;

const computeMacroGaps = (achieved: MacroSummary, target: MacroSummary) => [
  {
    gap: target.proteinGrams > 0
      ? Math.abs(achieved.proteinGrams - target.proteinGrams) / target.proteinGrams
      : 0,
    macro: 'protein' as const,
  },
  {
    gap: target.carbGrams > 0
      ? Math.abs(achieved.carbGrams - target.carbGrams) / target.carbGrams
      : 0,
    macro: 'carb' as const,
  },
  {
    gap: target.fatGrams > 0
      ? Math.abs(achieved.fatGrams - target.fatGrams) / target.fatGrams
      : 0,
    macro: 'fat' as const,
  },
];

const hasBigGap = (achieved: MacroSummary, target: MacroSummary): boolean => {
  const gaps = computeMacroGaps(achieved, target);
  const proteinGap = gaps.find(({ macro }) => macro === 'protein')?.gap ?? 0;
  const carbGap = gaps.find(({ macro }) => macro === 'carb')?.gap ?? 0;
  const fatGap = gaps.find(({ macro }) => macro === 'fat')?.gap ?? 0;
  return proteinGap > GAP_THRESHOLD || carbGap > GAP_THRESHOLD || fatGap > GAP_THRESHOLD;
};

const findGapMacro = (
  achieved: MacroSummary,
  target: MacroSummary,
): 'protein' | 'carb' | 'fat' => {
  const gaps = computeMacroGaps(achieved, target);
  return gaps.toSorted((a, b) => b.gap - a.gap)[0]?.macro ?? 'protein';
};

const MACRO_LABEL: Record<'protein' | 'carb' | 'fat', string> = {
  carb: 'carboidrati',
  fat: 'grassi',
  protein: 'proteine',
};

interface GapWarningProps {
  macro: 'protein' | 'carb' | 'fat';
}

const GapWarning = ({ macro }: GapWarningProps) => {
  const queryResult = useQuery(api.foods.suggestForMacro, { macro, limit: 3 });
  const isLoading = queryResult === undefined;
  const suggestions = queryResult ?? [];

  return (
    <div className="rounded-lg border border-yellow-400 bg-yellow-50 p-3 dark:bg-yellow-950">
      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
        Divario elevato su {MACRO_LABEL[macro]}
      </p>
      {isLoading && (
        <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">Loading...</p>
      )}
      {suggestions && suggestions.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {suggestions.map((food: { _id: string; name: string }) => (
            <li key={food._id} className="text-xs text-yellow-700 dark:text-yellow-300">
              {food.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const PlanMacroSummary = ({ achieved, target }: PlanMacroSummaryProps) => {
  const showWarning = hasBigGap(achieved, target);
  const gapMacro = showWarning ? findGapMacro(achieved, target) : null;

  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">Macronutrienti</h2>
      <MacroProgressBar
        label="Calorie"
        current={achieved.calories}
        target={target.calories}
        unit="kcal"
      />
      <MacroProgressBar
        label="Proteine"
        current={achieved.proteinGrams}
        target={target.proteinGrams}
      />
      <MacroProgressBar
        label="Carboidrati"
        current={achieved.carbGrams}
        target={target.carbGrams}
      />
      <MacroProgressBar
        label="Grassi"
        current={achieved.fatGrams}
        target={target.fatGrams}
      />
      {gapMacro && <GapWarning macro={gapMacro} />}
    </section>
  );
};

export default PlanMacroSummary;
