/**
 * Description: Validates Issue 285 offline pipeline reproducibility.
 * What it checks:
 * - Deterministic splits + output ordering for build_issue_285_pairs (even if input JSONL order changes)
 * - Deterministic packaging output bytes for package_issue_285_model (no signature mode)
 *
 * Usage:
 *   node execution/verify_issue_285_reproducibility.mjs
 *
 * Exit codes:
 *   0 success
 *   2 invalid args
 *   3 reproducibility failure / runtime error
 */

import path from 'node:path';
import process from 'node:process';
import fsp from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

import { ensureDir, parseArgs, sha256FileHex } from './issue_285/lib.mjs';

async function writeJson(filePath, obj) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

async function writeJsonl(filePath, rows) {
  await ensureDir(path.dirname(filePath));
  const body = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
  await fsp.writeFile(filePath, body, 'utf8');
}

function runNodeScript(scriptPath, args) {
  const res = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: 'inherit',
    env: process.env,
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`Script failed (${path.basename(scriptPath)}), exit code ${res.status}`);
  }
}

async function hashPairsDir(dir) {
  const files = ['train.jsonl', 'valid.jsonl', 'test.jsonl', 'library_profiles.json'];
  const out = {};
  for (const f of files) {
    out[f] = await sha256FileHex(path.join(dir, f));
  }
  return out;
}

function assertEqualHashes(label, a, b) {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const k of keys) {
    if (a[k] !== b[k]) {
      throw new Error(`${label}: hash mismatch for ${k}: ${a[k]} != ${b[k]}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    outDir: { type: 'string', default: '.tmp/issue-285/repro-check' },
    seed: { type: 'int', default: 285 },
  });

  const outDir = path.resolve(args.outDir);
  const inputsDir = path.join(outDir, 'inputs');
  const run1 = path.join(outDir, 'run1');
  const run2 = path.join(outDir, 'run2');
  const run3 = path.join(outDir, 'run3');
  const pkg1 = path.join(outDir, 'pkg1');
  const pkg2 = path.join(outDir, 'pkg2');

  await ensureDir(inputsDir);
  await ensureDir(run1);
  await ensureDir(run2);
  await ensureDir(run3);
  await ensureDir(pkg1);
  await ensureDir(pkg2);

  const libraries = [
    { id: 1, name: 'Kids' },
    { id: 2, name: 'Family' },
    { id: 3, name: 'Adults' },
  ];

  const records = [
    {
      id: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      media_type: 'movie',
      tmdb_id: 101,
      confidence: 90,
      method: 'manual',
      label_library_id: 1,
      label_library_name: 'Kids',
      metadata: { title: 'Toy Box', year: 1999, media_type: 'movie', genres: [{ name: 'Animation' }], keywords: [{ name: 'friendship' }] },
    },
    {
      id: 2,
      created_at: '2026-01-02T00:00:00.000Z',
      media_type: 'movie',
      tmdb_id: 102,
      confidence: 85,
      method: 'manual',
      label_library_id: 2,
      label_library_name: 'Family',
      metadata: { title: 'Space Camp', year: 2004, media_type: 'movie', genres: [{ name: 'Adventure' }], keywords: [{ name: 'space' }] },
    },
    {
      id: 3,
      created_at: '2026-01-03T00:00:00.000Z',
      media_type: 'movie',
      tmdb_id: 103,
      confidence: 92,
      method: 'manual',
      label_library_id: 3,
      label_library_name: 'Adults',
      metadata: { title: 'Night City', year: 2016, media_type: 'movie', genres: [{ name: 'Thriller' }], keywords: [{ name: 'crime' }] },
    },
    {
      id: 4,
      created_at: '2026-01-04T00:00:00.000Z',
      media_type: 'tv',
      tmdb_id: 201,
      confidence: 88,
      method: 'manual',
      label_library_id: 1,
      label_library_name: 'Kids',
      metadata: { title: 'Dino Squad', year: 2010, media_type: 'tv', genres: [{ name: 'Family' }], keywords: [{ name: 'dinosaurs' }] },
    },
    {
      id: 5,
      created_at: '2026-01-05T00:00:00.000Z',
      media_type: 'tv',
      tmdb_id: 202,
      confidence: 80,
      method: 'manual',
      label_library_id: 2,
      label_library_name: 'Family',
      metadata: { title: 'Home Recipes', year: 2018, media_type: 'tv', genres: [{ name: 'Reality' }], keywords: [{ name: 'cooking' }] },
    },
    {
      id: 6,
      created_at: '2026-01-06T00:00:00.000Z',
      media_type: 'tv',
      tmdb_id: 203,
      confidence: 95,
      method: 'manual',
      label_library_id: 3,
      label_library_name: 'Adults',
      metadata: { title: 'Cold Case', year: 2020, media_type: 'tv', genres: [{ name: 'Drama' }], keywords: [{ name: 'detective' }] },
    },
    // Add some non-tmdb keyed rows to exercise id-based splitting.
    {
      id: 7,
      created_at: '2026-01-07T00:00:00.000Z',
      media_type: 'movie',
      tmdb_id: null,
      confidence: 70,
      method: 'manual',
      label_library_id: 1,
      label_library_name: 'Kids',
      metadata: { title: 'Forest Friends', year: 2001, media_type: 'movie', genres: [{ name: 'Animation' }], keywords: [{ name: 'animals' }] },
    },
    {
      id: 8,
      created_at: '2026-01-08T00:00:00.000Z',
      media_type: 'movie',
      tmdb_id: null,
      confidence: 75,
      method: 'manual',
      label_library_id: 2,
      label_library_name: 'Family',
      metadata: { title: 'Road Trip', year: 2009, media_type: 'movie', genres: [{ name: 'Comedy' }], keywords: [{ name: 'vacation' }] },
    },
    {
      id: 9,
      created_at: '2026-01-09T00:00:00.000Z',
      media_type: 'movie',
      tmdb_id: null,
      confidence: 77,
      method: 'manual',
      label_library_id: 3,
      label_library_name: 'Adults',
      metadata: { title: 'Broken Mirror', year: 2012, media_type: 'movie', genres: [{ name: 'Horror' }], keywords: [{ name: 'haunted' }] },
    },
  ];

  const dataset1 = path.join(inputsDir, 'dataset.jsonl');
  const dataset2 = path.join(inputsDir, 'dataset_reordered.jsonl');
  const librariesPath = path.join(inputsDir, 'libraries.json');

  await writeJsonl(dataset1, records);
  await writeJsonl(dataset2, [...records].reverse());
  await writeJson(librariesPath, libraries);

  const pairsScript = path.resolve('execution/build_issue_285_pairs.mjs');

  runNodeScript(pairsScript, ['--dataset', dataset1, '--libraries', librariesPath, '--outDir', run1, '--seed', String(args.seed)]);
  runNodeScript(pairsScript, ['--dataset', dataset1, '--libraries', librariesPath, '--outDir', run2, '--seed', String(args.seed)]);
  runNodeScript(pairsScript, ['--dataset', dataset2, '--libraries', librariesPath, '--outDir', run3, '--seed', String(args.seed)]);

  const h1 = await hashPairsDir(run1);
  const h2 = await hashPairsDir(run2);
  const h3 = await hashPairsDir(run3);

  assertEqualHashes('build_pairs run1 vs run2', h1, h2);
  assertEqualHashes('build_pairs dataset reorder invariance', h1, h3);

  // Packaging determinism: build archive twice and compare bytes.
  const modelDir = path.join(outDir, 'model_fixture');
  const modelSub = path.join(modelDir, 'subdir');
  await ensureDir(modelSub);
  await fsp.writeFile(path.join(modelDir, 'config.json'), JSON.stringify({ dims: 16, name: 'fixture' }, null, 2) + '\n', 'utf8');
  await fsp.writeFile(path.join(modelSub, 'weights.bin'), Buffer.from('0123456789abcdef', 'utf8'));
  await fsp.writeFile(path.join(modelSub, 'notes.txt'), 'hello\n', 'utf8');

  const pkgScript = path.resolve('execution/package_issue_285_model.mjs');
  runNodeScript(pkgScript, ['--modelDir', modelDir, '--outDir', pkg1, '--modelId', 'fixture', '--version', '0.0.0', '--dims', '16']);
  runNodeScript(pkgScript, ['--modelDir', modelDir, '--outDir', pkg2, '--modelId', 'fixture', '--version', '0.0.0', '--dims', '16']);

  const a1 = await sha256FileHex(path.join(pkg1, 'model.tar.gz'));
  const a2 = await sha256FileHex(path.join(pkg2, 'model.tar.gz'));
  if (a1 !== a2) throw new Error(`package_model: model.tar.gz sha256 mismatch: ${a1} != ${a2}`);

  console.log('Reproducibility checks passed.');
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(3);
});

