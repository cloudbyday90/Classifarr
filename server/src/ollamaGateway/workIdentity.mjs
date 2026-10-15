/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash,createHmac,createSecretKey } from 'node:crypto';
import { gatewayError } from './errors.mjs';

export function gatewayWorkKey(raw) {
  if (raw === undefined) return null;
  if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(raw)) throw gatewayError('gateway_config_invalid');
  const bytes = Buffer.from(raw,'base64url');
  if (bytes.length !== 32 || bytes.toString('base64url') !== raw) throw gatewayError('gateway_config_invalid');
  // KeyObject serialization does not expose the key. Explicit ID also fences reload/rotation.
  return Object.freeze({ key: createSecretKey(bytes),id: createHash('sha256').update(bytes).digest('hex') });
}

export function prepareGatewayWork(config,installation,path,body) {
  const serialized = JSON.stringify(body);
  // Snapshot the exact body before awaiting admission; fingerprint and sent bytes must agree.
  const snapshot = JSON.parse(serialized);
  const fingerprint = config.workIdentity ? createHmac('sha256',config.workIdentity.key)
    .update(JSON.stringify(['classifarr-work-v1',config.providerHash,installation,path,serialized])).digest('hex') : null;
  return { body: snapshot,identity: { version: 1,operation: path,model: snapshot.model,
    fingerprint,keyId: config.workIdentity?.id ?? null } };
}

/** Diagnostic correlation only. Never copied from incoming headers or used as permission. */
export function gatewayWorkHeaders(identity) {
  if (identity === undefined) return {};
  if (!identity || typeof identity.requestId !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(identity.requestId) ||
      typeof identity.installation !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(identity.installation)) {
    throw gatewayError('gateway_work_identity_invalid');
  }
  return { 'X-Classifarr-Application': 'classifarr','X-Classifarr-Request-Id': identity.requestId,
    'X-Classifarr-Installation': identity.installation };
}
