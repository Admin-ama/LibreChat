const { getRefillEligibilityDate } = require('librechat-data-provider');
const { logger, runAsSystem } = require('@librechat/data-schemas');

const DEFAULT_INTERVAL_MS = 1000;

let timer;
let sweepRunning = false;

async function runAutoRefillSweep(deps, now = new Date()) {
  const balances = await deps.findAutoRefillBalances();
  let refilled = 0;

  for (const balance of balances) {
    const intervalValue = balance.refillIntervalValue;
    const intervalUnit = balance.refillIntervalUnit;
    const refillAmount = balance.refillAmount;

    if (
      !balance.autoRefillEnabled ||
      !Number.isFinite(intervalValue) ||
      intervalValue <= 0 ||
      !intervalUnit ||
      !Number.isFinite(refillAmount) ||
      refillAmount <= 0
    ) {
      continue;
    }

    const lastRefill = balance.lastRefill ? new Date(balance.lastRefill) : new Date(0);
    const eligibleAt = getRefillEligibilityDate(lastRefill, intervalValue, intervalUnit);
    if (now < eligibleAt) {
      continue;
    }

    try {
      const result = await deps.createAutoRefillTransaction({
        user: balance.user.toString(),
        tokenType: 'credits',
        context: 'scheduledAutoRefill',
        rawAmount: refillAmount,
      });
      if (result) {
        refilled += 1;
      }
    } catch (error) {
      logger.error('[AutoRefillScheduler] Failed to refill user balance', {
        user: balance.user.toString(),
        error,
      });
    }
  }

  return { checked: balances.length, refilled };
}

function startAutoRefillScheduler({ intervalMs = DEFAULT_INTERVAL_MS, deps } = {}) {
  if (timer) {
    return stopAutoRefillScheduler;
  }

  const schedulerDeps = deps ?? require('~/models');
  const sweep = async () => {
    if (sweepRunning) {
      return;
    }
    sweepRunning = true;
    try {
      await runAsSystem(() => runAutoRefillSweep(schedulerDeps));
    } catch (error) {
      logger.error('[AutoRefillScheduler] Sweep failed', error);
    } finally {
      sweepRunning = false;
    }
  };

  void sweep();
  timer = setInterval(sweep, intervalMs);
  timer.unref?.();
  logger.info(`[AutoRefillScheduler] Started with ${intervalMs}ms interval`);
  return stopAutoRefillScheduler;
}

function stopAutoRefillScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

module.exports = {
  runAutoRefillSweep,
  startAutoRefillScheduler,
  stopAutoRefillScheduler,
};
