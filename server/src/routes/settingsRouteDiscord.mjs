/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function registerNotificationRoutes(router, { discordHandlers }) {
  router.get('/notifications', discordHandlers.getConfig);
  router.put('/notifications', discordHandlers.updateConfig);
  router.post('/discord/test', discordHandlers.testConnection);
  router.get('/discord/servers', discordHandlers.getServers);
  router.get('/discord/channels/:serverId', discordHandlers.getChannels);
  router.get('/discord/channel/:channelId', discordHandlers.getChannelDetails);
}
