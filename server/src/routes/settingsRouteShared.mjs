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

import { registerMediaConfigRoutes } from './settingsRouteMediaConfig.mjs';
import { registerProviderRoutes } from './settingsRouteProviders.mjs';
import { registerNotificationRoutes } from './settingsRouteDiscord.mjs';
import { registerWebhookRoutes } from './settingsRouteWebhook.mjs';
import { registerInfrastructureRoutes } from './settingsRouteInfrastructure.mjs';
import { registerConfidenceRoutes } from './settingsRouteConfidence.mjs';

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
  webSearchProviderHandlers,
  webhookHandlers,
}) {
const router = express.Router();

router.get('/setup-status', setupHandlers.getSetupStatus);
router.post('/media-path', setupHandlers.setMediaPath);

router.get('/', generalSettingsHandlers.getAllSettings);
router.put('/', generalSettingsHandlers.updateAllSettings);
router.get('/category/:name', generalSettingsHandlers.getCategorySettings);
router.put('/category/:name', generalSettingsHandlers.updateCategorySettings);

registerMediaConfigRoutes(router, { radarrHandlers, sonarrHandlers, arrConfigStatusHandler });
registerProviderRoutes(router, { ollamaHandlers, metadataProviderHandlers, aiHandlers, webSearchProviderHandlers });
registerNotificationRoutes(router, { discordHandlers });
registerWebhookRoutes(router, { webhookHandlers });
registerInfrastructureRoutes(router, { sslHandlers, sslTestLimiter, pathTestingHandlers, providerLockHandlers });
registerConfidenceRoutes(router, { authenticateToken, requireAdmin, confidenceSettingsHandlers });

return router;
}
