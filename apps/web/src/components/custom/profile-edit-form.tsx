'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import { Button } from '@ratio-diet/ui/components/button';
import { Input } from '@ratio-diet/ui/components/input';
import { Label } from '@ratio-diet/ui/components/label';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { toast } from 'sonner';
import DateOfBirthField, { validateDateOfBirth } from './date-of-birth-field';

type Sex = 'M' | 'F';
type BodyBuild = 'snello' | 'medio' | 'robusto';
type Goal = 'dimagrimento' | 'mantenimento' | 'aumento_massa' | 'ricomposizione';
type ActivityLevel =
  | 'sedentario'
  | 'leggermente_attivo'
  | 'moderatamente_attivo'
  | 'molto_attivo'
  | 'atleta';
type DietaryPreference = 'onnivoro' | 'vegetariano' | 'vegano' | 'pescetariano';

interface ProfileFormState {
  sex: Sex;
  dateOfBirth: string;
  heightCm: number;
  weightKg: number;
  bodyBuild: BodyBuild;
  goal: Goal;
  activityLevel: ActivityLevel;
  allergies: string[];
  allergiesOther: string;
  dietaryPreference: DietaryPreference;
  followedByNutritionist: boolean;
}

const ALLERGEN_OPTIONS = [
  { value: 'glutine', label: 'Glutine' },
  { value: 'lattosio', label: 'Lattosio' },
  { value: 'frutta_a_guscio', label: 'Frutta a guscio' },
  { value: 'uova', label: 'Uova' },
  { value: 'crostacei', label: 'Crostacei' },
] as const;

const GOAL_OPTIONS = [
  { value: 'dimagrimento', label: 'Dimagrimento' },
  { value: 'mantenimento', label: 'Mantenimento' },
  { value: 'aumento_massa', label: 'Aumento massa' },
  { value: 'ricomposizione', label: 'Ricomposizione' },
] as const;

const ACTIVITY_OPTIONS = [
  { value: 'sedentario', label: 'Sedentario' },
  { value: 'leggermente_attivo', label: 'Leggermente attivo' },
  { value: 'moderatamente_attivo', label: 'Moderatamente attivo' },
  { value: 'molto_attivo', label: 'Molto attivo' },
  { value: 'atleta', label: 'Atleta' },
] as const;

const DIETARY_OPTIONS = [
  { value: 'onnivoro', label: 'Onnivoro' },
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'vegano', label: 'Vegano' },
  { value: 'pescetariano', label: 'Pescetariano' },
] as const;

const toggleAllergen = (current: string[], value: string): string[] => {
  if (current.includes(value)) {
    return current.filter((a) => a !== value);
  }
  return [...current, value];
};

const buildDefaultState = (profile: ProfileFormState): ProfileFormState => ({ ...profile });

const PersonalFields = ({
  form,
  setField,
}: {
  form: ProfileFormState;
  setField: <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => void;
}) => (
  <div className="space-y-4">
    <h3 className="font-semibold">Dati personali</h3>
    <div className="space-y-2">
      <Label htmlFor="pef-sex">Sesso</Label>
      <select
        id="pef-sex"
        value={form.sex}
        onChange={(e) => setField('sex', e.target.value as Sex)}
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
      >
        <option value="M">Maschio</option>
        <option value="F">Femmina</option>
      </select>
    </div>
    <DateOfBirthField
      id="pef-dob"
      value={form.dateOfBirth}
      onChange={(value) => setField('dateOfBirth', value)}
      required
    />
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label htmlFor="pef-height">Altezza (cm)</Label>
        <Input
          id="pef-height"
          type="number"
          min={100}
          max={250}
          value={form.heightCm || ''}
          onChange={(e) => setField('heightCm', Number(e.target.value))}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pef-weight">Peso (kg)</Label>
        <Input
          id="pef-weight"
          type="number"
          min={30}
          max={300}
          step={0.1}
          value={form.weightKg || ''}
          onChange={(e) => setField('weightKg', Number(e.target.value))}
          required
        />
      </div>
    </div>
    <div className="space-y-2">
      <Label htmlFor="pef-build">Corporatura</Label>
      <select
        id="pef-build"
        value={form.bodyBuild}
        onChange={(e) => setField('bodyBuild', e.target.value as BodyBuild)}
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
      >
        <option value="snello">Snello</option>
        <option value="medio">Medio</option>
        <option value="robusto">Robusto</option>
      </select>
    </div>
  </div>
);

const GoalActivityFields = ({
  form,
  setField,
}: {
  form: ProfileFormState;
  setField: <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => void;
}) => (
  <div className="space-y-4">
    <h3 className="font-semibold">Obiettivo e attività</h3>
    <div className="space-y-2">
      <Label htmlFor="pef-goal">Obiettivo</Label>
      <select
        id="pef-goal"
        value={form.goal}
        onChange={(e) => setField('goal', e.target.value as Goal)}
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
      >
        {GOAL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
    <div className="space-y-2">
      <Label htmlFor="pef-activity">Livello di attività</Label>
      <select
        id="pef-activity"
        value={form.activityLevel}
        onChange={(e) => setField('activityLevel', e.target.value as ActivityLevel)}
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
      >
        {ACTIVITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  </div>
);

const DietaryFields = ({
  form,
  setField,
}: {
  form: ProfileFormState;
  setField: <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => void;
}) => (
  <div className="space-y-4">
    <h3 className="font-semibold">Preferenze alimentari</h3>
    <div className="space-y-2">
      <Label htmlFor="pef-dietary">Regime alimentare</Label>
      <select
        id="pef-dietary"
        value={form.dietaryPreference}
        onChange={(e) => setField('dietaryPreference', e.target.value as DietaryPreference)}
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
      >
        {DIETARY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
    <div className="space-y-2">
      <Label>Allergie e intolleranze</Label>
      <div className="flex flex-wrap gap-3">
        {ALLERGEN_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              value={opt.value}
              checked={form.allergies.includes(opt.value)}
              onChange={() => setField('allergies', toggleAllergen(form.allergies, opt.value))}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
    <div className="space-y-2">
      <Label htmlFor="pef-allergies-other">Altre allergie</Label>
      <Input
        id="pef-allergies-other"
        type="text"
        placeholder="es. kiwi, sedano..."
        value={form.allergiesOther}
        onChange={(e) => setField('allergiesOther', e.target.value)}
      />
    </div>
    <div className="flex items-center gap-2">
      <input
        id="pef-nutritionist"
        type="checkbox"
        checked={form.followedByNutritionist}
        onChange={(e) => setField('followedByNutritionist', e.target.checked)}
      />
      <Label htmlFor="pef-nutritionist">Seguito da un nutrizionista</Label>
    </div>
  </div>
);

const ProfileEditForm = () => {
  const profile = useQuery(api.userProfiles.get);
  const updateProfile = useMutation(api.userProfiles.update);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (profile === undefined) {
    return <p className="text-muted-foreground text-sm">Caricamento...</p>;
  }

  if (profile === null) {
    return <p className="text-muted-foreground text-sm">Profilo non trovato.</p>;
  }

  const currentForm: ProfileFormState = form ?? buildDefaultState(profile as unknown as ProfileFormState);

  const setField = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setForm((prev) => ({ ...(prev ?? currentForm), [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);

    const dateOfBirthError = validateDateOfBirth(currentForm.dateOfBirth);
    if (dateOfBirthError) {
      toast.error(dateOfBirthError);
      setIsSubmitting(false);
      return;
    }

    try {
      await updateProfile({
        sex: currentForm.sex,
        dateOfBirth: currentForm.dateOfBirth,
        heightCm: currentForm.heightCm,
        weightKg: currentForm.weightKg,
        bodyBuild: currentForm.bodyBuild,
        goal: currentForm.goal,
        activityLevel: currentForm.activityLevel,
        allergies: currentForm.allergies,
        allergiesOther: currentForm.allergiesOther || undefined,
        dietaryPreference: currentForm.dietaryPreference,
        followedByNutritionist: currentForm.followedByNutritionist,
        legalGateAccepted: true,
      });
      toast.success('Profilo aggiornato');
    } catch {
      toast.error('Errore durante il salvataggio del profilo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PersonalFields form={currentForm} setField={setField} />
      <GoalActivityFields form={currentForm} setField={setField} />
      <DietaryFields form={currentForm} setField={setField} />
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        Salva modifiche
      </Button>
    </form>
  );
};

export default ProfileEditForm;
