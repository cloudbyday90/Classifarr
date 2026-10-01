/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';

const PROFILES = Object.freeze({
  standard: Object.freeze({ user: '1000:1000', file: null }),
  unraid: Object.freeze({ user: '99:100', file: 'scripts/fixtures/published-upgrade/unraid.yml' }),
  custom: Object.freeze({ user: '2345:2345', file: 'scripts/fixtures/published-upgrade/custom.yml' }),
});

export function publishedUpgradeDeployment(name) {
  if (typeof name !== 'string' || !Object.hasOwn(PROFILES, name)) throw new Error('invalid_upgrade_deployment');
  return PROFILES[name];
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

/** Retain only a digest: no resolved environment values enter receipts or logs. */
export function upgradeDeploymentDigest(output) {
  const document = JSON.parse(output);
  const app = document?.services?.app;
  if (!app || typeof app !== 'object' || Array.isArray(app) || typeof app.image !== 'string'
    || !app.environment || !Array.isArray(app.volumes) || !app.volumes.length) {
    throw new Error('invalid_upgrade_deployment_config');
  }
  // Networks and volume definitions also affect startup; image is the only exemption.
  const { image: _image, ...service } = app;
  return createHash('sha256').update(JSON.stringify(canonical({ service,
    networks: document.networks, volumes: document.volumes }))).digest('hex');
}

export function upgradeProbeArguments(args, deployment) {
  if (args[0] !== 'exec' || deployment.user === '1000:1000') return args;
  const position = args.indexOf('app');
  if (position < 0 || args.includes('--user')) throw new Error('invalid_upgrade_probe_target');
  return [...args.slice(0, position), '--user', deployment.user, ...args.slice(position)];
}
