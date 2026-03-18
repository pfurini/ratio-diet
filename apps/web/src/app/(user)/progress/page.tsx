'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import { Button } from '@ratio-diet/ui/components/button';
import { Input } from '@ratio-diet/ui/components/input';
import { Label } from '@ratio-diet/ui/components/label';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { toast } from 'sonner';

import WeightChart from '@/components/custom/weight-chart';
import { getLocalDateString } from '@/lib/date-utils';
import type { MacroTarget } from '@/types/macros';

const showWeightToast = (result: { recalculated: boolean; newMacros?: MacroTarget }) => {
  if (result.recalculated && result.newMacros) {
    const { proteinGrams, carbGrams, fatGrams } = result.newMacros;
    const desc = `Proteine: ${Math.round(proteinGrams)}g · Carbo: ${Math.round(carbGrams)}g · Grassi: ${Math.round(fatGrams)}g`;
    toast.success('I tuoi target sono stati aggiornati in base al nuovo peso', { description: desc });
  } else {
    toast.success('Peso registrato');
  }
};

const parseWeight = (val: string): number | null => {
  const kg = Number.parseFloat(val);
  return Number.isNaN(kg) || kg <= 0 ? null : kg;
};

const submitWeight = async (
  logWeight: ReturnType<typeof useMutation<typeof api.weightLogs.log>>,
  date: string,
  kg: number
) => {
  const result = await logWeight({ date, weightKg: kg });
  showWeightToast(result);
};

const WeightLogForm = () => {
  const [weightKg, setWeightKg] = useState('');
  const [date, setDate] = useState(getLocalDateString());
  const [submitting, setSubmitting] = useState(false);
  const logWeight = useMutation(api.weightLogs.log);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const kg = parseWeight(weightKg);
    if (!kg) {
      toast.error('Peso non valido');
      return;
    }
    setSubmitting(true);
    try {
      await submitWeight(logWeight, date, kg);
      setWeightKg('');
    } catch {
      toast.error('Impossibile registrare il peso');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">Registra peso</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="weight-kg">Peso (kg)</Label>
          <Input
            id="weight-kg"
            type="number"
            step="0.1"
            min="20"
            max="300"
            placeholder="Es. 75.5"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="weight-date">Data</Label>
          <Input id="weight-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        Registra
      </Button>
    </form>
  );
};

const MacroRow = ({ label, value, unit }: { label: string; value: number; unit: string }) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">
      {Math.round(value)} {unit}
    </span>
  </div>
);

const MacroTargets = ({ macros }: { macros: MacroTarget }) => (
  <section className="space-y-2 rounded-xl border p-4">
    <h2 className="font-semibold">Target attuali</h2>
    <MacroRow label="Calorie" value={macros.calorieTarget} unit="kcal" />
    <MacroRow label="Proteine" value={macros.proteinGrams} unit="g" />
    <MacroRow label="Carboidrati" value={macros.carbGrams} unit="g" />
    <MacroRow label="Grassi" value={macros.fatGrams} unit="g" />
    <MacroRow label="TDEE" value={macros.tdee} unit="kcal" />
  </section>
);

const WeightHistorySection = () => {
  const logs = useQuery(api.weightLogs.list, {});
  const chartData = (logs ?? []).map((l) => ({ date: l.date, weightKg: l.weightKg }));

  return (
    <section className="space-y-2 rounded-xl border p-4">
      <h2 className="font-semibold">Storico peso</h2>
      <WeightChart data={chartData} />
    </section>
  );
};

const ProgressPage = () => {
  const profile = useQuery(api.userProfiles.get);

  if (profile === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Progresso</h1>
      <WeightLogForm />
      <WeightHistorySection />
      {profile?.macros && <MacroTargets macros={profile.macros} />}
    </main>
  );
};

export default ProgressPage;
