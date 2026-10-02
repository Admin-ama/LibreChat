import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TAdminUserBalance } from 'librechat-data-provider';
import BalancePanel from './BalancePanel';

const mockUpdateBalance = jest.fn();
let mockSelectedBalance: TAdminUserBalance | undefined;

jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked: boolean;
    onCheckedChange: (value: boolean) => void;
    'aria-label': string;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      {...props}
    />
  ),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/data-provider', () => ({
  useAdminUsersQuery: () => ({
    data: {
      users: [
        {
          id: 'user-1',
          name: 'Ana Admin',
          username: 'ana',
          email: 'ana@example.com',
          avatar: '',
          role: 'USER',
          provider: 'local',
        },
      ],
    },
    isLoading: false,
  }),
  useAdminUserSearchQuery: () => ({ data: undefined, isLoading: false }),
  useAdminUserBalanceQuery: () => ({ data: mockSelectedBalance, isLoading: false }),
  useUpdateAdminUserBalanceMutation: () => ({ mutate: mockUpdateBalance, isLoading: false }),
}));

describe('BalancePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedBalance = {
      userId: 'user-1',
      tokenCredits: 250000,
      autoRefillEnabled: true,
      refillIntervalValue: 1,
      refillIntervalUnit: 'months',
      refillAmount: 500000,
    };
  });

  it('edits and saves a user-specific automatic refill policy', () => {
    render(<BalancePanel />);

    fireEvent.click(screen.getByRole('button', { name: /Ana Admin/ }));
    fireEvent.change(screen.getByLabelText('com_admin_balance_token_credits'), {
      target: { value: '300000' },
    });
    fireEvent.change(screen.getByLabelText('com_admin_balance_refill_interval'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('com_admin_balance_refill_unit'), {
      target: { value: 'weeks' },
    });
    fireEvent.change(screen.getByLabelText('com_admin_balance_refill_amount'), {
      target: { value: '750000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'com_admin_balance_save' }));

    expect(mockUpdateBalance).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        balance: {
          tokenCredits: 300000,
          autoRefillEnabled: true,
          refillIntervalValue: 2,
          refillIntervalUnit: 'weeks',
          refillAmount: 750000,
        },
      },
      expect.any(Object),
    );
  });

  it('disables refill controls when automatic refill is off', () => {
    mockSelectedBalance = { ...mockSelectedBalance!, autoRefillEnabled: false };
    render(<BalancePanel />);

    fireEvent.click(screen.getByRole('button', { name: /Ana Admin/ }));

    expect(screen.getByLabelText('com_admin_balance_refill_interval')).toBeDisabled();
    expect(screen.getByLabelText('com_admin_balance_refill_unit')).toBeDisabled();
    expect(screen.getByLabelText('com_admin_balance_refill_amount')).toBeDisabled();
  });
});
