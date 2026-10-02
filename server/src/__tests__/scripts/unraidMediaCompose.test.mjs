/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

const readCompose = name => load(readFileSync(new URL(`../../../../${name}`, import.meta.url), 'utf8'));

test('Unraid media access is opt-in and leaves existing appdata unchanged', () => {
  const base = readCompose('docker-compose.unraid.yml').services.classifarr;
  expect(base.volumes).toEqual(['/mnt/user/appdata/classifarr:/app/data']);
  expect(base.extra_hosts).toEqual(['host.docker.internal:host-gateway']);
  expect(base.stop_grace_period).toBe('60s');
  expect(base.user).toBe('${PUID:-99}:${PGID:-100}');
});

test('media overlay only adds a writable mount to an explicitly selected existing directory', () => {
  const overlay = readCompose('docker-compose.unraid.media.yml');
  expect(overlay).toEqual({
    services: {
      classifarr: {
        volumes: [{
          type: 'bind',
          source: '${CLASSIFARR_MEDIA_PATH:?Set CLASSIFARR_MEDIA_PATH to your existing media directory}',
          target: '/data/media',
          read_only: false,
          bind: { create_host_path: false },
        }],
      },
    },
  });
});
