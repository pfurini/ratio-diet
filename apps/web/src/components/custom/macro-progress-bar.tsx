'use client';

interface MacroProgressBarProps {
  label: string;
  current: number;
  target: number;
  unit?: string;
}

const clampPct = (current: number, target: number): number => {
  if (target <= 0) return 0;
  return Math.min((current / target) * 100, 100);
};

const isOver = (current: number, target: number): boolean => current > target;

const MacroProgressBar = ({ label, current, target, unit = 'g' }: MacroProgressBarProps) => {
  const pct = clampPct(current, target);
  const over = isOver(current, target);
  const textClass = over ? 'text-destructive' : 'text-muted-foreground';
  const barClass = over ? 'bg-destructive' : 'bg-primary';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={textClass}>
          {Math.round(current)} / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default MacroProgressBar;
