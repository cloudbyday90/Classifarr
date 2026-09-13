/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { plexService } from './mediaServers/plex.mjs';

const MACHINE_ID = /^[a-fA-F0-9-]{16,64}$/;
const ITEM_ID = /^[1-9][0-9]{0,19}$/;

/** Read-only, request-coalesced lookup. Failures are never cached. */
export function createPlexLogItemLinks({ testConnection = (url, token) => plexService.testConnection(url, token) } = {}) {
  const pending = new Map();
  return async function resolveLinks(server, itemIds) {
    const key = JSON.stringify([server.id, server.url, server.api_key]);
    let request = pending.get(key);
    if (!request) {
      if (pending.size >= 16) return itemIds.map(() => null);
      request = Promise.resolve().then(() => testConnection(server.url, server.api_key))
        .then(result => {
          const id = result?.success === true ? result.data?.MediaContainer?.machineIdentifier : null;
          return typeof id === 'string' && MACHINE_ID.test(id) ? id : null;
        }).catch(() => null).finally(() => pending.delete(key));
      pending.set(key, request);
    }
    const machineId = await request;
    return itemIds.map(id => machineId && typeof id === 'string' && ITEM_ID.test(id)
      ? `https://app.plex.tv/desktop/#!/server/${machineId}/details?key=${encodeURIComponent(`/library/metadata/${id}`)}`
      : null);
  };
}
