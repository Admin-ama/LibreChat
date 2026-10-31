import type { UsageWindowKey } from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';

export const usageWindowLabelKeys: Record<UsageWindowKey, TranslationKeys> = {
  fiveHour: 'com_nav_usage_five_hour',
  weekly: 'com_nav_usage_weekly',
  monthly: 'com_nav_usage_monthly',
};

export const usageWindowShortLabelKeys: Record<UsageWindowKey, TranslationKeys> = {
  fiveHour: 'com_nav_usage_five_hour_short',
  weekly: 'com_nav_usage_weekly_short',
  monthly: 'com_nav_usage_monthly_short',
};

const resetFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatResetAt = (iso: string): string => resetFormatter.format(new Date(iso));

/** Percentage of the cap used, clamped to 0–100; `null` when uncapped. */
export const usagePercent = (spent: number, limit: number | null): number | null => {
  if (limit == null) {
    return null;
  }
  if (limit <= 0) {
    return 100;
  }
  return Math.min(100, Math.max(0, (spent / limit) * 100));
};

/** Compact time left until `iso`, e.g. "4h 45m", "2d 10h", "12m"; `null` when past or missing. */
export const formatCountdown = (
  iso: string | null | undefined,
  now: number = Date.now(),
): string | null => {
  if (iso == null) {
    return null;
  }
  const minutes = Math.ceil((new Date(iso).getTime() - now) / 60000);
  if (minutes <= 0) {
    return null;
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};
