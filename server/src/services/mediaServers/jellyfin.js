/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const { createEmbyLikeService } = require('./shared/createEmbyLikeService');

const jellyfinService = createEmbyLikeService({ displayName: 'Jellyfin' });

module.exports = jellyfinService;
module.exports.default = jellyfinService;
