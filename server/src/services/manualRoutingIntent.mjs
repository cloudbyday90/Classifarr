/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { isValidArrExpectation, normalizeArrId } from './arrResourceVerification.mjs';
import { normalizeSettings } from './classificationRoutingServiceShared.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fingerprint = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

/** Only routing-relevant values, in a fixed order; credentials are excluded. */
export function manualRoutingLibraryFingerprint(library) {
  const settings = normalizeSettings(library[`${library.arr_type}_settings`]);
  return digest([library.id, library.media_type, library.arr_type, Number(library.arr_id),
    library.root_folder ?? null, library.quality_profile_id ?? null,
    settings.root_folder_path ?? null, settings.quality_profile_id ?? null]);
}

export function manualRoutingEndpointFingerprint(baseUrl) {
  return digest(baseUrl);
}

export function validManualRoutingIntent(intent) {
  return intent?.version === 1 && ['radarr', 'sonarr'].includes(intent.arrType)
    && normalizeArrId(intent.configId) !== null
    && intent.identityKey === (intent.arrType === 'radarr' ? 'tmdbId' : 'tvdbId')
    && typeof intent.rootFolderPath === 'string' && intent.rootFolderPath.length <= 4096
    && fingerprint(intent.endpointFingerprint) && fingerprint(intent.libraryFingerprint)
    && isValidArrExpectation(intent);
}

export function buildManualRoutingIntent({ arrType, configId, baseUrl, expected, libraryFingerprint }) {
  const intent = { version: 1, arrType, configId: normalizeArrId(configId),
    identityKey: expected.identityKey, identity: normalizeArrId(expected.identity),
    rootFolderPath: expected.rootFolderPath,
    endpointFingerprint: manualRoutingEndpointFingerprint(baseUrl), libraryFingerprint };
  if (typeof baseUrl !== 'string' || !baseUrl || !validManualRoutingIntent(intent)) {
    throw new Error('Manual routing intent is unavailable');
  }
  return Object.freeze(intent);
}
