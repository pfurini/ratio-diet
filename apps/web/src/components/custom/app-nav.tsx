'use client';

import { CalendarDays, CalendarRange, Home, Settings, TrendingUp } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard' },
  { href: '/daily-plan', icon: CalendarDays, label: 'Piano giornaliero' },
  { href: '/weekly-plan', icon: CalendarRange, label: 'Piano settimanale' },
  { href: '/progress', icon: TrendingUp, label: 'Progressi' },
  { href: '/settings', icon: Settings, label: 'Impostazioni' },
];

const NavItem = ({ href, icon: Icon, label, active }: { href: string; icon: typeof Home; label: string; active: boolean }) => (
  <Link
    href={href as Route<string>}
    className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors ${
      active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
    }`}
    aria-current={active ? 'page' : undefined}
  >
    <Icon className="h-5 w-5" aria-hidden="true" />
    <span className="truncate leading-none">{label}</span>
  </Link>
);

const AppNav = () => {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t bg-background"
      aria-label="Navigazione principale"
    >
      {navItems.map((item) => (
        <NavItem key={item.href} {...item} active={pathname === item.href} />
      ))}
    </nav>
  );
};

export default AppNav;
