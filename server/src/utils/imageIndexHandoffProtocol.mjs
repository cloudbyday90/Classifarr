/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isQueueClaimToken } from '../services/queueTaskAcknowledgementService.mjs';

export const IMAGE_INDEX_REQUEST_BYTES = 56;
export const IMAGE_INDEX_REQUEST_INTERVAL_MS = 60_000;
export const IMAGE_INDEX_WORKER_TIMEOUT_MS = 135_000;

/** Fixed ASCII frame: I + zero-padded bigint ID + UUIDv4. No payload or commands. */
export function encodeImageIndexClaim(task) {
  const id = String(task?.id);
  if (!/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n
    || (typeof task.id === 'number' && !Number.isSafeInteger(task.id))
    || !isQueueClaimToken(task?.claim_token)) throw new Error('image_index_claim_invalid');
  return Buffer.from(`I${id.padStart(19, '0')}${task.claim_token.toLowerCase()}`, 'ascii');
}

export function decodeImageIndexClaim(frame) {
  if (!Buffer.isBuffer(frame) || frame.length !== IMAGE_INDEX_REQUEST_BYTES
    || !/^I[0-9]{19}[0-9a-f-]{36}$/.test(frame.toString('utf8'))) throw new Error('image_index_claim_invalid');
  const task = { id: frame.subarray(1, 20).toString('ascii').replace(/^0+/, ''),
    claim_token: frame.subarray(20).toString('ascii') };
  encodeImageIndexClaim(task);
  return Object.freeze(task);
}
