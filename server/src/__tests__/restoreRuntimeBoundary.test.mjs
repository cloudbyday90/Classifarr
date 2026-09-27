/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

test('restore runtime import graph excludes normal bootstraps and provider-capable services', () => {
  const visited = new Set();
  const inspect = file => {
    if (visited.has(file)) return;
    visited.add(file);
    // Static imports and barrel re-exports; dynamic imports in maintenance are forbidden below.
    const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(source).not.toMatch(/\bimport\s*\(/);
    // Parse without linking/evaluating; includes side-effect imports and re-exports.
    const module = new vm.SourceTextModule(source, { identifier: file });
    for (const specifier of module.dependencySpecifiers) {
      if (specifier.startsWith('.') && specifier.endsWith('.mjs')) inspect(path.resolve(path.dirname(file), specifier));
    }
  };
  inspect(path.resolve(import.meta.dirname, '../bootstrap/restoreRuntime.mjs'));
  const filenames = [...visited].map(file => path.basename(file));
  expect(filenames).toContain('backupRestoreSession.mjs');
  for (const forbidden of ['normalRuntime.mjs', 'createApp.mjs', 'startupPreflight.mjs', 'initializeServices.mjs',
    'api.mjs', 'queueService.mjs', 'scheduler.mjs', 'discordBot.mjs', 'ollama.mjs', 'embeddingRouter.mjs',
    'providerLock.mjs', 'classificationEvidenceService.mjs']) {
    expect(filenames).not.toContain(forbidden);
  }
});
