/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

export function createSettingsRouter({
  express,
  authenticateToken,
  requireAdmin,
  arrConfigStatusHandler,
  aiHandlers,
  confidenceSettingsHandlers,
  discordHandlers,
  generalSettingsHandlers,
  metadataProviderHandlers,
  ollamaHandlers,
  pathTestingHandlers,
  providerLockHandlers,
  radarrHandlers,
  setupHandlers,
  sonarrHandlers,
  sslHandlers,
  sslTestLimiter,
  webhookHandlers,
}) {
const router = express.Router();

/**
 * @swagger
 * /api/settings/setup-status:
 *   get:
 *     summary: Get re-classification setup status for dashboard banner
 */
router.get('/setup-status', setupHandlers.getSetupStatus);

/**
 * @swagger
 * /api/settings/media-path:
 *   post:
 *     summary: Configure Classifarr media path
 */
router.post('/media-path', setupHandlers.setMediaPath);

// ============================================
// GENERAL SETTINGS
// ============================================
router.get('/', generalSettingsHandlers.getAllSettings);

/**
 * @swagger
 * /api/settings:
 *   put:
 *     summary: Update settings
 */
router.put('/', generalSettingsHandlers.updateAllSettings);

// ============================================
// CATEGORY-BASED SETTINGS
// ============================================

/**
 * @swagger
 * /api/settings/category/{name}:
 *   get:
 *     summary: Get settings for a specific category
 *     parameters:
 *       - name: name
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [queue, scheduler, classification]
 */
router.get('/category/:name', generalSettingsHandlers.getCategorySettings);

/**
 * @swagger
 * /api/settings/category/{name}:
 *   put:
 *     summary: Update settings for a specific category
 *     parameters:
 *       - name: name
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [queue, scheduler, classification]
 */
router.put('/category/:name', generalSettingsHandlers.updateCategorySettings);


// ============================================
// RADARR CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/radarr:
 *   get:
 *     summary: Get all Radarr configurations (with masked API keys)
 */
router.get('/radarr', radarrHandlers.list);

/**
 * @swagger
 * /api/settings/radarr:
 *   post:
 *     summary: Add Radarr configuration
 */
router.post('/radarr', radarrHandlers.create);

/**
 * @swagger
 * /api/settings/radarr/{id}:
 *   put:
 *     summary: Update Radarr configuration
 */
router.put('/radarr/:id', radarrHandlers.update);

/**
 * @swagger
 * /api/settings/radarr/{id}:
 *   delete:
 *     summary: Delete Radarr configuration
 */
router.delete('/radarr/:id', radarrHandlers.remove);

/**
 * @swagger
 * /api/settings/radarr/test:
 *   post:
 *     summary: Test Radarr connection with detailed stats
 */
router.post('/radarr/test', radarrHandlers.test);

/**
 * @swagger
 * /api/settings/radarr/{id}/root-folders:
 *   get:
 *     summary: Get Radarr root folders
 */
router.get('/radarr/:id/root-folders', radarrHandlers.rootFolders);

/**
 * @swagger
 * /api/settings/radarr/{id}/quality-profiles:
 *   get:
 *     summary: Get Radarr quality profiles
 */
router.get('/radarr/:id/quality-profiles', radarrHandlers.qualityProfiles);

// ============================================
// SONARR CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/sonarr:
 *   get:
 *     summary: Get all Sonarr configurations (with masked API keys)
 */
router.get('/sonarr', sonarrHandlers.list);

/**
 * @swagger
 * /api/settings/sonarr:
 *   post:
 *     summary: Add Sonarr configuration
 */
router.post('/sonarr', sonarrHandlers.create);

/**
 * @swagger
 * /api/settings/sonarr/{id}:
 *   put:
 *     summary: Update Sonarr configuration
 */
router.put('/sonarr/:id', sonarrHandlers.update);

/**
 * @swagger
 * /api/settings/sonarr/{id}:
 *   delete:
 *     summary: Delete Sonarr configuration
 */
router.delete('/sonarr/:id', sonarrHandlers.remove);

/**
 * @swagger
 * /api/settings/sonarr/test:
 *   post:
 *     summary: Test Sonarr connection with detailed stats
 */
router.post('/sonarr/test', sonarrHandlers.test);

/**
 * @swagger
 * /api/settings/sonarr/{id}/root-folders:
 *   get:
 *     summary: Get Sonarr root folders
 */
router.get('/sonarr/:id/root-folders', sonarrHandlers.rootFolders);

/**
 * @swagger
 * /api/settings/sonarr/{id}/quality-profiles:
 *   get:
 *     summary: Get Sonarr quality profiles
 */
router.get('/sonarr/:id/quality-profiles', sonarrHandlers.qualityProfiles);

// ============================================
// ARR CONFIG STATUS (for incomplete config warnings)
// ============================================

/**
 * @swagger
 * /api/settings/arr-config-status:
 *   get:
 *     summary: Check for incomplete Radarr/Sonarr configurations
 *     description: Returns configs missing required fields like quality_profile_id
 */
router.get('/arr-config-status', arrConfigStatusHandler);

// ============================================
// OLLAMA CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/ollama:
 *   get:
 *     summary: Get Ollama configuration
 */
router.get('/ollama', ollamaHandlers.getConfig);

/**
 * @swagger
 * /api/settings/ollama:
 *   put:
 *     summary: Update Ollama configuration
 */
router.put('/ollama', ollamaHandlers.updateConfig);

/**
 * @swagger
 * /api/settings/ollama/test:
 *   post:
 *     summary: Test Ollama connection
 */
router.post('/ollama/test', ollamaHandlers.testConnection);

/**
 * @swagger
 * /api/settings/ollama/preflight/last:
 *   get:
 *     summary: Get last scheduled preflight check result
 *     description: Returns the result of the most recent scheduled daily Ollama connection check
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Last preflight check result or null if none has run
 */
router.get('/ollama/preflight/last', ollamaHandlers.getLastPreflight);

/**
 * @swagger
 * /api/settings/ollama/warm:
 *   post:
 *     summary: Warm (pre-load) a specific model into memory
 *     description: Loads a model into Ollama's memory and keeps it there for the specified duration
 *     tags: [Settings]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *                 description: Model name to warm (defaults to configured AI model)
 *               keepAlive:
 *                 type: string
 *                 description: Duration to keep model in memory (default 24h)
 *     responses:
 *       200:
 *         description: Model warmed successfully
 */
router.post('/ollama/warm', ollamaHandlers.warmModel);

/**
 * @swagger
 * /api/settings/ollama/warm-all:
 *   post:
 *     summary: Warm both AI and embedding models into memory
 *     description: Pre-loads both the classification model and embedding model (if different) into Ollama's memory
 *     tags: [Settings]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keepAlive:
 *                 type: string
 *                 description: Duration to keep models in memory (default 24h)
 *     responses:
 *       200:
 *         description: Models warmed successfully
 */
router.post('/ollama/warm-all', ollamaHandlers.warmAllModels);

/**
 * @swagger
 * /api/settings/ollama/models:
 *   get:
 *     summary: Get available Ollama models
 */
router.get('/ollama/models', ollamaHandlers.getModels);

/**
 * @swagger
 * /api/settings/ollama/recommended-models:
 *   get:
 *     summary: Get recommended models for classification tasks
 */
router.get('/ollama/recommended-models', ollamaHandlers.getRecommendedModels);



// ============================================
// TMDB CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/tmdb:
 *   get:
 *     summary: Get TMDB configuration
 */
router.get('/tmdb', metadataProviderHandlers.getTmdbConfig);

/**
 * @swagger
 * /api/settings/tmdb:
 *   put:
 *     summary: Update TMDB configuration
 */
router.put('/tmdb', metadataProviderHandlers.updateTmdbConfig);

/**
 * @swagger
 * /api/settings/tmdb/test:
 *   post:
 *     summary: Test TMDB connection
 */
router.post('/tmdb/test', metadataProviderHandlers.testTmdb);

/**
 * @swagger
 * /api/settings/tmdb/health:
 *   get:
 *     summary: Check TMDB API health and SSL certificate status
 */
router.get('/tmdb/health', metadataProviderHandlers.tmdbHealth);

// ============================================
// TAVILY CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/tavily:
 *   get:
 *     summary: Get Tavily configuration
 */
router.get('/tavily', metadataProviderHandlers.getTavilyConfig);

/**
 * @swagger
 * /api/settings/tavily:
 *   put:
 *     summary: Update Tavily configuration
 */
router.put('/tavily', metadataProviderHandlers.updateTavilyConfig);

/**
 * @swagger
 * /api/settings/tavily/test:
 *   post:
 *     summary: Test Tavily connection
 */
router.post('/tavily/test', metadataProviderHandlers.testTavily);

/**
 * @swagger
 * /api/settings/tavily/search:
 *   post:
 *     summary: Test Tavily search (for debugging)
 */
router.post('/tavily/search', metadataProviderHandlers.searchTavily);

/**
 * @swagger
 * /api/settings/tavily/health:
 *   get:
 *     summary: Check Tavily API health and SSL certificate status
 */
router.get('/tavily/health', metadataProviderHandlers.tavilyHealth);

// ============================================
// OMDB CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/omdb:
 *   get:
 *     summary: Get OMDb configuration
 */
router.get('/omdb', metadataProviderHandlers.getOmdbConfig);

/**
 * @swagger
 * /api/settings/omdb:
 *   put:
 *     summary: Update OMDb configuration
 */
router.put('/omdb', metadataProviderHandlers.updateOmdbConfig);

/**
 * @swagger
 * /api/settings/omdb/test:
 *   post:
 *     summary: Test OMDb connection
 */
router.post('/omdb/test', metadataProviderHandlers.testOmdb);

/**
 * @swagger
 * /api/settings/omdb/search:
 *   post:
 *     summary: Test OMDb search with a title
 */
router.post('/omdb/search', metadataProviderHandlers.searchOmdb);

/**
 * @swagger
 * /api/settings/omdb/health:
 *   get:
 *     summary: Check OMDb API health and SSL certificate status
 *     responses:
 *       200:
 *         description: OMDb health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unavailable]
 *                 configured:
 *                   type: boolean
 *                 ssl_valid:
 *                   type: boolean
 *                 api_reachable:
 *                   type: boolean
 *                 requests_today:
 *                   type: integer
 *                 daily_limit:
 *                   type: integer
 *                 message:
 *                   type: string
 */
router.get('/omdb/health', metadataProviderHandlers.omdbHealth);



// ============================================
// NOTIFICATION CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/notifications:
 *   get:
 *     summary: Get notification configuration
 */
router.get('/notifications', discordHandlers.getConfig);

/**
 * @swagger
 * /api/settings/notifications:
 *   put:
 *     summary: Update notification configuration
 */
router.put('/notifications', discordHandlers.updateConfig);

/**
 * @swagger
 * /api/settings/discord/test:
 *   post:
 *     summary: Test Discord bot connection and send test notification
 */
router.post('/discord/test', discordHandlers.testConnection);

/**
 * @swagger
 * /api/settings/discord/servers:
 *   get:
 *     summary: Get Discord servers (guilds)
 */
router.get('/discord/servers', discordHandlers.getServers);

/**
 * @swagger
 * /api/settings/discord/channels/:serverId:
 *   get:
 *     summary: Get Discord channels in a server
 */
router.get('/discord/channels/:serverId', discordHandlers.getChannels);

/**
 * @swagger
 * /api/settings/discord/channel/:channelId:
 *   get:
 *     summary: Get Discord channel details (name, guild name)
 */
router.get('/discord/channel/:channelId', discordHandlers.getChannelDetails);

// ============================================
// WEBHOOK CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/webhook:
 *   get:
 *     summary: Get webhook configuration (with masked secret key)
 */
router.get('/webhook', webhookHandlers.getConfig);

/**
 * @swagger
 * /api/settings/webhook:
 *   put:
 *     summary: Update webhook configuration
 */
router.put('/webhook', webhookHandlers.updateConfig);

/**
 * @swagger
 * /api/settings/webhook/generate-key:
 *   post:
 *     summary: Generate new webhook secret key
 */
router.post('/webhook/generate-key', webhookHandlers.generateKey);

/**
 * @swagger
 * /api/settings/webhook/secret:
 *   get:
 *     summary: Reveal the full webhook secret key
 *     description: Returns the full decrypted webhook secret for authenticated admin users
 */
router.get('/webhook/secret', webhookHandlers.getSecret);

/**
 * @swagger
 * /api/settings/webhook/url:
 *   get:
 *     summary: Get full webhook URL with key
 */
router.get('/webhook/url', webhookHandlers.getUrl);

/**
 * @swagger
 * /api/settings/webhook/logs:
 *   get:
 *     summary: Get paginated webhook logs
 */
router.get('/webhook/logs', webhookHandlers.getLogs);

/**
 * @swagger
 * /api/settings/webhook/stats:
 *   get:
 *     summary: Get webhook statistics
 */
router.get('/webhook/stats', webhookHandlers.getStats);

/**
 * @swagger
 * /api/settings/webhook/test:
 *   post:
 *     summary: Send test webhook to self
 */
router.post('/webhook/test', webhookHandlers.sendTestWebhook);

// ============================================
// SSL/HTTPS CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/ssl:
 *   get:
 *     summary: Get SSL/HTTPS configuration
 */
router.get('/ssl', sslHandlers.getConfig);

/**
 * @swagger
 * /api/settings/ssl:
 *   put:
 *     summary: Update SSL/HTTPS configuration
 */
router.put('/ssl', sslHandlers.updateConfig);

/**
 * @swagger
 * /api/settings/ssl/test:
 *   post:
 *     summary: Test SSL certificate files
 */
router.post('/ssl/test', sslTestLimiter, sslHandlers.testCertificates);

// ============================================
// MULTI-REQUEST MANAGER ENDPOINTS
// ============================================

// List all webhook configurations
router.get('/webhook/configs', webhookHandlers.listConfigs);

// Get specific webhook configuration
router.get('/webhook/configs/:id', webhookHandlers.getConfigById);

// Create new webhook configuration
router.post('/webhook/configs', webhookHandlers.createConfig);

// Update webhook configuration
router.put('/webhook/configs/:id', webhookHandlers.updateConfigById);

// Delete webhook configuration
router.delete('/webhook/configs/:id', webhookHandlers.deleteConfig);

// Set webhook configuration as primary
router.post('/webhook/configs/:id/primary', webhookHandlers.setPrimaryConfig);

// ============================================
// AI PROVIDER CONFIGURATION
// ============================================

/**
 * Get AI provider configuration
 */
router.get('/ai', aiHandlers.getConfig);

/**
 * Update AI provider configuration
 */
router.put('/ai', aiHandlers.updateConfig);

/**
 * Test cloud AI provider connection
 */
router.post('/ai/test', aiHandlers.testConnection);

/**
 * Get available models from cloud provider
 */
router.post('/ai/models', aiHandlers.getModels);

/**
 * Get AI usage statistics (with average cost per call)
 */
router.get('/ai/usage', aiHandlers.getUsage);

/**
 * Get AI provider status
 */
router.get('/ai/status', aiHandlers.getStatus);

/**
 * Reset monthly usage (admin action)
 */
router.post('/ai/reset-usage', aiHandlers.resetUsage);

// ============================================
// PATH TESTING (for re-classification setup)
// ============================================

/**
 * @swagger
 * /api/settings/path-test:
 *   post:
 *     summary: Test if a path is accessible from Classifarr
 */
router.post('/path-test', pathTestingHandlers.testPath);

/**
 * @swagger
 * /api/settings/path-test/translation:
 *   post:
 *     summary: Test path translation between environments
 */
router.post('/path-test/translation', pathTestingHandlers.testTranslation);

/**
 * @swagger
 * /api/settings/path-test/mappings/{mediaServerId}:
 *   get:
 *     summary: Test all library mappings for a media server
 */
router.get('/path-test/mappings/:mediaServerId', pathTestingHandlers.testMappings);

/**
 * @swagger
 * /api/settings/path-test/health:
 *   get:
 *     summary: Get re-classification health check status
 */
router.get('/path-test/health', pathTestingHandlers.healthCheck);

/**
 * @swagger
 * /api/settings/media-path-config:
 *   get:
 *     summary: Get media path configuration and accessibility
 */
router.get('/media-path-config', pathTestingHandlers.getMediaPathConfig);

// ============================================
// EMBEDDING PROVIDER SETTINGS (Consolidated)
// ============================================
// Note: Embedding provider configuration endpoints were consolidated into /api/settings/ai
// to eliminate redundancy and provide a unified API for all AI provider settings.
//
// Previously available endpoints (now removed):
//   - GET/PUT /api/settings/embedding-provider -> Use GET/PUT /api/settings/ai
//   - POST /api/settings/embedding-provider/test -> Use POST /api/rag/test
//   - GET /api/settings/embedding-provider/defaults -> Unused, removed
//
// The /api/settings/ai endpoint now handles all embedding provider fields:
//   - embedding_provider_mode (same/separate_ollama/cloud)
//   - embedding_ollama_host, embedding_ollama_port, embedding_ollama_model
//   - embedding_cloud_provider, embedding_cloud_api_key, embedding_cloud_model
//   - image_embedding_provider_mode (separate_local/cloud/disabled)
//   - image_embedding_local_host, image_embedding_local_port, image_embedding_local_model
//   - image_embedding_cloud_provider, image_embedding_cloud_api_key, image_embedding_cloud_model
// ============================================

// ============================================
// HEARTBEAT/PROVIDER LOCK CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/heartbeat:
 *   get:
 *     summary: Get heartbeat configuration
 */
router.get('/heartbeat', providerLockHandlers.getHeartbeatConfig);

/**
 * @swagger
 * /api/settings/heartbeat:
 *   put:
 *     summary: Update heartbeat configuration
 */
router.put('/heartbeat', providerLockHandlers.updateHeartbeatConfig);

/**
 * @swagger
 * /api/settings/provider-lock/status:
 *   get:
 *     summary: Get current provider lock status
 */
router.get('/provider-lock/status', providerLockHandlers.getProviderLockStatus);

// ============================================
// UNIFIED CONFIDENCE SETTINGS (Issue #241)
// ============================================

/**
 * GET /api/settings/confidence
 * Get all confidence-related settings
 * Requires authentication
 */
router.get('/confidence', authenticateToken, confidenceSettingsHandlers.getSettings);

/**
 * PUT /api/settings/confidence
 * Update confidence settings (admin only)
 */
router.put('/confidence', authenticateToken, requireAdmin, confidenceSettingsHandlers.updateSettings);

/**
 * GET /api/settings/confidence/history
 * Get change history for audit (admin only)
 */
router.get('/confidence/history', authenticateToken, requireAdmin, confidenceSettingsHandlers.getHistory);

/**
 * POST /api/settings/confidence/revert/:auditId
 * Revert to a previous setting value (admin only)
 */
router.post('/confidence/revert/:auditId', authenticateToken, requireAdmin, confidenceSettingsHandlers.revertSetting);

/**
 * POST /api/settings/confidence/export
 * Export all settings as JSON (admin only)
 */
router.post('/confidence/export', authenticateToken, requireAdmin, confidenceSettingsHandlers.exportSettings);

/**
 * POST /api/settings/confidence/import
 * Import settings from JSON (admin only)
 */
router.post('/confidence/import', authenticateToken, requireAdmin, confidenceSettingsHandlers.importSettings);

return router;
}
