import { Types } from 'mongoose';
import type { FilterQuery, PipelineStage } from 'mongoose';
import type { ITransaction } from '~/schema/transaction';

/** A single spend event; `credits` is positive (1 USD = 1,000,000 credits). */
export interface UsageEntry {
  createdAt: Date;
  credits: number;
}

export interface UsageWindowRange {
  key: string;
  since: Date;
}

export interface UserWindowSpend {
  user: string;
  /** Credits spent per window key */
  spend: Record<string, number>;
  lastUsedAt: Date | null;
}

export interface UsageBreakdownEntry {
  key: string;
  credits: number;
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

export interface UsageBreakdown {
  byModel: UsageBreakdownEntry[];
  byDay: UsageBreakdownEntry[];
}

const SPEND_TOKEN_TYPES = ['prompt', 'completion'];

const toObjectId = (id: string): Types.ObjectId => new Types.ObjectId(id);

const breakdownGroup = (key: unknown): PipelineStage.Group['$group'] => ({
  _id: key,
  credits: { $sum: { $multiply: ['$tokenValue', -1] } },
  requests: { $sum: { $cond: [{ $eq: ['$tokenType', 'prompt'] }, 1, 0] } },
  inputTokens: {
    $sum: { $cond: [{ $eq: ['$tokenType', 'prompt'] }, { $abs: '$rawAmount' }, 0] },
  },
  outputTokens: {
    $sum: { $cond: [{ $eq: ['$tokenType', 'completion'] }, { $abs: '$rawAmount' }, 0] },
  },
});

interface BreakdownRow {
  _id: string | null;
  credits: number;
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

const toBreakdownEntry = ({ _id, ...rest }: BreakdownRow): UsageBreakdownEntry => ({
  key: _id ?? 'unknown',
  ...rest,
});

export interface UsageMethods {
  getUserUsageEntries: (user: string, since: Date) => Promise<UsageEntry[]>;
  aggregateUsageByUser: (
    windows: UsageWindowRange[],
    users?: string[],
  ) => Promise<UserWindowSpend[]>;
  getUserUsageBreakdown: (user: string, since: Date, timezone?: string) => Promise<UsageBreakdown>;
}

export function createUsageMethods(mongoose: typeof import('mongoose')): UsageMethods {
  /** Spend events for one user since `since`, oldest first. */
  async function getUserUsageEntries(user: string, since: Date): Promise<UsageEntry[]> {
    const Transaction = mongoose.models.Transaction;
    const rows = await Transaction.find(
      { user, createdAt: { $gte: since }, tokenType: { $in: SPEND_TOKEN_TYPES } },
      { _id: 0, createdAt: 1, tokenValue: 1 },
    )
      .sort({ createdAt: 1 })
      .lean<Array<{ createdAt: Date; tokenValue?: number }>>();
    return rows.map(({ createdAt, tokenValue }) => ({
      createdAt,
      credits: -(tokenValue ?? 0),
    }));
  }

  /** Credits spent per user in each window, in a single pass over the widest window. */
  async function aggregateUsageByUser(
    windows: UsageWindowRange[],
    users?: string[],
  ): Promise<UserWindowSpend[]> {
    if (windows.length === 0) {
      return [];
    }
    const Transaction = mongoose.models.Transaction;
    const earliest = new Date(Math.min(...windows.map(({ since }) => since.getTime())));
    const match: FilterQuery<ITransaction> = {
      createdAt: { $gte: earliest },
      tokenType: { $in: SPEND_TOKEN_TYPES },
    };
    if (users) {
      match.user = { $in: users.map(toObjectId) };
    }
    const windowSums = Object.fromEntries(
      windows.map(({ key, since }) => [
        key,
        {
          $sum: {
            $cond: [{ $gte: ['$createdAt', since] }, { $multiply: ['$tokenValue', -1] }, 0],
          },
        },
      ]),
    );
    const rows = await Transaction.aggregate<
      { _id: Types.ObjectId; lastUsedAt: Date } & Record<string, number>
    >([
      { $match: match },
      { $group: { _id: '$user', lastUsedAt: { $max: '$createdAt' }, ...windowSums } },
    ]);
    return rows.map(({ _id, lastUsedAt, ...rest }) => ({
      user: _id.toString(),
      lastUsedAt: lastUsedAt ?? null,
      spend: Object.fromEntries(windows.map(({ key }) => [key, Number(rest[key] ?? 0)])),
    }));
  }

  /** Per-model and per-day spend for one user since `since`. */
  async function getUserUsageBreakdown(
    user: string,
    since: Date,
    timezone = 'UTC',
  ): Promise<UsageBreakdown> {
    const Transaction = mongoose.models.Transaction;
    const [result] = await Transaction.aggregate<{
      byModel: BreakdownRow[];
      byDay: BreakdownRow[];
    }>([
      {
        $match: {
          user: toObjectId(user),
          createdAt: { $gte: since },
          tokenType: { $in: SPEND_TOKEN_TYPES },
        },
      },
      {
        $facet: {
          byModel: [{ $group: breakdownGroup('$model') }, { $sort: { credits: -1 } }],
          byDay: [
            {
              $group: breakdownGroup({
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone },
              }),
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);
    return {
      byModel: (result?.byModel ?? []).map(toBreakdownEntry),
      byDay: (result?.byDay ?? []).map(toBreakdownEntry),
    };
  }

  return { getUserUsageEntries, aggregateUsageByUser, getUserUsageBreakdown };
}
