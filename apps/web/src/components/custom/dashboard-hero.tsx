'use client';

type MacroSnapshot = {
  tdee: number;
  calorieTarget: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
};

type Props = {
  macros: MacroSnapshot;
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
  </section>
);

export default DashboardHero;
