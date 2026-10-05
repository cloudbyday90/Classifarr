/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parseEmbeddedId } from './embeddedIdentityPolicy.mjs';
import { readDatabaseStartupTimeout } from './embeddedDatabaseStartup.mjs';
import { selectedApplicationConfiguration, isSelectedApplicationSetting } from './selectedApplicationConfiguration.mjs';

const supervisorKeys = new Set(['PUID', 'PGID', 'UMASK', 'CLASSIFARR_RUNTIME_MODE',
  'CLASSIFARR_SCHEMA_MAINTENANCE', 'PGVECTOR_RUNTIME_STAGING',
  'CLASSIFARR_POSTGRES_STARTUP_TIMEOUT_SECONDS', 'PGCTLTIMEOUT']);
const fixedLegacy = Object.freeze({ NODE_ENV: 'production', POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432', POSTGRES_DB: 'classifarr', POSTGRES_USER: 'classifarr', POSTGRES_PASSWORD: '' });
// Metadata is accounted for but never copied into a child or used as trusted evidence.
const metadata = new Set(['HOSTNAME', 'HOST_OS', 'HOST_HOSTNAME', 'HOST_CONTAINERNAME',
  'NODE_VERSION', 'YARN_VERSION', 'CLASSIFARR_BUILD_REVISION', 'CLASSIFARR_PGVECTOR_BUILD']);
const imagePath = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
const fail = reason => { throw new Error(`selected_deployment_${reason}`); };

/** Resolved container snapshot AFTER heap sizing, BEFORE authority rewrites.
 * Internal compiler only. Caller must not log the returned secret-bearing profile
 * or discard supervisor fields. Does not attest accounts/mounts or select a runtime.
 */
export function selectedDeploymentConfiguration(environment) {
  if (!environment || Object.getPrototypeOf(environment) !== Object.prototype) fail('invalid');
  const descriptors = Object.getOwnPropertyDescriptors(environment);
  const names = Reflect.ownKeys(descriptors);
  if (names.length > 256) fail('invalid');
  const snapshot = {};
  for (const key of names) {
    const descriptor = descriptors[key];
    if (typeof key !== 'string' || !/^[A-Z][A-Z0-9_]{0,127}$/.test(key)
      || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')
      || typeof descriptor.value !== 'string' || descriptor.value.length > 4096
      || /[\x00-\x1f\x7f]/.test(descriptor.value)) fail('invalid');
    snapshot[key] = descriptor.value;
  }
  const application = { POSTGRES_POOL_MAX: '15', POSTGRES_CONNECT_RETRIES: '2' };
  for (const [key, value] of Object.entries(snapshot)) {
    if (isSelectedApplicationSetting(key)) application[key] = value;
    else if (supervisorKeys.has(key) || metadata.has(key)) continue;
    else if (Object.hasOwn(fixedLegacy, key)) { if (value !== fixedLegacy[key]) fail('authority_unsupported'); }
    else if (key === 'PATH') { if (value !== imagePath) fail('authority_unsupported'); }
    else fail('setting_unreviewed');
  }
  if ((snapshot.CLASSIFARR_RUNTIME_MODE ?? 'normal') !== 'normal') fail('mode_unsupported');
  if ((snapshot.CLASSIFARR_SCHEMA_MAINTENANCE ?? 'startup') !== 'startup') fail('authority_unsupported');
  if (!Object.hasOwn(snapshot, 'NODE_OPTIONS')) fail('heap_unresolved');
  const umask = snapshot.UMASK ?? '022';
  if (!/^(?:0)?[0-7]{3}$/.test(umask)) fail('invalid');
  const vectorStaging = snapshot.PGVECTOR_RUNTIME_STAGING ?? 'auto';
  if (!['auto', 'disabled'].includes(vectorStaging)) fail('invalid');
  let configuration, uid, gid, databaseStartupTimeoutMs;
  try {
    configuration = selectedApplicationConfiguration(application);
    uid = parseEmbeddedId(snapshot.PUID ?? '1000');
    gid = parseEmbeddedId(snapshot.PGID ?? '1000');
    databaseStartupTimeoutMs = readDatabaseStartupTimeout(snapshot);
  } catch { fail('invalid'); }
  return {
    configuration,
    supervisor: { uid, gid, umask, vectorStaging, databaseStartupTimeoutMs },
  };
}
