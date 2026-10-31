const express = require('express');
const { createAdminUsageHandlers } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { getAppConfig } = require('~/server/services/Config');
const { requireJwtAuth } = require('~/server/middleware');
const db = require('~/models');

const router = express.Router();

const requireAdminAccess = requireCapability(SystemCapabilities.ACCESS_ADMIN);
const requireReadUsers = requireCapability(SystemCapabilities.READ_USERS);

const handlers = createAdminUsageHandlers({
  findUsers: db.findUsers,
  countUsers: db.countUsers,
  getUserById: db.getUserById,
  getAppConfig,
  aggregateUsageByUser: db.aggregateUsageByUser,
  getUserUsageEntries: db.getUserUsageEntries,
  getUserUsageBreakdown: db.getUserUsageBreakdown,
});

router.use(requireJwtAuth, requireAdminAccess, requireReadUsers);

router.get('/', handlers.listUsage);
router.get('/:id', handlers.getUserUsage);

module.exports = router;
