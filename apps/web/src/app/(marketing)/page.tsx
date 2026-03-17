import type { Route } from 'next';
import Link from 'next/link';

const steps = [
  { label: 'Inserisci i tuoi dati', number: '1' },
  { label: 'Scegli i cibi', number: '2' },
  { label: 'Ottieni le quantità', number: '3' },
];

const freeFeatures = ['Piano giornaliero', 'Alimenti CREA', 'Template predefiniti'];

const premiumFeatures = ['Piano settimanale con AI', 'Modifica piani', 'Lista della spesa'];

const HeroSection = () => (
  <section className="px-4 py-20 text-center">
    <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">Ratio Diet</h1>
    <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
      La tua alimentazione basata su numeri, proporzioni e metodo.
    </p>
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <Link
        href="/signup"
        className="rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Inizia gratis
      </Link>
      <Link
        href="/pricing"
        className="rounded-md border border-border px-6 py-3 font-semibold transition-colors hover:bg-accent"
      >
        Scopri Premium
      </Link>
    </div>
  </section>
);

const HowItWorksSection = () => (
  <section className="bg-muted/40 px-4 py-16">
    <h2 className="mb-10 text-center text-2xl font-bold">Come funziona</h2>
    <ol className="mx-auto flex max-w-2xl flex-col gap-6 sm:flex-row sm:justify-between">
      {steps.map((step) => (
        <li key={step.number} className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-xl">
            {step.number}
          </span>
          <span className="font-medium">{step.label}</span>
        </li>
      ))}
    </ol>
  </section>
);

const PlanCard = ({
  title,
  price,
  features,
  ctaLabel,
  ctaHref,
  highlighted,
}: {
  title: string;
  price: string;
  features: string[];
  ctaLabel: string;
  ctaHref: Route<string>;
  highlighted?: boolean;
}) => (
  <div
    className={`flex flex-col gap-4 rounded-xl border p-6 ${highlighted ? 'border-primary bg-primary/5' : 'bg-card'}`}
  >
    <div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="text-muted-foreground">{price}</p>
    </div>
    <ul className="flex flex-col gap-2">
      {features.map((f) => (
        <li key={f} className="flex items-center gap-2 text-sm">
          <span className="text-primary">✓</span>
          {f}
        </li>
      ))}
    </ul>
    <Link
      href={ctaHref}
      className={`mt-auto rounded-md px-4 py-2 text-center font-semibold transition-opacity hover:opacity-90 ${highlighted ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
    >
      {ctaLabel}
    </Link>
  </div>
);

const ComparisonSection = () => (
  <section className="px-4 py-16">
    <h2 className="mb-10 text-center text-2xl font-bold">Gratuito vs Premium</h2>
    <div className="mx-auto grid max-w-2xl gap-6 sm:grid-cols-2">
      <PlanCard
        title="Gratuito"
        price="€0 / sempre"
        features={freeFeatures}
        ctaLabel="Inizia gratis"
        ctaHref="/signup"
      />
      <PlanCard
        title="Premium"
        price="€4.99 / mese"
        features={premiumFeatures}
        ctaLabel="Scopri Premium"
        ctaHref="/pricing"
        highlighted
      />
    </div>
  </section>
);

const Footer = () => (
  <footer className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
    <p>Ratio Diet non è un sostituto del parere medico o nutrizionale professionale.</p>
    <p className="mt-2">© {new Date().getFullYear()} Ratio Diet</p>
  </footer>
);

const Home = () => (
  <main>
    <HeroSection />
    <HowItWorksSection />
    <ComparisonSection />
    <Footer />
  </main>
);

export default Home;
