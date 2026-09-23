/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const dockerfile = readFileSync(new URL('../../../Dockerfile', import.meta.url), 'utf8');
const step = dockerfile.match(/RUN apk add --no-cache --virtual \.pgvector-build-deps[\s\S]*?(?=\r?\n\r?\n)/)[0]
    .replace(/^RUN /, '').replace(/\\\r?\n/g, ' ')
    .replaceAll('/usr/libexec/postgresql17/pg_config', 'pg_config17')
    .replaceAll('/usr/libexec/postgresql18/pg_config', 'pg_config18');

// Execute the actual AND/OR structure with every external command stubbed. No
// downloads, builds, file changes, environment loading or database connections.
const stubs = `
apk() { return 0; }
curl() { [ "$FAIL_STAGE" != download ]; }
sha256sum() { [ "$FAIL_STAGE" != checksum ]; }
tar() { return 0; }
cd() { return 0; }
pg_config17() { printf /synthetic/17; }
pg_config18() { printf /synthetic/18; }
make() {
  [ "$1" != clean ] || return 1
  case "$1" in install) phase=install;; *) phase=compile;; esac
  case "$*" in *PG_CONFIG=pg_config18*) major=18;; *) major=17;; esac
  printf 'stage:%s%s\\n' "$phase" "$major"
  [ "$FAIL_STAGE" != "$phase$major" ]
}
cp() { printf 'stage:copy\\n'; [ "$FAIL_STAGE" != copy ]; }
rm() { printf 'stage:cleanup\\n'; return 0; }
`;

function run(mode, failure) {
    const result = spawnSync('sh', ['-c', `${stubs}\n${step}`], { encoding: 'utf8', timeout: 10000,
        windowsHide: true, shell: false, env: { ...process.env, PGVECTOR_BUILD: mode, FAIL_STAGE: failure,
            PGVECTOR_VERSION: 'synthetic', PGVECTOR_SHA256: 'synthetic',
            PGVECTOR_GENERIC_OPTFLAGS: '', PGVECTOR_AVX_OPTFLAGS: '-mavx', PGVECTOR_AVX2_OPTFLAGS: '-mavx2' } });
    if (result.error) throw result.error;
    return result;
}

test.each(['generic', 'avx', 'avx2', 'multi'])('%s build preserves failures and only tolerates make clean', mode => {
    for (const failure of ['download', 'checksum', 'compile17', 'install17', 'compile18', 'install18', 'copy']) {
        const result = run(mode, failure);
        expect(result.status).not.toBe(0);
        expect(result.stdout).not.toContain('stage:cleanup');
        if (['download', 'checksum'].includes(failure)) expect(result.stdout).not.toContain('stage:compile');
        if (failure === 'compile18') expect(result.stdout).not.toContain('stage:install18');
    }
    const success = run(mode, 'none');
    expect(success.status).toBe(0);
    expect(success.stdout).toContain('stage:cleanup');
    expect(success.stdout.match(/stage:compile18/g)).toHaveLength(mode === 'multi' ? 3 : 1);
});
