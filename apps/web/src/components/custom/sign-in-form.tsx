'use client';

import { Button } from '@ratio-diet/ui/components/button';
import { Input } from '@ratio-diet/ui/components/input';
import { Label } from '@ratio-diet/ui/components/label';
import type { AnyFieldApi, ReactFormExtendedApi } from '@tanstack/react-form';
import { useForm } from '@tanstack/react-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';

import { authClient } from '@/lib/auth-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyReactFormApi = ReactFormExtendedApi<any, any, any, any, any, any, any, any, any, any, any, any>;

const handleSignInError = (error: { error?: { message?: string; statusText?: string } }) => {
  toast.error(error?.error?.message ?? error?.error?.statusText ?? 'Errore imprevisto durante il login');
};

const getFieldErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error != null && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    return typeof msg === 'string' ? msg : String(msg ?? 'Errore di validazione');
  }
  return error != null ? String(error) : 'Errore di validazione';
};

const handleSignInSuccess = (router: ReturnType<typeof useRouter>) => {
  toast.success('Accesso effettuato con successo');
  router.push('/dashboard');
};

const EmailField = ({ form }: { form: AnyReactFormApi }) => (
  <div>
    <form.Field name="email">
      {(field: AnyFieldApi) => (
        <div className="space-y-2">
          <Label htmlFor={field.name}>Email</Label>
          <Input
            id={field.name}
            name={field.name}
            type="email"
            value={field.state.value as string}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
          />
          {field.state.meta.errors.map((error: unknown, index: number) => (
            <p key={index} className="text-sm text-destructive">
              {getFieldErrorMessage(error)}
            </p>
          ))}
        </div>
      )}
    </form.Field>
  </div>
);

const PasswordField = ({ form }: { form: AnyReactFormApi }) => (
  <div>
    <form.Field name="password">
      {(field: AnyFieldApi) => (
        <div className="space-y-2">
          <Label htmlFor={field.name}>Password</Label>
          <Input
            id={field.name}
            name={field.name}
            type="password"
            value={field.state.value as string}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
          />
          {field.state.meta.errors.map((error: unknown, index: number) => (
            <p key={index} className="text-sm text-destructive">
              {getFieldErrorMessage(error)}
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
        {isSubmitting ? 'Accesso in corso...' : 'Accedi'}
      </Button>
    )}
  </form.Subscribe>
);

const SignInForm = () => {
  const router = useRouter();

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        { email: value.email, password: value.password },
        {
          onError: handleSignInError,
          onSuccess: () => handleSignInSuccess(router),
        }
      );
    },
    validators: {
      onSubmit: z.object({
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
      <EmailField form={form} />
      <PasswordField form={form} />
      <SubmitButton form={form} />
      <p className="mt-4 text-center text-sm">
        Non hai un account?{' '}
        <Link href="/signup" className="font-medium underline underline-offset-4">
          Registrati
        </Link>
      </p>
    </form>
  );
};

export default SignInForm;
