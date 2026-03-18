'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import { Button } from '@ratio-diet/ui/components/button';
import { useAction } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

interface WeeklyPlanGeneratorProps {
  onGenerated: (id: Id<'weeklyPlans'>) => void;
}

const WeeklyPlanGenerator = ({ onGenerated }: WeeklyPlanGeneratorProps) => {
  const generatePlan = useAction(api.weeklyPlans.generate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + daysToMonday);
      const weekStartDate = monday.toISOString().slice(0, 10);
      const planId = await generatePlan({ weekStartDate });
      onGenerated(planId as Id<'weeklyPlans'>);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore durante la generazione';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border p-6 space-y-4" aria-busy={loading}>
      <div>
        <h2 className="text-lg font-semibold">Genera piano settimanale</h2>
        <p className="text-sm text-muted-foreground mt-1">
          L&apos;AI creerà un piano alimentare personalizzato per la prossima settimana
          basato sul tuo profilo e sulle tue preferenze. Questo può richiedere 10-30 secondi.
        </p>
      </div>
      {error && (
        <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
          {error}
        </p>
      )}
      <Button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generazione in corso...
          </>
        ) : (
          'Genera piano settimanale'
        )}
      </Button>
      {loading && (
        <p className="text-xs text-center text-muted-foreground" role="status" aria-live="polite">
          L&apos;AI sta creando il tuo piano personalizzato, attendere prego...
        </p>
      )}
    </div>
  );
};

export default WeeklyPlanGenerator;
