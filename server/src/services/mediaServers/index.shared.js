const embyService = require('./emby');
const jellyfinService = require('./jellyfin');
const plexService = require('./plex');

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

module.exports = {
  ...mediaServerServices,
  mediaServerServices,
  getMediaServerService,
  plexService,
  embyService,
  jellyfinService,
  default: mediaServerServices,
};
