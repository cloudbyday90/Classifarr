/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { publishedUpgradeDeployment, upgradeDeploymentDigest, upgradeProbeArguments } from '../../../../scripts/lib/publishedUpgradeDeployment.mjs';

const config = () => ({ services: { app: { image: 'baseline', user: '1000:1000', environment: { A: '1', B: '2' },
  volumes: [{ source: 'app-data', target: '/app/data' }], read_only: true } }, volumes: { 'app-data': {} }, networks: { default: { internal: true } } });
const digest = value => upgradeDeploymentDigest(JSON.stringify(value));

test.each(['standard', 'unraid', 'custom'])('fixed deployment %s is immutable', profile => {
  expect(Object.isFrozen(publishedUpgradeDeployment(profile))).toBe(true);
});
test.each(['', '../live.yml', '__proto__', 'constructor', null, 1])('rejects arbitrary deployment %j', profile => {
  expect(() => publishedUpgradeDeployment(profile)).toThrow('invalid_upgrade_deployment');
});
test('image is the only ignored app setting and key order is immaterial', () => {
  const changed = config();
  changed.services.app.image = 'candidate';
  changed.services.app.environment = { B: '2', A: '1' };
  expect(digest(changed)).toBe(digest(config()));
  expect(digest(changed)).toMatch(/^[a-f0-9]{64}$/);
});
test.each([
  value => { value.services.app.user = '0'; },
  value => { value.services.app.environment.A = '3'; },
  value => { value.services.app.read_only = false; },
  value => { value.services.app.volumes[0].source = 'live'; },
  value => { value.volumes['app-data'].external = true; },
  value => { value.networks.default.internal = false; },
])('detects non-image changes', mutate => {
  const changed = config(); mutate(changed);
  expect(digest(changed)).not.toBe(digest(config()));
});
test.each(['', '{}', '{"services":{"app":[]}}'])('rejects malformed config %j', output => {
  expect(() => upgradeDeploymentDigest(output)).toThrow();
});
test('probes use the application identity, not the root-starting identity', () => {
  const args = ['exec', '-T', 'app', 'node', 'probe'];
  expect(upgradeProbeArguments(args, publishedUpgradeDeployment('unraid'))).toEqual(['exec', '-T', '--user', '99:100', 'app', 'node', 'probe']);
  expect(upgradeProbeArguments(args, publishedUpgradeDeployment('standard'))).toBe(args);
  expect(upgradeProbeArguments(['build', 'candidate'], publishedUpgradeDeployment('custom'))).toEqual(['build', 'candidate']);
  for (const invalid of [['exec', '-T', 'other'], ['exec', '--user', 'root', 'app']]) {
    expect(() => upgradeProbeArguments(invalid, publishedUpgradeDeployment('unraid'))).toThrow('invalid_upgrade_probe_target');
  }
});
test.each(['unraid', 'custom'])('frozen %s fixture adds no maintenance setting or host mount', profile => {
  const deployment = publishedUpgradeDeployment(profile);
  const fixture = load(readFileSync(new URL(`../../../../${deployment.file}`, import.meta.url), 'utf8'));
  expect(Object.keys(fixture)).toEqual(['services']);
  const app = fixture.services.app;
  expect(app.user).toBe('0:0');
  expect(`${app.environment.PUID}:${app.environment.PGID}`).toBe(deployment.user);
  expect(Object.keys(app.environment).sort()).toEqual(['PGID', 'PUID', 'UMASK']);
  for (const key of ['entrypoint', 'command', 'volumes', 'ports', 'privileged', 'network_mode', 'env_file']) expect(app[key]).toBeUndefined();
});
