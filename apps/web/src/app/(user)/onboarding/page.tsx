'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import { useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import OnboardingForm from '@/components/custom/onboarding-form';

const OnboardingPage = () => {
  const profile = useQuery(api.userProfiles.get);
  const router = useRouter();

  useEffect(() => {
    if (profile) {
      router.replace('/dashboard');
    }
  }, [profile, router]);

  if (profile) {
    return null;
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
