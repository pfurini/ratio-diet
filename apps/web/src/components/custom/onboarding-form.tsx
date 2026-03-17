'use client';

import type { ReactFormExtendedApi } from '@tanstack/react-form';
import { useForm } from '@tanstack/react-form';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import { Button } from '@ratio-diet/ui/components/button';

import StepDietary from './onboarding/step-dietary';
import StepGoal from './onboarding/step-goal';
import StepLegal from './onboarding/step-legal';
import StepPersonal from './onboarding/step-personal';
import { STEPS, type FormValues } from './onboarding/types';
import { validateDateOfBirth } from './date-of-birth-field';

const DEFAULT_VALUES: FormValues = {
  isOver18: false,
  noPathologies: false,
  disclaimerRead: false,
  sex: 'M',
  dateOfBirth: '',
  heightCm: 0,
  weightKg: 0,
  bodyBuild: 'medio',
  goal: 'mantenimento',
  activityLevel: 'moderatamente_attivo',
  allergies: [],
  allergiesOther: '',
  dietaryPreference: 'onnivoro',
  followedByNutritionist: false,
};

const validateLegal = (values: FormValues): string | null => {
  if (!values.isOver18) return 'Devi avere almeno 18 anni.';
  if (!values.noPathologies) return 'Devi confermare di non avere patologie specifiche.';
  if (!values.disclaimerRead) return 'Devi leggere e accettare il disclaimer.';
  return null;
};

const validatePersonal = (values: FormValues): string | null => {
  const dateOfBirthError = validateDateOfBirth(values.dateOfBirth);
  if (dateOfBirthError) return dateOfBirthError;
  if (values.heightCm < 100 || values.heightCm > 250) return 'Inserisci un\'altezza valida.';
  if (values.weightKg < 30 || values.weightKg > 300) return 'Inserisci un peso valido.';
  return null;
};

const STEP_VALIDATORS = [validateLegal, validatePersonal, null, null];

const STEP_COMPONENTS = [StepLegal, StepPersonal, StepGoal, StepDietary];

const OnboardingForm = () => {
  const [step, setStep] = useState(0);
  const createProfile = useMutation(api.userProfiles.create);

  const form = useForm({
    defaultValues: DEFAULT_VALUES,
    onSubmit: async ({ value }) => {
      try {
        await createProfile({
          sex: value.sex,
          dateOfBirth: value.dateOfBirth,
          heightCm: value.heightCm,
          weightKg: value.weightKg,
          bodyBuild: value.bodyBuild,
          goal: value.goal,
          activityLevel: value.activityLevel,
          allergies: value.allergies,
          allergiesOther: value.allergiesOther || undefined,
          dietaryPreference: value.dietaryPreference,
          followedByNutritionist: value.followedByNutritionist,
        });
        toast.success('Profilo creato con successo!');
      } catch (err) {
        toast.error('Errore durante la creazione del profilo. Riprova.');
      }
    },
  });

  const handleNext = () => {
    const validator = STEP_VALIDATORS[step];
    if (validator) {
      const error = validator(form.state.values);
      if (error) {
        toast.error(error);
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => s - 1);

  const StepComponent = STEP_COMPONENTS[step];
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="space-y-8">
      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= step ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      <p className="text-muted-foreground text-sm">
        Passo {step + 1} di {STEPS.length}: <span className="font-medium">{STEPS[step]}</span>
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <StepComponent form={form as unknown as ReactFormExtendedApi<any, any, any, any, any, any, any, any, any, any, any, any>} />

        <div className="mt-8 flex justify-between">
          <Button type="button" variant="outline" onClick={handleBack} disabled={step === 0}>
            Indietro
          </Button>
          {isLastStep ? (
            <Button type="submit">Completa</Button>
          ) : (
            <Button type="button" onClick={handleNext}>
              Avanti
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default OnboardingForm;
