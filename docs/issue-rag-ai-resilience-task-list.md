# RAG/AI Resilience Task List

Implementation source: `docs/implementation_plan_rag_ai_resilience_and_command_center_consistency.md`

## Current Status (2026-02-18)
- [x] Runtime incident evidence captured and validated in production-like Unraid environment.
- [x] Correlated stage-event sequence confirmed for `correlation_id=41293366-9a30-4095-9424-a5054a8b2f80`.
- [x] Malformed parser event confirmed (`AIResponseParser`, free-text output).
- [x] Duplicate warning persistence pattern confirmed (`RAG` + `RAGLogger`).
- [x] Vector baseline validated (`pgvector 0.8.0`, dims consistent at `1024`, active embeddings present).
- [x] Phase 0 online best-practice and official-doc verification completed (`docs/issue-rag-ai-resilience-best-practices.md`, updated 2026-02-18).
- [x] Phase 0.5 re-baseline and downstream phase/task refinement completed (2026-02-18).
- [x] Remediation implementation started (Phase 1 in progress).
- [x] Phase 4 implementation completed in code (`skipped` phase model + Command Center rendering) on 2026-02-18; rollout smoke validation pending.
- [x] Phase 5 verification execution started (local automated test/build run in progress) on 2026-02-18.
- [x] Fresh local DB snapshot created via isolated Docker pgvector container:
  - dump: `.tmp/db-snapshot/backups/classifarr_snapshot_pgvector_clean_20260218T170824Z.sql`
  - container: `classifarr_pgvector_snapshot_clean` (removed after snapshot creation)
  - data path: `.tmp/db-snapshot/pgdata-clean-20260218T170824Z`

## Closeout Checklist (Post v0.42.5d-alpha)
Use this as the single operator checklist to close the issue cleanly.

Known evidence already captured:
- Release shipped: `v0.42.5d-alpha` (tag + GitHub release published).
- Tag pipeline health:
  - `CI/CD Pipeline` run `22196227826`: `success`
  - `OSV Dependency Scan` run `22196228001`: `success`
- Runtime code/db verification in container:
  - `policy_prompt_risk_clear` present in `/app/src/utils/ragLoopHelpers.js`
  - `policy_recheck_skip_when_ai_confident_enabled` present in `/app/src/utils/ragLoopConfig.js`
  - `ai_provider_config.id=1.policy_recheck_skip_when_ai_confident_enabled = true`
- Retry queue stability snapshots captured after remediation:
  - `pending_exhausted = 0`
  - `warn_auto_heal_last_60m = 0`
  - Tavily deferred queue state normalized to pending with monthly deferral reason (`tavily_monthly_quota_deferred`).

### 1) Staging Validation Window
- [ ] Run staging with rollout flags enabled for at least `200 classify runs` or `24 hours` (whichever is first):
  - `ai_response_repair_enabled=true`
  - `classification_disallow_partial_stream_response=true`
  - `rag_pass1_retry_enabled=true`
  - `rag_stage_single_write_enabled=true`
  - `phase_skipped_status_enabled=true`
- [ ] Record validation window:
  - start: `________________`
  - end: `________________`
  - runs: `________________`

### 2) Phase 1 Acceptance Evidence (Parser/Repair)
- [ ] Capture before/after malformed parser warning rate (`>=50%` reduction target).
- [ ] Capture repair-success rate when strict parse fails (`>=80%` target).
- [ ] Confirm no verify-mode regressions during validation window.
- [ ] Capture p95 classification decision latency before/after (Phase 1 rollback guard).

Evidence log:
- baseline malformed rate: `parser_malformed_24h=1` (captured 2026-02-18 snapshot)
- post-fix malformed rate: `________________`
- repair success rate: `________________`
- verify regressions observed: `yes/no` (`________________`)
- p95 decision latency delta: `________________`

### 3) Phase 2 Acceptance Evidence (Retrieval Specificity/Stability)
- [ ] Confirm reduction in generic:
  - `rag_pass1_candidate_failed`
  - `rag_pass2_failed`
- [ ] Confirm specific reason codes are present in stage events for most failures.
- [ ] Confirm retrieval stability under current library volume.
- [ ] Capture index/query evidence (`idx_embeddings_hnsw` presence + representative EXPLAIN output where applicable).

Evidence log:
- generic pass1 count (baseline -> post): `baseline known from incident snapshot; post-fix capture pending`
- generic pass2 count (baseline -> post): `baseline known from incident snapshot; post-fix capture pending`
- specific reason-code sample rows: `pre-fix generic snapshots captured; post-fix production-window sample capture pending`
- index/plan validation notes: `pgvector=0.8.0, embedding dims=1024 verified; additional EXPLAIN evidence capture pending`

### 4) Phase 3 Acceptance Evidence (De-dupe + Metrics Parity)
- [ ] Re-run duplicate-row query and confirm one canonical DB stage row per fingerprint/correlation (excluding intentional retries).
- [ ] Confirm `RAGLogger` no longer creates duplicate warning rows for same stage event.
- [ ] Re-run parity aggregate and confirm `error_log` vs `rag_metrics` alignment for same window.

Evidence log:
- duplicate query result summary: `pre-fix duplicate module rows observed (RAG + RAGLogger) for same incident correlation; post-fix re-run pending`
- parity query result summary: `local/unit parity paths validated; staging parity aggregate capture pending`
- mismatches requiring follow-up: `________________`

### 5) Phase 4 Acceptance Evidence (Command Center Truthfulness)
- [ ] Manual smoke verifies `signal_combine` shows `skipped` (not misleadingly `pending`) on policy-path tasks.
- [ ] Manual smoke verifies stepper clearly distinguishes `pending` vs `skipped`.

Evidence log:
- smoke run timestamp: `________________`
- classification/task ids sampled: `________________`
- result summary: `________________`

### 6) Docs + Task Closure
- [ ] Update `docs/implementation_plan_rag_ai_resilience_and_command_center_consistency.md` with post-fix outcomes.
- [ ] Update this task list with final metric values and mark applicable phase checkboxes complete.
- [x] Confirm release notes/changelog already contain shipped behavior changes.
- [ ] Mark `Definition of Done` items complete (except explicitly deferred backlog items).

### 7) Administrative Cleanup (Retroactive)
- [ ] Mark `Implementation Start Gate (DoR)` entries as `N/A (retroactive)` or `Completed retroactively`, with a one-line rationale.
- [ ] Keep `Deferred (Post-Fix Backlog)` unchecked unless explicitly scheduled into a new issue.

## Incident Evidence Snapshot
- Classification result:
  - `classification_history.id=6606`
  - `status=completed`
  - `method=ai_rerun`
  - `confidence=85.00`
  - `library_name=Family`
- Stage sequence (same correlation):
  1. `gate error (rag_pass1_candidate_failed)`
  2. `gate run (policy_prompt_select)`
  3. `gate strategy_selected (auto_default)`
  4. `enrichment skipped (metadata_complete)`
  5. `retrieval_pass2 error (rag_pass2_failed)`
  6. `policy_recheck evaluated (policy_not_upgraded)`
  7. `ai_rerun applied (material_improvement)`
- Config snapshot (`ai_provider_config.id=1`):
  - `rag_retrieval_loop_enabled=true`
  - `rag_retry_strategy=auto`
  - `rag_retry_low_signal_similarity_floor=0.55`
  - `policy_recheck_below_prompt_threshold_enabled=true`
  - `policy_recheck_metadata_timeout_ms=2000`
  - `rag_loop_global_bypass_ms=600000`
  - `rag_loop_rollout_mode=apply`

## Implementation Start Gate (DoR)
- [ ] Reconfirm scope lock against implementation plan.
- [ ] Confirm owner for each phase.
- [ ] Confirm no conflicting in-flight refactor in:
  - `server/src/services/classification.mjs`
  - `server/src/services/aiResponseParser.mjs`
  - `server/src/utils/ragLogger.mjs`
  - `client/src/views/CommandCenter.vue`
- [ ] Confirm staging path and rollback toggles are ready.
- [ ] Confirm observability queries are prepared before first code deploy.

## Phase Mapping (Plan -> Task List)
| Plan workstream | Task list phase |
|---|---|
| Best-practice and evidence gate | Phase 0: Research and Official Docs Validation |
| Research assimilation and scope updates | Phase 0.5: Re-baseline and Plan/Task Synchronization |
| Workstream A + B | Phase 1: AI Contract and Streaming Guard |
| Workstream C | Phase 2: Retrieval Resilience and Reason Codes |
| Workstream D + F | Phase 3: Logging De-duplication and Metrics Parity |
| Workstream E | Phase 4: Phase Model and Command Center Stepper |
| Rollout + validation | Phase 5: Verification, Rollout, and Docs |

## Critical Path
1. Phase 0
2. Phase 0.5
3. Phase 1
4. Phase 2
5. Phase 3
6. Phase 4
7. Phase 5

Parallelizable:
- Phase 3 observability query/dashboard prep can begin during Phase 2.
- Documentation updates can start once Phase 3 contracts are stable.

## Phase 0: Research and Official Docs Validation
Implementation activities:
- [x] Create research log artifact:
  - `docs/issue-rag-ai-resilience-best-practices.md`
- [x] Collect and cite official/primary sources for AI output-format control and constrained generation:
  - provider docs used by Classifarr runtime (Ollama and any enabled AI provider adapters)
  - response-format controls and structured output patterns
  - timeout/streaming behavior guidance for long-running generation
- [x] Collect and cite official/primary sources for PostgreSQL + pgvector retrieval/indexing:
  - pgvector HNSW and cosine index guidance
  - index build/maintenance considerations and compatibility notes
  - query plan verification patterns for vector search
- [x] Collect and cite operational logging/observability best practices:
  - event deduplication/fingerprinting patterns
  - stage-event vs metrics parity modeling
  - recoverable vs non-recoverable error taxonomy standards
- [x] Collect and cite frontend phase/progress UX best practices:
  - explicit skipped-state semantics
  - multi-step process visualization where steps can be bypassed
- [x] Map each citation to a concrete plan decision:
  - prompt contract changes
  - parser repair path
  - reason-code taxonomy
  - log dedupe behavior
  - metrics parity contract
  - `signal_combine` skipped-state rendering
- [x] Record accepted recommendations and rejected alternatives with rationale.

Acceptance checklist:
- [x] Research log exists and includes URL + date + source type for each citation.
- [x] All high-impact implementation decisions in the plan reference at least one source-backed rationale.
- [x] Any deviation from source recommendations is explicitly documented.
- [x] Phase 1 work does not start until this gate is complete.

Verification checklist:
- [x] Peer review confirms citations are primary/official where applicable.
- [x] Research log cross-links to:
  - `docs/implementation_plan_rag_ai_resilience_and_command_center_consistency.md`
  - `docs/issue-rag-ai-resilience-task-list.md`
- [x] Plan sections updated to reference finalized research decisions.

## Phase 0.5: Re-baseline and Plan/Task Synchronization
Implementation activities:
- [x] Compare Phase 0 findings against all assumptions in:
  - `docs/implementation_plan_rag_ai_resilience_and_command_center_consistency.md`
  - `docs/issue-rag-ai-resilience-task-list.md`
- [x] Produce a change-impact matrix from findings -> impacted workstreams/phases:
  - scope adjustments
  - sequence/dependency adjustments
  - acceptance/verification criteria adjustments
  - feature-flag/rollout adjustments
- [x] Update plan and task list to reflect accepted Phase 0 outcomes:
  - add/modify/remove steps in Phase 1-5 as required by evidence
  - update risks, mitigations, and rollback notes if recommendations changed
  - keep reason-code taxonomy, parser contract, and phase-status contract synchronized
- [x] Document rejected recommendations from Phase 0 and rationale.
- [x] Add a concise "what changed after research" delta summary in both docs.

Acceptance checklist:
- [x] Every Phase 0 high-impact recommendation is either:
  - incorporated into Phase 1-5 tasks, or
  - explicitly rejected with rationale.
- [x] Plan and task list are version/date-updated after re-baseline.
- [x] No implementation phase (1-5) starts until this synchronization gate is complete.

Verification checklist:
- [x] Diff review confirms each modified phase has evidence linkage back to Phase 0 research log.
- [x] Plan/task cross-references are still valid after edits.
- [x] Owners acknowledge any sequencing changes introduced by re-baseline.

Phase 0.5 delta summary (2026-02-18):
- Phase 1 criteria hardened with measurable thresholds, incident-fixture replay, and explicit rollback triggers.
- Phase 2 includes concurrent-safe index rollout and EXPLAIN-backed verification expectations.
- Phase 3 formalizes canonical stage-event identity and dedupe fingerprint policy.
- Phase 4 enforces explicit `skipped` semantics for stepper truthfulness.

## Phase 1: AI Contract and Streaming Guard
Implementation activities:
- [x] Make final prompt guidance mode-aware:
  - `classify`: only `CONFIDENT|...` or `CLARIFY|...`
  - `verify`: only `CONFIRM|...` or `CLARIFY|...`
- [x] Remove classify-path wording that encourages `CONFIRM`.
- [x] Add one-shot repair flow when parser returns fallback.
- [x] Add parse diagnostics fields (attempt count, mode, failure reason, repaired flag, contract_version).
- [x] Prevent classification path from accepting partial streaming output as final parse input.
- [x] Route stream timeout/abort to transient handling path (retry/degraded) instead of malformed parse path.
- [x] Define Phase 1 rollout defaults before implementation:
  - staging: `ai_response_repair_enabled=true`, `classification_disallow_partial_stream_response=true`
  - production: both flags start `false` and are promoted only after Phase 1 acceptance criteria pass in staging.

Acceptance checklist:
- [ ] Malformed parser warning rate is reduced by at least 50% versus baseline.
- [ ] Repaired outputs produce valid parse in classify mode at least 80% of the time when strict parse initially fails.
- [ ] No regressions in existing verify mode parse behavior.
- [ ] Staging acceptance window uses at least 200 classify runs or 24 hours of traffic (whichever comes first).

Verification checklist:
- [x] Unit tests for parser strict + repair behavior.
- [x] Integration test: prose AI output -> repaired valid contract.
- [x] Integration test: replay incident malformed sample text from 2026-02-18 and verify repaired parse.
- [x] Integration test: stream timeout/abort -> transient handling path.
- [ ] Capture before/after malformed count query results.

Rollback criteria (Phase 1 specific):
- [ ] Roll back Phase 1 flags if malformed parser warning rate increases by more than 20% versus baseline for a sustained 30-minute window.
- [ ] Roll back Phase 1 flags if classify parse fallback rate exceeds 5% for a sustained 30-minute window after enablement.
- [ ] Roll back Phase 1 flags if p95 classification decision latency increases by more than 15% after enablement.

## Phase 2: Retrieval Resilience and Reason Codes
Validation query pack: `docs/issue-rag-phase2-validation-checks.md`

Implementation activities:
- [x] Add bounded retry for pass1 candidate retrieval in second-pass gate.
- [x] Add bounded retry for pass2 retrieval path (`semantic` and `hybrid`).
- [x] Expand reason-code mapping:
  - `rag_pass1_candidate_timeout`
  - `rag_pass1_candidate_provider_failed`
  - `rag_pass1_candidate_db_failed`
  - `rag_pass1_candidate_embed_failed`
  - `rag_pass1_candidate_aborted`
  - `rag_pass2_timeout`
  - `rag_pass2_provider_failed`
  - `rag_pass2_db_failed`
  - `rag_pass2_embed_failed`
  - `rag_pass2_aborted`
- [x] Preserve recoverable classification semantics for transient failures.
- [x] Ensure normalization does not collapse specific reason codes back to generic values.
- [x] Add idempotent migration/check for missing text HNSW index (`idx_embeddings_hnsw`) where supported.

Acceptance checklist:
- [ ] Generic `rag_pass1_candidate_failed` frequency drops.
- [ ] Generic `rag_pass2_failed` frequency drops.
- [ ] Reason-code specificity visible in stage events.
- [ ] Retrieval remains stable under existing dataset size.

Verification checklist:
- [x] Fault-injection tests for timeout/provider/db/embed/abort scenarios.
- [ ] Validate stage logs show specific reason codes.
- [ ] Validate index presence and query-plan improvement evidence where applicable.

## Phase 3: Logging De-duplication and Metrics Parity
Validation query pack: `docs/issue-rag-phase3-validation-checks.md`

Implementation activities:
- [x] Keep stage-event DB insert in `module=RAG` as canonical write.
- [x] Prevent second DB write via `RAGLogger` module for same stage event.
- [x] Retain console/file logging visibility.
- [x] Ensure `rag_metrics` captures retrieval failures/skips consistently with stage events.
- [x] Add query-level parity check script/report between `error_log` and `rag_metrics`.

Acceptance checklist:
- [ ] One DB row per stage event fingerprint/correlation (excluding intentional retries).
- [ ] `RAGLogger` no longer creates duplicate warning rows for same stage event.
- [ ] `rag_metrics` failure counts align with stage-event failures in same window.

Verification checklist:
- [ ] Re-run duplicate-row query used during incident diagnostics.
- [ ] Re-run 24h metrics aggregate and compare against stage events.
- [x] Add/execute tests for dedupe behavior and metrics parity paths.

## Phase 4: Phase Model and Command Center Stepper
Implementation activities:
- [x] Add `skipped` phase support in backend progress model.
- [x] Mark `signal_combine` as `skipped` for policy-signal path.
- [x] Render `skipped` state in Command Center stepper.
- [x] Preserve existing 8-step order while making status semantics truthful.

Acceptance checklist:
- [ ] `signal_combine` no longer appears misleadingly pending when policy path bypasses combine step.
- [ ] Stepper clearly distinguishes `pending` vs `skipped`.

Verification checklist:
- [x] Backend tests for phase status generation.
- [x] Frontend tests for skipped-state rendering.
- [ ] Manual smoke: policy path task shows truthful phase progression.

## Phase 5: Verification, Rollout, and Docs
Implementation activities:
- [ ] Enable feature flags in staging:
  - `ai_response_repair_enabled`
  - `classification_disallow_partial_stream_response`
  - `rag_pass1_retry_enabled`
  - `rag_stage_single_write_enabled`
  - `phase_skipped_status_enabled`
- [ ] Run staged verification sequence:
  - parser malformed trend
  - retrieval reason-code specificity
  - duplicate-log check
  - metrics parity check
  - Command Center stepper truthfulness
- [ ] Update implementation plan findings with post-fix outcomes.
- [ ] Update release notes/changelog with behavior changes and operational impact.

Acceptance checklist:
- [ ] No blocker regressions in classification flow.
- [ ] Baseline incident pattern is either resolved or materially reduced.
- [ ] Rollback path validated.

Verification checklist:
- [x] `npm --prefix server test`
- [x] `npm --prefix server run test:integration`
- [x] `npm --prefix client run test:unit`
- [x] `npm --prefix client test`
- [x] `npm --prefix client run build`
- Local run notes (2026-02-18):
  - `npm --prefix server test` passed (`79` suites, `1262` tests).
  - `npm --prefix server run test:integration` passed (`34` suites, `469` tests).
  - `npm --prefix client run test:unit` passed (`32` files, `339` tests).
  - `npm --prefix client test` passed (`33` files, `340` tests).
  - `npm --prefix client run build` passed.

## Definition of Done
- [ ] Parser malformed rate reduced materially from baseline.
- [ ] Generic retrieval error codes replaced by specific cause codes in most failures.
- [ ] Duplicate stage warning DB rows eliminated.
- [ ] Metrics and stage-event logging are materially consistent.
- [ ] Command Center stepper reflects skipped phases correctly.
- [ ] Docs updated and linked:
  - `docs/implementation_plan_rag_ai_resilience_and_command_center_consistency.md`
  - `docs/issue-rag-ai-resilience-task-list.md`

## Deferred (Post-Fix Backlog)
- [ ] Add automated daily health report for parser-malformed and retrieval-failure reason-code trends.
- [ ] Add guardrail alert when duplicate stage-log ratio exceeds threshold.
- [ ] Add optional synthetic canary classification to continuously verify parser contract compliance.
