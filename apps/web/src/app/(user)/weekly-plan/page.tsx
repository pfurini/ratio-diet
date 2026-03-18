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

const DUPLICATE_SUBSCRIPTION_MESSAGE =
  'Hai gia un abbonamento attivo o in prova per questo piano. Apri il Portale Cliente per gestirlo.';
const PORTAL_OPEN_ERROR_MESSAGE = 'Impossibile aprire il portale.';
const PORTAL_OPEN_UNEXPECTED_ERROR_MESSAGE = "Errore durante l'apertura del portale.";

const useCheckoutRedirect = () => {
  const createSession = useAction(api.subscriptions.createCheckoutSession);
  const createPortalSession = useAction(api.subscriptions.createPortalSession);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    setError(null);
    try {
      const result = await createSession({});
      if (result?.url) {
        // Keep loading state during navigation.
        window.location.href = result.url;
        return;
      }
      setError(DUPLICATE_SUBSCRIPTION_MESSAGE);
    } catch (checkoutError) {
      setError(getCheckoutErrorMessage(checkoutError));
    }
    setCheckoutLoading(false);
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { url } = await createPortalSession({});
      if (url) {
        // Keep loading state during navigation.
        window.location.href = url;
        return;
      }
      setError(PORTAL_OPEN_ERROR_MESSAGE);
    } catch {
      setError(PORTAL_OPEN_UNEXPECTED_ERROR_MESSAGE);
    }
    setPortalLoading(false);
  };

  const showManageSubscription = error === DUPLICATE_SUBSCRIPTION_MESSAGE;

  return { checkoutLoading, error, handleCheckout, handleManageSubscription, portalLoading, showManageSubscription };
};

const UpgradePrompt = () => {
  const { checkoutLoading, error, handleCheckout, handleManageSubscription, portalLoading, showManageSubscription } =
    useCheckoutRedirect();

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
      <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
        <Button onClick={handleCheckout} disabled={checkoutLoading || portalLoading} className="w-full">
          {checkoutLoading ? 'Reindirizzamento...' : 'Inizia ora'}
        </Button>
        {showManageSubscription && (
          <Button
            variant="outline"
            onClick={handleManageSubscription}
            disabled={checkoutLoading || portalLoading}
            className="w-full"
          >
            {portalLoading ? 'Apertura...' : 'Gestisci abbonamento'}
          </Button>
        )}
      </div>
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
