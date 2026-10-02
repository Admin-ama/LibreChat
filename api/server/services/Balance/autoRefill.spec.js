const { runAutoRefillSweep } = require('./autoRefill');

describe('runAutoRefillSweep', () => {
  const now = new Date('2026-08-11T15:00:00.000Z');

  it('refills an eligible account even when it still has credits', async () => {
    const deps = {
      findAutoRefillBalances: jest.fn().mockResolvedValue([
        {
          user: 'user-1',
          tokenCredits: 5000,
          autoRefillEnabled: true,
          refillIntervalValue: 1,
          refillIntervalUnit: 'hours',
          refillAmount: 1000,
          lastRefill: new Date('2026-08-11T13:00:00.000Z'),
        },
      ]),
      createAutoRefillTransaction: jest.fn().mockResolvedValue({ balance: 6000 }),
    };

    const result = await runAutoRefillSweep(deps, now);

    expect(deps.createAutoRefillTransaction).toHaveBeenCalledWith({
      user: 'user-1',
      tokenType: 'credits',
      context: 'scheduledAutoRefill',
      rawAmount: 1000,
    });
    expect(result).toEqual({ checked: 1, refilled: 1 });
  });

  it('does not refill before the configured interval expires', async () => {
    const deps = {
      findAutoRefillBalances: jest.fn().mockResolvedValue([
        {
          user: 'user-1',
          autoRefillEnabled: true,
          refillIntervalValue: 2,
          refillIntervalUnit: 'hours',
          refillAmount: 1000,
          lastRefill: new Date('2026-08-11T14:00:00.000Z'),
        },
      ]),
      createAutoRefillTransaction: jest.fn(),
    };

    const result = await runAutoRefillSweep(deps, now);

    expect(deps.createAutoRefillTransaction).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, refilled: 0 });
  });
});
