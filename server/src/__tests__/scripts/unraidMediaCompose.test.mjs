/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

const readCompose = name => load(readFileSync(new URL(`../../../../${name}`, import.meta.url), 'utf8'));

test('README Compose preserves startup and identity without requiring a dummy media directory', () => {
  const readme = readFileSync(new URL('../../../../README.md', import.meta.url), 'utf8');
  const example = readme.split('## Quick Start (Docker Compose)')[1].split('```yaml')[1].split('```')[0];
  const base = load(example).services.classifarr;
  expect(base.volumes).toEqual(['./data:/app/data']);
  expect(base.user).toBe('1000:1000');
  expect(base.environment.PUID).toBe(1000);
  expect(base.environment.PGID).toBe(1000);
  expect(base.tmpfs).toContain('/var/run/postgresql:rw,noexec,nosuid,nodev,uid=1000,gid=1000,mode=770');
  expect(base.stop_grace_period).toBe('60s');
  for (const key of ['entrypoint', 'command', 'privileged']) expect(base).not.toHaveProperty(key);
  expect(readme).toContain('update the image using your saved setup');
  // Parse the opt-in example too, so a broken comment block cannot become instructions.
  const withMedia = load(example.replace(/^      # ([-a-z ].*)$/gm, '      $1')).services.classifarr;
  expect(withMedia.volumes[1]).toEqual({ type: 'bind', source: '/your/existing/media',
    target: '/data/media', read_only: false, bind: { create_host_path: false } });
});

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
