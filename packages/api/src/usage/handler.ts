import { logger } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import type { CheckUsageLimitsDeps } from './limits';
import { getUserUsageSummary } from './limits';

/** `GET /api/usage` — the requesting user's rolling-window spend against their caps. */
export function createUsageHandler({
  getUserUsageEntries,
}: Pick<CheckUsageLimitsDeps, 'getUserUsageEntries'>): (
  req: ServerRequest,
  res: Response,
) => Promise<Response> {
  return async function getUsageHandler(req: ServerRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const summary = await getUserUsageSummary(userId, req.config, getUserUsageEntries);
      return res.status(200).json(summary);
    } catch (error) {
      logger.error('[usage] getUsage error:', error);
      return res.status(500).json({ error: 'Failed to get usage' });
    }
  };
}
