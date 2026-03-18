import type * as GeneratedApi from '@ratio-diet/backend/convex/_generated/api';
import { render, screen } from '@testing-library/react';
import type * as ConvexReact from 'convex/react';

import type * as WeeklyPlanGeneratorModule from '@/components/custom/weekly-plan-generator';
import type * as WeeklyPlanHistoryModule from '@/components/custom/weekly-plan-history';
import type * as WeeklyPlanViewModule from '@/components/custom/weekly-plan-view';

import WeeklyPlanPage from './page';

type SubscriptionStatus = { status: string; nextRenewalDate: string } | null | undefined;

const { mockApi, mockUseAction, mockUseQuery } = vi.hoisted(() => ({
  mockApi: {
    subscriptions: {
      createCheckoutSession: 'subscriptions.createCheckoutSession',
      createPortalSession: 'subscriptions.createPortalSession',
      getStatus: 'subscriptions.getStatus',
    },
  },
  mockUseAction: vi.fn(),
  mockUseQuery: vi.fn(),
}));

vi.mock<typeof ConvexReact>(import('convex/react'), () => ({
  useAction: (...args: unknown[]) => mockUseAction(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock<typeof GeneratedApi>(
  import('@ratio-diet/backend/convex/_generated/api'),
  () => ({ api: mockApi }) as unknown as typeof GeneratedApi
);

vi.mock<typeof WeeklyPlanGeneratorModule>(import('@/components/custom/weekly-plan-generator'), () => ({
  default: () => <div data-testid="weekly-plan-generator" />,
}));

vi.mock<typeof WeeklyPlanHistoryModule>(import('@/components/custom/weekly-plan-history'), () => ({
  default: () => <div data-testid="weekly-plan-history" />,
}));

vi.mock<typeof WeeklyPlanViewModule>(import('@/components/custom/weekly-plan-view'), () => ({
  default: ({ canEdit }: { canEdit: boolean }) => (
    <div data-testid={canEdit ? 'weekly-plan-view-edit' : 'weekly-plan-view-read'} />
  ),
}));

const renderPage = (status: SubscriptionStatus) => {
  mockUseQuery.mockImplementation((query: string) => {
    if (query === mockApi.subscriptions.getStatus) {
      return status;
    }
    return null;
  });
  mockUseAction.mockReturnValue(() => ({ url: null }));
  render(<WeeklyPlanPage />);
};

describe('weeklyPlanPage subscription gating', () => {
  it('treats trialing as premium access', () => {
    renderPage({ nextRenewalDate: '2026-04-01', status: 'trialing' });

    expect(screen.getByTestId('weekly-plan-generator')).toBeInTheDocument();
    expect(screen.queryByText('Abbonati a Ratio Diet Premium')).not.toBeInTheDocument();
  });

  it('shows upgrade prompt for non-premium statuses', () => {
    renderPage({ nextRenewalDate: '2026-04-01', status: 'past_due' });

    expect(screen.getByText('Abbonati a Ratio Diet Premium')).toBeInTheDocument();
    expect(screen.queryByTestId('weekly-plan-generator')).not.toBeInTheDocument();
  });
});
