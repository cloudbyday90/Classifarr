/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import embyService from './emby.mjs';
import jellyfinService from './jellyfin.mjs';
import plexService from './plex.mjs';

const mediaServerServices = Object.freeze({
  plex: plexService,
  emby: embyService,
  jellyfin: jellyfinService,
});

function getMediaServerService(type) {
  const normalizedType = typeof type === 'string' ? type.toLowerCase() : '';
  const service = mediaServerServices[normalizedType];

  if (!service) {
    throw new Error(`Unknown media server type: ${type}`);
  }

  return service;
}

export { mediaServerServices, getMediaServerService, plexService, embyService, jellyfinService };

export default mediaServerServices;
