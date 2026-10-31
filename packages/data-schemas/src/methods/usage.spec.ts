import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createUsageMethods } from './usage';
import { createModels } from '~/models';

const HOUR = 60 * 60 * 1000;

let mongoServer: InstanceType<typeof MongoMemoryServer>;
let Transaction: mongoose.Model<unknown>;
let methods: ReturnType<typeof createUsageMethods>;

const userA = new mongoose.Types.ObjectId();
const userB = new mongoose.Types.ObjectId();
const now = new Date('2026-10-31T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * HOUR);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  Object.assign(mongoose.models, createModels(mongoose));
  Transaction = mongoose.models.Transaction;
  methods = createUsageMethods(mongoose);
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await Transaction.collection.insertMany([
    {
      user: userA,
      tokenType: 'prompt',
      model: 'm1',
      rawAmount: -1000,
      tokenValue: -500_000,
      createdAt: hoursAgo(1),
    },
    {
      user: userA,
      tokenType: 'completion',
      model: 'm1',
      rawAmount: -200,
      tokenValue: -250_000,
      createdAt: hoursAgo(1),
    },
    {
      user: userA,
      tokenType: 'prompt',
      model: 'm2',
      rawAmount: -4000,
      tokenValue: -2_000_000,
      createdAt: hoursAgo(48),
    },
    {
      user: userA,
      tokenType: 'credits',
      rawAmount: 10_000_000,
      tokenValue: 10_000_000,
      createdAt: hoursAgo(2),
    },
    {
      user: userA,
      tokenType: 'prompt',
      model: 'm1',
      rawAmount: -1,
      tokenValue: -9_000_000,
      createdAt: hoursAgo(24 * 40),
    },
    {
      user: userB,
      tokenType: 'prompt',
      model: 'm1',
      rawAmount: -100,
      tokenValue: -100_000,
      createdAt: hoursAgo(3),
    },
  ]);
});

describe('getUserUsageEntries', () => {
  it('returns spend entries since the cutoff, oldest first, as positive credits', async () => {
    const entries = await methods.getUserUsageEntries(userA.toString(), hoursAgo(24 * 30));
    expect(entries.map((e) => e.credits)).toEqual([2_000_000, 500_000, 250_000]);
    expect(entries[0].createdAt.getTime()).toBe(hoursAgo(48).getTime());
  });
});

describe('aggregateUsageByUser', () => {
  it('sums each window per user in one pass and ignores credit refills', async () => {
    const rows = await methods.aggregateUsageByUser([
      { key: 'fiveHour', since: hoursAgo(5) },
      { key: 'monthly', since: hoursAgo(24 * 30) },
    ]);
    const byUser = new Map(rows.map((r) => [r.user, r]));
    expect(byUser.get(userA.toString())?.spend).toEqual({ fiveHour: 750_000, monthly: 2_750_000 });
    expect(byUser.get(userB.toString())?.spend).toEqual({ fiveHour: 100_000, monthly: 100_000 });
    expect(byUser.get(userA.toString())?.lastUsedAt?.getTime()).toBe(hoursAgo(1).getTime());
  });

  it('restricts to the given users', async () => {
    const rows = await methods.aggregateUsageByUser(
      [{ key: 'monthly', since: hoursAgo(24 * 30) }],
      [userB.toString()],
    );
    expect(rows.map((r) => r.user)).toEqual([userB.toString()]);
  });
});

describe('getUserUsageBreakdown', () => {
  it('groups spend by model and by day', async () => {
    const { byModel, byDay } = await methods.getUserUsageBreakdown(
      userA.toString(),
      hoursAgo(24 * 30),
    );
    expect(byModel).toEqual([
      { key: 'm2', credits: 2_000_000, requests: 1, inputTokens: 4000, outputTokens: 0 },
      { key: 'm1', credits: 750_000, requests: 1, inputTokens: 1000, outputTokens: 200 },
    ]);
    expect(byDay.map((d) => d.key)).toEqual(['2026-10-29', '2026-10-31']);
  });
});
