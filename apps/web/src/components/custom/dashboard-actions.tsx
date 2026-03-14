'use client';

import Link from 'next/link';

import { Button } from '@ratio-diet/ui/components/button';

type Props = {
  hasTodayPlan: boolean;
};

const DashboardActions = ({ hasTodayPlan }: Props) => (
  <section className="space-y-3">
    <h2 className="font-semibold">Azioni rapide</h2>
    <div className="grid grid-cols-1 gap-3">
      <Button asChild variant={hasTodayPlan ? 'outline' : 'default'} className="w-full">
        <Link href="/daily-plan">
          {hasTodayPlan ? 'Visualizza piano di oggi' : 'Pianifica la giornata'}
        </Link>
      </Button>
      <Button asChild variant="outline" className="w-full">
        <Link href="/weekly-plan">Piano settimanale</Link>
      </Button>
      <Button asChild variant="outline" className="w-full">
        <Link href="/progress">Registra peso</Link>
      </Button>
    </div>
  </section>
);

export default DashboardActions;
