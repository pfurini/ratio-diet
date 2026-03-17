'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import { useConvexAuth, useQuery } from 'convex/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import AppNav from '@/components/custom/app-nav';

const useAuthGuard = () => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  return { isAuthenticated, isLoading };
};

const useProfileGuard = (isAuthenticated: boolean) => {
  const profile = useQuery(api.userProfiles.get, isAuthenticated ? {} : 'skip');
  const router = useRouter();
  const pathname = usePathname();

  const isRedirecting = profile === null && pathname !== '/onboarding';

  useEffect(() => {
    if (isRedirecting) {
      router.replace('/onboarding');
    }
  }, [isRedirecting, router]);

  const profileLoaded = profile !== undefined && !isRedirecting;

  return { isRedirecting, profileLoaded };
};

const UserLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuthGuard();
  const { profileLoaded, isRedirecting } = useProfileGuard(isAuthenticated);

  if (isLoading || isRedirecting || (isAuthenticated && !profileLoaded)) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-svh pb-16">
      {children}
      <AppNav />
    </div>
  );
};

export default UserLayout;
