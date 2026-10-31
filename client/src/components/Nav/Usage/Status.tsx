import { useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { useRecoilValue } from 'recoil';
import type { TUsageWindow } from 'librechat-data-provider';
import {
  formatUsd,
  usagePercent,
  formatCountdown,
  usageWindowLabelKeys,
  usageWindowShortLabelKeys,
} from '~/utils/usage';
import { useAuthContext } from '~/hooks/AuthContext';
import { useGetUsageQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';

const countdownOf = (window: TUsageWindow): string | null =>
  formatCountdown(window.resetAt ?? window.releaseAt);

const isBlocked = (window: TUsageWindow): boolean =>
  window.limit != null && window.spent >= window.limit;

function WindowMeter({ window }: { window: TUsageWindow }) {
  const localize = useLocalize();
  const percent = usagePercent(window.spent, window.limit) ?? 0;
  const blocked = isBlocked(window);
  const fill = blocked ? 'bg-red-500' : 'bg-green-600';
  const countdown = blocked ? countdownOf(window) : null;

  return (
    <span className="flex items-center gap-1.5">
      <span>{localize(usageWindowShortLabelKeys[window.key])}</span>
      <span
        aria-hidden="true"
        className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-tertiary"
      >
        <span
          className={cn(
            'block h-full rounded-full',
            !blocked && percent >= 80 ? 'bg-amber-500' : fill,
          )}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className={cn('tabular-nums', blocked && 'font-medium text-red-500')}>
        {Math.round(percent)}%
      </span>
      {blocked && (
        <span className="flex items-center gap-0.5 font-medium text-red-500">
          <Lock className="size-3" aria-hidden="true" />
          {countdown}
        </span>
      )}
    </span>
  );
}

/**
 * Chat footer usage meter: a mini bar per capped rolling window (5h / week / month),
 * lock and countdown when blocked, USD detail on hover. Uncapped users see their spend.
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
      className="flex items-center gap-3 whitespace-nowrap text-xs text-text-secondary"
      title={tooltip}
      aria-label={tooltip}
      role="status"
    >
      {capped.length > 0 ? (
        capped.map((w) => <WindowMeter key={w.key} window={w} />)
      ) : (
        <span className="tabular-nums">
          {data.windows
            .map((w) => `${localize(usageWindowShortLabelKeys[w.key])} ${formatUsd(w.spent)}`)
            .join(' · ')}{' '}
          · {localize('com_nav_usage_unlimited')}
        </span>
      )}
    </div>
  );
}
