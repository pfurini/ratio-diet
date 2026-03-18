'use client';

import { buttonVariants } from '@ratio-diet/ui/components/button';
import Link from 'next/link';

type Props = {
  hasTodayPlan: boolean;
};

const DashboardActions = ({ hasTodayPlan }: Props) => (
  <section className="space-y-3">
    <h2 className="font-semibold">Azioni rapide</h2>
    <div className="grid grid-cols-1 gap-3">
      <Link href="/daily-plan" className={buttonVariants({ variant: hasTodayPlan ? 'outline' : 'default', className: 'w-full text-center' })}>
        {hasTodayPlan ? 'Visualizza piano di oggi' : 'Pianifica la giornata'}
      </Link>
      <Link href="/weekly-plan" className={buttonVariants({ variant: 'outline', className: 'w-full text-center' })}>
        Piano settimanale
      </Link>
      <Link href="/progress" className={buttonVariants({ variant: 'outline', className: 'w-full text-center' })}>
        Registra peso
      </Link>
    </div>
  </section>
);

export default DashboardActions;
