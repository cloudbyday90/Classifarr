# Issue 285 Implementation Plan

Title: RAG Enhancement: Retriever Fine-Tuning for Improved Domain Accuracy
Owner: Classifarr team
Status: Open
Date: 2026-02-06
Issue: https://github.com/cloudbyday90/Classifarr/issues/285

## Summary
Fine-tune the text embedding retriever on Classifarr's domain-specific classification history so semantic search aligns with actual library routing behavior. The plan keeps the current provider architecture intact, adds deterministic data/training/evaluation scripts, and introduces a safe rollout path with fallback to baseline models.

## Requirements From Issue 285
1. Export a large, anonymized dataset from `classification_history`.
2. Build positive and negative examples for contrastive learning.
3. Fine-tune an embedding model compatible with pgvector retrieval.
4. Integrate the fine-tuned model into Classifarr with fallback to default embeddings.
5. Validate with retrieval metrics (MRR, Recall@k, accuracy) before and after.

## OPENAI.md Alignment (Project Guidelines)
- Follow 3-layer architecture:
  - Layer 1: add directive for repeatable fine-tune workflow.
  - Layer 2: orchestrate scripts and rollout gates.
  - Layer 3: use deterministic scripts in `execution/` for export, train, eval.
- Keep changes scoped to retriever/embedding surfaces.
- If API contracts change, update server + client (`client/src/api` and views).
- If schema changes are needed, add timestamped migration and update `database/schema/current.sql`.
- Use `.env.example` for new config keys only.

## Directive/Execution Checklist
- [ ] Add `directives/issue-285-retriever-finetuning.md` (SOP for export/train/eval/rollout).
- [ ] Add deterministic scripts in `execution/` for:
  - [ ] dataset export
  - [ ] pair/triplet construction
  - [ ] training
  - [ ] offline eval
  - [ ] model packaging/publish metadata
- [ ] Ensure scripts write intermediates to `.tmp/` and are fully reproducible.
- [ ] Document script inputs/outputs and required env vars.

## Current State (Code Map)
Text embedding generation and routing:
1. `server/src/services/embeddingService.js`
   - `generateAndStore()` formats metadata and calls `embeddingRouter.embed(text)`.
   - `storeEmbedding()` writes to `classification_embeddings.embedding`.
2. `server/src/services/embeddingRouter.js`
   - Reads config from `ai_provider_config` and routes by mode/provider.
   - Has circuit breaker and Ollama fallback behavior.
3. `server/src/services/embeddingProvider.js`
   - Supports `same`, `separate_ollama`, and `cloud` modes.
   - Cloud providers: OpenAI, Gemini, Voyage, OpenRouter, Cohere.
4. `server/src/services/ragRetriever.js`
   - Uses `embeddingRouter.embed(text)` and pgvector similarity search.
   - Already supports configurable threshold and weighted scoring (text + optional image).
5. `server/src/routes/settings.js`
   - Reads/writes embedding provider fields in `ai_provider_config`.
6. `database/schema/current.sql`
   - `ai_provider_config` contains text embedding provider/model fields.

## Design Principles For Issue 285
- Do not break current provider modes; fine-tuned model is an additional option.
- Keep runtime path simple:
  - model selection in settings
  - embedding generation with fallback
  - retrieval unchanged except using new vectors
- Treat training as an offline pipeline with strict validation gates.
- Prefer reversible rollout:
  - index new vectors side-by-side or mark stale and re-embed in controlled batches.

## Scope and Non-Goals
In scope:
- Fine-tune text retriever embeddings using Classifarr classification outcomes.
- Add model selection + fallback without breaking existing embedding modes.
- Add deterministic offline training/evaluation pipeline and rollout guardrails.

Out of scope for v1:
- End-to-end fine-tuning inside the main Classifarr container.
- Replacing pgvector or changing retriever algorithm family.
- Joint multimodal fine-tuning (text + image in one model).

## Architecture Options and Tradeoffs
### Option A: Single active embedding model (cutover + re-embed)
- Description:
  - Activate one model id.
  - Mark text embeddings stale.
  - Backfill regenerates embeddings with the selected model.
- Pros:
  - Simple runtime and schema.
  - Lowest maintenance burden.
- Cons:
  - No true online A/B at retrieval time.
  - Requires backfill to complete before full quality is realized.

### Option B: Dual index (baseline + fine-tuned side-by-side)
- Description:
  - Store two text vectors per item and evaluate both live.
- Pros:
  - True online A/B and immediate fallback quality comparison.
- Cons:
  - Higher schema/runtime complexity.
  - Higher storage and write costs.

### Recommendation for Issue 285
- Use Option A for v1.
- Add an offline benchmark + shadow-eval gate before activation.
- Revisit Option B only if quality uncertainty remains after first rollout.

## Decision Lock (v1)
- Artifact host: GitHub Release assets.
- Update strategy: definitions-style manifest with scheduled checks.
- Cost target: minimal recurring cost and no dedicated object storage dependency.
- Model registry: DB-backed registry enabled in v1.
- Benchmark gate policy: coverage-based thresholds (not raw-count-only).
- Provider scope: local-first fine-tuned serving via extended existing embedding service; Ollama remains baseline/fallback.
- Manifest integrity: checksum + signature verification required in v1.

## Security and Update Defaults (Locked)
Validated against current standards and vendor guidance on 2026-02-06.

- Signature format:
  - Detached `ed25519` signature for each model artifact.
  - Manifest includes `signature_url`, `signature_alg`, and signing `key_id`.
- Trusted keys:
  - Keep an allowlist of trusted public keys.
  - Support overlap window with `current` and `next` keys for rotation.
  - Refuse apply if `key_id` is unknown or revoked.
- Updater defaults:
  - `embedding_update_channel='stable'`
  - `embedding_update_mode='notify'`
  - `embedding_update_check_interval_hours=12`
- Apply safety gates:
  - Require pre-apply health check pass, dims match, latency smoke pass.
  - Auto-rollback to `previous` on post-apply health regression.
- Artifact safety:
  - Enforce max artifact size (`embedding_update_max_download_mb`).
  - Enforce monotonic version progression unless explicit rollback flow is used.
- Runtime auth:
  - Require token-based service authentication for fine-tuned runtime endpoints in v1.
  - Keep mTLS as optional hardening for later phase.

## Dependency and Supply Chain Policy (v1)
Goal: any new dependencies introduced for Issue 285 must be compatible with Node `>=24.11.0`, be actively maintained, and introduce zero known vulnerabilities at time of merge.

- Prefer platform primitives first:
  - Node core (`crypto`, `fs/promises`, `stream`, `zlib`, `fetch`) before new npm packages.
  - Reuse existing dependencies where possible (example: `axios` already exists).
- Dependency admission gate (required before merging any new package):
  - New runtime deps must have `npm audit --omit=dev` = `0 vulnerabilities` in `server/` and `client/`.
  - New deps must not introduce OSV findings (scan lockfiles).
  - Licenses must be compatible with Classifarr licensing standards.
- Ongoing hygiene:
  - Dependabot for npm + GitHub Actions version updates.
  - Security scanning in CI for pull requests and tag releases.
  - Keep `overrides` for transitive fixes as a temporary measure, not a substitute for updating.

## Model Update Mechanism (Definitions-Style)
### Purpose
Provide frequent, low-risk model updates similar to antivirus definition updates:
- lightweight metadata checks
- controlled download/verify
- atomic activation
- automatic rollback on failure

### Update Channels
- `stable` (default): production-safe updates.
- `beta`: optional testing channel.

### Manifest Contract
Host a small manifest in GitHub Release assets (or repo file) that points to model artifacts.

Example `models-manifest.json`:
```json
{
  "schema_version": 1,
  "generated_at": "2026-02-06T18:00:00Z",
  "channels": {
    "stable": {
      "model_id": "classifarr-rag-embed-v1.2.0",
      "version": "1.2.0",
      "dims": 768,
      "asset_url": "https://github.com/<org>/<repo>/releases/download/v1.2.0/model.tar.zst",
      "sha256": "hex_digest_here",
      "key_id": "classifarr-signing-2026q1",
      "signature_url": "https://github.com/<org>/<repo>/releases/download/v1.2.0/model.tar.zst.sig",
      "signature_alg": "ed25519",
      "min_classifarr_version": "0.41.2-alpha",
      "notes_url": "https://github.com/<org>/<repo>/releases/tag/v1.2.0"
    },
    "beta": {
      "model_id": "classifarr-rag-embed-v1.3.0-beta.1",
      "version": "1.3.0-beta.1",
      "dims": 768,
      "asset_url": "https://github.com/<org>/<repo>/releases/download/v1.3.0-beta.1/model.tar.zst",
      "sha256": "hex_digest_here",
      "key_id": "classifarr-signing-2026q2",
      "signature_url": "https://github.com/<org>/<repo>/releases/download/v1.3.0-beta.1/model.tar.zst.sig",
      "signature_alg": "ed25519",
      "min_classifarr_version": "0.41.2-alpha",
      "notes_url": "https://github.com/<org>/<repo>/releases/tag/v1.3.0-beta.1"
    }
  }
}
```

### Runtime State Model
- `current`: active model.
- `candidate`: downloaded and validated model pending activation.
- `previous`: last known good model for rollback.

Store under `data/models/`:
- `data/models/current/`
- `data/models/previous/`
- `data/models/cache/<model_id>/`

### Update Flow
1. Scheduler checks manifest every `N` hours (default `12h`).
2. Compare manifest `version` with current model.
3. If newer and policy allows:
   - download artifact to cache
   - verify `sha256`
   - verify detached signature against trusted public key set
   - run validation (`embed test`, dims check, latency smoke check)
4. If validation passes:
   - switch `candidate` -> `current` atomically
   - set old `current` as `previous`
   - mark text embeddings stale
   - start controlled backfill
5. If validation fails:
   - keep current model
   - record error and notify UI/logs

### Safety and Rollback
- Never switch active model before checksum + signature + validation pass.
- On runtime health degradation after activation:
  - auto-rollback to `previous`
  - disable candidate
  - continue serving with baseline/fallback path
- Keep at least last `2` model versions locally.

### Network Efficiency
- Use `ETag` and `If-None-Match` when fetching manifest.
- Do not re-download unchanged artifacts.
- Cap max model artifact size (configurable guardrail).

### Config Additions (v1)
Add to `ai_provider_config`:
- `embedding_update_channel VARCHAR(20) DEFAULT 'stable'`
- `embedding_update_mode VARCHAR(20) DEFAULT 'notify'` (`off|notify|auto`)
- `embedding_manifest_url TEXT`
- `embedding_update_check_interval_hours INTEGER DEFAULT 12`
- `embedding_update_last_checked_at TIMESTAMP`
- `embedding_update_last_applied_version VARCHAR(80)`
- `embedding_update_etag TEXT`
- `embedding_update_max_download_mb INTEGER DEFAULT 2048`
- `embedding_manifest_signing_key_id VARCHAR(120)`

### API Surface (v1)
- `POST /api/rag/fine-tuned/check-updates`
- `POST /api/rag/fine-tuned/download`
- `POST /api/rag/fine-tuned/apply`
- `POST /api/rag/fine-tuned/rollback`
- `GET /api/rag/fine-tuned/update-status`

### Backfill Coupling
When update is applied:
- text embeddings are marked stale.
- existing idle/scheduled/manual backfill handles regeneration.
- retrieval remains available via fallback during transition.

## Critical Design Constraint: Embedding Dimensions
Current behavior in `server/src/services/embeddingService.js` auto-heals text vector dimension mismatches by truncating `classification_embeddings` and recreating the vector column. This is operationally risky during model changes.

Required design rule for v1:
- Keep fine-tuned model dimension equal to current production dimension for the selected provider family.
- Block activation if dimensions do not match expected target.
- Add preflight validation in activation path:
  - compute sample embedding using selected model
  - compare dims with current `classification_embeddings.embedding` dimension
  - reject activation with actionable error if mismatch

Follow-up hardening after v1:
- Replace destructive auto-heal for text embeddings with explicit migration/maintenance flow.

## Recommended v1 Design (Concrete)
### High-level flow
1. Export anonymized training data from production history.
2. Train fine-tuned model offline and publish artifact metadata.
3. Run offline benchmark against frozen baseline snapshot.
4. Register model in Classifarr and keep disabled by default.
5. Enable model for embeddings with strict fallback enabled.
6. Trigger controlled text re-embed through existing backfill services.
7. Validate online metrics and keep rollback path one-click.

### Runtime selection precedence
1. `embedding_finetuned_enabled=true` and model healthy:
   - use local fine-tuned endpoint (extended existing embedding service).
2. Otherwise:
   - use existing `embedding_provider_mode` routing.
3. If provider failures:
   - existing fallback and circuit breaker rules apply.

### Health model
- Fine-tuned model considered healthy when:
  - connection test passes
  - sample embedding returns expected dims
  - p95 latency under configured threshold
- Unhealthy state auto-demotes to baseline provider path.

## Data Contract Design
### Export record contract (`jsonl`)
Each row should include:
- `sample_id` (hashed id)
- `text` (final embedding text built by same formatter used in runtime)
- `library_id`
- `library_name`
- `media_type`
- `label_source` (`manual_correction`, `confirmed`, `auto_high_confidence`)
- `event_ts`
- `split` (`train`, `valid`, `test`)

### Pair/triplet contract
- `anchor_text`
- `positive_text`
- `negative_text`
- `anchor_library_id`
- `hard_negative` (bool)

### SQL extraction baseline (reference)
```sql
SELECT
  ch.id,
  ch.title,
  ch.media_type,
  ch.library_id,
  ch.library_name,
  ch.method,
  ch.confidence,
  ch.metadata,
  ch.created_at
FROM classification_history ch
WHERE ch.library_id IS NOT NULL
  AND ch.created_at >= NOW() - INTERVAL '18 months'
ORDER BY ch.created_at ASC;
```

## Training Pipeline Design
### Script set (deterministic)
- `execution/export_issue_285_dataset.py`
- `execution/build_issue_285_pairs.py`
- `execution/train_issue_285_retriever.py`
- `execution/eval_issue_285_retriever.py`
- `execution/package_issue_285_model.py`

### Reproducibility controls
- fixed random seed in all scripts
- deterministic data split by timestamp + hash salt
- immutable dataset snapshot id
- explicit versions for torch/sentence-transformers/tokenizer

### Baseline training defaults
- objective: contrastive (MultipleNegativesRankingLoss)
- max sequence length: aligned with runtime embedding formatter output length
- early stopping on validation MRR
- checkpoint every N steps
- final export with model card + metrics JSON

## Config and Schema Design
### Minimal v1 config additions (`ai_provider_config`)
- `embedding_finetuned_enabled BOOLEAN DEFAULT false`
- `embedding_finetuned_model_id VARCHAR(150)`
- `embedding_finetuned_provider VARCHAR(50)` (local/cloud/custom endpoint)
- `embedding_finetuned_endpoint TEXT`
- `embedding_finetuned_api_key TEXT`
- `embedding_finetuned_expected_dims INTEGER`
- `embedding_finetuned_fallback_model VARCHAR(150)`
- `embedding_finetuned_last_validated_at TIMESTAMP`

Migration should be timestamped and idempotent with `IF NOT EXISTS`.

### Why DB fields in v1
- Keeps model activation state in existing settings flow.
- Avoids file-based drift across environments.
- Works with current settings API patterns.

## Target Architecture
### Training Pipeline (Offline)
1. Export labeled history from DB.
2. Build contrastive training pairs/triplets.
3. Fine-tune base model.
4. Evaluate against held-out benchmark.
5. Package model artifact + metadata.
6. Register artifact in Classifarr model registry (file or DB-backed).

### Runtime Pipeline (Online)
1. User selects fine-tuned model in RAG settings.
2. New embeddings generated with selected model.
3. Backfill re-embeds stale history in batches.
4. Retriever uses newly generated vectors.
5. Automatic fallback to baseline model/provider on failure.

## End-to-End Sequence (Activation)
1. Admin uploads/registers model metadata.
2. Admin clicks `Validate Model`.
3. Server runs:
   - endpoint/auth check
   - sample embed
   - dimensions match check
   - latency smoke check
4. If valid, admin enables fine-tuned mode.
5. Server marks text embeddings stale and starts controlled backfill.
6. RAG continues functioning with fallback during backfill.
7. Dashboard reports progress and quality deltas.

## Data Collection and Preprocessing Plan
### Source Tables
- `classification_history`
- `classification_embeddings`
- optional context joins:
  - `media_server_items` for richer metadata
  - `libraries` and policy mapping for target labels

### Export Criteria
- include only high-signal rows:
  - user-confirmed or corrected outcomes
  - non-null library assignment
  - remove obvious noise/failed classifications
- maintain temporal split to avoid leakage:
  - train on older windows, validate on recent window

### Anonymization Rules
- remove usernames, IPs, and secrets.
- keep semantic fields needed for embedding learning:
  - title, overview, genres, keywords, studio, year, media_type
- replace direct identifiers with salted hashes where needed.

### Training Example Construction
- Positive pairs:
  - same target library and similar metadata profile.
- Hard negatives:
  - different target library but overlapping genres/keywords.
- Class balancing:
  - cap dominant libraries; enforce minimum per class.

Example pair schema (`.tmp/issue-285/train_pairs.jsonl`):
```json
{"anchor":"Title: ... | Genres: ...","positive":"Title: ...","negative":"Title: ...","library_id":4}
```

## Model Strategy
### Phase 1 (Recommended)
- Base model: `nomic-embed-text`-class or `bge`-class sentence embedding model.
- Framework: Sentence Transformers contrastive training.
- Loss: MultipleNegativesRankingLoss (and optional hard-negative mining pass).

### Phase 2 (Optional)
- Distill to smaller model for faster inference.
- Quantized variant for low-resource local deployments.

### Artifact Contract
Each trained artifact must include:
- model id and semantic version
- embedding dimensions
- tokenizer/version
- training dataset snapshot id
- training/eval metrics
- compatibility notes (provider mode and endpoint)

## Integration Plan (Server)
### Provider Scope (Locked for v1)
- Extend existing `classifarr-image-embedding-service` into a unified local embedding runtime:
  - keep existing image embedding endpoints unchanged
  - add text fine-tuned endpoints and model management endpoints
- Classifarr consumes this runtime via custom local endpoint configuration.
- Existing Ollama route remains baseline and fallback path.

### Settings/Config
Add model registration fields (either DB table or JSON config):
- `embedding_finetuned_enabled` (bool)
- `embedding_finetuned_model_id` (string)
- `embedding_finetuned_endpoint` (string, optional)
- `embedding_finetuned_fallback_model` (string)

Required endpoints:
- `GET /api/settings/ai` include fine-tuned fields.
- `PUT /api/settings/ai` update and validate payload.
- `POST /api/rag/fine-tuned/validate` run active validation checks.
- `POST /api/rag/fine-tuned/activate` enable + mark stale + trigger backfill.
- `POST /api/rag/fine-tuned/disable` rollback to baseline immediately.

### Router Changes
File: `server/src/services/embeddingRouter.js`
- Add model resolution precedence:
  1. fine-tuned model if enabled and healthy
  2. configured baseline model
  3. Ollama fallback (existing)
- Keep current circuit breaker semantics.

Pseudo-code:
```js
if (config.embedding_finetuned_enabled) {
  try {
    return await finetunedProvider.embed(text, config.embedding_finetuned_model_id);
  } catch (e) {
    logger.warn('Finetuned embedding failed, using fallback', { error: e.message });
  }
}
return await existingEmbeddingPath(text);
```

Implementation note:
- Keep this logic additive. Existing mode routing (`same`, `separate_ollama`, `cloud`) remains unchanged when fine-tuned mode is disabled.

### External Local Runtime Contract (Extended Existing Service)
Required text endpoints to add in local runtime:
- `POST /embed-text`
- `GET /models/text`
- `POST /models/text/load`
- `GET /health/text`

Optional management endpoints:
- `POST /models/text/check-updates`
- `POST /models/text/download`
- `POST /models/text/apply`
- `POST /models/text/rollback`

### Backfill/Re-embed
- mark existing text embeddings stale when model changes.
- reuse existing backfill services:
  - `manualBackfillService`
  - `idleBackfillService`
  - `scheduledBackfillService`
- enforce budget/rate limits during re-embed.

Backfill policy defaults for cutover:
- idle backfill enabled
- scheduled backfill enabled during low-traffic window
- manual backfill available for immediate catch-up
- pause/resume controls continue to work without special handling

## Integration Plan (Client)
Files likely touched:
- `client/src/views/rag/TextEmbeddingsTab.vue`
- `client/src/views/rag/OverviewTab.vue`
- relevant API wrappers in `client/src/api`

UI additions:
- Fine-tuned model toggle.
- Model selector (baseline vs fine-tuned registry).
- Health/status chip for active retriever model.
- Warning banner when model changed and backfill pending.

Additional UX requirements:
- `Validate` button must run preflight and show actionable failures.
- `Activate` action must require successful validation result.
- Show active model id in text embedding status strip and overview tab.
- Show `fallback active` indicator when runtime falls back due to health failures.

## Optional Schema Changes
If keeping model metadata in DB, add table:
- `embedding_model_registry`
- `embedding_eval_runs`

Suggested migration (timestamped):
```sql
CREATE TABLE IF NOT EXISTS embedding_model_registry (
  id SERIAL PRIMARY KEY,
  model_id VARCHAR(150) UNIQUE NOT NULL,
  model_family VARCHAR(80) NOT NULL,
  embedding_dims INTEGER NOT NULL,
  artifact_uri TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS embedding_eval_runs (
  id SERIAL PRIMARY KEY,
  model_id VARCHAR(150) NOT NULL,
  split_name VARCHAR(50) NOT NULL,
  mrr NUMERIC(8,5),
  recall_at_5 NUMERIC(8,5),
  recall_at_10 NUMERIC(8,5),
  accuracy NUMERIC(8,5),
  created_at TIMESTAMP DEFAULT NOW()
);
```

Decision for v1:
- Implement `ai_provider_config` fine-tuned fields.
- Implement `embedding_model_registry` and `embedding_eval_runs` in v1 for auditable model/version tracking.
- Use registry rows as source of truth for selectable models in UI.

## Evaluation Plan
### Offline Metrics
- MRR
- Recall@5
- Recall@10
- Top-1 library accuracy
- library-level macro average (to avoid dominance bias)

### Online/Shadow Validation
- shadow evaluate N requests before enabling by default.
- compare baseline vs fine-tuned predictions and confidence deltas.
- gate activation on minimum uplift threshold.

### Suggested Acceptance Gates
- Recall@10 uplift >= 5% over baseline.
- No >2% regression in top-1 accuracy for any major library segment.
- P95 embedding latency within configured SLO.
- Zero critical fallback defects in canary window.

### Benchmark Protocol
- Freeze baseline model + dataset snapshot.
- Run same candidate set through baseline and fine-tuned models.
- Record:
  - global metrics
  - per-library macro metrics
  - edge-case buckets (franchise collisions, genre-overlap collisions).
- Persist results to artifact metadata and release notes draft.

### Benchmark Eligibility and Rollout Thresholds (Locked)
Train eligibility gate:
- Minimum total labeled samples: `12,000`
- Time window: most recent `18 months`
- Active library coverage: at least `8` libraries with `>= 150` samples each
- Class balance cap: no single library exceeds `40%` after balancing
- Hard negatives: at least `2,000`

Rollout benchmark gate:
- Frozen holdout size: `>= 2,500`
- Holdout floor for each major library: `>= 75`
- Must pass all:
  - Recall@10 uplift `>= 5%`
  - Top-1 regression per major library `<= 2%`
  - p95 embedding latency regression `<= 25%`

## Test Plan
### Unit Tests
- router priority and fallback logic for fine-tuned mode.
- config parsing/defaulting.
- model health check handling.
- activation preflight dimensions check.
- fallback demotion path on provider failure.

### Integration Tests
- settings save/load for fine-tuned model fields.
- embedding generation persists with expected model metadata.
- backfill marks stale and re-embeds with new model.
- `validate -> activate -> disable` endpoint workflow.
- settings roundtrip for all new fine-tuned fields.

### Regression Tests
- existing `same`/`separate_ollama`/`cloud` modes unchanged.
- circuit breaker behavior still correct.
- RAG disabled path unchanged.
- no behavior drift for existing text/image embedding settings.

## Rollout Plan
1. Add scripts + directive + docs.
2. Export and prepare dataset snapshot.
3. Train baseline fine-tuned candidate.
4. Run offline benchmark and record results.
5. Integrate runtime model selection with fallback.
6. Run shadow evaluation.
7. Enable for limited rollout.
8. Trigger controlled backfill.
9. Validate production metrics and finalize.

## Phase Breakdown (Execution Order)
### Phase 0: Design freeze
- finalize model dimension target
- finalize provider/hosting pattern
- finalize benchmark gate thresholds

### Phase 1: Offline pipeline
- build export/pair/train/eval/package scripts
- produce first candidate artifact + metrics

### Phase 2: Runtime integration
- add config fields + API + router fallback logic
- add UI controls (validate/activate/disable)

### Phase 3: Controlled rollout
- enable canary
- monitor fallback, latency, retrieval metrics
- full activation or rollback

## Operational Considerations
- Cost control:
  - offline training compute budget and schedule
  - embedding backfill batch caps
- Safety:
  - hard fallback path always enabled
  - one-click revert to baseline model
- Observability:
  - active model id in health endpoints
  - embedding error rates by model
  - backfill progress by model id

## Documentation Updates Required
- `docs/issue-285-implementation-plan.md` (this file)
- `docs/issue-285-task-list.md` (phase/task tracking)
- RAG settings docs in README and/or `docs/`
- release notes/changelog entries once implementation lands

## Risks and Mitigations
1. Overfitting to historical routing patterns
   - Mitigation: temporal holdout and hard-negative validation.
2. Library imbalance skews model behavior
   - Mitigation: stratified sampling and macro metrics.
3. Runtime latency regression
   - Mitigation: benchmark and distill/quantize if needed.
4. Migration/backfill load spike
   - Mitigation: phased backfill with caps and schedule windows.
5. Fallback not triggering correctly
   - Mitigation: explicit failure-mode tests and canary rollout.

## Acceptance Criteria
1. Fine-tuned model can be selected and persisted in settings.
2. Embedding generation uses fine-tuned model when enabled.
3. Automatic fallback to baseline works on model/provider failure.
4. Backfill supports re-embedding to new model without data loss.
5. Measured retrieval uplift is documented with before/after metrics.
6. Tests cover new config, routing, fallback, and backfill behavior.

## Open Questions
None. All current design questions are resolved.

## References
- Issue 285: https://github.com/cloudbyday90/Classifarr/issues/285
- RAG practices paper: https://arxiv.org/abs/2501.07391
- Sentence Transformers training docs: https://www.sbert.net/docs/training/overview.html
- Pyserini/OpenNIR ecosystem: https://github.com/castorini/pyserini
- SLSA v1.1 requirements: https://slsa.dev/spec/v1.1/requirements
- TUF specification (latest): https://theupdateframework.github.io/specification/latest/
- Sigstore Cosign verify guidance: https://docs.sigstore.dev/cosign/verifying/verify/
- GitHub artifact attestations (concepts): https://docs.github.com/en/enterprise-cloud%40latest/actions/concepts/security/artifact-attestations
- GitHub offline attestation verification: https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/verifying-attestations-offline
- OAuth 2.0 Security BCP (RFC 9700): https://www.rfc-editor.org/info/rfc9700
- OAuth mTLS (RFC 8705): https://www.rfc-editor.org/info/rfc8705
- OWASP API Security Top 10 (2023): https://owasp.org/API-Security/editions/2023/en/0x11-t10/
