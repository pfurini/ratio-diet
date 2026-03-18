import Link from 'next/link';

const freeFeatures = ['Piano giornaliero', 'Alimenti CREA', 'Template predefiniti', 'Calcolo macro base'];

const premiumFeatures = [
  'Piano settimanale con AI',
  'Modifica piani personalizzata',
  'Lista della spesa automatica',
  'Tutti i vantaggi del piano gratuito',
];

const FeatureList = ({ features }: { features: string[] }) => (
  <ul className="flex flex-col gap-2">
    {features.map((f) => (
      <li key={f} className="flex items-center gap-2 text-sm">
        <span className="font-bold text-primary">✓</span>
        {f}
      </li>
    ))}
  </ul>
);

const FreePlanCard = () => (
  <div className="flex flex-col gap-6 rounded-xl border bg-card p-8">
    <div>
      <h2 className="text-2xl font-bold">Gratuito</h2>
      <p className="mt-1 text-3xl font-bold">€0</p>
      <p className="text-muted-foreground">per sempre</p>
    </div>
    <FeatureList features={freeFeatures} />
    <Link
      href="/signup"
      className="mt-auto rounded-md border border-border px-4 py-2 text-center font-semibold transition-colors hover:bg-accent"
    >
      Inizia gratis
    </Link>
  </div>
);

const PremiumPlanCard = () => (
  <div className="flex flex-col gap-6 rounded-xl border border-primary bg-primary/5 p-8">
    <div>
      <h2 className="text-2xl font-bold">Premium</h2>
      <p className="mt-1 text-3xl font-bold">€4.99</p>
      <p className="text-muted-foreground">al mese</p>
    </div>
    <FeatureList features={premiumFeatures} />
    <Link
      href="/signup"
      className="mt-auto rounded-md bg-primary px-4 py-2 text-center font-semibold text-primary-foreground transition-opacity hover:opacity-90"
    >
      Abbonati
    </Link>
  </div>
);

const PricingPage = () => (
  <main className="px-4 py-16">
    <div className="mb-12 text-center">
      <h1 className="text-3xl font-bold">Piani e prezzi</h1>
      <p className="mt-3 text-muted-foreground">Scegli il piano più adatto alle tue esigenze.</p>
    </div>
    <div className="mx-auto grid max-w-3xl gap-8 sm:grid-cols-2">
      <FreePlanCard />
      <PremiumPlanCard />
    </div>
    <p className="mt-12 text-center text-sm text-muted-foreground">
      Ratio Diet non è un sostituto del parere medico o nutrizionale professionale.
    </p>
  </main>
);

export default PricingPage;
