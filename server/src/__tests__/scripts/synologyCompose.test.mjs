/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

const readCompose = name => load(readFileSync(new URL(`../../../../${name}`, import.meta.url), 'utf8'));
const base = readCompose('docker-compose.synology.yml');
const service = base.services.classifarr;

test('Synology keeps the existing appdata destination and requires an existing host directory', () => {
  expect(service.volumes).toEqual([{
    type: 'bind',
    source: '${CLASSIFARR_APPDATA_PATH:-/volume1/docker/classifarr}',
    target: '/app/data',
    bind: { create_host_path: false },
  }]);
});

test('Synology preserves saved identity defaults and the image startup command', () => {
  expect(service.image).toBe('ghcr.io/cloudbyday90/classifarr:latest');
  expect(service.container_name).toBe('classifarr');
  expect(service.environment).toEqual([
    'PUID=${PUID:-1026}', 'PGID=${PGID:-100}', 'UMASK=${UMASK:-022}',
    'NODE_ENV=production', 'TZ=${TZ:-UTC}',
  ]);
  for (const key of ['user', 'entrypoint', 'command', 'build', 'privileged', 'cap_add', 'devices', 'network_mode']) {
    expect(service).not.toHaveProperty(key);
  }
});

test('Synology keeps its existing port, shutdown budget, healthcheck and host alias', () => {
  expect(service.ports).toEqual(['21324:21324']);
  expect(service.restart).toBe('unless-stopped');
  expect(service.stop_grace_period).toBe('60s');
  expect(service.extra_hosts).toEqual(['host.docker.internal:host-gateway']);
  expect(service.healthcheck).toEqual({
    test: ['CMD', 'curl', '-f', 'http://localhost:21324/health'],
    interval: '30s', timeout: '10s', retries: 3, start_period: '60s',
  });
  expect(Object.keys(base.services)).toEqual(['classifarr']);
});

test('Synology media overlay only adds an explicit, existing, read-only-by-default media mount', () => {
  expect(readCompose('docker-compose.synology.media.yml')).toEqual({
    services: {
      classifarr: {
        volumes: [{
          type: 'bind',
          source: '${CLASSIFARR_MEDIA_PATH:?Set CLASSIFARR_MEDIA_PATH to your existing media directory}',
          target: '/data/media',
          read_only: '${CLASSIFARR_MEDIA_READ_ONLY:-true}',
          bind: { create_host_path: false },
        }],
      },
    },
  });
});
