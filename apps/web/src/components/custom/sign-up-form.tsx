'use client';

import { Button } from '@ratio-diet/ui/components/button';
import { Input } from '@ratio-diet/ui/components/input';
import { Label } from '@ratio-diet/ui/components/label';
import type { AnyFieldApi } from '@tanstack/react-form';
import { useForm } from '@tanstack/react-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';

import { authClient } from '@/lib/auth-client';
import type { AnyReactFormApi } from '@/lib/form-types';

const handleSignUpError = (error: { error?: { message?: string; statusText?: string } }) => {
  toast.error(error?.error?.message ?? error?.error?.statusText ?? 'Errore imprevisto durante la registrazione');
};

const handleSignUpSuccess = (router: ReturnType<typeof useRouter>) => {
  toast.success('Account creato con successo');
  router.push('/onboarding');
};

const FormField = ({
  form,
  name,
  label,
  type = 'text',
}: {
  form: AnyReactFormApi;
  name: string;
  label: string;
  type?: string;
}) => (
  <div>
    <form.Field name={name}>
      {(field: AnyFieldApi) => (
        <div className="space-y-2">
          <Label htmlFor={field.name}>{label}</Label>
          <Input
            id={field.name}
            name={field.name}
            type={type}
            value={field.state.value as string}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
          />
          {field.state.meta.errors.map((error: unknown) => (
            <p key={String(error)} className="text-sm text-destructive">
              {(error as { message?: string })?.message}
            </p>
          ))}
        </div>
      )}
    </form.Field>
  </div>
);

const SubmitButton = ({ form }: { form: AnyReactFormApi }) => (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <form.Subscribe selector={(state: any) => ({ canSubmit: state.canSubmit as boolean, isSubmitting: state.isSubmitting as boolean })}>
    {({ canSubmit, isSubmitting }: { canSubmit: boolean; isSubmitting: boolean }) => (
      <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
        {isSubmitting ? 'Creazione in corso...' : 'Crea account'}
      </Button>
    )}
  </form.Subscribe>
);

const SignUpForm = () => {
  const router = useRouter();

  const form = useForm({
    defaultValues: { name: '', email: '', password: '' },
    onSubmit: async ({ value }) => {
      try {
        await authClient.signUp.email(
          { email: value.email, name: value.name, password: value.password },
          {
            onError: handleSignUpError,
            onSuccess: () => handleSignUpSuccess(router),
          }
        );
      } catch (error) {
        handleSignUpError(error as { error?: { message?: string; statusText?: string } });
      }
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, 'Il nome deve contenere almeno 2 caratteri'),
        email: z.email('Indirizzo email non valido'),
        password: z.string().min(8, 'La password deve contenere almeno 8 caratteri'),
      }),
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <FormField form={form} name="name" label="Nome" />
      <FormField form={form} name="email" label="Email" type="email" />
      <FormField form={form} name="password" label="Password" type="password" />
      <SubmitButton form={form} />
      <p className="mt-4 text-center text-sm">
        Hai già un account?{' '}
        <Link href="/login" className="font-medium underline underline-offset-4">
          Accedi
        </Link>
      </p>
    </form>
  );
};

export default SignUpForm;
