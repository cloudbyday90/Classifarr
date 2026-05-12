# Issue RAG/AI Resilience Implementation Plan

Title: Classifier Reliability Hardening: AI Output Contract, RAG Retrieval Resilience, and Command Center Phase Truthfulness

Owner: Classifarr team  
Status: Planned  
Date: 2026-02-18  
Release target: `next patch/minor after v0.42.0-alpha`  
Task list: `docs/issue-rag-ai-resilience-task-list.md`  
Best-practices log: `docs/issue-rag-ai-resilience-best-practices.md`

## Summary
This effort fixes a real production incident pattern: classification still completed, but only after degraded stage behavior (`rag_pass1_candidate_failed`, `rag_pass2_failed`, malformed AI parser event, and duplicated warning persistence).  
The plan hardens reliability while preserving graceful fallback behavior.

Primary outcomes:
1. Reduce malformed AI response fallout.
2. Make second-pass retrieval failures diagnosable and actionable.
3. Eliminate duplicate warning DB writes for one stage event.
4. Align Command Center phase visualization with actual backend phase execution (`signal_combine` skip semantics).
5. Reconcile `rag_metrics` with stage-event logging.

## Best-Practice and Evidence Gate (Required Before Coding)
Before implementation starts, confirm these are captured and locked:
1. Runtime evidence from production-like environment (done for this incident).
2. Existing architecture constraints from `OPENAI.md`.
3. Existing patterns in current code for parser, retrieval, logging, and progress-phase rendering.
4. Safe rollout controls (flags, rollback path, and measurable gates).
5. Verification commands for each risk domain (parser, retrieval, logging, phase UI, metrics).
6. Mandatory post-research re-baseline pass to update downstream phases/tasks based on findings.

Gate status:
- Runtime evidence captured and validated.
- Plan and task list drafted and linked.
- Phase 0 research and source-linkage complete (2026-02-18).
- Phase 0.5 re-baseline and plan/task synchronization complete (2026-02-18).
- Ready to execute Phase 1 implementation.

## Requirements From Incident Diagnostics
1. Classify-mode malformed AI output must have deterministic recovery before fallback.
2. RAG second-pass retrieval failures must emit cause-specific reason codes (not only generic codes).
3. Stage warnings must persist once per event/fingerprint in DB.
4. Command Center must not show misleading pending `signal_combine` when backend path bypasses it.
5. `rag_metrics` must reflect retrieval-stage failures/skips in parity with stage-event logs.

## Related Runtime Evidence (Validated)
Environment: Unraid + embedded Postgres in `Classifarr` container.

Correlation details:
- `correlation_id`: `41293366-9a30-4095-9424-a5054a8b2f80`
- `classification_id`: `6606`

Observed stage sequence:
1. `WARN gate error (rag_pass1_candidate_failed)`
2. `INFO gate run (policy_prompt_select)`
3. `INFO gate strategy_selected (auto_default)`
4. `INFO enrichment skipped (metadata_complete)`
5. `WARN retrieval_pass2 error (rag_pass2_failed)`
6. `WARN policy_recheck evaluated (policy_not_upgraded)`
7. `INFO ai_rerun applied (material_improvement)`

Final classification outcome:
- `status=completed`
- `method=ai_rerun`
- `confidence=85.00`
- `library_name=Family`

Additional confirmed signals:
- `AIResponseParser` warning: `AI response malformed, no format matched` with free-form prose snippet.
- Duplicate warning persistence: `module=RAG` and `module=RAGLogger` for same warning-stage events.
- `sql_state=NULL` and `recoverable=true` on incident stage warnings.
- `rag_metrics` (24h) showed `hybrid_search success` only while stage events recorded retrieval errors.

Vector/storage baseline:
- PostgreSQL `17.7`
- `pgvector 0.8.0`
- Embedding dims consistent: `1024` only (`6579` rows)
- Indexes:
  - Present: `idx_embeddings_image_hnsw`
  - Missing: `idx_embeddings_hnsw` (text embedding HNSW)

Live config snapshot (`ai_provider_config.id=1`):
- `rag_retrieval_loop_enabled=true`
- `rag_retry_strategy=auto`
- `rag_retry_low_signal_similarity_floor=0.55`
- `policy_recheck_below_prompt_threshold_enabled=true`
- `policy_recheck_metadata_timeout_ms=2000`
- `rag_loop_global_bypass_ms=600000`
- `rag_loop_rollout_mode=apply`

## Evidence Appendix (Concrete Examples)
Example A: malformed parser event
```text
[WARN] [AIResponseParser] AI response malformed, no format matched
response: "The media item is an animated family comedy with science fiction elements..."
```

Example B: duplicate warning persistence
```text
module=RAG       message=Second-pass stage retrieval_pass2 error (rag_pass2_failed)
module=RAGLogger message=Second-pass stage retrieval_pass2 error (rag_pass2_failed)
```

Example C: successful degraded completion
```text
classification_history.id=6606
status=completed
method=ai_rerun
confidence=85.00
library=Family
```

## Current State (Main Branch)
- Policy-signal path can skip `signal_combine` and move directly to `ai_analysis`.
- Command Center stepper renders fixed phase order including `signal_combine`.
- Parser classify mode accepts contract formats only and falls back on prose.
- Retrieval failures in second pass are logged but reason coding is too generic.
- Stage-event persistence path can duplicate warning rows.
- Metrics do not fully represent stage-level retrieval failures.

## Non-Goals (This Scope)
- No full classification or RAG architecture rewrite.
- No broad UI redesign outside phase status truthfulness.
- No unrelated dependency modernization sweep.
- No removal of fallback mechanisms unless equivalent resilience is introduced.

## Root Cause Analysis (Evidence-Based)
### RC-1: AI malformed output (primary)
Cause:
- Prompt contract mismatch in classify path plus weak output enforcement.

Evidence:
- Parser classify mode expects `CONFIDENT|...` or `CLARIFY|...`.
- Final prompt guidance contained `CONFIRM` recommendation while classify path was used.
- Captured output was prose.

### RC-2: Retrieval diagnostics lossy
Cause:
- Failure classification collapses into generic reason codes.

Evidence:
- `rag_pass1_candidate_failed` and `rag_pass2_failed` without granular cause tokens.
- `sql_state=NULL`; no structured exception subtype persisted for pass2 in incident row set.

### RC-3: Observability imbalance
Cause:
- Stage logging path and logger path both write warning rows.
- Metrics pipeline not fully aligned with stage failure events.

Evidence:
- Duplicate module rows (`RAG` + `RAGLogger`).
- `rag_metrics` success-only window despite retrieval error stage events.

### RC-4: Retrieval performance risk
Cause:
- Missing text HNSW index.

Evidence:
- `idx_embeddings_hnsw` not present.
- Not proven direct cause of malformed parser event, but likely contributor to future retrieval latency/failure risk.

## Potential Fix Matrix (Finding -> Fix -> Validation)
1. Finding: malformed AI prose in classify mode.
   - Fix: mode-aware final prompt guidance and one-shot repair pass before fallback.
   - Validation: malformed parser trend decreases; repaired parse success rises.
2. Finding: generic pass1/pass2 reason codes.
   - Fix: reason-code expansion with timeout/provider/db/embed/abort mapping and retries.
   - Validation: generic-code share drops; specific-code share rises.
3. Finding: duplicate warning persistence.
   - Fix: canonical stage write path only; suppress second DB write on logger emission.
   - Validation: one row per event fingerprint/correlation.
4. Finding: metrics/log mismatch.
   - Fix: parity instrumentation for retrieval failures and skipped outcomes.
   - Validation: stage-event and `rag_metrics` parity query passes.
5. Finding: missing text HNSW index.
   - Fix: idempotent migration for `idx_embeddings_hnsw` when supported.
   - Validation: index present and retrieval performance/plan checks improve.

## Phase 0 Source Linkage (Best-Practice IDs)
Research log: `docs/issue-rag-ai-resilience-best-practices.md`

Decision-to-source mapping:
1. Parser contract hardening and strict structured output validation:
   - BP-001, BP-003, BP-005, BP-006
2. Stream completion-only parse gating and timeout/abort transient routing:
   - BP-002, BP-004, BP-007, BP-008
3. Retrieval reason specificity and retry behavior:
   - BP-007, BP-008, BP-009
4. Missing text HNSW remediation and rollout-safe index creation:
   - BP-009, BP-010, BP-011
5. Stage-event dedupe and metrics parity contract:
   - BP-012, BP-013
6. Command Center skipped-state truthfulness:
   - BP-014

## Related Scope and Work Packages
- `WP-1`: AI contract hardening and stream guard.
- `WP-2`: Retrieval resilience and reason taxonomy.
- `WP-3`: Stage logging dedupe and metrics parity.
- `WP-4`: Phase truthfulness (`signal_combine` skipped semantics).
- `WP-5`: Rollout validation and doc closure.

## Implementation Strategy
Staged hardening with measurable gates:
1. Complete Phase 0 research and evidence lock.
2. Execute Phase 0.5 re-baseline and synchronize plan/task phases.
3. Correct AI output contract path.
4. Harden retrieval behavior and cause mapping.
5. Lock observability/reason contracts and enforce metrics parity.
6. Align UI phase semantics.
7. Validate parity and publish release documentation.

## Execution Readiness and Governance (Locked)
Definition of Ready:
- Plan + task list approved together.
- Runtime baseline evidence captured (done).
- Validation query pack prepared (done).
- Rollout and rollback controls defined.

Critical path:
1. Phase 0 research and evidence gate.
2. Phase 0.5 re-baseline and plan/task synchronization.
3. AI contract + stream guard.
4. Retrieval resilience.
5. Logging de-duplication and metrics parity.
6. Command Center phase truthfulness.
7. Validation and release notes.

Parallelization policy:
- WP-3 observability query/dashboard prep can begin during WP-2 once reason-code contracts stabilize.
- WP-4 (phase truthfulness) can begin after WP-1 contracts stabilize.
- Docs and runbook work can begin after WP-3 data contracts stabilize.

Scope change control:
- Any change to reason codes, phase-status contract, or parser behavior requires synchronized updates to:
  - this plan
  - task list
  - tests
  - release notes/changelog

## OPENAI.md Alignment (Execution Constraints)
This plan explicitly follows `OPENAI.md`.

3-layer architecture mapping:
- Layer 1 (Directive): this plan and task list define goals, constraints, and gates.
- Layer 2 (Orchestration): phase sequencing, risk gating, rollback decisions, and diagnostics interpretation.
- Layer 3 (Execution): deterministic services/tests/migrations/queries implement and validate behavior.

Tools-first policy:
- Use existing repository services/tests/scripts first.
- Check `execution/` then `scripts/` then `server/src/scripts/` before adding new automation.

Self-annealing policy:
- For each observed failure class:
  1. Identify root cause with evidence.
  2. Implement narrow fix.
  3. Re-test and verify Operational Visibility.
  4. Update plan/task docs with learnings.

Contract and schema discipline:
- API/contract updates must be reflected in both server and client where applicable.
- DB updates must be migration-first under `database/migrations/`.

Documentation obligations:
- Keep plan and task list synchronized during execution.
- Record behavior-impacting changes in release docs.

## Phase Plan

## Phase 0 - Evidence Freeze and Baseline Gates
Deliverables:
- Incident evidence set and baseline metrics frozen.
- Validation SQL/log command pack documented.
- Owner/date and release window approved.

Acceptance criteria:
- Reproducibility of evidence confirmed.
- No unresolved ambiguity in incident narrative.

Verification checklist:
- [x] Evidence appendix reviewed and signed off.
- [x] Baseline query outputs archived.
- [x] Rollback path validated at config level.

## Phase 0.5 - Re-baseline and Plan/Task Synchronization (Required)
Deliverables:
- Finding-to-impact matrix from Phase 0 research.
- Updated phase sequencing/scope in plan + task list where findings changed assumptions.
- Explicit log of adopted vs rejected recommendations with rationale.

Acceptance criteria:
- Every high-impact Phase 0 finding is reflected in downstream phases (or explicitly rejected with rationale).
- Plan and task list remain synchronized after edits.
- No Phase 1+ implementation starts before this gate is complete.

Verification checklist:
- [x] Diff review confirms updates in both:
  - `docs/implementation_plan_rag_ai_resilience_and_command_center_consistency.md`
  - `docs/issue-rag-ai-resilience-task-list.md`
- [x] Each changed downstream phase includes evidence linkage to Phase 0 research log.
- [x] Owner acknowledgement captured for any sequence/scope change.

Phase 0.5 delta summary (2026-02-18):
- Reordered and synchronized phase sequencing with task list (`Phase 1` = AI contract/stream guard).
- Added measurable Phase 1 acceptance gates and rollback triggers.
- Added provider- and database-source linkage for parser, retrieval, observability, and stepper semantics.
- Locked Phase 0.5 dependency gate before any Phase 1+ implementation.

## Phase 1 - AI Output Contract and Streaming Guard
Scope:
- Mode-aware prompt guidance.
- One-shot parser repair path.
- Classification stream partial-response guard.
- Parser diagnostics contract versioning (`contract_version`).
- Phase 1 rollout defaults and gated promotion rules.

Primary files:
- `server/src/services/classification.mjs`
- `server/src/services/aiResponseParser.mjs`
- `server/src/services/ollama.mjs`
- `server/src/utils/operationController.mjs`

Acceptance criteria:
- Malformed parser warning rate reduced by at least 50% versus baseline.
- Repaired parse success at least 80% when strict parse initially fails in classify mode.
- Classify mode does not request `CONFIRM`.
- Timeout/abort path classified consistently.
- No regressions in verify-mode parse behavior.
- Staging acceptance window uses at least 200 classify runs or 24 hours of traffic (whichever comes first).

Verification checklist:
- [ ] Parser unit tests expanded (strict + repair + fallback).
- [ ] Integration tests for malformed -> repaired parse.
- [ ] Integration test replays incident malformed sample text from 2026-02-18 and verifies repaired parse.
- [ ] Integration tests for timeout/abort routing.

Rollout defaults (Phase 1):
- Staging: `ai_response_repair_enabled=true`, `classification_disallow_partial_stream_response=true`.
- Production: both flags start `false`; promote only after Phase 1 acceptance criteria pass.

Rollback triggers (Phase 1):
- Disable both Phase 1 flags if malformed parser warning rate increases by more than 20% versus baseline for a sustained 30-minute window.
- Disable both Phase 1 flags if classify parse fallback rate exceeds 5% for a sustained 30-minute window after enablement.
- Disable both Phase 1 flags if p95 decision latency increases by more than 15% after enablement.

## Phase 2 - Retrieval Resilience (Pass1 + Pass2)
Scope:
- Bounded retries for pass1 and pass2 retrieval.
- Cause-specific reason codes.
- Optional text HNSW index migration.

Primary files:
- `server/src/services/classification.mjs`
- `server/src/services/ragRetriever.mjs`
- `server/src/utils/ragErrorHandler.mjs`
- `database/migrations/*` (if index migration added)

Target reason codes:
- Pass1: timeout/provider/db/embed/aborted
- Pass2: timeout/provider/db/embed/aborted

Acceptance criteria:
- Generic reason codes become minority in retrieval failures.
- Retrieval remains stable and recoverable under transient failures.

Verification checklist:
- [ ] Fault-injection tests cover timeout/provider/db/embed/abort.
- [ ] New reason codes appear in stage events.
- [ ] Index migration is idempotent and safe.

## Phase 3 - Logging De-duplication and Metrics Parity
Scope:
- Canonical stage-event DB write path.
- Duplicate warning write elimination.
- `rag_metrics` parity with stage failures/skips.
- Validation/reporting query set finalized.

Primary files:
- `server/src/utils/ragLogger.mjs`
- `server/src/utils/logger.mjs`
- `server/src/utils/ragErrorHandler.mjs`
- `server/src/services/classification.mjs`
- `server/src/services/ragLoopMetricsCollector.mjs`
- `server/src/services/ragRetriever.mjs`

Acceptance criteria:
- One warning DB row per stage event.
- Logger still emits console/file lines.
- No regressions in current stage logging flow.
- Metrics and stage-event logs materially reconcile for retrieval outcomes.

Verification checklist:
- [ ] Duplicate-row query passes for test incident.
- [ ] Unit tests for severity and dedupe behavior pass.
- [ ] Parity query passes on new incident samples.

## Phase 4 - Command Center Phase Truthfulness
Scope:
- Support `skipped` phase status.
- Mark `signal_combine` as skipped when policy path bypasses combine.
- Render skipped state in stepper.

Primary files:
- `server/src/services/classificationPhaseService.mjs`
- `server/src/services/classification.mjs`
- `client/src/views/CommandCenter.vue`

Acceptance criteria:
- Stepper no longer misrepresents skipped combine step as pending.
- Backend and UI phase semantics are aligned.

Verification checklist:
- [x] Backend phase-list tests include skipped states.
- [x] Frontend tests render skipped state correctly.
- [ ] Manual smoke verifies policy path presentation.

## Phase 5 - Verification, Rollout, and Docs Closure
Scope:
- Feature-flag rollout execution in staging then production.
- End-to-end verification sequence across parser, retrieval, logging/metrics parity, and Command Center phases.
- Release documentation updated with behavior changes and known limitations.

Primary files:
- `docs/implementation_plan_rag_ai_resilience_and_command_center_consistency.md`
- `docs/issue-rag-ai-resilience-task-list.md`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`

Acceptance criteria:
- Verification package is reproducible in staging/prod-like environment.
- Rollback path is validated with explicit Phase 1 trigger checks.

Verification checklist:
- [ ] Phase 1 rollback triggers and rollback procedure are dry-run validated.
- [ ] Release docs include reliability hardening summary.

## Verification Commands (Operational Pack)
Backend tests:
- `npm --prefix server test`
- `npm --prefix server run test:integration`

Frontend tests:
- `npm --prefix client run test:unit`
- `npm --prefix client test`
- `npm --prefix client run build`

Production-like SQL/log checks:
- Parser malformed trend (24h/7d).
- Pass1/pass2 reason-code distribution.
- Duplicate-stage warning row query.
- Stage-event vs `rag_metrics` parity query.
- Command Center phase progression smoke query + UI check.

## Feature Flags and Rollback Controls
Proposed toggles:
- `ai_response_repair_enabled`
- `classification_disallow_partial_stream_response`
- `rag_pass1_retry_enabled`
- `rag_pass2_retry_enabled`
- `rag_stage_single_write_enabled`
- `phase_skipped_status_enabled`

Rollback strategy:
- Disable affected feature flags first.
- Revert migration-backed changes only if required and safe.
- Preserve baseline fallback behavior.

## Risks and Mitigations
- Risk: repair flow latency overhead.
  - Mitigation: one-shot repair only; Operational Visibility on added latency.
- Risk: retries increase compute load.
  - Mitigation: bounded retries + backoff; monitor queue and retrieval latencies.
- Risk: index migration incompatibility.
  - Mitigation: idempotent migration and capability checks.
- Risk: UI and backend phase contract drift.
  - Mitigation: shared phase contract tests and explicit skipped-state coverage.
- Risk: parity work introduces logging noise.
  - Mitigation: dedupe gates and fingerprint validation in tests.

## Definition of Done
1. Parser malformed rate reduced materially from baseline.
2. Generic retrieval reason codes materially replaced by cause-specific reason codes.
3. Duplicate stage warning DB rows eliminated.
4. `rag_metrics` and stage-event logs are materially consistent for retrieval outcomes.
5. Command Center stepper accurately reflects skipped vs pending phases.
6. Validation package passes in staging/prod-like environment.
7. Plan/task/release docs are synchronized with shipped behavior.

## Dependencies
1. Phase 0 must complete before Phase 0.5 begins.
2. Phase 0.5 must complete before any Phase 1+ implementation starts.
3. Phase 1 should complete before broad rollout of Phase 2/3.
4. Phase 2 and Phase 3 can overlap after reason taxonomy baseline is stable.
5. Phase 4 depends on backend phase-status contract decisions from Phase 1/2.
6. Phase 5 requires completion evidence from Phases 1-4.

## Cross-Reference
- Plan: `docs/implementation_plan_rag_ai_resilience_and_command_center_consistency.md`
- Task list: `docs/issue-rag-ai-resilience-task-list.md`
