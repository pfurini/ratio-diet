'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import { Button } from '@ratio-diet/ui/components/button';
import { useAction, useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import CustomFoodList from '@/components/custom/custom-food-list';
import ProfileEditForm from '@/components/custom/profile-edit-form';
import TemplateList from '@/components/custom/template-list';
import { authClient } from '@/lib/auth-client';

const formatRenewalDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('it-IT');
};

const subscriptionStatusLabelIt = (status: string, cancelAtPeriodEnd: boolean): string => {
  if (status === 'canceled' || cancelAtPeriodEnd) {
    return 'Annullato';
  }
  if (status === 'active') {
    return 'Attivo';
  }
  if (status === 'trialing') {
    return 'Prova';
  }
  if (status === 'past_due') {
    return 'Pagamento in sospeso';
  }
  if (status === 'paused') {
    return 'In pausa';
  }
  if (status === 'unpaid') {
    return 'Non pagato';
  }
  if (status === 'incomplete' || status === 'incomplete_expired') {
    return 'Incompleto';
  }
  return status;
};

const SubscriptionSection = () => {
  const subscription = useQuery(api.subscriptions.getStatus);
  const createPortalSession = useAction(api.subscriptions.createPortalSession);
  const [loading, setLoading] = useState(false);

  const handleManage = async () => {
    setLoading(true);
    try {
      const { url } = await createPortalSession();
      if (url) {
        window.location.href = url;
      } else {
        toast.error('Impossibile aprire il portale.');
        setLoading(false);
      }
    } catch {
      toast.error("Errore durante l'apertura del portale.");
      setLoading(false);
    }
  };

  if (subscription === undefined) {
    return (
      <p className="text-muted-foreground text-sm" role="status" aria-live="polite" aria-busy="true">
        Caricamento...
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {subscription === null ? (
        <p className="text-muted-foreground text-sm">Nessun abbonamento attivo.</p>
      ) : (
        <div className="space-y-1">
          <p className="text-sm">
            Stato:{' '}
            <span className="font-medium">
              {subscriptionStatusLabelIt(subscription.status, subscription.cancelAtPeriodEnd)}
            </span>
          </p>
          <p className="text-muted-foreground text-sm">
            Prossimo rinnovo: {subscription.nextRenewalDate ? formatRenewalDate(subscription.nextRenewalDate) : '—'}
          </p>
        </div>
      )}
      <Button variant="outline" onClick={handleManage} disabled={loading}>
        {loading ? 'Apertura...' : 'Gestisci abbonamento'}
      </Button>
    </div>
  );
};

const SignOutSection = () => {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      await authClient.signOut();
      router.replace('/');
    } catch {
      toast.error('Errore durante la disconnessione.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Button variant="destructive" onClick={handleSignOut} className="w-full" disabled={isSigningOut}>
      {isSigningOut ? 'Disconnessione...' : 'Esci'}
    </Button>
  );
};

const SectionWrapper = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-4">
    <h2 className="text-lg font-semibold">{title}</h2>
    {children}
  </section>
);

const SettingsPage = () => (
  <div className="mx-auto max-w-md space-y-10 px-4 py-8">
    <h1 className="text-2xl font-bold">Impostazioni</h1>
    <SectionWrapper title="Profilo">
      <ProfileEditForm />
    </SectionWrapper>
    <SectionWrapper title="Alimenti personalizzati">
      <CustomFoodList />
    </SectionWrapper>
    <SectionWrapper title="Template">
      <TemplateList />
    </SectionWrapper>
    <SectionWrapper title="Abbonamento">
      <SubscriptionSection />
    </SectionWrapper>
    <SignOutSection />
  </div>
);

export default SettingsPage;
