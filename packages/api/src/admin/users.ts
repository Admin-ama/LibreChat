import { Types } from 'mongoose';
import { REFILL_INTERVAL_UNITS, PrincipalType, SystemRoles } from 'librechat-data-provider';
import { logger, isValidObjectIdString } from '@librechat/data-schemas';
import type { TAdminUserBalance } from 'librechat-data-provider';
import type {
  IUser,
  IBalance,
  IConfig,
  IBalanceUpdate,
  AdminUserListItem,
  AdminUserSearchResult,
  UserDeleteResult,
} from '@librechat/data-schemas';
import type { FilterQuery } from 'mongoose';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import { parsePagination } from './pagination';

const MAX_SEARCH_LENGTH = 200;

const toAdminUserBalance = (userId: string, balance: IBalance | null): TAdminUserBalance => ({
  userId,
  tokenCredits: balance?.tokenCredits ?? 0,
  autoRefillEnabled: balance?.autoRefillEnabled ?? false,
  refillIntervalValue: balance?.refillIntervalValue ?? 30,
  refillIntervalUnit: balance?.refillIntervalUnit ?? 'days',
  refillAmount: balance?.refillAmount ?? 0,
});

const USER_LIST_FIELDS = '_id name username email avatar role provider createdAt updatedAt';

export interface AdminUsersDeps {
  findUsers: (
    searchCriteria: FilterQuery<IUser>,
    fieldsToSelect?: string | string[] | null,
    options?: { limit?: number; offset?: number; sort?: Record<string, 1 | -1> },
  ) => Promise<IUser[]>;
  countUsers: (filter?: FilterQuery<IUser>) => Promise<number>;
  /**
   * Thin data-layer delete — removes the User document only.
   * Full cascade of user-owned resources (conversations, messages, files, tokens, etc.)
   * is handled by `UserController.deleteUserController` in the self-delete flow.
   * This admin endpoint currently cascades Config and AclEntries.
   * A future iteration should consolidate the full cascade into a shared service function.
   */
  deleteUserById: (userId: string) => Promise<UserDeleteResult>;
  deleteConfig: (
    principalType: PrincipalType,
    principalId: string | Types.ObjectId,
  ) => Promise<IConfig | null>;
  deleteAclEntries: (filter: {
    principalType: PrincipalType;
    principalId: string | Types.ObjectId;
  }) => Promise<void>;
  getUserById: (userId: string, fieldsToSelect?: string | string[] | null) => Promise<IUser | null>;
  findBalanceByUser: (user: string) => Promise<IBalance | null>;
  upsertBalanceFields: (user: string, fields: IBalanceUpdate) => Promise<IBalance | null>;
}

export function createAdminUsersHandlers(deps: AdminUsersDeps): {
  listUsers: (req: ServerRequest, res: Response) => Promise<Response>;
  searchUsers: (req: ServerRequest, res: Response) => Promise<Response>;
  deleteUser: (req: ServerRequest, res: Response) => Promise<Response>;
  getUserBalance: (req: ServerRequest, res: Response) => Promise<Response>;
  setUserBalance: (req: ServerRequest, res: Response) => Promise<Response>;
} {
  const {
    findUsers,
    countUsers,
    deleteUserById,
    deleteConfig,
    deleteAclEntries,
    getUserById,
    findBalanceByUser,
    upsertBalanceFields,
  } = deps;

  async function listUsersHandler(req: ServerRequest, res: Response) {
    try {
      const { limit, offset } = parsePagination(req.query);
      const [users, total] = await Promise.all([
        findUsers({}, USER_LIST_FIELDS, { limit, offset, sort: { createdAt: -1 } }),
        countUsers(),
      ]);

      const mapped: AdminUserListItem[] = users.map((u) => ({
        id: u._id?.toString() ?? '',
        name: u.name ?? '',
        username: u.username ?? '',
        email: u.email ?? '',
        avatar: u.avatar ?? '',
        role: u.role ?? 'USER',
        provider: u.provider ?? 'local',
        createdAt: u.createdAt?.toISOString(),
        updatedAt: u.updatedAt?.toISOString(),
      }));

      return res.status(200).json({ users: mapped, total, limit, offset });
    } catch (error) {
      logger.error('[adminUsers] listUsers error:', error);
      return res.status(500).json({ error: 'Failed to list users' });
    }
  }

  async function searchUsersHandler(req: ServerRequest, res: Response) {
    try {
      const rawQ = req.query.q;
      const rawLimit = req.query.limit;
      const query = typeof rawQ === 'string' ? rawQ : undefined;
      const limitStr = typeof rawLimit === 'string' ? rawLimit : '20';
      const trimmed = query?.trim() ?? '';

      if (!trimmed) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      if (trimmed.length < 2) {
        return res.status(400).json({ error: 'Query must be at least 2 characters' });
      }

      if (trimmed.length > MAX_SEARCH_LENGTH) {
        return res
          .status(400)
          .json({ error: `Query must not exceed ${MAX_SEARCH_LENGTH} characters` });
      }

      const searchLimit = Math.min(Math.max(1, parseInt(limitStr, 10) || 20), 50);
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}`, 'i');

      const users = await findUsers(
        { $or: [{ name: regex }, { email: regex }, { username: regex }] },
        '_id name email username avatar',
        { limit: searchLimit, sort: { name: 1 } },
      );

      const results: AdminUserSearchResult[] = users.map((u) => ({
        id: u._id?.toString() ?? '',
        name: u.name ?? '',
        email: u.email ?? '',
        username: u.username,
        avatarUrl: u.avatar,
      }));

      return res
        .status(200)
        .json({ users: results, total: results.length, capped: results.length >= searchLimit });
    } catch (error) {
      logger.error('[adminUsers] searchUsers error:', error);
      return res.status(500).json({ error: 'Failed to search users' });
    }
  }

  async function deleteUserHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };

      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }

      const callerId = req.user?._id?.toString() ?? req.user?.id;
      if (callerId === id) {
        return res.status(403).json({ error: 'Cannot delete your own account' });
      }

      const [targetUser] = await findUsers({ _id: id }, 'role', { limit: 1 });
      if (targetUser?.role === SystemRoles.ADMIN) {
        const adminCount = await countUsers({ role: SystemRoles.ADMIN });
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Cannot delete the last admin user' });
        }
      }

      const result = await deleteUserById(id);

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (targetUser?.role === SystemRoles.ADMIN) {
        const remaining = await countUsers({ role: SystemRoles.ADMIN });
        if (remaining === 0) {
          logger.error(
            `[adminUsers] CRITICAL: last admin deleted via race condition, user: ${id}. ` +
              'Manual DB intervention required to restore an ADMIN user.',
          );
        }
      }

      const objectId = new Types.ObjectId(id);
      const cleanupResults = await Promise.allSettled([
        deleteConfig(PrincipalType.USER, id),
        deleteAclEntries({ principalType: PrincipalType.USER, principalId: objectId }),
      ]);
      for (const r of cleanupResults) {
        if (r.status === 'rejected') {
          logger.error('[adminUsers] cascade cleanup failed for user:', id, r.reason);
        }
      }

      return res.status(200).json({ message: result.message || 'User deleted successfully' });
    } catch (error) {
      logger.error('[adminUsers] deleteUser error:', error);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  async function getUserBalanceHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };

      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }

      const targetUser = await getUserById(id, '_id');
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const balance = await findBalanceByUser(id);
      return res.status(200).json(toAdminUserBalance(id, balance));
    } catch (error) {
      logger.error('[adminUsers] getUserBalance error:', error);
      return res.status(500).json({ error: 'Failed to get user balance' });
    }
  }

  async function setUserBalanceHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<TAdminUserBalance>;

      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }

      const targetUser = await getUserById(id, '_id');
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (typeof body.tokenCredits !== 'number' || body.tokenCredits < 0) {
        return res.status(400).json({ error: '`tokenCredits` must be a non-negative number' });
      }
      if (
        body.refillAmount !== undefined &&
        (typeof body.refillAmount !== 'number' || body.refillAmount < 0)
      ) {
        return res.status(400).json({ error: '`refillAmount` must be a non-negative number' });
      }
      if (
        body.refillIntervalValue !== undefined &&
        (typeof body.refillIntervalValue !== 'number' || body.refillIntervalValue <= 0)
      ) {
        return res.status(400).json({ error: '`refillIntervalValue` must be a positive number' });
      }
      if (
        body.refillIntervalUnit !== undefined &&
        !REFILL_INTERVAL_UNITS.includes(body.refillIntervalUnit)
      ) {
        return res.status(400).json({
          error: `\`refillIntervalUnit\` must be one of: ${REFILL_INTERVAL_UNITS.join(', ')}`,
        });
      }
      if (body.autoRefillEnabled !== undefined && typeof body.autoRefillEnabled !== 'boolean') {
        return res.status(400).json({ error: '`autoRefillEnabled` must be a boolean' });
      }

      const fields: IBalanceUpdate = {
        tokenCredits: body.tokenCredits,
        ...(body.autoRefillEnabled !== undefined && { autoRefillEnabled: body.autoRefillEnabled }),
        ...(body.autoRefillEnabled === true && { lastRefill: new Date() }),
        ...(body.refillIntervalValue !== undefined && {
          refillIntervalValue: body.refillIntervalValue,
        }),
        ...(body.refillIntervalUnit !== undefined && {
          refillIntervalUnit: body.refillIntervalUnit,
        }),
        ...(body.refillAmount !== undefined && { refillAmount: body.refillAmount }),
      };

      const balance = await upsertBalanceFields(id, fields);
      logger.info(
        `[adminUsers] balance updated for user ${id} by admin ${req.user?._id ?? req.user?.id}`,
      );
      return res.status(200).json(toAdminUserBalance(id, balance));
    } catch (error) {
      logger.error('[adminUsers] setUserBalance error:', error);
      return res.status(500).json({ error: 'Failed to update user balance' });
    }
  }

  return {
    listUsers: listUsersHandler,
    searchUsers: searchUsersHandler,
    deleteUser: deleteUserHandler,
    getUserBalance: getUserBalanceHandler,
    setUserBalance: setUserBalanceHandler,
  };
}
