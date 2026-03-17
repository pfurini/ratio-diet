'use client';

type MacroSnapshot = {
  achievedCalories?: number;
  tdee?: number;
  calorieTarget?: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
};

type DailyPlan = {
  macrosAchieved: MacroSnapshot;
  macrosTarget: MacroSnapshot;
};

type Props = {
  macros: MacroSnapshot;
  plan: DailyPlan | null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const ProgressBar = ({
  label,
  achieved,
  target,
  unit,
  colorClass,
}: {
  label: string;
  achieved: number;
  target: number;
  unit: string;
  colorClass: string;
}) => {
  const pct = target > 0 ? clamp((achieved / target) * 100, 0, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {Math.round(achieved)} / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const EmptyState = () => (
  <div className="rounded-xl border border-dashed p-6 text-center">
    <p className="text-muted-foreground text-sm">Nessun piano per oggi</p>
    <p className="text-muted-foreground mt-1 text-xs">
      Pianifica la tua giornata per tenere traccia dei macronutrienti.
    </p>
  </div>
);

const DashboardProgress = ({ macros, plan }: Props) => {
  if (!plan) return <EmptyState />;

  const { macrosAchieved, macrosTarget } = plan;

  return (
    <section className="mb-6 space-y-4 rounded-xl border p-4">
      <h2 className="font-semibold">Progresso di oggi</h2>
      <ProgressBar
        label="Calorie"
        achieved={macrosAchieved.achievedCalories ?? 0}
        target={(macrosTarget.calorieTarget ?? macros.calorieTarget) ?? 0}
        unit="kcal"
        colorClass="bg-orange-400"
      />
      <ProgressBar
        label="Proteine"
        achieved={macrosAchieved.proteinGrams}
        target={macrosTarget.proteinGrams ?? macros.proteinGrams}
        unit="g"
        colorClass="bg-blue-500"
      />
      <ProgressBar
        label="Carboidrati"
        achieved={macrosAchieved.carbGrams}
        target={macrosTarget.carbGrams ?? macros.carbGrams}
        unit="g"
        colorClass="bg-yellow-400"
      />
      <ProgressBar
        label="Grassi"
        achieved={macrosAchieved.fatGrams}
        target={macrosTarget.fatGrams ?? macros.fatGrams}
        unit="g"
        colorClass="bg-green-500"
      />
    </section>
  );
};

export default DashboardProgress;
