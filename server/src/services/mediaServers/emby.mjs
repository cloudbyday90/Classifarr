import { createEmbyLikeService } from './shared/createEmbyLikeService.mjs';
import { readEmbyLibraryCatalog } from './embyLibraryCatalog.mjs';

export const embyService = createEmbyLikeService({ displayName: 'Emby', readCatalog: readEmbyLibraryCatalog });
