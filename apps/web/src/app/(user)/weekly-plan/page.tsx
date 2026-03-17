'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import { Button } from '@ratio-diet/ui/components/button';
import { useAction, useQuery } from 'convex/react';
import { useState } from 'react';

import WeeklyPlanGenerator from '@/components/custom/weekly-plan-generator';
import WeeklyPlanHistory from '@/components/custom/weekly-plan-history';
import WeeklyPlanView from '@/components/custom/weekly-plan-view';

const getCheckoutErrorMessage = (checkoutError: unknown): string =>
  checkoutError instanceof Error ? checkoutError.message : 'Errore durante il pagamento';

const useCheckoutRedirect = () => {
  const createSession = useAction(api.subscriptions.createCheckoutSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await createSession({});
      if (result?.url) {
        // Keep loading state during navigation.
        window.location.href = result.url;
        return;
      }
      setError('Impossibile avviare il pagamento. Riprova.');
    } catch (checkoutError) {
      setError(getCheckoutErrorMessage(checkoutError));
    }
    setLoading(false);
  };

  return { error, handleCheckout, loading };
};

const UpgradePrompt = () => {
  const { error, handleCheckout, loading } = useCheckoutRedirect();

  return (
    <div className="rounded-xl border p-8 text-center space-y-4">
      <div>
        <h2 className="text-xl font-bold">Abbonati a Ratio Diet Premium</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Genera piani settimanali personalizzati con l&apos;AI, lista della spesa inclusa.
        </p>
        <p className="mt-3 text-2xl font-semibold">
          €4,99<span className="text-base font-normal text-muted-foreground">/mese</span>
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={handleCheckout} disabled={loading} className="w-full max-w-xs">
        {loading ? 'Reindirizzamento...' : 'Inizia ora'}
      </Button>
    </div>
  );
};

interface ActiveViewProps {
  selectedPlanId: Id<'weeklyPlans'> | null;
  onSelect: (id: Id<'weeklyPlans'>) => void;
  onGenerated: (id: Id<'weeklyPlans'>) => void;
}

const ActiveView = ({ selectedPlanId, onSelect, onGenerated }: ActiveViewProps) => (
  <div className="space-y-6">
    <WeeklyPlanGenerator onGenerated={onGenerated} />
    <WeeklyPlanHistory onSelect={onSelect} selectedId={selectedPlanId ?? undefined} />
    {selectedPlanId && <WeeklyPlanView weeklyPlanId={selectedPlanId} canEdit={true} />}
  </div>
);

interface InactiveViewProps {
  selectedPlanId: Id<'weeklyPlans'> | null;
  onSelect: (id: Id<'weeklyPlans'>) => void;
}

const InactiveView = ({ selectedPlanId, onSelect }: InactiveViewProps) => (
  <div className="space-y-6">
    <WeeklyPlanHistory onSelect={onSelect} selectedId={selectedPlanId ?? undefined} />
    {selectedPlanId && <WeeklyPlanView weeklyPlanId={selectedPlanId} canEdit={false} />}
  </div>
);

const WeeklyPlanPage = () => {
  const subscriptionStatus = useQuery(api.subscriptions.getStatus);
  const [selectedPlanId, setSelectedPlanId] = useState<Id<'weeklyPlans'> | null>(null);

  const handleGenerated = (id: Id<'weeklyPlans'>) => {
    setSelectedPlanId(id);
  };

  if (subscriptionStatus === undefined) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <p className="text-center text-muted-foreground text-sm">Caricamento...</p>
      </div>
    );
  }

  const isActive = subscriptionStatus?.status === 'active';
  const hasSubscription = subscriptionStatus !== null;

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Piano settimanale</h1>
      {(!hasSubscription || (hasSubscription && !isActive)) && <UpgradePrompt />}
      {hasSubscription && isActive && (
        <ActiveView selectedPlanId={selectedPlanId} onSelect={setSelectedPlanId} onGenerated={handleGenerated} />
      )}
      {hasSubscription && !isActive && <InactiveView selectedPlanId={selectedPlanId} onSelect={setSelectedPlanId} />}
    </div>
  );
};

export default WeeklyPlanPage;
