# Issue 285 Task List

## Phase 0: Design Freeze and Guardrails
- [x] Review `docs/issue-285-implementation-plan.md` and lock v1 design decisions:
  - [x] Option A cutover model strategy (single active model)
  - [x] GitHub Release assets as artifact source
  - [x] Definitions-style update manifest (`stable` default)
  - [x] Activation preflight requirements (health + dims + latency)
  - [x] Provider scope lock:
    - [x] local-first fine-tuned serving via extended existing embedding service
    - [x] Ollama retained as baseline/fallback
- [ ] Confirm benchmark gates for rollout:
  - [ ] Train eligibility gate:
    - [ ] `>= 12,000` labeled samples
    - [ ] `18-month` time window
    - [ ] `>= 8` libraries with `>= 150` samples each
    - [ ] no library > `40%` after balancing
    - [ ] `>= 2,000` hard negatives
  - [ ] Rollout benchmark gate:
    - [ ] holdout `>= 2,500`
    - [ ] major-library floor `>= 75` each
    - [ ] Recall@10 uplift `>= 5%`
    - [ ] top-1 regression per major library `<= 2%`
    - [ ] p95 latency regression `<= 25%`
- [ ] Confirm integrity policy for v1:
  - [x] checksum (`sha256`) verification required
  - [x] signature verification required (detached signature)
  - [x] trusted public key distribution + rotation approach defined
- [ ] Lock v1 defaults (best-practice):
  - [x] `embedding_update_channel='stable'`
  - [x] `embedding_update_mode='notify'`
  - [x] `embedding_update_check_interval_hours=12`
  - [x] token-based service auth required for fine-tuned runtime endpoints
  - [x] auto-rollback on post-apply health regression enabled
- [x] Add CI enforcement for dependency security (best-practice):
  - [x] Dependabot for npm (`/`, `/server`, `/client`) and GitHub Actions
  - [x] OSV scan on pull requests (fail on newly introduced findings)
  - [x] OSV scan on tag releases (fail on any findings)
  - [x] `npm audit --omit=dev` gates for `server/` and `client/`
- [x] Define required environment variables and add placeholders to `.env.example`
- [ ] Hardening (observed in production logs):
  - [x] Treat `ECONNRESET` / "socket hang up" as transient for OMDb and retry once before falling back
  - [x] Ensure error logs persist the real upstream stack trace (`logger.*(..., { error })`)

## Phase 1: Directive and Execution Pipeline (Offline)
- [ ] Add SOP: `directives/issue-285-retriever-finetuning.md`
- [ ] Create deterministic scripts under `execution/`:
  - [ ] `execution/export_issue_285_dataset.py`
  - [ ] `execution/build_issue_285_pairs.py`
  - [ ] `execution/train_issue_285_retriever.py`
  - [ ] `execution/eval_issue_285_retriever.py`
  - [ ] `execution/package_issue_285_model.py`
- [ ] Ensure scripts write outputs to `.tmp/issue-285/`
- [ ] Add script usage docs (inputs, outputs, required env)
- [ ] Validate reproducibility with fixed seeds and deterministic splits

## Phase 2: Data and Benchmark Assets
- [ ] Export anonymized dataset from `classification_history`
- [ ] Build contrastive train/valid/test datasets
- [ ] Produce baseline benchmark snapshot and metrics
- [ ] Train first fine-tuned candidate artifact
- [ ] Evaluate candidate vs baseline:
  - [ ] MRR
  - [ ] Recall@5/Recall@10
  - [ ] Top-1 library accuracy
  - [ ] macro metrics by library
- [ ] Enforce benchmark eligibility checks before candidate approval
- [ ] Package artifact + metadata + checksum for release asset upload
  - [ ] include detached signature artifact and algorithm metadata

## Phase 3: Schema and Config (Runtime)
- [ ] Add timestamped migration for fine-tuned config fields in `ai_provider_config`:
  - [ ] `embedding_finetuned_enabled`
  - [ ] `embedding_finetuned_model_id`
  - [ ] `embedding_finetuned_provider`
  - [ ] `embedding_finetuned_endpoint`
  - [ ] `embedding_finetuned_api_key`
  - [ ] `embedding_finetuned_expected_dims`
  - [ ] `embedding_finetuned_fallback_model`
  - [ ] `embedding_finetuned_last_validated_at`
  - [ ] `embedding_update_channel`
  - [ ] `embedding_update_mode`
  - [ ] `embedding_manifest_url`
  - [ ] `embedding_update_check_interval_hours`
  - [ ] `embedding_update_last_checked_at`
  - [ ] `embedding_update_last_applied_version`
  - [ ] `embedding_update_etag`
  - [ ] `embedding_update_max_download_mb`
  - [ ] `embedding_manifest_signing_key_id`
- [ ] Add timestamped migration for model registry tables:
  - [ ] `embedding_model_registry`
  - [ ] `embedding_eval_runs`
- [ ] Add indexes/constraints for registry lookups and active model enforcement
- [ ] Update `server/src/routes/settings.js` for new fields, defaults, and masking behavior
- [ ] Update `database/schema/current.sql`

## Phase 4: Backend Runtime Integration
- [ ] Add fine-tuned model resolution path in `server/src/services/embeddingRouter.js`
- [ ] Keep existing `same` / `separate_ollama` / `cloud` paths unchanged when fine-tuned mode is off
- [ ] Add preflight validation service (health, dims, latency smoke check)
- [ ] Add activation/disable flow:
  - [ ] enable fine-tuned mode
  - [ ] mark text embeddings stale
  - [ ] trigger controlled backfill
  - [ ] support one-click rollback
- [ ] Add definitions-style updater service:
  - [ ] manifest fetch with ETag
  - [ ] version compare by channel
  - [ ] secure download + checksum verification
  - [ ] signature verification using trusted key set
  - [ ] candidate apply/rollback state handling
- [ ] Integrate with extended local embedding runtime for text fine-tuned inference:
  - [ ] `POST /embed-text`
  - [ ] `GET /models/text`
  - [ ] `POST /models/text/load`
  - [ ] `GET /health/text`

## Phase 5: API Endpoints
- [ ] Add endpoints in `server/src/routes/rag.js` (or appropriate route module):
  - [ ] `POST /api/rag/fine-tuned/validate`
  - [ ] `POST /api/rag/fine-tuned/activate`
  - [ ] `POST /api/rag/fine-tuned/disable`
  - [ ] `POST /api/rag/fine-tuned/check-updates`
  - [ ] `POST /api/rag/fine-tuned/download`
  - [ ] `POST /api/rag/fine-tuned/apply`
  - [ ] `POST /api/rag/fine-tuned/rollback`
  - [ ] `GET /api/rag/fine-tuned/update-status`
- [ ] Add model registry endpoints:
  - [ ] `GET /api/rag/fine-tuned/models`
  - [ ] `POST /api/rag/fine-tuned/models`
  - [ ] `PUT /api/rag/fine-tuned/models/:id`
  - [ ] `POST /api/rag/fine-tuned/models/:id/set-active`
- [ ] Verify auth/permission model for admin-only actions
- [ ] Add robust error payloads for UI actionability

## Phase 6: UI Integration
- [ ] Update `client/src/views/rag/TextEmbeddingsTab.vue`:
  - [ ] fine-tuned toggle
  - [ ] model id / endpoint fields
  - [ ] validate/activate/disable actions
  - [ ] update mode/channel controls
- [ ] Update `client/src/views/rag/OverviewTab.vue`:
  - [ ] active model id
  - [ ] fallback-active indicator
  - [ ] update status visibility
- [ ] Update API clients under `client/src/api`
- [ ] Add UX protections:
  - [ ] block activate unless validation passed
  - [ ] explicit confirmation for model switch and re-embed

## Phase 7: Tests (New + Updated)
- [ ] Unit tests:
  - [ ] embedding router selection precedence
  - [ ] fallback behavior on fine-tuned provider failure
  - [ ] preflight validation (dims mismatch, endpoint failure, latency threshold)
  - [ ] updater logic (ETag, version compare, checksum verify)
  - [ ] updater signature verification and tamper-failure coverage
- [ ] Integration tests:
  - [ ] settings save/load for new fields
  - [ ] validate -> activate -> disable flow
  - [ ] update check/download/apply/rollback flow
  - [ ] mark stale and backfill trigger behavior
- [ ] Regression tests:
  - [ ] existing embedding modes unaffected
  - [ ] RAG-disabled behavior unchanged
  - [ ] image embedding paths unaffected
- [ ] Run full test suites and resolve failures

Suggested commands:
```bash
npm --prefix server test
npm --prefix client test
npm --prefix server run test:integration
```

## Phase 8: Canary Rollout and Validation
- [ ] Upload artifact and manifest to GitHub Release assets
- [ ] Configure canary channel and validate update fetch
- [ ] Activate fine-tuned model in canary scope
- [ ] Monitor:
  - [ ] retrieval quality deltas
  - [ ] fallback/error rate
  - [ ] p95 embedding latency
  - [ ] backfill progress
- [ ] Decide go/no-go for full rollout based on acceptance gates

## Phase X: External Service Coordination (classifarr-image-embedding-service)
- [ ] Add text embedding/fine-tuned endpoints to existing service (image endpoints unchanged)
- [ ] Add model asset loader from GitHub Release assets
- [ ] Add checksum verification and local cache management
- [ ] Add signature verification and signing-key configuration
- [ ] Add service tests for text endpoints and model loading
- [ ] Add release note entries in external service repo for this expansion

## Phase 9: Documentation and Release Readiness
- [ ] Update README/docs for fine-tuned retriever setup and updater behavior
- [ ] Add operational runbook for rollback/recovery
- [ ] Update `CHANGELOG.md` (technical)
- [ ] Update `RELEASE_NOTES.md` (high-level)
- [ ] Close issue #285 when acceptance criteria are verified

## Dependencies
1. Phase 1 depends on Phase 0 decisions.
2. Phase 2 depends on Phase 1 scripts.
3. Phase 3 depends on Phase 0 field decisions.
4. Phase 4 depends on Phase 3 migration + config availability.
5. Phase 5 depends on Phase 4 backend services.
6. Phase 6 depends on Phase 5 endpoint readiness.
7. Phase 7 depends on Phases 4-6 implementation completeness.
8. Phase 8 depends on Phases 2-7 and validated build.
9. Phase 9 depends on Phase 8 outcomes.
10. Phase X must be completed before finalizing Phase 4/8 in Classifarr main repo.

## Exit Criteria (Done Definition)
- [ ] Fine-tuned retriever can be validated, activated, and disabled safely.
- [ ] Definitions-style updater can check/download/apply/rollback model assets.
- [ ] Runtime fallback remains reliable under failure conditions.
- [ ] Backfill regenerates embeddings after model switch without data loss.
- [ ] Benchmarks and canary metrics meet acceptance gates.
- [ ] Tests and docs are updated; release notes/changelog complete.
