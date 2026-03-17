'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import { useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import DashboardActions from '@/components/custom/dashboard-actions';
import DashboardHero from '@/components/custom/dashboard-hero';
import DashboardProgress from '@/components/custom/dashboard-progress';

const getLocalDate = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const DashboardPage = () => {
  const [sessionDate, setSessionDate] = useState<string>(() => getLocalDate());
  const profile = useQuery(api.userProfiles.get);
  const todayPlan = useQuery(api.dailyPlans.get, profile ? { date: sessionDate } : 'skip');
  const router = useRouter();

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setSessionDate(getLocalDate());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (profile === null) {
      router.replace('/onboarding');
    }
  }, [profile, router]);

  if (!profile) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <DashboardHero macros={profile.macros} />
      <DashboardProgress macros={profile.macros} plan={todayPlan ?? null} />
      <DashboardActions hasTodayPlan={!!todayPlan} />
    </div>
  );
};

export default DashboardPage;
