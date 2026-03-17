import { render, screen } from '@testing-library/react';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import userEvent from '@testing-library/user-event';
import type { ChangeEvent, ReactNode } from 'react';
import type { MealState } from './plan-template-bar';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApi, mockCompletePlan, mockUseMutation, mockUseQuery } = vi.hoisted(() => ({
  mockApi: {
    dailyPlans: {
      complete: 'dailyPlans.complete',
    },
    templates: {
      list: 'templates.list',
      save: 'templates.save',
    },
  },
  mockCompletePlan: vi.fn(),
  mockUseMutation: vi.fn(),
  mockUseQuery: vi.fn(),
}));

vi.mock('convex/react', () => ({
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('@ratio-diet/backend/convex/_generated/api', () => ({
  api: mockApi,
}));

vi.mock('@ratio-diet/ui/components/button', () => ({
  Button: ({
    children,
    disabled,
    onClick,
    type,
  }: {
    children: ReactNode;
    type?: 'button' | 'submit';
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type={type ?? 'button'} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@ratio-diet/ui/components/input', () => ({
  Input: ({
    className,
    onChange,
    placeholder,
    required,
    value,
  }: {
    className?: string;
    placeholder?: string;
    value?: string;
    required?: boolean;
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <input
      className={className}
      placeholder={placeholder}
      value={value}
      required={required}
      onChange={onChange}
    />
  ),
}));

import PlanTemplateBar from './plan-template-bar';

describe('PlanTemplateBar complete button regressions', () => {
  beforeEach(() => {
    mockCompletePlan.mockReset();
    mockCompletePlan.mockResolvedValue(undefined);
    mockUseQuery.mockImplementation((query: string) => {
      if (query === mockApi.templates.list) return [];
      return null;
    });
    mockUseMutation.mockImplementation((mutation: string) => {
      if (mutation === mockApi.dailyPlans.complete) return mockCompletePlan;
      return async () => null;
    });
  });

  it('resets done state when planId changes', async () => {
    const user = userEvent.setup();
    const meals: MealState[] = [{ items: [], type: 'colazione' }];
    const onLoadTemplate = vi.fn();
    const planA = 'plan-a' as Id<'dailyPlans'>;
    const planB = 'plan-b' as Id<'dailyPlans'>;

    const { rerender } = render(<PlanTemplateBar meals={[...meals]} onLoadTemplate={onLoadTemplate} planId={planA} />);

    await user.click(screen.getByRole('button', { name: 'Completa giornata' }));

    expect(mockCompletePlan).toHaveBeenCalledWith({ planId: planA });
    expect(screen.getByRole('button', { name: 'Completato!' })).toBeDisabled();

    rerender(<PlanTemplateBar meals={[...meals]} onLoadTemplate={onLoadTemplate} planId={planB} />);

    const resetButton = screen.getByRole('button', { name: 'Completa giornata' });
    expect(resetButton).toBeEnabled();

    await user.click(resetButton);
    expect(mockCompletePlan).toHaveBeenCalledWith({ planId: planB });
  });
});
