const express = require('express');
const router = express.Router();

// Import route modules
const mediaServerRouter = require('./mediaServer');
const librariesRouter = require('./libraries');
const settingsRouter = require('./settings');
const classificationRouter = require('./classification');

// Mount route modules
router.use('/media-server', mediaServerRouter);
router.use('/libraries', librariesRouter);
router.use('/settings', settingsRouter);
router.use('/', classificationRouter);

module.exports = router;
