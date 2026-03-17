'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import { Badge } from '@ratio-diet/ui/components/badge';
import { useQuery } from 'convex/react';

interface WeeklyPlanHistoryProps {
  onSelect: (id: Id<'weeklyPlans'>) => void;
  selectedId?: Id<'weeklyPlans'>;
}

type PlanStatus = 'generato' | 'modificato' | 'archiviato';

const STATUS_LABELS: Record<PlanStatus, string> = {
  archiviato: 'Archiviato',
  generato: 'Generato',
  modificato: 'Modificato',
};

const STATUS_VARIANTS: Record<PlanStatus, 'default' | 'secondary' | 'outline'> = {
  archiviato: 'outline',
  generato: 'default',
  modificato: 'secondary',
};

const formatWeekStart = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
};

interface PlanRowProps {
  plan: { _id: Id<'weeklyPlans'>; weekStartDate: string; status: string };
  isSelected: boolean;
  onSelect: (id: Id<'weeklyPlans'>) => void;
}

const PlanRow = ({ plan, isSelected, onSelect }: PlanRowProps) => {
  const status = plan.status as PlanStatus;
  const variant = STATUS_VARIANTS[status] ?? 'outline';
  const label = STATUS_LABELS[status] ?? plan.status;

  return (
    <button
      type="button"
      onClick={() => onSelect(plan._id)}
      className={`w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted ${
        isSelected ? 'bg-muted ring-1 ring-primary' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          Dal {formatWeekStart(plan.weekStartDate)}
        </span>
        <Badge variant={variant}>{label}</Badge>
      </div>
    </button>
  );
};

const WeeklyPlanHistory = ({ onSelect, selectedId }: WeeklyPlanHistoryProps) => {
  const plans = useQuery(api.weeklyPlans.list);

  if (plans === undefined) {
    return (
      <div className="text-sm text-muted-foreground py-2">Caricamento storico...</div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        Nessun piano settimanale generato.
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-2 text-base font-semibold">Piani precedenti</h2>
      <div className="space-y-1">
        {plans.map((plan) => (
          <PlanRow
            key={plan._id}
            plan={plan}
            isSelected={selectedId === plan._id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default WeeklyPlanHistory;
