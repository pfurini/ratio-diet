import SignInForm from '@/components/custom/sign-in-form';

const LoginPage = () => (
  <div className="flex min-h-svh items-center justify-center px-4">
    <div className="w-full max-w-sm">
      <h1 className="mb-6 text-center text-2xl font-bold">Accedi a Ratio Diet</h1>
      <SignInForm />
    </div>
  </div>
);

export default LoginPage;
