'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import { useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import Loader from '@/components/custom/loader';
import OnboardingForm from '@/components/custom/onboarding-form';

const getQueryError = (value: unknown): Error | null => {
  if (value instanceof Error) {
    return value;
  }

  if (value && typeof value === 'object' && 'error' in value && value.error instanceof Error) {
    return value.error;
  }

  return null;
};

const OnboardingPage = () => {
  const profile = useQuery(api.userProfiles.get);
  const router = useRouter();
  const queryError = getQueryError(profile);

  useEffect(() => {
    if (!queryError && profile !== undefined && profile) {
      router.replace('/dashboard');
    }
  }, [profile, queryError, router]);

  if (profile === undefined) {
    return <Loader />;
  }

  if (queryError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold">Errore nel caricamento del profilo</h1>
        <p className="text-muted-foreground mb-6">
          {queryError.message || 'Si e verificato un errore. Riprova tra qualche istante.'}
        </p>
        <button
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2"
          onClick={() => router.refresh()}
          type="button"
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Configura il tuo profilo</h1>
      <p className="text-muted-foreground mb-8">
        Inserisci i tuoi dati per calcolare il tuo fabbisogno nutrizionale personalizzato.
      </p>
      <OnboardingForm />
    </div>
  );
};

export default OnboardingPage;
