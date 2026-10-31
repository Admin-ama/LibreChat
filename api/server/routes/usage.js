const express = require('express');
const { createUsageHandler } = require('@librechat/api');
const { requireJwtAuth, configMiddleware } = require('~/server/middleware');
const { getUserUsageEntries } = require('~/models');

const router = express.Router();

router.get('/', requireJwtAuth, configMiddleware, createUsageHandler({ getUserUsageEntries }));

module.exports = router;
