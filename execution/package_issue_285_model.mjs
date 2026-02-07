/**
 * Description: Packages a trained model directory into a release artifact, computes sha256, and creates an ed25519 detached signature.
 * Usage:
 *   node execution/package_issue_285_model.mjs --modelDir .tmp/issue-285/artifacts/model --outDir .tmp/issue-285/artifacts/release --modelId classifarr-rag-embed-v1.0.0 --version 1.0.0 --dims 1024 --privateKeyPath .tmp/issue-285/keys/signing_ed25519.pem
 *
 * Notes:
 * - Produces a .tar.gz (portable, no external deps). The manifest can reference this asset.
 * - The signature file contains base64 signature bytes over the raw archive bytes.
 *
 * Exit codes:
 *   0 success
 *   2 invalid args / missing paths
 *   3 runtime failure
 */

import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';

import {
  deterministicTarGzDirectory,
  ensureDir,
  nowIsoUtc,
  parseArgs,
  sha256FileHex,
  writeJson,
  writeText,
} from './issue_285/lib.mjs';

async function fileExists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readPrivateKey(privateKeyPath) {
  const pem = await fsp.readFile(privateKeyPath, 'utf8');
  return crypto.createPrivateKey(pem);
}

async function signFileEd25519(privateKey, filePath) {
  const data = await fsp.readFile(filePath);
  const sig = crypto.sign(null, data, privateKey);
  return sig.toString('base64');
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    modelDir: { type: 'string', required: true },
    outDir: { type: 'string', default: '.tmp/issue-285/artifacts/release' },
    modelId: { type: 'string', required: true },
    version: { type: 'string', required: true },
    dims: { type: 'int', required: true },
    privateKeyPath: { type: 'string', required: false, default: '' },
    keyId: { type: 'string', default: 'classifarr-signing-local' },
  });

  const modelDir = path.resolve(args.modelDir);
  const outDir = path.resolve(args.outDir);
  await ensureDir(outDir);

  if (!(await fileExists(modelDir))) {
    console.error(`Missing modelDir: ${modelDir}`);
    process.exit(2);
  }

  const archivePath = path.join(outDir, 'model.tar.gz');
  const shaPath = `${archivePath}.sha256`;
  const sigPath = `${archivePath}.sig`;
  const metaPath = path.join(outDir, 'model-meta.json');

  await deterministicTarGzDirectory(modelDir, archivePath);
  const sha256 = await sha256FileHex(archivePath);
  await writeText(shaPath, `${sha256}  ${path.basename(archivePath)}\n`);

  let signature_b64 = null;
  let signature_alg = null;
  let key_id = null;

  if (args.privateKeyPath) {
    const keyPath = path.resolve(args.privateKeyPath);
    if (!(await fileExists(keyPath))) {
      console.error(`privateKeyPath provided but file missing: ${keyPath}`);
      process.exit(2);
    }
    const key = await readPrivateKey(keyPath);
    signature_b64 = await signFileEd25519(key, archivePath);
    signature_alg = 'ed25519';
    key_id = args.keyId;
    await writeText(sigPath, `${signature_b64}\n`);
  }

  const meta = {
    schema_version: 1,
    generated_at: nowIsoUtc(),
    host: os.hostname(),
    node: process.version,
    model_id: args.modelId,
    version: args.version,
    dims: args.dims,
    artifact: {
      filename: path.basename(archivePath),
      sha256,
      signature_alg,
      key_id,
      signature_b64,
    },
    paths: {
      model_dir: modelDir,
      archive: archivePath,
      sha256_file: shaPath,
      signature_file: signature_b64 ? sigPath : null,
    },
  };

  await writeJson(metaPath, meta);

  console.log(`Wrote artifact: ${archivePath}`);
  console.log(`Wrote checksum: ${shaPath}`);
  if (signature_b64) console.log(`Wrote signature: ${sigPath}`);
  console.log(`Wrote metadata: ${metaPath}`);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(3);
});
