'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import { useQuery } from 'convex/react';
import { useEffect, useState } from 'react';

import DashboardActions from '@/components/custom/dashboard-actions';
import DashboardHero from '@/components/custom/dashboard-hero';
import DashboardProgress from '@/components/custom/dashboard-progress';
import { getLocalDateString } from '@/lib/date-utils';

const DashboardPage = () => {
  const [sessionDate, setSessionDate] = useState<string>(() => getLocalDateString());
  const profile = useQuery(api.userProfiles.get);
  const todayPlan = useQuery(api.dailyPlans.get, profile ? { date: sessionDate } : 'skip');

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setSessionDate(getLocalDateString());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
