import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Switch } from '@librechat/client';
import { REFILL_INTERVAL_UNITS } from 'librechat-data-provider';
import type { TAdminUser, RefillIntervalUnit, TAdminUserBalance } from 'librechat-data-provider';
import {
  useAdminUsersQuery,
  useAdminUserSearchQuery,
  useAdminUserBalanceQuery,
  useUpdateAdminUserBalanceMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';

const EMPTY_BALANCE: TAdminUserBalance = {
  userId: '',
  tokenCredits: 0,
  autoRefillEnabled: false,
  refillIntervalValue: 1,
  refillIntervalUnit: 'months',
  refillAmount: 0,
};

export default function BalancePanel() {
  const localize = useLocalize();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<TAdminUser | null>(null);
  const [draft, setDraft] = useState<TAdminUserBalance>(EMPTY_BALANCE);
  const [saved, setSaved] = useState(false);
  const usersQuery = useAdminUsersQuery({ limit: 50, offset: 0 });
  const searchQuery = useAdminUserSearchQuery(search);
  const balanceQuery = useAdminUserBalanceQuery(selectedUser?.id ?? null);
  const updateMutation = useUpdateAdminUserBalanceMutation();

  const users = useMemo<TAdminUser[]>(() => {
    if (search.trim().length < 2) {
      return usersQuery.data?.users ?? [];
    }
    return (searchQuery.data?.users ?? []).map((user) => ({
      ...user,
      avatar: user.avatarUrl ?? '',
      role: '',
      provider: '',
    }));
  }, [search, searchQuery.data?.users, usersQuery.data?.users]);

  useEffect(() => {
    if (balanceQuery.data == null) {
      return;
    }
    setDraft(balanceQuery.data);
    setSaved(false);
  }, [balanceQuery.data]);

  const updateNumber =
    (field: 'tokenCredits' | 'refillIntervalValue' | 'refillAmount') =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      setDraft((current) => ({ ...current, [field]: Number.isFinite(value) ? value : 0 }));
      setSaved(false);
    };

  const save = () => {
    if (selectedUser == null) {
      return;
    }
    const { userId: _userId, ...balance } = draft;
    updateMutation.mutate(
      { userId: selectedUser.id, balance },
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <section className="flex h-full min-h-0 flex-col text-text-primary">
      <header className="border-b border-border-light px-4 py-4">
        <h2 className="text-base font-semibold">{localize('com_admin_balance_title')}</h2>
        <p className="mt-1 text-xs text-text-secondary">
          {localize('com_admin_balance_description')}
        </p>
        <Input
          className="mt-3"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={localize('com_admin_balance_search')}
          aria-label={localize('com_admin_balance_search')}
        />
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(120px,35%)_1fr] md:grid-rows-[minmax(140px,40%)_1fr]">
        <div className="overflow-y-auto border-b border-border-light p-2">
          {(usersQuery.isLoading || searchQuery.isLoading) && (
            <p className="p-3 text-sm text-text-secondary">{localize('com_ui_loading')}</p>
          )}
          {!usersQuery.isLoading && !searchQuery.isLoading && users.length === 0 && (
            <p className="p-3 text-sm text-text-secondary">
              {localize('com_admin_balance_no_users')}
            </p>
          )}
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => setSelectedUser(user)}
              aria-label={`${user.name} ${user.email}`}
              className={`mb-1 w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-hover ${
                selectedUser?.id === user.id ? 'bg-surface-active-alt' : ''
              }`}
            >
              <span className="block truncate text-sm font-medium">{user.name || user.email}</span>
              <span className="block truncate text-xs text-text-secondary">{user.email}</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          {selectedUser == null && (
            <p className="text-sm text-text-secondary">
              {localize('com_admin_balance_select_user')}
            </p>
          )}
          {selectedUser != null && balanceQuery.isLoading && (
            <p className="text-sm text-text-secondary">{localize('com_ui_loading')}</p>
          )}
          {selectedUser != null && !balanceQuery.isLoading && (
            <div className="space-y-4">
              <div>
                <h3 className="truncate text-sm font-semibold">{selectedUser.name}</h3>
                <p className="truncate text-xs text-text-secondary">{selectedUser.email}</p>
              </div>

              <label className="block space-y-1 text-xs font-medium">
                <span>{localize('com_admin_balance_token_credits')}</span>
                <Input
                  type="number"
                  min="0"
                  value={draft.tokenCredits}
                  onChange={updateNumber('tokenCredits')}
                  aria-label={localize('com_admin_balance_token_credits')}
                />
              </label>

              <div className="flex items-center justify-between gap-3">
                <label htmlFor="admin-auto-refill" className="text-xs font-medium">
                  {localize('com_admin_balance_auto_refill')}
                </label>
                <Switch
                  id="admin-auto-refill"
                  checked={draft.autoRefillEnabled}
                  onCheckedChange={(autoRefillEnabled) => {
                    setDraft((current) => ({ ...current, autoRefillEnabled }));
                    setSaved(false);
                  }}
                  aria-label={localize('com_admin_balance_auto_refill')}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-xs font-medium">
                  <span>{localize('com_admin_balance_refill_interval')}</span>
                  <Input
                    type="number"
                    min="1"
                    disabled={!draft.autoRefillEnabled}
                    value={draft.refillIntervalValue}
                    onChange={updateNumber('refillIntervalValue')}
                    aria-label={localize('com_admin_balance_refill_interval')}
                  />
                </label>
                <label className="block space-y-1 text-xs font-medium">
                  <span>{localize('com_admin_balance_refill_unit')}</span>
                  <select
                    className="h-10 w-full rounded-md border border-border-medium bg-surface-primary px-3 text-sm"
                    disabled={!draft.autoRefillEnabled}
                    value={draft.refillIntervalUnit}
                    onChange={(event) => {
                      setDraft((current) => ({
                        ...current,
                        refillIntervalUnit: event.target.value as RefillIntervalUnit,
                      }));
                      setSaved(false);
                    }}
                    aria-label={localize('com_admin_balance_refill_unit')}
                  >
                    {REFILL_INTERVAL_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {localize(`com_nav_balance_${unit}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-1 text-xs font-medium">
                <span>{localize('com_admin_balance_refill_amount')}</span>
                <Input
                  type="number"
                  min="0"
                  disabled={!draft.autoRefillEnabled}
                  value={draft.refillAmount}
                  onChange={updateNumber('refillAmount')}
                  aria-label={localize('com_admin_balance_refill_amount')}
                />
              </label>

              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-xs text-green-600 dark:text-green-400">
                  {saved ? localize('com_admin_balance_saved') : ''}
                </span>
                <Button
                  type="button"
                  onClick={save}
                  disabled={updateMutation.isLoading}
                  aria-label={localize('com_admin_balance_save')}
                >
                  {localize('com_admin_balance_save')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
