/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Socket } from 'node:net';
import { createQueueMaintenanceHandoffClient } from './queueMaintenanceHandoffClient.mjs';
import { IMAGE_INDEX_RESULTS } from '../utils/imageIndexResultProtocol.mjs';
import { encodeImageIndexClaim, IMAGE_INDEX_REQUEST_INTERVAL_MS,
  IMAGE_INDEX_WORKER_TIMEOUT_MS } from '../utils/imageIndexHandoffProtocol.mjs';

export function openImageIndexHandoff({ environment = process.env, platform = process.platform,
  connect = () => new Socket({ fd: 4, readable: true, writable: true }),
} = {}) {
  if (environment.CLASSIFARR_IMAGE_INDEX_CHANNEL === undefined) return null;
  const unavailable = { request: async () => ({ status: 'unavailable', via: 'maintenance_handoff' }) };
  if (platform !== 'linux' || environment.CLASSIFARR_IMAGE_INDEX_CHANNEL !== 'stdio-v1') return unavailable;
  try {
    return createQueueMaintenanceHandoffClient({ channel: connect(), encodeRequest: encodeImageIndexClaim,
      intervalMs: IMAGE_INDEX_REQUEST_INTERVAL_MS, timeoutMs: IMAGE_INDEX_WORKER_TIMEOUT_MS + 5000,
      coalesce: false, results: IMAGE_INDEX_RESULTS });
  } catch { return unavailable; }
}

// One descriptor owner per application, shared by all queue processor instances.
let handoff;
export function getImageIndexHandoff() {
  if (handoff === undefined) handoff = openImageIndexHandoff();
  return handoff;
}
