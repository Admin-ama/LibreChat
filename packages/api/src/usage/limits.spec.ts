import { ViolationTypes } from 'librechat-data-provider';
import type { AppConfig, UsageEntry } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import { summarizeUsage, getUsageLimits, checkUsageLimits } from './limits';

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-10-31T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * HOUR);
const usd = (amount: number) => amount * 1_000_000;

const config = (usageLimits: AppConfig['usageLimits']) => ({ usageLimits }) as AppConfig;
const limits = getUsageLimits(config({ enabled: true, fiveHour: 2, weekly: 5, monthly: 10 }));

describe('getUsageLimits', () => {
  it('is disabled without config or without any cap', () => {
    expect(getUsageLimits(undefined).enabled).toBe(false);
    expect(getUsageLimits(config({ enabled: true })).enabled).toBe(false);
    expect(getUsageLimits(config({ enabled: false, monthly: 10 })).enabled).toBe(false);
  });

  it('treats missing or null windows as uncapped', () => {
    const resolved = getUsageLimits(config({ enabled: true, monthly: 10, weekly: null }));
    expect(resolved).toEqual({
      enabled: true,
      limits: { fiveHour: null, weekly: null, monthly: 10 },
    });
  });
});

describe('summarizeUsage', () => {
  it('sums spend per rolling window', () => {
    const entries: UsageEntry[] = [
      { createdAt: hoursAgo(24 * 20), credits: usd(3) },
      { createdAt: hoursAgo(24 * 2), credits: usd(1) },
      { createdAt: hoursAgo(1), credits: usd(0.5) },
    ];
    const { windows } = summarizeUsage(entries, limits, now);
    const releaseAt = (h: number, windowHours: number) =>
      new Date(hoursAgo(h).getTime() + windowHours * HOUR).toISOString();
    expect(windows).toEqual([
      { key: 'fiveHour', spent: 0.5, limit: 2, resetAt: null, releaseAt: releaseAt(1, 5) },
      { key: 'weekly', spent: 1.5, limit: 5, resetAt: null, releaseAt: releaseAt(48, 168) },
      { key: 'monthly', spent: 4.5, limit: 10, resetAt: null, releaseAt: releaseAt(480, 720) },
    ]);
  });

  it('resets when enough of the oldest spend leaves the window', () => {
    const entries: UsageEntry[] = [
      { createdAt: hoursAgo(4), credits: usd(1.5) },
      { createdAt: hoursAgo(2), credits: usd(0.4) },
      { createdAt: hoursAgo(1), credits: usd(0.3) },
    ];
    const fiveHour = summarizeUsage(entries, limits, now).windows[0];
    expect(fiveHour.spent).toBeCloseTo(2.2);
    expect(fiveHour.resetAt).toBe(new Date(hoursAgo(4).getTime() + 5 * HOUR).toISOString());
  });

  it('never resolves a reset for a zero cap', () => {
    const zero = getUsageLimits(config({ enabled: true, monthly: 0 }));
    const monthly = summarizeUsage([], zero, now).windows[2];
    expect(monthly).toEqual({ key: 'monthly', spent: 0, limit: 0, resetAt: null, releaseAt: null });
  });
});

describe('checkUsageLimits', () => {
  const req = {} as ServerRequest;
  const res = {} as Response;

  it('skips the lookup when limits are disabled', async () => {
    const getUserUsageEntries = jest.fn();
    const logViolation = jest.fn();
    await expect(
      checkUsageLimits(
        { req, res, user: 'u1', appConfig: config(undefined) },
        { getUserUsageEntries, logViolation },
      ),
    ).resolves.toBe(true);
    expect(getUserUsageEntries).not.toHaveBeenCalled();
  });

  it('throws a usage_limit violation naming the first exceeded window', async () => {
    const getUserUsageEntries = jest
      .fn()
      .mockResolvedValue([{ createdAt: new Date(Date.now() - HOUR), credits: usd(2.5) }]);
    const logViolation = jest.fn().mockResolvedValue(undefined);
    const appConfig = config({ enabled: true, fiveHour: 2, weekly: 5, monthly: 10 });

    const error = await checkUsageLimits(
      { req, res, user: 'u1', appConfig },
      { getUserUsageEntries, logViolation },
    ).catch((e: Error) => JSON.parse(e.message));

    expect(error).toMatchObject({ type: ViolationTypes.USAGE_LIMIT, window: 'fiveHour', limit: 2 });
    expect(typeof error.resetAt).toBe('string');
    expect(logViolation).toHaveBeenCalledWith(req, res, ViolationTypes.USAGE_LIMIT, error, 0);
  });
});
