import mediaServerRegistry from './index.shared.js';

export const mediaServerServices = mediaServerRegistry.mediaServerServices;
export const getMediaServerService = mediaServerRegistry.getMediaServerService;
export const plexService = mediaServerRegistry.plexService;
export const embyService = mediaServerRegistry.embyService;
export const jellyfinService = mediaServerRegistry.jellyfinService;

export default mediaServerServices;
