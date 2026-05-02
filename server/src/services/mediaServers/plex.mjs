import axios from 'axios';
import loggerModule from '../../utils/logger.mjs';
import { parsePlexGuids } from './shared/providerIds.mjs';
import { appendQueryParam, buildPathUrl } from './shared/url.mjs';
import plexFactory from './plex.shared.js';

const { createLogger } = loggerModule;
const logger = createLogger('plex');

export default plexFactory.buildPlexService({
  axiosClient: axios,
  logger,
  parsePlexGuids,
  appendQueryParam,
  buildPathUrl,
});
