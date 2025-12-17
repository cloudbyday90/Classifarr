const express = require('express');
const router = express.Router();

// Import route modules
const webhookRoutes = require('./webhook');
const mediaServerRoutes = require('./mediaServer');
const librariesRoutes = require('./libraries');
const classificationRoutes = require('./classification');
const ruleBuilderRoutes = require('./ruleBuilder');
const settingsRoutes = require('./settings');

// Mount routes
router.use('/webhook', webhookRoutes);
router.use('/media-servers', mediaServerRoutes);
router.use('/libraries', librariesRoutes);
router.use('/classification', classificationRoutes);
router.use('/rule-builder', ruleBuilderRoutes);
router.use('/settings', settingsRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Classifarr API',
    version: '1.0.0',
    endpoints: {
      webhook: '/api/webhook',
      mediaServers: '/api/media-servers',
      libraries: '/api/libraries',
      classification: '/api/classification',
      ruleBuilder: '/api/rule-builder',
      settings: '/api/settings',
      health: '/api/health'
    }
  });
});

module.exports = router;
