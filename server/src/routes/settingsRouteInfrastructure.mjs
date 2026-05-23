/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function registerInfrastructureRoutes(router, { sslHandlers, sslTestLimiter, pathTestingHandlers, providerLockHandlers }) {
  router.get('/ssl', sslHandlers.getConfig);
  router.put('/ssl', sslHandlers.updateConfig);
  router.post('/ssl/test', sslTestLimiter, sslHandlers.testCertificates);

  router.post('/path-test', pathTestingHandlers.testPath);
  router.post('/path-test/translation', pathTestingHandlers.testTranslation);
  router.get('/path-test/mappings/:mediaServerId', pathTestingHandlers.testMappings);
  router.get('/path-test/health', pathTestingHandlers.healthCheck);
  router.get('/media-path-config', pathTestingHandlers.getMediaPathConfig);

  router.get('/heartbeat', providerLockHandlers.getHeartbeatConfig);
  router.put('/heartbeat', providerLockHandlers.updateHeartbeatConfig);
  router.get('/provider-lock/status', providerLockHandlers.getProviderLockStatus);
}
