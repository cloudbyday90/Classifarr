const express = require('express');
const webhookRouter = require('./webhook');
const mediaServerRouter = require('./mediaServer');
const librariesRouter = require('./libraries');
const classificationRouter = require('./classification');
const ruleBuilderRouter = require('./ruleBuilder');
const settingsRouter = require('./settings');
const logsRouter = require('./logs');

const router = express.Router();

// Mount all route modules
router.use('/webhook', webhookRouter);
router.use('/media-server', mediaServerRouter);
router.use('/libraries', librariesRouter);
router.use('/classification', classificationRouter);
router.use('/rule-builder', ruleBuilderRouter);
router.use('/settings', settingsRouter);
router.use('/logs', logsRouter);

// Root API endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Classifarr API',
    version: '1.0.0',
    description: 'AI-powered media classification for the *arr ecosystem',
    endpoints: {
      webhook: '/api/webhook',
      mediaServer: '/api/media-server',
      libraries: '/api/libraries',
      classification: '/api/classification',
      ruleBuilder: '/api/rule-builder',
      settings: '/api/settings',
      logs: '/api/logs',
      docs: '/api/docs',
    },
  });
});

module.exports = router;
