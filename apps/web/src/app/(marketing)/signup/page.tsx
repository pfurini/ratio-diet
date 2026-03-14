import SignUpForm from '@/components/custom/sign-up-form';

const SignupPage = () => (
  <div className="flex min-h-svh items-center justify-center px-4">
    <div className="w-full max-w-sm">
      <h1 className="mb-6 text-center text-2xl font-bold">Crea il tuo account</h1>
      <SignUpForm />
    </div>
  </div>
);

export default SignupPage;
