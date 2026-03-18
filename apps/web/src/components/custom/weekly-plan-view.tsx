'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ratio-diet/ui/components/tabs';
import { useQuery } from 'convex/react';
import { AlertCircle, Printer } from 'lucide-react';

import { handlePrint } from '@/lib/print';

import DayView from './day-view';
import ShoppingList from './shopping-list';

interface WeeklyPlanViewProps {
  weeklyPlanId: Id<'weeklyPlans'>;
  canEdit: boolean;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const FULL_DAY_LABELS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const formatDate = (dateStr: string): string => {
  let date: Date;
  if (ISO_DATE_ONLY.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = new Date(dateStr);
  }
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
};

interface ReadOnlyBannerProps {
  show: boolean;
}

const ReadOnlyBanner = ({ show }: ReadOnlyBannerProps) => {
  if (!show) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <AlertCircle className="h-4 w-4 shrink-0" />
      Piano in sola lettura — riattiva l&apos;abbonamento per modificare
    </div>
  );
};

interface PlanHeaderProps {
  weekStartDate: string;
  status: string;
}

const PlanHeader = ({ weekStartDate, status }: PlanHeaderProps) => (
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-lg font-semibold">Piano settimanale</h2>
      <p className="text-xs text-muted-foreground">
        Settimana dal {formatDate(weekStartDate)} · {status}
      </p>
    </div>
    <button
      type="button"
      onClick={handlePrint}
      className="print:hidden flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      aria-label="Stampa piano"
    >
      <Printer className="h-3.5 w-3.5" />
      Stampa
    </button>
  </div>
);

type DailyPlanWithId = {
  _id: Id<'dailyPlans'>;
  date: string;
  meals: Array<{
    type: 'colazione' | 'pranzo' | 'cena' | 'spuntino_mattina' | 'spuntino_pomeriggio';
    items: Array<{ foodId: Id<'foods'>; quantityGrams: number }>;
  }>;
};

interface DayTabContentProps {
  dailyPlan: DailyPlanWithId;
  index: number;
  weeklyPlanId: Id<'weeklyPlans'>;
  canEdit: boolean;
}

const DayTabContent = ({ dailyPlan, index, weeklyPlanId, canEdit }: DayTabContentProps) => (
  <TabsContent value={`day-${index}`}>
    <div className="pt-3">
      <h3 className="mb-3 font-medium">
        {FULL_DAY_LABELS[index] ?? `Giorno ${index + 1}`} — {formatDate(dailyPlan.date)}
      </h3>
      <DayView
        dailyPlan={dailyPlan}
        weeklyPlanId={weeklyPlanId}
        canEdit={canEdit}
      />
    </div>
  </TabsContent>
);

interface ShoppingTabContentProps {
  shoppingList: Array<{ foodId: Id<'foods'>; name: string; totalGrams: number; category: string }>;
}

const ShoppingTabContent = ({ shoppingList }: ShoppingTabContentProps) => (
  <TabsContent value="shopping">
    <div className="pt-3">
      <ShoppingList shoppingList={shoppingList} />
    </div>
  </TabsContent>
);

const WeeklyPlanView = ({ weeklyPlanId, canEdit }: WeeklyPlanViewProps) => {
  const plan = useQuery(api.weeklyPlans.get, { weeklyPlanId });

  if (plan === undefined) {
    return (
      <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground" aria-busy="true">
        <p role="status" aria-live="polite">Caricamento piano...</p>
      </div>
    );
  }

  if (plan === null) {
    return (
      <div className="rounded-xl border p-6 text-center text-sm text-destructive">
        Piano non trovato.
      </div>
    );
  }

  const dailyPlans = (plan.dailyPlans ?? []) as DailyPlanWithId[];

  return (
    <div className="rounded-xl border p-4 space-y-4">
      <PlanHeader weekStartDate={plan.weekStartDate} status={plan.status} />
      <ReadOnlyBanner show={!canEdit} />
      <Tabs defaultValue={dailyPlans.length > 0 ? "day-0" : "shopping"}>
        <TabsList className="flex w-full overflow-x-auto">
          {dailyPlans.map((dp, i) => (
            <TabsTrigger key={dp._id} value={`day-${i}`} className="flex-1 min-w-fit">
              {DAY_LABELS[i]}
              <span className="ml-1 hidden text-[10px] text-muted-foreground sm:inline">
                {formatDate(dp.date)}
              </span>
            </TabsTrigger>
          ))}
          <TabsTrigger value="shopping" className="flex-1 min-w-fit">
            Spesa
          </TabsTrigger>
        </TabsList>
        {dailyPlans.map((dp, i) => (
          <DayTabContent
            key={dp._id}
            dailyPlan={dp}
            index={i}
            weeklyPlanId={weeklyPlanId}
            canEdit={canEdit}
          />
        ))}
        <ShoppingTabContent shoppingList={plan.shoppingList ?? []} />
      </Tabs>
    </div>
  );
};

export default WeeklyPlanView;
