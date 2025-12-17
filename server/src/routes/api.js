const express = require('express');
const router = express.Router();

// Import route modules
const settingsRouter = require('./settings');

// Mount route modules
router.use('/settings', settingsRouter);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
