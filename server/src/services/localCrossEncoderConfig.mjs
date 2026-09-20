/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const CROSS_ENCODER_MODEL = 'BAAI/bge-reranker-base';
export const CROSS_ENCODER_REVISION = '2cfc18c9415c912f9d8155881c133215df768a70';
export const CROSS_ENCODER_IMAGE = 'ghcr.io/huggingface/text-embeddings-inference@sha256:8419f533857b503ebf6ec292a95d4f1cf9c0464ac8b8abeef39518cf110e5726';
export const CROSS_ENCODER_VERSION = '1.9.4';
export const CROSS_ENCODER_BATCH_SIZE = 16;
export const CROSS_ENCODER_MODEL_PATH = `/models/${CROSS_ENCODER_REVISION}`;
export const CROSS_ENCODER_ORIGIN = 'http://inventory-cross-encoder:21325';

/** Fixed Compose service on a private network, or canonical loopback for isolated local probes. */
export function resolveCrossEncoderOrigin(value = CROSS_ENCODER_ORIGIN) {
  if (value === CROSS_ENCODER_ORIGIN) return value;
  let url;
  try { url = new URL(value); } catch { throw new Error('cross_encoder_endpoint_invalid'); }
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', '[::1]'].includes(url.hostname) ||
      (value !== url.origin && value !== `${url.origin}/`) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('cross_encoder_endpoint_invalid');
  return url.origin;
}

export function inspectCrossEncoderInfo(info) {
  if (info?.model_id !== CROSS_ENCODER_MODEL_PATH || info.model_sha !== CROSS_ENCODER_REVISION ||
      info.version !== CROSS_ENCODER_VERSION || info.model_dtype !== 'float32' || info.auto_truncate !== false ||
      !info.model_type?.reranker || Object.keys(info.model_type).length !== 1 ||
      info.max_input_length !== 512 || info.max_client_batch_size !== CROSS_ENCODER_BATCH_SIZE ||
      info.max_concurrent_requests !== CROSS_ENCODER_BATCH_SIZE || info.max_batch_tokens !== 512 ||
      info.max_batch_requests !== 4 || info.tokenization_workers !== 2) {
    throw new Error('cross_encoder_identity_invalid');
  }
  return Object.freeze({ model: CROSS_ENCODER_MODEL, revision: CROSS_ENCODER_REVISION, version: CROSS_ENCODER_VERSION,
    image: CROSS_ENCODER_IMAGE, dtype: 'float32', maxInputLength: 512, representation: 'description_pair_v1' });
}
