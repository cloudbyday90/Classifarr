/**
 * Description: Generates a reproducible training config for Issue 285 retriever fine-tuning.
 * Notes:
 * - This repo does not ship ML training dependencies. Training is expected to run in a dedicated environment.
 * - This script validates inputs and writes a train_config.json that a trainer can consume.
 *
 * Usage:
 *   node execution/train_issue_285_retriever.mjs --pairsDir .tmp/issue-285/pairs --outDir .tmp/issue-285/artifacts/training --baseModel sentence-transformers/all-MiniLM-L6-v2
 *
 * Exit codes:
 *   0 success
 *   2 invalid args / missing files
 *   3 runtime failure
 */

import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import fsp from 'node:fs/promises';

import { ensureDir, nowIsoUtc, parseArgs, sha256FileHex, writeJson } from './issue_285/lib.mjs';

async function fileExists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    pairsDir: { type: 'string', default: '.tmp/issue-285/pairs' },
    outDir: { type: 'string', default: '.tmp/issue-285/artifacts/training' },
    seed: { type: 'int', default: 285 },
    baseModel: { type: 'string', required: true },
    epochs: { type: 'int', default: 1 },
    batchSize: { type: 'int', default: 64 },
    learningRate: { type: 'float', default: 2e-5 },
    warmupRatio: { type: 'float', default: 0.1 },
    maxSeqLength: { type: 'int', default: 256 },
  });

  const pairsDir = path.resolve(args.pairsDir);
  const outDir = path.resolve(args.outDir);
  await ensureDir(outDir);

  const trainPath = path.join(pairsDir, 'train.jsonl');
  const validPath = path.join(pairsDir, 'valid.jsonl');
  const testPath = path.join(pairsDir, 'test.jsonl');

  for (const p of [trainPath, validPath, testPath]) {
    if (!(await fileExists(p))) {
      console.error(`Missing required pairs file: ${p}`);
      process.exit(2);
    }
  }

  const config = {
    schema_version: 1,
    generated_at: nowIsoUtc(),
    host: os.hostname(),
    seed: args.seed,
    base_model: args.baseModel,
    training: {
      epochs: args.epochs,
      batch_size: args.batchSize,
      learning_rate: args.learningRate,
      warmup_ratio: args.warmupRatio,
      max_seq_length: args.maxSeqLength,
      // The intended objective for v1:
      // - Use query->target positives with in-batch negatives (or explicit negatives).
      objective: 'contrastive',
      loss: 'multiple-negatives-ranking (recommended)',
    },
    inputs: {
      pairs_dir: pairsDir,
      train_jsonl: trainPath,
      valid_jsonl: validPath,
      test_jsonl: testPath,
      sha256: {
        train: await sha256FileHex(trainPath),
        valid: await sha256FileHex(validPath),
        test: await sha256FileHex(testPath),
      },
    },
    outputs: {
      // Trainer should write a model directory here.
      model_dir: path.join(outDir, 'model'),
      logs_dir: path.join(outDir, 'logs'),
    },
  };

  await writeJson(path.join(outDir, 'train_config.json'), config);
  console.log(`Wrote training config to ${path.join(outDir, 'train_config.json')}`);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(3);
});
