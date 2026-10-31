import { CREDITS_PER_USD, USAGE_WINDOWS } from 'librechat-data-provider';
import { logger, isValidObjectIdString } from '@librechat/data-schemas';
import type {
  TUsageSummary,
  TAdminUsageUser,
  TAdminUsageDetail,
  TUsageBreakdownRow,
} from 'librechat-data-provider';
import type {
  IUser,
  AppConfig,
  UsageEntry,
  UsageBreakdown,
  UserWindowSpend,
  UsageWindowRange,
  UsageBreakdownEntry,
} from '@librechat/data-schemas';
import type { FilterQuery } from 'mongoose';
import type { Response } from 'express';
import type { GetAppConfigOptions } from '~/app/service';
import type { ServerRequest } from '~/types/http';
import {
  getUsageLimits,
  findExceededWindow,
  getUserUsageSummary,
  LONGEST_USAGE_WINDOW_MS,
} from '~/usage/limits';
import { getAppConfigOptionsFromUser } from '~/app/service';
import { parsePagination } from './pagination';

const USAGE_USER_FIELDS = '_id name email role idOnTheSource tenantId';

export interface AdminUsageDeps {
  findUsers: (
    searchCriteria: FilterQuery<IUser>,
    fieldsToSelect?: string | string[] | null,
    options?: { limit?: number; offset?: number; sort?: Record<string, 1 | -1> },
  ) => Promise<IUser[]>;
  countUsers: (filter?: FilterQuery<IUser>) => Promise<number>;
  getUserById: (userId: string, fieldsToSelect?: string | string[] | null) => Promise<IUser | null>;
  getAppConfig: (options?: GetAppConfigOptions) => Promise<AppConfig>;
  aggregateUsageByUser: (
    windows: UsageWindowRange[],
    users?: string[],
  ) => Promise<UserWindowSpend[]>;
  getUserUsageEntries: (user: string, since: Date) => Promise<UsageEntry[]>;
  getUserUsageBreakdown: (user: string, since: Date, timezone?: string) => Promise<UsageBreakdown>;
}

const toUsd = (credits: number): number => Math.round((credits / CREDITS_PER_USD) * 1e6) / 1e6;

const toBreakdownRow = ({ credits, ...rest }: UsageBreakdownEntry): TUsageBreakdownRow => ({
  ...rest,
  spent: toUsd(credits),
});

const getUsageTimezone = (): string => process.env.USAGE_TIMEZONE || process.env.TZ || 'UTC';

export function createAdminUsageHandlers(deps: AdminUsageDeps): {
  listUsage: (req: ServerRequest, res: Response) => Promise<Response>;
  getUserUsage: (req: ServerRequest, res: Response) => Promise<Response>;
} {
  const {
    findUsers,
    countUsers,
    getUserById,
    getAppConfig,
    aggregateUsageByUser,
    getUserUsageEntries,
    getUserUsageBreakdown,
  } = deps;

  const resolveUserConfig = (user: IUser): Promise<AppConfig> =>
    getAppConfig(
      getAppConfigOptionsFromUser({
        id: user._id?.toString(),
        role: user.role,
        tenantId: user.tenantId,
        idOnTheSource: user.idOnTheSource ?? null,
      }),
    );

  /** Summary from the aggregate; resolves `resetAt` only for users already at a cap. */
  async function buildUserSummary(
    userId: string,
    appConfig: AppConfig,
    spend: UserWindowSpend | undefined,
  ): Promise<TUsageSummary> {
    const limits = getUsageLimits(appConfig);
    const summary: TUsageSummary = {
      enabled: limits.enabled,
      windows: USAGE_WINDOWS.map(({ key }) => ({
        key,
        spent: toUsd(spend?.spend[key] ?? 0),
        limit: limits.limits[key],
        resetAt: null,
      })),
    };
    if (!findExceededWindow(summary)) {
      return summary;
    }
    return getUserUsageSummary(userId, appConfig, getUserUsageEntries);
  }

  const toUsageUser = (
    user: IUser,
    summary: TUsageSummary,
    lastUsedAt: Date | null | undefined,
  ): TAdminUsageUser => ({
    id: user._id?.toString() ?? '',
    name: user.name ?? '',
    email: user.email ?? '',
    role: user.role ?? 'USER',
    lastUsedAt: lastUsedAt?.toISOString() ?? null,
    ...summary,
  });

  async function listUsageHandler(req: ServerRequest, res: Response) {
    try {
      const { limit, offset } = parsePagination(req.query);
      const [users, total] = await Promise.all([
        findUsers({}, USAGE_USER_FIELDS, { limit, offset, sort: { createdAt: -1 } }),
        countUsers(),
      ]);
      const now = Date.now();
      const windows = USAGE_WINDOWS.map(({ key, durationMs }) => ({
        key,
        since: new Date(now - durationMs),
      }));
      const userIds = users.map((u) => u._id?.toString() ?? '');
      const [spendRows, configs] = await Promise.all([
        aggregateUsageByUser(windows, userIds),
        Promise.all(users.map(resolveUserConfig)),
      ]);
      const spendByUser = new Map(spendRows.map((row) => [row.user, row]));
      const mapped = await Promise.all(
        users.map(async (user, i) => {
          const spend = spendByUser.get(userIds[i]);
          const summary = await buildUserSummary(userIds[i], configs[i], spend);
          return toUsageUser(user, summary, spend?.lastUsedAt);
        }),
      );
      return res.status(200).json({ users: mapped, total, limit, offset });
    } catch (error) {
      logger.error('[adminUsage] listUsage error:', error);
      return res.status(500).json({ error: 'Failed to list usage' });
    }
  }

  async function getUserUsageHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      const user = await getUserById(id, USAGE_USER_FIELDS);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const since = new Date(Date.now() - LONGEST_USAGE_WINDOW_MS);
      const appConfig = await resolveUserConfig(user);
      const [summary, breakdown, spendRows] = await Promise.all([
        getUserUsageSummary(id, appConfig, getUserUsageEntries),
        getUserUsageBreakdown(id, since, getUsageTimezone()),
        aggregateUsageByUser([{ key: 'monthly', since }], [id]),
      ]);
      const detail: TAdminUsageDetail = {
        ...toUsageUser(user, summary, spendRows[0]?.lastUsedAt),
        byModel: breakdown.byModel.map(toBreakdownRow),
        byDay: breakdown.byDay.map(toBreakdownRow),
      };
      return res.status(200).json(detail);
    } catch (error) {
      logger.error('[adminUsage] getUserUsage error:', error);
      return res.status(500).json({ error: 'Failed to get user usage' });
    }
  }

  return { listUsage: listUsageHandler, getUserUsage: getUserUsageHandler };
}
