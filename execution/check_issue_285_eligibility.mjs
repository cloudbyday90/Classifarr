/**
 * Description: Checks Issue 285 training eligibility gates on exported dataset + built pairs.
 *
 * Gates (Phase 0):
 * - >= 12,000 labeled samples
 * - >= 8 libraries with >= 150 samples each
 * - no library > 40% after balancing
 * - >= 2,000 hard negatives (train split)
 *
 * Usage:
 *   node execution/check_issue_285_eligibility.mjs
 *
 * Exit codes:
 *   0 pass
 *   2 invalid args / missing inputs
 *   3 gate failed
 */

import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { ensureDir, nowIsoUtc, parseArgs, readJson, readJsonl, writeJson } from './issue_285/lib.mjs';

function countByLib(records) {
  const m = new Map();
  for (const r of records) {
    const id = Number(r.label_library_id);
    if (!id) continue;
    m.set(id, (m.get(id) || 0) + 1);
  }
  const rows = [...m.entries()].map(([library_id, count]) => ({ library_id, count }));
  rows.sort((a, b) => (b.count - a.count) || (a.library_id - b.library_id));
  return rows;
}

function pct(x) {
  return `${(x * 100).toFixed(2)}%`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    dataset: { type: 'string', default: '.tmp/issue-285/dataset/dataset.jsonl' },
    datasetMeta: { type: 'string', default: '.tmp/issue-285/dataset/meta.json' },
    pairsDir: { type: 'string', default: '.tmp/issue-285/pairs' },
    outDir: { type: 'string', default: '.tmp/issue-285/eligibility' },

    minLabeledSamples: { type: 'int', default: 12000 },
    minLibraries: { type: 'int', default: 8 },
    minSamplesPerLibrary: { type: 'int', default: 150 },
    maxLibraryShare: { type: 'float', default: 0.4 },
    minHardNegatives: { type: 'int', default: 2000 },
  });

  const datasetPath = path.resolve(args.dataset);
  const datasetMetaPath = path.resolve(args.datasetMeta);
  const pairsDir = path.resolve(args.pairsDir);
  const outDir = path.resolve(args.outDir);
  await ensureDir(outDir);

  let dataset;
  let datasetMeta;
  try {
    dataset = await readJsonl(datasetPath);
    datasetMeta = await readJson(datasetMetaPath);
  } catch (e) {
    console.error(`Failed to read dataset inputs: ${e.message}`);
    process.exit(2);
  }

  const pairsMetaPath = path.join(pairsDir, 'meta.json');
  const trainPairsPath = path.join(pairsDir, 'train.jsonl');
  let pairsMeta;
  let trainPairs;
  try {
    pairsMeta = await readJson(pairsMetaPath);
    trainPairs = await readJsonl(trainPairsPath);
  } catch (e) {
    console.error(`Failed to read pairs inputs: ${e.message}`);
    process.exit(2);
  }

  const total = dataset.length;
  const byLib = countByLib(dataset);
  const libsWithMin = byLib.filter(r => r.count >= args.minSamplesPerLibrary);

  const hardNegCount = trainPairs.filter(r => r.kind === 'hard_negative').length;

  // Balancing check: prefer pairs meta balancing section (train label counts after balancing).
  const balancing = pairsMeta?.balancing || {};
  const trainCounts = Array.isArray(balancing.train_label_counts) ? balancing.train_label_counts : [];
  const trainTotal = trainCounts.reduce((a, r) => a + Number(r.count || 0), 0);
  const trainMax = trainCounts.length ? Math.max(...trainCounts.map(r => Number(r.count || 0))) : 0;
  const trainMaxShare = trainTotal > 0 ? trainMax / trainTotal : null;

  const checks = [];

  checks.push({
    id: 'min_labeled_samples',
    ok: total >= args.minLabeledSamples,
    required: args.minLabeledSamples,
    actual: total,
  });

  checks.push({
    id: 'min_libraries_with_min_samples',
    ok: libsWithMin.length >= args.minLibraries,
    required: { libraries: args.minLibraries, min_samples_per_library: args.minSamplesPerLibrary },
    actual: { libraries: libsWithMin.length },
  });

  const maxShareReq = Number(args.maxLibraryShare);
  const maxShareOk = trainMaxShare === null ? false : trainMaxShare <= maxShareReq + 1e-12;
  checks.push({
    id: 'max_library_share_after_balancing',
    ok: maxShareOk,
    required: maxShareReq,
    actual: trainMaxShare,
    detail: trainMaxShare === null ? 'missing balancing.train_label_counts in pairs meta' : `max_share=${pct(trainMaxShare)}`,
  });

  checks.push({
    id: 'min_hard_negatives_train',
    ok: hardNegCount >= args.minHardNegatives,
    required: args.minHardNegatives,
    actual: hardNegCount,
  });

  const ok = checks.every(c => c.ok);

  const out = {
    schema_version: 1,
    generated_at: nowIsoUtc(),
    host: os.hostname(),
    node: process.version,
    ok,
    args,
    inputs: {
      dataset: datasetPath,
      dataset_meta: datasetMetaPath,
      pairs_dir: pairsDir,
    },
    dataset_summary: {
      total_rows: total,
      libraries_total: byLib.length,
      libraries_with_min_samples: libsWithMin.length,
      top_libraries: byLib.slice(0, 20),
    },
    train_balance_summary: {
      train_total_rows_after_balancing: trainTotal,
      max_library_share_after_balancing: trainMaxShare,
    },
    pairs_summary: {
      train_pairs_total: trainPairs.length,
      train_hard_negative_count: hardNegCount,
    },
    checks,
    notes: {
      export_args: datasetMeta?.args || null,
      export_since_date_utc: datasetMeta?.since_date_utc || null,
    },
  };

  const outPath = path.join(outDir, 'eligibility.json');
  await writeJson(outPath, out);

  if (ok) {
    console.log(`PASS: eligibility gates ok (wrote ${outPath})`);
    process.exit(0);
  } else {
    console.error(`FAIL: eligibility gates failed (wrote ${outPath})`);
    process.exit(3);
  }
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(3);
});

