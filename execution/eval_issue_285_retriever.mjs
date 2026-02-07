/**
 * Description: Offline retrieval evaluation for Issue 285.
 * Approach:
 * - Build a corpus from one split (default: train) and queries from another (default: test).
 * - Embed query texts and corpus texts via a local embedder HTTP service.
 * - Compute cosine similarity, rank top-k, and compute Recall@k and Top-1 library accuracy.
 *
 * Usage:
 *   node execution/eval_issue_285_retriever.mjs --dataset .tmp/issue-285/dataset/dataset.jsonl --embedderUrl http://localhost:8002 --outDir .tmp/issue-285/eval
 *
 * Required:
 * - The embedder service must expose POST /embed-text with body { texts: string[] }
 *   and return { embeddings: number[][], dims: number }.
 *
 * Exit codes:
 *   0 success
 *   2 invalid args / missing inputs
 *   3 runtime failure
 */

import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import {
  ensureDir,
  formatEmbeddingTextV2,
  mulberry32,
  nowIsoUtc,
  parseArgs,
  readJsonl,
  sha256Hex,
  sha256FileHex,
  writeJson,
} from './issue_285/lib.mjs';

function splitByStableHash(records, seed) {
  const train = [];
  const valid = [];
  const test = [];
  for (const r of records) {
    const key = r.tmdb_id ? `tmdb:${r.tmdb_id}` : `id:${r.id}`;
    const h = sha256Hex(`${seed}:${key}`);
    const bucket = Number.parseInt(h.slice(0, 8), 16) / 0xffffffff;
    if (bucket < 0.8) train.push(r);
    else if (bucket < 0.9) valid.push(r);
    else test.push(r);
  }
  return { train, valid, test };
}

function l2Normalize(vec) {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum) || 1;
  return vec.map(v => v / norm);
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

async function embedTexts(embedderUrl, texts) {
  const resp = await fetch(`${embedderUrl.replace(/\/+$/, '')}/embed-text`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texts }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`embed-text failed: ${resp.status} ${body}`);
  }
  const json = await resp.json();
  if (!json || !Array.isArray(json.embeddings)) {
    throw new Error('embed-text response missing embeddings[]');
  }
  return json;
}

async function embedAll(embedderUrl, texts, batchSize) {
  const out = [];
  let dims = null;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const { embeddings, dims: d } = await embedTexts(embedderUrl, batch);
    if (!dims) dims = d;
    for (const e of embeddings) out.push(l2Normalize(e));
  }
  return { embeddings: out, dims };
}

function topKIndices(scores, k) {
  // O(n log k) selection using partial sort for simplicity (offline script).
  const idx = scores.map((s, i) => [s, i]);
  idx.sort((a, b) => b[0] - a[0]);
  return idx.slice(0, k).map(([, i]) => i);
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    dataset: { type: 'string', default: '.tmp/issue-285/dataset/dataset.jsonl' },
    outDir: { type: 'string', default: '.tmp/issue-285/eval' },
    embedderUrl: { type: 'string', required: true },
    seed: { type: 'int', default: 285 },
    corpusSplit: { type: 'string', default: 'train' }, // train|valid|test
    querySplit: { type: 'string', default: 'test' }, // train|valid|test
    k: { type: 'int', default: 10 },
    batchSize: { type: 'int', default: 32 },
    maxCorpus: { type: 'int', default: 5000 },
    maxQueries: { type: 'int', default: 1000 },
  });

  const datasetPath = path.resolve(args.dataset);
  const outDir = path.resolve(args.outDir);
  await ensureDir(outDir);

  let records;
  try {
    records = await readJsonl(datasetPath);
  } catch (e) {
    console.error(`Failed to read dataset: ${e.message}`);
    process.exit(2);
  }

  // Sort records to keep split/subset selection stable even if dataset.jsonl order changes.
  records.sort((a, b) => {
    const ak = a.tmdb_id ? `tmdb:${a.tmdb_id}` : `id:${a.id}`;
    const bk = b.tmdb_id ? `tmdb:${b.tmdb_id}` : `id:${b.id}`;
    if (ak < bk) return -1;
    if (ak > bk) return 1;
    const ai = Number(a.id) || 0;
    const bi = Number(b.id) || 0;
    return ai - bi;
  });

  const split = splitByStableHash(records, args.seed);
  const corpus = split[args.corpusSplit];
  const queries = split[args.querySplit];
  if (!Array.isArray(corpus) || !Array.isArray(queries)) {
    console.error(`Invalid split names: corpusSplit=${args.corpusSplit} querySplit=${args.querySplit}`);
    process.exit(2);
  }

  const rng = mulberry32(args.seed);
  const takeDeterministic = (arr, max) => {
    if (max <= 0 || arr.length <= max) return arr;
    // Deterministic shuffle-ish sample without external deps.
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy.slice(0, max);
  };

  const corpusSubset = takeDeterministic(corpus, args.maxCorpus);
  const querySubset = takeDeterministic(queries, args.maxQueries);

  const corpusTexts = corpusSubset.map(r => formatEmbeddingTextV2(r.metadata, { includeClassified: false }));
  const queryTexts = querySubset.map(r => formatEmbeddingTextV2(r.metadata, { includeClassified: false }));

  const { embeddings: corpusEmb, dims: corpusDims } = await embedAll(args.embedderUrl, corpusTexts, args.batchSize);
  const { embeddings: queryEmb, dims: queryDims } = await embedAll(args.embedderUrl, queryTexts, args.batchSize);

  if (corpusDims && queryDims && corpusDims !== queryDims) {
    console.error(`Dims mismatch: corpus=${corpusDims} query=${queryDims}`);
    process.exit(3);
  }

  const k = Math.max(1, Math.min(args.k, corpusEmb.length));

  let recallAtK = 0;
  let top1Acc = 0;
  const perLib = new Map();

  for (let qi = 0; qi < queryEmb.length; qi++) {
    const q = queryEmb[qi];
    const labelLib = Number(querySubset[qi].label_library_id);
    const scores = corpusEmb.map(c => dot(q, c));
    const top = topKIndices(scores, k);

    const hit = top.some(idx => Number(corpusSubset[idx].label_library_id) === labelLib);
    if (hit) recallAtK += 1;

    const top1 = top[0];
    const top1Lib = Number(corpusSubset[top1].label_library_id);
    if (top1Lib === labelLib) top1Acc += 1;

    if (!perLib.has(labelLib)) perLib.set(labelLib, { total: 0, recallHit: 0, top1Hit: 0 });
    const lib = perLib.get(labelLib);
    lib.total += 1;
    lib.recallHit += hit ? 1 : 0;
    lib.top1Hit += top1Lib === labelLib ? 1 : 0;
  }

  const metrics = {
    recall_at_k: recallAtK / queryEmb.length,
    top1_library_accuracy: top1Acc / queryEmb.length,
    k,
    query_count: queryEmb.length,
    corpus_count: corpusEmb.length,
    dims: corpusDims || queryDims || null,
    per_library: [...perLib.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([library_id, v]) => ({
        library_id,
        total: v.total,
        recall_at_k: v.total ? v.recallHit / v.total : 0,
        top1_library_accuracy: v.total ? v.top1Hit / v.total : 0,
      })),
  };

  const meta = {
    generated_at: nowIsoUtc(),
    host: os.hostname(),
    node: process.version,
    args,
    inputs: {
      dataset: datasetPath,
      dataset_sha256: await sha256FileHex(datasetPath),
      corpus_subset_keys_sha256: sha256Hex(corpusSubset.map(r => (r.tmdb_id ? `tmdb:${r.tmdb_id}` : `id:${r.id}`)).join('\n')),
      query_subset_keys_sha256: sha256Hex(querySubset.map(r => (r.tmdb_id ? `tmdb:${r.tmdb_id}` : `id:${r.id}`)).join('\n')),
    },
  };

  await writeJson(path.join(outDir, 'metrics.json'), metrics);
  await writeJson(path.join(outDir, 'meta.json'), meta);

  console.log(`Wrote metrics to ${path.join(outDir, 'metrics.json')}`);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(3);
});
