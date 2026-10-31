import { logger } from '@librechat/data-schemas';
import { USAGE_WINDOWS, CREDITS_PER_USD, ViolationTypes } from 'librechat-data-provider';
import type {
  TUsageWindow,
  TUsageSummary,
  UsageWindowKey,
  TUsageLimitsConfig,
} from 'librechat-data-provider';
import type { AppConfig, UsageEntry } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';

export const LONGEST_USAGE_WINDOW_MS: number = Math.max(...USAGE_WINDOWS.map((w) => w.durationMs));

export interface ResolvedUsageLimits {
  enabled: boolean;
  /** USD cap per window, `null` when uncapped */
  limits: Record<UsageWindowKey, number | null>;
}

export interface UsageLimitError {
  type: ViolationTypes.USAGE_LIMIT;
  window: UsageWindowKey;
  limit: number;
  spent: number;
  resetAt: string | null;
}

export interface CheckUsageLimitsDeps {
  getUserUsageEntries: (user: string, since: Date) => Promise<UsageEntry[]>;
  logViolation: (
    req: unknown,
    res: unknown,
    type: string,
    errorMessage: UsageLimitError,
    score: number,
  ) => Promise<void>;
}

const toUsd = (credits: number): number => Math.round((credits / CREDITS_PER_USD) * 1e6) / 1e6;

/** Normalizes the (possibly principal-overridden) `usageLimits` section of an app config. */
export function getUsageLimits(appConfig?: AppConfig | null): ResolvedUsageLimits {
  const config: Partial<TUsageLimitsConfig> = appConfig?.usageLimits ?? {};
  const limits = Object.fromEntries(
    USAGE_WINDOWS.map(({ key }) => {
      const value = config[key];
      return [key, typeof value === 'number' && value >= 0 ? value : null];
    }),
  ) as Record<UsageWindowKey, number | null>;
  const hasAnyLimit = Object.values(limits).some((value) => value != null);
  return { enabled: config.enabled === true && hasAnyLimit, limits };
}

/**
 * Earliest moment the rolling window drops back under its cap: walk the oldest
 * spend forward until the remainder is below the limit, then add the window length.
 */
function findResetAt(
  entries: UsageEntry[],
  startIndex: number,
  spentCredits: number,
  limitCredits: number,
  durationMs: number,
): string | null {
  if (limitCredits <= 0) {
    return null;
  }
  let remaining = spentCredits;
  for (let i = startIndex; i < entries.length; i++) {
    remaining -= entries[i].credits;
    if (remaining < limitCredits) {
      return new Date(entries[i].createdAt.getTime() + durationMs).toISOString();
    }
  }
  return null;
}

/**
 * Builds the per-window summary from spend entries sorted oldest first.
 * Entries older than the longest window are ignored.
 */
export function summarizeUsage(
  entries: UsageEntry[],
  limits: ResolvedUsageLimits,
  now: Date = new Date(),
): TUsageSummary {
  const windows: TUsageWindow[] = USAGE_WINDOWS.map(({ key, durationMs }) => {
    const since = now.getTime() - durationMs;
    let startIndex = entries.length;
    let spentCredits = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].createdAt.getTime() < since) {
        break;
      }
      startIndex = i;
      spentCredits += entries[i].credits;
    }
    const limit = limits.limits[key];
    const limitCredits = limit == null ? null : limit * CREDITS_PER_USD;
    const resetAt =
      limitCredits != null && spentCredits >= limitCredits
        ? findResetAt(entries, startIndex, spentCredits, limitCredits, durationMs)
        : null;
    return { key, spent: toUsd(spentCredits), limit, resetAt };
  });
  return { enabled: limits.enabled, windows };
}

/** First window whose cap is reached, if any. */
export function findExceededWindow(summary: TUsageSummary): TUsageWindow | undefined {
  return summary.windows.find(({ spent, limit }) => limit != null && spent >= limit);
}

/** Loads a user's spend for the longest window and summarizes it against their limits. */
export async function getUserUsageSummary(
  user: string,
  appConfig: AppConfig | null | undefined,
  getUserUsageEntries: CheckUsageLimitsDeps['getUserUsageEntries'],
  now: Date = new Date(),
): Promise<TUsageSummary> {
  const limits = getUsageLimits(appConfig);
  const since = new Date(now.getTime() - LONGEST_USAGE_WINDOW_MS);
  const entries = await getUserUsageEntries(user, since);
  return summarizeUsage(entries, limits, now);
}

/**
 * Blocks the request when any rolling window cap is reached.
 * Throws a JSON-encoded {@link UsageLimitError}, mirroring `checkBalance`.
 */
export async function checkUsageLimits(
  {
    req,
    res,
    user,
    appConfig,
  }: { req: ServerRequest; res: Response; user: string; appConfig?: AppConfig | null },
  deps: CheckUsageLimitsDeps,
): Promise<boolean> {
  if (!getUsageLimits(appConfig).enabled) {
    return true;
  }
  const summary = await getUserUsageSummary(user, appConfig, deps.getUserUsageEntries);
  const exceeded = findExceededWindow(summary);
  if (!exceeded || exceeded.limit == null) {
    return true;
  }
  const errorMessage: UsageLimitError = {
    type: ViolationTypes.USAGE_LIMIT,
    window: exceeded.key,
    limit: exceeded.limit,
    spent: exceeded.spent,
    resetAt: exceeded.resetAt,
  };
  logger.debug('[usageLimits] cap reached', { user, ...errorMessage });
  await deps.logViolation(req, res, errorMessage.type, errorMessage, 0);
  throw new Error(JSON.stringify(errorMessage));
}
