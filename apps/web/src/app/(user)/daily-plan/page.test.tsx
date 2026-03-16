import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DailyPlanPage from './page';

const { mockApi, mockUseMutation, mockUseQuery } = vi.hoisted(() => ({
  mockApi: {
    dailyPlans: {
      get: 'dailyPlans.get',
      optimize: 'dailyPlans.optimize',
    },
    userProfiles: {
      get: 'userProfiles.get',
    },
  },
  mockUseMutation: vi.fn(),
  mockUseQuery: vi.fn(),
}));

vi.mock(import('convex/react'), () => ({
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock(import('@ratio-diet/backend/convex/_generated/api'), () => ({
  api: mockApi,
}));

vi.mock(import('@/components/custom/meal-builder'), () => ({
  default: ({
    items,
    mealType,
    onItemsChange,
  }: {
    mealType: string;
    items: { foodId: string }[];
    onItemsChange: (items: { foodId: string }[]) => void;
  }) => (
    <section data-testid={`meal-${mealType}`}>
      <span data-testid={`count-${mealType}`}>{items.length}</span>
      <button type="button" onClick={() => onItemsChange([...items, { foodId: `food-${mealType}` }])}>
        {`add-${mealType}`}
      </button>
    </section>
  ),
}));

vi.mock(import('@/components/custom/plan-macro-summary'), () => ({
  default: () => <div data-testid="macro-summary" />,
}));

vi.mock(import('@/components/custom/plan-template-bar'), () => ({
  default: ({ planId }: { planId: string | null }) => <div data-testid="plan-id">{planId ?? 'none'}</div>,
}));

const setup = () => {
  const plansByDate = new Map<string, { _id: string }>();

  mockUseQuery.mockImplementation((query: string, args?: { date: string }) => {
    if (query === mockApi.userProfiles.get) {
      return null;
    }
    if (query === mockApi.dailyPlans.get) {
      return args ? (plansByDate.get(args.date) ?? null) : null;
    }
    return null;
  });

  mockUseMutation.mockImplementation((mutation: string) => {
    if (mutation === mockApi.dailyPlans.optimize) {
      return ({ date }: { date: string }) => `plan-${date}`;
    }
    return () => null;
  });
};

describe('dailyPlanPage regressions', () => {
  it('persists snack meal items when snack sections are hidden and shown again', async () => {
    setup();
    const user = userEvent.setup();
    render(<DailyPlanPage />);

    await user.click(screen.getByRole('button', { name: 'Aggiungi spuntini' }));
    await user.click(screen.getByRole('button', { name: 'add-spuntino_mattina' }));

    expect(screen.getByTestId('count-spuntino_mattina')).toHaveTextContent('1');

    await user.click(screen.getByRole('button', { name: 'Rimuovi spuntini' }));
    expect(screen.queryByTestId('meal-spuntino_mattina')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Aggiungi spuntini' }));
    expect(screen.getByTestId('count-spuntino_mattina')).toHaveTextContent('1');
  });

  it('does not carry over optimized plan id after date changes', async () => {
    setup();
    const user = userEvent.setup();
    render(<DailyPlanPage />);

    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-03-10' } });
    await user.click(screen.getByRole('button', { name: 'Calcola quantità' }));

    await waitFor(() => {
      expect(screen.getByTestId('plan-id')).toHaveTextContent('plan-2026-03-10');
    });

    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-03-11' } });
    expect(screen.getByTestId('plan-id')).toHaveTextContent('none');
  });
});
