import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import '@/index.css';
import Providers from '@/components/custom/providers';
import { getToken } from '@/lib/auth-server';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  description: 'Ratio Diet — La tua alimentazione basata su numeri, proporzioni e metodo.',
  title: 'Ratio Diet',
};

const RootLayout = async ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  const token = await getToken();
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-title" content="RatioDiet" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers initialToken={token}>
          <main className="min-h-svh">{children}</main>
        </Providers>
      </body>
    </html>
  );
};

export default RootLayout;
