/**
 * Description: Builds deterministic contrastive pairs for Issue 285 retriever fine-tuning.
 * Usage:
 *   node execution/build_issue_285_pairs.mjs --dataset .tmp/issue-285/dataset/dataset.jsonl --libraries .tmp/issue-285/dataset/libraries.json --outDir .tmp/issue-285/pairs
 * Exit codes:
 *   0 success
 *   2 invalid args / missing files
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
  readJson,
  readJsonl,
  sha256Hex,
  sha256FileHex,
  writeJson,
  writeJsonl,
} from './issue_285/lib.mjs';

function splitByStableHash(records, seed) {
  // Deterministic split keyed by tmdb_id if present, else classification id.
  // 80/10/10 train/valid/test.
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

function buildDerivedLibraryProfiles(records, libraries) {
  // Build a lightweight “library description” from observed genres/keywords.
  const byLib = new Map();
  const libNames = new Map(libraries.map(l => [String(l.id), l.name]));

  function bump(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
  }

  for (const r of records) {
    const libId = String(r.label_library_id);
    if (!byLib.has(libId)) {
      byLib.set(libId, {
        id: Number(r.label_library_id),
        name: r.label_library_name || libNames.get(libId) || `Library ${libId}`,
        media_type_counts: new Map(),
        genres: new Map(),
        keywords: new Map(),
      });
    }
    const agg = byLib.get(libId);
    const mt = r.media_type || r.metadata?.media_type || 'unknown';
    bump(agg.media_type_counts, mt);

    const g = r.metadata?.genres || [];
    for (const item of Array.isArray(g) ? g : []) {
      const name = typeof item === 'string' ? item : item?.name;
      if (name) bump(agg.genres, name);
    }
    const k = r.metadata?.keywords || [];
    for (const item of Array.isArray(k) ? k : []) {
      const name = typeof item === 'string' ? item : item?.name;
      if (name) bump(agg.keywords, name);
    }
  }

  function topN(map, n) {
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k]) => k);
  }

  const profiles = [...byLib.values()]
    .sort((a, b) => a.id - b.id)
    .map((agg) => {
      const topGenres = topN(agg.genres, 8);
      const topKeywords = topN(agg.keywords, 12);
      const mediaTypes = [...agg.media_type_counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k);

      const descParts = [
        `Library: ${agg.name}`,
        mediaTypes.length ? `Media types: ${mediaTypes.join(', ')}` : null,
        topGenres.length ? `Typical genres: ${topGenres.join(', ')}` : null,
        topKeywords.length ? `Common keywords: ${topKeywords.join(', ')}` : null,
      ].filter(Boolean);

      return {
        id: agg.id,
        name: agg.name,
        description: descParts.join(' | '),
        top_genres: topGenres,
        top_keywords: topKeywords,
      };
    });

  return profiles;
}

function chooseNegatives(rng, candidateLibIds, positiveLibId, count) {
  const pool = candidateLibIds.filter(id => id !== positiveLibId);
  const target = Math.min(count, pool.length);
  const picked = new Set();
  while (picked.size < target && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    picked.add(pool[idx]);
  }
  return [...picked.values()];
}

function buildPairs(records, profilesById, opts) {
  const rng = mulberry32(opts.seed);
  const byMediaType = new Map();
  for (const r of records) {
    const mt = r.media_type || r.metadata?.media_type || 'unknown';
    if (!byMediaType.has(mt)) byMediaType.set(mt, []);
    byMediaType.get(mt).push(r);
  }

  const libIds = [...profilesById.keys()].map(k => Number(k)).sort((a, b) => a - b);

  const pairs = [];
  for (const r of records) {
    const libId = Number(r.label_library_id);
    const profile = profilesById.get(String(libId));
    if (!profile) continue;

    const queryText = formatEmbeddingTextV2(r.metadata, { includeClassified: false });

    // Positive example: query -> library description.
    pairs.push({
      kind: 'positive',
      query: queryText,
      target: profile.description,
      label_library_id: libId,
      media_type: r.media_type || r.metadata?.media_type || null,
      source_id: r.id,
      source_tmdb_id: r.tmdb_id ?? null,
    });

    // Negatives: query -> wrong library description.
    const negatives = chooseNegatives(rng, libIds, libId, opts.negativesPerExample);
    for (const negId of negatives) {
      const negProfile = profilesById.get(String(negId));
      if (!negProfile) continue;
      pairs.push({
        kind: 'negative',
        query: queryText,
        target: negProfile.description,
        label_library_id: libId,
        negative_library_id: negId,
        media_type: r.media_type || r.metadata?.media_type || null,
        source_id: r.id,
        source_tmdb_id: r.tmdb_id ?? null,
      });
    }
  }

  return pairs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    dataset: { type: 'string', default: '.tmp/issue-285/dataset/dataset.jsonl' },
    libraries: { type: 'string', default: '.tmp/issue-285/dataset/libraries.json' },
    outDir: { type: 'string', default: '.tmp/issue-285/pairs' },
    seed: { type: 'int', default: 285 },
    negativesPerExample: { type: 'int', default: 4 },
    hardNegativesPerExample: { type: 'int', default: 0 }, // reserved for v2, kept for CLI stability
  });

  const datasetPath = path.resolve(args.dataset);
  const librariesPath = path.resolve(args.libraries);
  const outDir = path.resolve(args.outDir);

  await ensureDir(outDir);

  let records;
  let libraries;
  try {
    records = await readJsonl(datasetPath);
    libraries = await readJson(librariesPath);
  } catch (e) {
    console.error(`Failed to read inputs: ${e.message}`);
    process.exit(2);
  }

  // Sort records to guarantee stable output ordering even if the input JSONL is re-ordered.
  // This also ensures RNG consumption order is deterministic.
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
  const profiles = buildDerivedLibraryProfiles(split.train, libraries);
  const profilesById = new Map(profiles.map(p => [String(p.id), p]));

  const trainPairs = buildPairs(split.train, profilesById, args);
  const validPairs = buildPairs(split.valid, profilesById, args);
  const testPairs = buildPairs(split.test, profilesById, args);

  const trainPath = path.join(outDir, 'train.jsonl');
  const validPath = path.join(outDir, 'valid.jsonl');
  const testPath = path.join(outDir, 'test.jsonl');
  const profilesPath = path.join(outDir, 'library_profiles.json');

  await writeJsonl(trainPath, trainPairs);
  await writeJsonl(validPath, validPairs);
  await writeJsonl(testPath, testPairs);
  await writeJson(profilesPath, profiles);

  const meta = {
    generated_at: nowIsoUtc(),
    host: os.hostname(),
    node: process.version,
    args,
    inputs: {
      dataset: datasetPath,
      libraries: librariesPath,
      dataset_sha256: await sha256FileHex(datasetPath),
      libraries_sha256: await sha256FileHex(librariesPath),
    },
    counts: {
      dataset_rows: records.length,
      libraries: libraries.length,
      split: {
        train: split.train.length,
        valid: split.valid.length,
        test: split.test.length,
      },
      pairs: {
        train: trainPairs.length,
        valid: validPairs.length,
        test: testPairs.length,
      },
    },
    outputs: {
      sha256: {
        train: await sha256FileHex(trainPath),
        valid: await sha256FileHex(validPath),
        test: await sha256FileHex(testPath),
        library_profiles: await sha256FileHex(profilesPath),
      },
    },
  };

  await writeJson(path.join(outDir, 'meta.json'), meta);

  console.log(`Wrote pairs to ${outDir}`);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(3);
});
