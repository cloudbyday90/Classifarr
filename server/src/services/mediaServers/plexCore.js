/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const axios = require('axios');
const { createLogger } = require('../../utils/logger');
const { parsePlexGuids } = require('./shared/providerIds');
const { appendQueryParam, buildPathUrl } = require('./shared/url');
const { buildPlexService } = require('./plex.shared');

const logger = createLogger('plex');

module.exports = buildPlexService({
  axiosClient: axios,
  logger,
  parsePlexGuids,
  appendQueryParam,
  buildPathUrl,
});
module.exports.default = module.exports;
