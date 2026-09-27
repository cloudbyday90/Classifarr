/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { runRestoreRecoveryCompose } from '../../../../scripts/lib/restoreRecoveryCompose.mjs';
import { assertDrillEnvironment, seedRecoveryFixtures } from '../../scripts/restoreRecoveryFixtures.mjs';
import { drillRequest, startDrillProcess, waitFor } from '../../scripts/restoreRecoveryProcess.mjs';

const random = size => Buffer.alloc(size, 1);
const goodEnvironment = {
  CLASSIFARR_RESTORE_DRILL: 'isolated-compose-v1', POSTGRES_HOST: 'database',
  POSTGRES_PORT: '5432', POSTGRES_DB: 'classifarr_restore_drill', POSTGRES_USER: 'rehearsal',
  POSTGRES_PASSWORD: 'a'.repeat(64), BACKUP_DIR: '/app/data/backups', MIGRATIONS_DIR: '/app/database/migrations',
};
const runner = () => jest.fn(() => ({ status: 0, stdout: '' }));
const operations = run => run.mock.calls.filter(([, args]) => args[0] === 'compose').map(([, args]) => args[7]);

describe('disposable recovery drill launcher', () => {
  test('uses fixed commands, an isolated project, bounded waits and no shell', () => {
    const run = runner();
    expect(runRestoreRecoveryCompose({ run, random })).toEqual({ status: 'passed', cleanup: 'passed' });
    expect(operations(run)).toEqual(['config', 'build', 'up', 'run', 'down']);
    for (const [command, args, options] of run.mock.calls) {
      expect(command).toBe('docker');
      expect(options).toMatchObject({ shell: false, windowsHide: true });
      expect(options.timeout).toBeGreaterThan(0);
      expect(options.env.COMPOSE_DISABLE_ENV_FILE).toBe('1');
      if (args[0] === 'compose') {
        expect(args[2]).toMatch(/^classifarr-restore-drill-[a-f0-9]{32}$/);
        expect(args[4]).toMatch(/docker-compose\.restore-recovery-drill\.yml$/);
      }
      expect(args.join(' ')).not.toContain(options.env.CLASSIFARR_DRILL_PASSWORD);
      expect(args).not.toContain('prune');
    }
  });

  test.each(['build', 'up', 'run'])('cleans up even when %s fails', operation => {
    const run = runner().mockImplementation((_cmd, args) => ({ status: args[7] === operation ? 1 : 0, stdout: '' }));
    expect(() => runRestoreRecoveryCompose({ run, random })).toThrow(`drill_${operation}_failed`);
    expect(operations(run).at(-1)).toBe('down');
  });

  test('does not report success when cleanup fails', () => {
    const run = runner().mockImplementation((_cmd, args) => ({ status: args[7] === 'down' ? 1 : 0, stdout: '' }));
    expect(() => runRestoreRecoveryCompose({ run, random })).toThrow('drill_cleanup_failed');
  });

  test('retains scenario failure classification when cleanup also fails', () => {
    const run = runner().mockImplementation((_cmd, args) => ({ status: ['run', 'down'].includes(args[7]) ? 1 : 0, stdout: '' }));
    expect(() => runRestoreRecoveryCompose({ run, random })).toThrow(':scenario_failed');
  });

  test.each([0, 1, 2, 3])('refuses resource collision at inventory %i without cleanup', index => {
    const run = runner();
    for (let i = 0; i < index; i++) run.mockReturnValueOnce({ status: 0, stdout: '' });
    run.mockReturnValueOnce({ status: 0, stdout: 'existing-resource' });
    expect(() => runRestoreRecoveryCompose({ run, random })).toThrow('drill_project_not_empty');
    expect(operations(run)).toEqual([]);
  });

  test('does not clean up resources when configuration validation fails', () => {
    const run = runner().mockImplementation((_cmd, args) => ({ status: args[7] === 'config' ? 1 : 0, stdout: '' }));
    expect(() => runRestoreRecoveryCompose({ run, random })).toThrow('drill_config_failed');
    expect(operations(run)).toEqual(['config']);
  });

  test('fails closed on unavailable Docker inventory', () => {
    expect(() => runRestoreRecoveryCompose({ run: () => ({ status: 1 }), random })).toThrow('drill_inventory_failed');
    expect(() => runRestoreRecoveryCompose({ run: () => { throw new Error('secret'); }, random })).toThrow('drill_inventory_failed');
  });

  test('sanitizes thrown command errors and still cleans up', () => {
    const run = runner().mockImplementation((_cmd, args) => {
      if (args[7] === 'run') throw new Error('private payload');
      return { status: 0, stdout: '' };
    });
    expect(() => runRestoreRecoveryCompose({ run, random })).toThrow('drill_run_failed');
    expect(operations(run).at(-1)).toBe('down');
  });

  test('rejects malformed generated identity and credentials before Docker', () => {
    const run = runner();
    expect(() => runRestoreRecoveryCompose({ run, random: () => Buffer.alloc(0) })).toThrow('invalid_drill_identity');
    expect(() => runRestoreRecoveryCompose({ run, random: size => Buffer.alloc(size === 16 ? 16 : 0) })).toThrow('invalid_drill_credentials');
    expect(run).not.toHaveBeenCalled();
  });
});

describe('container and database boundaries', () => {
  test('fixed Compose has no live mounts, published ports or egress network', () => {
    const document = load(readFileSync(new URL('../../../../docker-compose.restore-recovery-drill.yml', import.meta.url), 'utf8'));
    expect(document.networks).toEqual({ default: { internal: true } });
    expect(Object.keys(document.services).sort()).toEqual(['database', 'drill']);
    expect(Object.keys(document.volumes).sort()).toEqual(['app-data', 'database-data']);
    for (const service of Object.values(document.services)) {
      expect(service.ports).toBeUndefined();
      expect(service.network_mode).toBeUndefined();
      expect(service.env_file).toBeUndefined();
      expect(service.privileged).toBeUndefined();
      for (const mount of service.volumes) expect(mount).toMatch(/^(app-data|database-data):\//);
    }
    expect(document.services.drill.entrypoint).toEqual(['node', 'src/scripts/runRestoreRecoveryDrill.mjs']);
    expect(document.services.drill.cap_drop).toEqual(['ALL']);
  });

  test('accepts only the fixed disposable environment', () => {
    expect(() => assertDrillEnvironment(goodEnvironment)).not.toThrow();
    for (const key of Object.keys(goodEnvironment)) {
      expect(() => assertDrillEnvironment({ ...goodEnvironment, [key]: 'production' })).toThrow('isolated_drill_environment_required');
    }
  });

  test.each([
    { name: 'production', occupied: false }, { name: 'classifarr_restore_drill', occupied: true },
  ])('rejects unsafe schema initialization %j', target => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [target] }) };
    return expect(seedRecoveryFixtures(db)).rejects.toThrow('empty_drill_database_required');
  });

  test('rejects process/HTTP target overrides before starting anything', async () => {
    expect(() => startDrillProcess('shell', 21324)).toThrow('invalid_drill_process');
    expect(() => startDrillProcess('restore', 443)).toThrow('invalid_drill_process');
    await expect(drillRequest('https://example.com')).rejects.toThrow('invalid_drill_path');
    await expect(drillRequest('/health', { port: 443 })).rejects.toThrow('invalid_drill_port');
  });

  test('polling succeeds on evidence, propagates failures and has a deadline', async () => {
    await expect(waitFor(async () => true, 'ready', 100)).resolves.toBeUndefined();
    await expect(waitFor(async () => false, 'missing', 0)).rejects.toThrow('timeout:missing');
    await expect(waitFor(async () => { throw new Error('failed'); }, 'failed', 100)).rejects.toThrow('failed');
  });
});
