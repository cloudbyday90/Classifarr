# Issue 285 Retriever Fine-Tuning (SOP)

Purpose: Fine-tune and deploy a domain-adapted *text* embedding model for Classifarr RAG retrieval using anonymized classification history. This SOP defines a repeatable offline pipeline (export -> build pairs -> train -> eval -> package -> publish) and a safe rollout path (validate -> activate -> backfill -> monitor -> rollback).

Scope:
- This SOP covers the offline model pipeline and the artifact/update contract.
- Runtime wiring (settings, updater, activation) is handled by the main Issue 285 implementation plan.

## Preconditions
- You have a local Classifarr DB (or a production snapshot) with sufficient `classification_history`.
- You can connect using either `DATABASE_URL` or `POSTGRES_*` env vars.
- You have a working directory for artifacts under `.tmp/issue-285/` (never commit).

## Data Privacy + “Anonymized” Definition
The exported dataset must:
- Exclude user-identifying data (usernames, IPs, file paths, API keys).
- Preserve domain-relevant text fields that are not sensitive:
  - title, year, type, genres, keywords, studios, synopsis (public metadata).
- Normalize or omit any local-only values if present in metadata.

## Output Layout (All Scripts)
Scripts write to `.tmp/issue-285/` by default:
- `.tmp/issue-285/dataset/`
- `.tmp/issue-285/pairs/`
- `.tmp/issue-285/eval/`
- `.tmp/issue-285/artifacts/`

Every script should emit:
- A `meta.json` describing inputs, hashes, seed, counts, and runtime version.
- Machine-readable outputs (JSON/JSONL) with stable schemas.

## Reproducibility Check (Recommended)
Goal: verify deterministic splits and byte-for-byte reproducible packaging on this machine.

Command:
```powershell
node execution/verify_issue_285_reproducibility.mjs
```

## Step 1: Export Dataset
Goal: export labeled examples from `classification_history` with corrections applied.

Command:
```powershell
node execution/export_issue_285_dataset.mjs `
  --outDir .tmp/issue-285/dataset `
  --sinceDays 548 `
  --minConfidence 50 `
  --excludeMethod source_library `
  --batchSize 1000
```

Expected outputs:
- `.tmp/issue-285/dataset/dataset.jsonl`
- `.tmp/issue-285/dataset/meta.json`
- `.tmp/issue-285/dataset/libraries.json`

## Step 2: Build Contrastive Pairs
Goal: generate positive and negative training examples deterministically.

Command:
```powershell
node execution/build_issue_285_pairs.mjs `
  --dataset .tmp/issue-285/dataset/dataset.jsonl `
  --libraries .tmp/issue-285/dataset/libraries.json `
  --outDir .tmp/issue-285/pairs `
  --seed 285 `
  --negativesPerExample 4 `
  --hardNegativesPerExample 2
```

Expected outputs:
- `.tmp/issue-285/pairs/train.jsonl`
- `.tmp/issue-285/pairs/valid.jsonl`
- `.tmp/issue-285/pairs/test.jsonl`
- `.tmp/issue-285/pairs/meta.json`
- `.tmp/issue-285/pairs/library_profiles.json`

## Step 3: Train (Offline)
Goal: produce a fine-tuned embedding model artifact.

Notes:
- Training implementation is intentionally decoupled from Classifarr runtime.
- You may train in:
  - a separate “training” repo / container image
  - a local Python environment
- The output must be exportable for inference in `classifarr-image-embedding-service`.

Canonical path (recommended): use the dedicated trainer repo `cloudbyday90/classifarr-retriever-trainer` for train/eval/package.

Important: `classifarr-retriever-trainer` expects the same `.tmp/issue-285/*` inputs that you generated in Steps 1-2. You can either:
- copy `.tmp/issue-285/` into the trainer repo at `.tmp/issue-285/`, or
- pass explicit `--dataset/--profiles/--pairsDir/--outModelDir/...` paths to point at this repo's `.tmp/issue-285/` outputs.

All `python execution\\...` commands below are intended to run from the trainer repo root.
Note: the trainer's `--outModelDir` must be empty (or not exist) before training.

Trainer repo (recommended, one command):
```powershell
python execution\\run_issue_285_pipeline.py `
  --modelId classifarr-rag-embed-v1.0.0 `
  --version 1.0.0 `
  --dims auto `
  --gatesProfile rollout `
  --pairsDir <path-to-classifarr>\\.tmp\\issue-285\\pairs `
  --dataset <path-to-classifarr>\\.tmp\\issue-285\\dataset\\dataset.jsonl `
  --profiles <path-to-classifarr>\\.tmp\\issue-285\\pairs\\library_profiles.json `
  --outModelDir <path-to-classifarr>\\.tmp\\issue-285\\artifacts\\model_candidate `
  --evalDir <path-to-classifarr>\\.tmp\\issue-285\\eval `
  --releaseDir <path-to-classifarr>\\.tmp\\issue-285\\artifacts\\release
```

Trainer repo (training only):
```powershell
python execution\\train_issue_285_retriever.py `
  --pairsDir <path-to-classifarr>\\.tmp\\issue-285\\pairs `
  --outModelDir <path-to-classifarr>\\.tmp\\issue-285\\artifacts\\model_candidate `
  --baseModel sentence-transformers/all-MiniLM-L6-v2 `
  --seed 285 `
  --epochs 1
```

Optional (legacy): planner-only config generation (this repo).
```powershell
node execution/train_issue_285_retriever.mjs `
  --pairsDir .tmp/issue-285/pairs `
  --outDir .tmp/issue-285/artifacts/training `
  --seed 285 `
  --baseModel sentence-transformers/all-MiniLM-L6-v2
```

Expected outputs:
- `.tmp/issue-285/artifacts/training/train_config.json`

## Step 4: Offline Evaluation
Goal: compare baseline vs candidate with retrieval metrics.

Canonical path (recommended): use the trainer repo eval which is fully contained (no HTTP embedder required) and evaluates retrieval as `query -> library_profile.description` using `.tmp/issue-285/pairs/library_profiles.json`.

```powershell
python execution\\eval_issue_285_retriever_local.py `
  --dataset <path-to-classifarr>\\.tmp\\issue-285\\dataset\\dataset.jsonl `
  --profiles <path-to-classifarr>\\.tmp\\issue-285\\pairs\\library_profiles.json `
  --outDir <path-to-classifarr>\\.tmp\\issue-285\\eval `
  --seed 285 `
  --baselineModelId sentence-transformers/all-MiniLM-L6-v2 `
  --candidateModelDir <path-to-classifarr>\\.tmp\\issue-285\\artifacts\\model_candidate `
  --k 10 `
  --maxQueries 1000
```

Optional (legacy): HTTP-embedder-based eval (this repo). This requires a service that implements `POST /embed-text` and is useful for service-level latency checks.
```powershell
node execution/eval_issue_285_retriever.mjs `
  --dataset .tmp/issue-285/dataset/dataset.jsonl `
  --corpusSplit train `
  --querySplit test `
  --outDir .tmp/issue-285/eval `
  --seed 285 `
  --embedderUrl http://localhost:8002 `
  --k 10 `
  --maxQueries 1000 `
  --maxCorpus 5000
```

Expected outputs:
- `.tmp/issue-285/eval/metrics.json`
- `.tmp/issue-285/eval/meta.json`

## Step 5: Package + Sign Artifact
Goal: create a release-ready artifact with checksum and signature.

Canonical path (recommended): package from the trainer repo (deterministic).
```powershell
python execution\\package_issue_285_model.py `
  --modelDir <path-to-classifarr>\\.tmp\\issue-285\\artifacts\\model_candidate `
  --outDir <path-to-classifarr>\\.tmp\\issue-285\\artifacts\\release `
  --modelId classifarr-rag-embed-v1.0.0 `
  --version 1.0.0 `
  --dims <DIMS> `
  --privateKeyPath <path-to-classifarr>\\.tmp\\issue-285\\keys\\signing_ed25519.pem
```

Optional (legacy): Node packager (this repo).
```powershell
node execution/package_issue_285_model.mjs `
  --modelDir .tmp/issue-285/artifacts/model_candidate `
  --outDir .tmp/issue-285/artifacts/release `
  --modelId classifarr-rag-embed-v1.0.0 `
  --version 1.0.0 `
  --dims 1024 `
  --privateKeyPath .tmp/issue-285/keys/signing_ed25519.pem
```

Expected outputs:
- `.tmp/issue-285/artifacts/release/model.tar.gz`
- `.tmp/issue-285/artifacts/release/model.tar.gz.sha256`
- `.tmp/issue-285/artifacts/release/model.tar.gz.sig`
- `.tmp/issue-285/artifacts/release/model-meta.json`
- `.tmp/issue-285/artifacts/release/provenance.json` (trainer repo)

## Step 6: Publish (GitHub Release Assets)
Goal: attach the artifact + signature + checksum to a GitHub Release tag for the model repo.

Checklist:
- Upload:
  - `model.tar.gz`
  - `model.tar.gz.sha256`
  - `model.tar.gz.sig`
  - `model-meta.json`
  - `provenance.json` (if present)
- Update `models-manifest.json` for the `stable` channel with:
  - `asset_url`, `sha256`, `signature_url`, `key_id`, `dims`

## Rollout Gate (Operational)
Before activation in Classifarr:
- Preflight validate endpoint reachable.
- Dims match expected.
- Latency smoke test passes.
- Offline eval meets gates in `docs/issue-285-task-list.md` Phase 0.

Rollback:
- Must be one-click (or single API call).
- Must revert the active model id and mark embeddings stale only when re-embedding is intentionally requested.

## Troubleshooting
- Export yields too few labels:
  - ensure you are using corrected labels (corrections table)
  - increase `sinceDays` or lower `minConfidence`
- Pairs skewed to one library:
  - enable balancing (script enforces library cap threshold)
- Eval is too slow:
  - reduce `maxCorpus` and `maxQueries`
  - precompute embeddings and cache results (supported by eval script)

