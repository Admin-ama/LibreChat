import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import type { TUsageWindow } from 'librechat-data-provider';
import { formatUsd, usagePercent, formatCountdown, usageWindowLabelKeys } from '~/utils/usage';
import { useAuthContext } from '~/hooks/AuthContext';
import { useGetUsageQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';

const countdownOf = (window: TUsageWindow): string | null =>
  formatCountdown(window.resetAt ?? window.releaseAt);

/**
 * Compact OpenCode/Claude-style meter for the chat footer: one bar for the most
 * used window plus "% and time left" per capped window; full USD detail on hover.
 */
export default function UsageStatus() {
  const localize = useLocalize();
  const { isAuthenticated } = useAuthContext();
  const { data, refetch } = useGetUsageQuery({ enabled: !!isAuthenticated });
  const submitting = useRecoilValue(store.anySubmittingSelector);
  const wasSubmitting = useRef(submitting);

  useEffect(() => {
    if (wasSubmitting.current && !submitting) {
      refetch();
    }
    wasSubmitting.current = submitting;
  }, [submitting, refetch]);

  if (data == null || data.windows.length === 0) {
    return null;
  }

  const capped = data.enabled ? data.windows.filter((w) => w.limit != null) : [];
  const percents = capped.map((w) => usagePercent(w.spent, w.limit) ?? 0);
  const top = percents.length > 0 ? Math.max(...percents) : 0;
  const blocked = capped.some((w) => w.limit != null && w.spent >= w.limit);
  const barColor = blocked ? 'bg-red-500' : 'bg-green-600';

  const tooltip = data.windows
    .map((w) => {
      const label = localize(usageWindowLabelKeys[w.key]);
      const amount =
        data.enabled && w.limit != null
          ? `${formatUsd(w.spent)} / ${formatUsd(w.limit)}`
          : formatUsd(w.spent);
      const countdown = countdownOf(w);
      return countdown
        ? `${label}: ${amount} · ${localize('com_nav_usage_frees_in', { 0: countdown })}`
        : `${label}: ${amount}`;
    })
    .join('\n');

  return (
    <div
      className="flex items-center gap-2 whitespace-nowrap text-xs text-text-secondary"
      title={tooltip}
      aria-label={tooltip}
      role="status"
    >
      <span>{localize('com_nav_usage_used')}</span>
      {capped.length > 0 && (
        <span
          aria-hidden="true"
          className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-tertiary"
        >
          <span
            className={cn(
              'block h-full rounded-full',
              !blocked && top >= 80 ? 'bg-amber-500' : barColor,
            )}
            style={{ width: `${top}%` }}
          />
        </span>
      )}
      {capped.length > 0 ? (
        <span className="tabular-nums">
          {capped.map((w, i) => {
            const countdown = countdownOf(w);
            const isBlocked = w.limit != null && w.spent >= w.limit;
            return (
              <span key={w.key}>
                {i > 0 && ' · '}
                <span className={cn(isBlocked && 'font-medium text-red-500')}>
                  {Math.round(percents[i])}%{countdown ? ` ${countdown}` : ''}
                </span>
              </span>
            );
          })}
        </span>
      ) : (
        <span className="tabular-nums">
          {data.windows.map((w) => formatUsd(w.spent)).join(' · ')} ·{' '}
          {localize('com_nav_usage_unlimited')}
        </span>
      )}
    </div>
  );
}
