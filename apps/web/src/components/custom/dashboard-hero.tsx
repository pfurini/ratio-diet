'use client';

import type { MacroTarget } from '@/types/macros';

type Props = {
  macros: MacroTarget;
};

const MacroColumn = ({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) => (
  <div className="text-center">
    <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
    <p className="text-lg font-bold">
      {Math.round(value)}
      <span className="text-muted-foreground text-sm font-normal"> {unit}</span>
    </p>
  </div>
);

const DashboardHero = ({ macros }: Props) => (
  <section className="mb-8 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 p-6 text-center">
    <p className="text-muted-foreground mb-1 text-sm">Obiettivo calorico giornaliero</p>
    <p className="text-5xl font-bold">{Math.round(macros.calorieTarget)}</p>
    <p className="text-muted-foreground mb-6 text-sm">kcal</p>

    <div className="grid grid-cols-3 gap-4 border-t pt-4">
      <MacroColumn label="Proteine" value={macros.proteinGrams} unit="g" />
      <MacroColumn label="Carboidrati" value={macros.carbGrams} unit="g" />
      <MacroColumn label="Grassi" value={macros.fatGrams} unit="g" />
    </div>

    <p className="text-muted-foreground mt-4 text-xs">
      TDEE stimato: {Math.round(macros.tdee)} kcal/giorno
    </p>
    <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
      Il tuo fabbisogno giornaliero è calcolato con la formula Mifflin-St Jeor
      in base ai tuoi dati e obiettivo.
    </p>
  </section>
);

export default DashboardHero;
