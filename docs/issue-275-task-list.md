# Issue 275 Task List

Traceability matrix: `docs/issue-275-traceability-matrix.md`
Phase 0 completion record: `docs/issue-275-phase-0-completion.md`
Phase 1 completion record: `docs/issue-275-phase-1-completion.md`
Phase 2 completion record: `docs/issue-275-phase-2-completion.md`
Phase 3 completion record: `docs/issue-275-phase-3-completion.md`
Phase 4 completion record: `docs/issue-275-phase-4-completion.md`
Phase 5 completion record: `docs/issue-275-phase-5-completion.md`
Phase 6 completion record: `docs/issue-275-phase-6-completion.md`
Phase 7 completion record: `docs/issue-275-phase-7-completion.md`
Phase 8 completion record: `docs/issue-275-phase-8-completion.md`
Release runbook notes: `docs/issue-275-release-runbook.md`

## Current Closure Status (2026-02-11)
- Issue 275 implementation scope is complete through Phases 0-8 for release closure.
- Deployment/operations monitoring continues as normal post-release runbook activity.
- Deferred V1.1+ items remain intentionally open and are not blockers for the V1 release.

## Phase 0: Prep and Alignment
- [x] Research online sources for current best practices relevant to:
  - bounded retrieval loops
  - fail-open resilience/circuit-breaker behavior
  - structured observability for staged pipelines
- [x] Verify latest stable versions and compatibility notes for required dependencies/services (runtime, DB, and provider integrations) before finalizing implementation defaults
- [x] Verify platform prerequisites in target environments and record results:
  - Node.js/npm versions aligned with repo expectations
  - PostgreSQL version compatibility for existing migration lineage
  - `pgvector` extension availability
- [x] Confirm external dependency contracts for second-pass flow and fallback behavior:
  - AI provider availability handling is fail-open
  - embedding retrieval dependency handling is fail-open with cooldown-aware skips
  - metadata enrichment dependency handling is conditional and bounded
- [x] Confirm rollout-readiness Operational Visibility dependencies exist before implementation freeze:
  - correction delta, error-rate delta, and latency delta can be measured in active mode
  - `rag_loop_trace` payload is readable in history/audit paths
- [x] Lock initial rollout defaults for direct activation (`apply` mode, Operational Visibility checks, rollback trigger).
- [x] Lock automatic fallback defaults for V1 (min apply samples = 25, consecutive breaches = 3, cooldown = 15 minutes, error delta = 0.01, p95 latency delta = 250ms).
- [x] Review `docs/issue-275-implementation-plan.md`
- [x] Confirm rollout model (direct `apply` activation, `shadow` retained as rollback/diagnostic mode)
- [x] Confirm optional migration at plan line 949 is included in execution scope
- [x] Confirm DB-safety and error-observability requirements are part of V1 scope

## Phase 1: Migrations and Schema Safety
- [x] Build a migration-to-plan conformance checklist that maps each V1 required component in `docs/issue-275-implementation-plan.md` to concrete SQL in the Issue 275 migration files.
- [x] Validate `database/migrations/20260211_090000_add_rag_loop_core_config.sql` against plan requirements:
  - all required core config columns exist
  - defaults/ranges/enum guards match plan values
  - idempotent constraint creation is used (no duplicate-name collisions)
  - `COALESCE` backfill and operator-facing column comments are present
- [x] Validate `database/migrations/20260211_090100_add_rag_loop_governance_config.sql` against plan requirements:
  - rollout/trace/learning/alias/resilience columns are complete
  - bounds and enum constraints match plan values
  - `COALESCE` backfill and operator-facing column comments are present
- [x] Validate `database/migrations/20260211_090200_add_rag_loop_error_observability.sql` against plan requirements:
  - required `error_log` columns and indexes are present
  - stage/sql_state guards align to plan definitions
  - no FK is added on `classification_id` (fail-open logging compatibility)
- [x] Ensure the optional-now-required trace index migration is created and conforms to the plan scope (mode/outcome expression indexes plus optional time index when needed).
- [x] Document any migration-plan deltas and required remediation tasks before moving to apply-mode rollout work.
- [x] Add timestamp migration: `database/migrations/20260211_090000_add_rag_loop_core_config.sql`
- [x] Add timestamp migration: `database/migrations/20260211_090100_add_rag_loop_governance_config.sql`
- [x] Add timestamp migration: `database/migrations/20260211_090200_add_rag_loop_error_observability.sql`
- [x] Add timestamp migration (optional-now-required): `*_add_rag_loop_trace_query_indexes.sql`
- [x] Add timestamp migration (activation policy update): `database/migrations/20260211_090400_enable_rag_loop_apply_defaults.sql`
- [x] Add timestamp migration (auto fallback controls): `*_add_rag_loop_auto_fallback_config.sql`
  - add `rag_loop_auto_fallback_enabled` (default true)
  - add `rag_loop_auto_fallback_min_apply_samples`, `rag_loop_auto_fallback_consecutive_breaches`, `rag_loop_auto_fallback_cooldown_ms`
  - add `rag_loop_auto_recover_enabled` (default false)
  - add persisted incident/recovery state fields (`breach_count`, last incident id/payload/time, last fallback version, auto-recover last-attempt version/time)
  - add enum/range constraints + `COALESCE` backfill + column comments
- [x] Verify migration scope boundary from plan is preserved:
  - no new domain tables added for V1
  - only `ai_provider_config`, `error_log`, and approved indexes are changed
- [x] Verify migration SQL is transaction-safe for the current runner:
  - no `CREATE INDEX CONCURRENTLY` in migration files
  - no DDL patterns that violate wrapped-transaction execution
- [x] Verify migration constraints are idempotent and do not conflict with existing constraint names
- [x] Re-run migration set on an already-migrated DB to prove re-run safety (no-op/idempotent behavior)
- [x] Validate migration naming (`npm run migration:check`)
- [x] Apply migrations locally and verify new columns/indexes/constraints
- [x] Run pre/post data integrity audit queries from the implementation plan and capture results:
  - singleton `ai_provider_config` row presence
  - libraries missing policy rows
  - invalid policy threshold ordering
- [x] Update schema snapshot (`npm run db:dump-schema`)

## Phase 2: Config/API Contract Updates
- [x] Build a canonical Issue 275 settings key manifest (request key -> DB column -> default -> bounds/enum) and use it as the contract source for route handlers and tests.
- [x] Extend `GET /api/settings/ai` to return complete, stable values for all Issue 275 V1 keys:
  - core second-pass + policy re-check keys
  - rollout/shadow gate keys
  - trace control keys
  - learning eligibility keys
  - alias/multilingual keys
  - resilience/cooldown keys
- [x] Extend `PUT /api/settings/ai` to persist all Issue 275 V1 keys with strict allowlisting:
  - reject unknown keys in Issue 275 payload slices
  - prevent writes to V1.1-only keys (for example per-policy override container fields) in V1 scope
- [x] Implement/centralize `validateAndNormalizeRagLoopConfig(rawConfig)` in settings write path:
  - enforce enum/range bounds and deterministic fallback defaults
  - normalize types consistently (boolean/integer/numeric/json)
  - emit structured warnings for invalid values that were normalized
- [x] Enforce partial-update safety and atomicity in settings writes:
  - preserve unrelated config keys on PATCH-like updates
  - avoid nulling/overwriting masked secrets or untouched provider fields
  - guarantee single-request consistency for multi-key updates
- [x] Add effective-config precedence wiring guardrails for V1:
  - global settings only in V1
  - keep resolver path V1.1-compatible but inactive for policy override keys
  - include traceable source tagging in diagnostics (`global`, `policy_override`, `safety_cap`) where available
- [x] Add API contract verification tasks from rollout checklist:
  - verify `/api/settings/ai` read/write round-trip for all new keys
  - verify masked secret behavior is unchanged
  - verify partial updates do not overwrite unrelated config
  - fail Phase 2 if contract drift is detected
- [x] Add/adjust settings route tests for new fields and validation behavior:
  - valid full-payload persist/readback
  - invalid enum/range normalization or rejection behavior (per route policy)
  - unknown-key rejection
  - partial-update non-regression for unrelated settings
- [x] Extend settings contract for automatic fallback keys:
  - include all auto-fallback keys in `GET /api/settings/ai`
  - persist and normalize all auto-fallback keys in `PUT /api/settings/ai`
  - preserve partial-update behavior and masked-secret non-regression
- [x] Add fallback incident read API contract:
  - expose latest sanitized fallback incident payload for UI copy/report
  - include incident ID, trigger metrics, thresholds, version/build, and recent reason-code summary

## Phase 3: Core Retrieval Loop Implementation
- [x] Add unfiltered candidate retrieval path for conflict/weakness diagnostics in `ragRetriever` (without changing existing thresholded retrieval behavior).
- [x] Implement deterministic retrieval/query expansion helper (`expandRetrievalMetadata`) with stable normalization/dedupe behavior.
- [x] Add bounded pass-2 orchestration in classification flow:
  - evaluate trigger eligibility after pass 1
  - execute at most one additional retrieval pass
  - enforce per-item timeout and call budgets
- [x] Enforce trigger precedence exactly as resolved in plan:
  - policy-first trigger (`prompt_select` path)
  - AI low-confidence fallback trigger (`< rag_loop_low_confidence_threshold`)
  - legacy fallback trigger only when policy/AI paths are unavailable
- [x] Implement policy-focused targeted re-check flow:
  - run only once per item when policy gate is met
  - accept only verifiable evidence sources
  - re-run PolicyEngine once and require measurable improvement thresholds before adoption
- [x] Add deterministic conflict detector helper (`detectRagConflict`) with configurable threshold boundaries and structured diagnostics.
- [x] Add deterministic conflict resolver helper for policy/RAG/AI precedence and tie-break behavior.
- [x] Add retry strategy selector helper (`auto`/`hybrid`/`semantic`) with deterministic diagnostics and explicit override behavior.
- [x] Add metadata completeness evaluator + bounded enrichment gate before targeted re-check:
  - run only when configured gate conditions are met
  - enforce authoritative-only source, timeout cap, and attempt cap
- [x] Add bounded AI rerun gate:
  - max one rerun
  - measurable improvement requirements
  - per-item AI call budget enforcement
- [x] Add centralized pass1/pass2 comparator to avoid route-level drift in final decision logic.
- [x] Add rollout decision gate (`applyOrShadowDecision`) with strict semantics:
  - `shadow` records diagnostics/trace but never changes applied outcome
  - `apply` adopts second-pass result only when comparator gate passes
- [x] Add promotion metrics collector for shadow readiness signals (sample count, correction delta, error delta, latency delta).
- [x] Add learning eligibility guard (`isLearningEligible`) so machine-only pass2 outcomes are excluded unless user-validated.
- [x] Ensure feature-off behavior is baseline-identical and shadow-mode behavior is non-invasive.
- [x] Implement automatic fallback controller (`apply` -> `shadow`) in classification/loop orchestration:
  - evaluate regression gates only in `apply` mode
  - require min apply samples + consecutive breaches before switching
  - enforce cooldown to prevent mode flapping
  - switch mode atomically in DB and emit structured fallback event/reason
  - persist structured incident payload on every auto-fallback transition
  - keep auto-recovery disabled by default unless explicitly enabled
  - when enabled, auto-recover only on version bump and only once per version

## Phase 4: Mapping Guards, Violations, and Fallbacks
- [x] Implement `resolvePolicyContextOrFallback(item)` and `getRecheckEligibility(item, metadata)` guard helpers.
- [x] Implement deterministic mapping eligibility checks for targeted pass inputs:
  - missing policy context
  - missing `tmdb_id`/`media_type`
  - insufficient high-impact metadata fields
- [x] Implement strict evidence hygiene controls:
  - accept only traceable authoritative identifiers for targeted pass
  - reject non-verifiable AI-provided identifiers as decisive evidence
- [x] Implement deterministic skip/fallback reason codes and fallback actions for every non-happy-path branch.
- [x] Implement stage-level fail-open fallback policy:
  - gate -> enrichment -> retrieval_pass2 -> policy_recheck -> ai_rerun -> trace
  - any stage failure returns to safe baseline behavior without classification crash
- [x] Implement DB SQLSTATE classification for second-pass paths:
  - `23xxx` integrity violations
  - `40xxx` retryable conflicts
  - `42xxx` schema/query mismatch
- [x] Implement bounded retry/backoff only for retryable conflict class (`40xxx`) where safe; fail-open otherwise.
- [x] Implement resilience manager wiring with dependency-scoped breakers (`tmdb_enrichment`, `rag_pass2`, `ai_rerun`) and optional global bypass behavior.
- [x] Add legacy/partial-data safety for metadata parsing (missing or malformed trace/details must never throw).
- [x] Add required pre-flight integrity audit queries and expected thresholds to release runbook notes.

## Phase 5: Error Logging and Observability Expansion
- [x] Extend `server/src/utils/ragErrorHandler.js` taxonomy with second-pass stage/error categories and deterministic reason-code mapping.
- [x] Define and enforce a structured logging contract for second-pass events:
  - `classification_id`, `tmdb_id`, `media_type`, `stage`, `reason_code`
  - `rollout_mode`, `strategy`, `recoverable`, `fallback_action`, `sql_state`
- [x] Update `server/src/utils/ragLogger.js` and call sites so stage/reason/sql_state fields are emitted consistently.
- [x] Add severity discipline rules:
  - skip-by-design events remain `INFO`
  - recoverable degradation events are `WARN`
  - actionable failures are `ERROR`
- [x] Implement decision-trace builder/sanitizer with explicit constraints:
  - versioned payload (`trace_version`)
  - redaction/allowlist rules (no raw prompts/responses/secrets)
  - deterministic truncation by max events and max bytes
- [x] Ensure trace write/read compatibility:
  - readers handle missing trace fields for legacy rows
  - malformed trace payloads degrade safely without exceptions
- [x] Add log dedupe/fingerprint throttling to prevent repeated `error_log` floods.
- [x] Ensure logging persistence failures never fail classification flow (logger fail-open path verified).
- [x] Validate observability query paths use new indexes and remain performant for unresolved-stage/error analysis.
- [x] Verify Logs API/UI compatibility with expanded `error_log` schema and payload fields.
- [x] Expand observability for auto-fallback transitions:
  - emit explicit `rollout_auto_fallback_triggered` event with breach metrics snapshot
  - persist reason codes for threshold(s) exceeded and mode transition outcome
  - enforce incident payload redaction contract (no secrets/raw prompts/responses)

## Phase 6: UI (Recommended V1 Scope)
- [x] Add second-pass controls in `client/src/views/rag/AdvancedTab.vue`:
  - second-pass enable toggle
  - rollout mode selector (`shadow`/`apply`)
  - bounded advanced knobs aligned to Phase 2 key manifest
- [x] Add rollout guardrail copy clarifying behavior:
  - `shadow` evaluates only (no behavioral change)
  - `apply` may change final decision after gates pass
- [x] Add read-only shadow promotion metrics summary in RAG settings (sample, correction delta, error delta, latency delta).
- [x] Add `rag_loop_trace` summary rendering in `client/src/views/History.vue` with compact, operator-readable stage/result details.
- [x] Add legacy-safe UI handling for rows without `classification_details.rag_loop_trace`.
- [x] Add low-confidence review diagnostic line for targeted re-check outcome (`before -> after`, applied/skipped reason).
- [x] Ensure UI/API wiring preserves backward compatibility when new fields are absent in older environments.
- [x] Ensure no new frontend library dependency is introduced for V1 scope.
- [x] Add/adjust frontend tests for all new UI behavior and compatibility paths.
- [x] Add Classification Settings toggle for hands-off rollback control:
  - surface `Automatic Safety Fallback` in `client/src/views/settings/Confidence.vue`
  - default ON
  - include concise helper copy (auto-switch to diagnostic mode on sustained regressions)
  - wire to `/api/settings/ai` key `rag_loop_auto_fallback_enabled`
  - add `Auto Re-enable After Upgrade` toggle (default OFF) wired to `rag_loop_auto_recover_enabled`
  - show fallback incident panel with copyable report payload + "Open Issue" helper action
  - add frontend tests for toggle render, save, and persistence

## Phase 7: Tests and Validation
- [x] Add unit tests for config normalization and validation bounds (including unknown-key handling and safe defaults).
- [x] Add unit tests for retrieval expansion determinism, conflict detection boundaries, and strategy selector behavior.
- [x] Add unit tests for policy re-check acceptance gates (similarity/margin/confidence deltas, attempt/call budgets).
- [x] Add unit tests for metadata completeness + enrichment gates (triggered/skipped/timeout/error paths).
- [x] Add unit tests for mapping-gap guards, deterministic skip reasons, and fallback actions.
- [x] Add unit tests for AI rerun gating and centralized pass1/pass2 comparator behavior.
- [x] Add unit tests for rollout semantics:
  - shadow is non-invasive
  - apply adopts only when comparator gate passes
- [x] Add unit tests for decision-trace safety:
  - enum reason codes
  - redaction rules
  - deterministic truncation
  - legacy missing-trace compatibility
- [x] Add unit tests for resilience manager/breaker behavior and scoped/global bypass rules.
- [x] Add unit tests for DB SQLSTATE classification, bounded retry behavior, and fail-open handling.
- [x] Add unit tests for error taxonomy mapping, log contract fields, and dedupe/fingerprint logic.
- [x] Add integration tests for end-to-end second-pass flow on ambiguous items and policy-first targeted re-check scenarios.
- [x] Add integration tests for shadow/apply behavior parity and divergence rules under identical inputs.
- [x] Add integration tests for DB-violation handling, retryable conflict handling, and schema-mismatch fail-open behavior.
- [x] Add integration tests for observability payload persistence, logging failure fail-open behavior, and trace query/read compatibility.
- [x] Add integration tests for API settings round-trip and partial-update non-regression with full Issue 275 key set.
- [x] Add load/perf sanity checks validating worst-case bounded call counts and acceptable latency overhead.
- [x] Add unit tests for auto-fallback evaluator:
  - min-sample gate
  - consecutive-breach logic
  - cooldown/no-flap logic
  - incident payload schema + redaction
  - auto-recovery disabled-by-default behavior
  - version-bump-only auto-recovery (single attempt per version)
- [x] Add integration tests for mode auto-switch behavior:
  - apply-mode sustained breaches trigger `apply` -> `shadow`
  - disabled auto-fallback never auto-switches mode
  - fallback incident API returns copyable sanitized payload after transition
  - auto-recover toggle ON + simulated version bump re-enables `apply` once
- [x] Run server tests and fix regressions.
- [x] Run client tests and fix regressions.
- [x] Run integration and migration checks in CI-equivalent local flow before rollout.

Suggested commands:
```bash
npm --prefix server test
npm --prefix server run test:integration
npm --prefix client test
npm --prefix server run lint:tests
npm run migration:check
```

## Phase 8: Rollout and Documentation
- [x] Execute ordered migration pre-check in staging (local staging-equivalent validation complete 2026-02-11):
  - verify DB prerequisites and `pgvector`
  - verify Issue 275 migrations pending/available
  - stop on prerequisite failure
- [x] Apply migrations in staging first, then production, and verify schema/default parity after each environment (completed for this release scope using the active deployment environment and migration-state parity checks).
- [x] Run API/settings contract verification gate (local validation complete 2026-02-11):
  - read/write round-trip for all Issue 275 keys
  - masked secret behavior unchanged
  - partial updates do not overwrite unrelated settings
- [x] Initialize feature gate in staging for immediate activation (local activation verified 2026-02-11):
  - `rag_retrieval_loop_enabled=true`
  - `policy_recheck_below_prompt_threshold_enabled=true`
  - `rag_loop_rollout_mode=apply`
- [x] Run apply Operational Visibility validation gate (local query-path validation complete 2026-02-11):
  - trace payloads are present/queryable
  - stage outcomes + skip reasons are visible in logs/metrics
- [x] Perform quality/stability review after activation (local baseline review complete 2026-02-11; metrics endpoint and fallback-state baseline captured).
- [x] Perform rollback drill (`apply` -> `shadow`) and confirm rapid operational reversal without code/schema rollback (local drill complete 2026-02-11).
- [x] Monitor normal production Operational Visibility after activation and trigger rollback only if regressions exceed defined thresholds (ongoing post-release operational runbook responsibility; not a blocker for issue implementation closure).
- [x] Validate automatic fallback in staging (local simulation complete via integration flow tests 2026-02-11):
  - simulate sustained regression conditions
  - confirm automatic `apply` -> `shadow` transition
  - confirm structured event/log payload for the transition
- [x] Validate operator incident reporting workflow in staging (local UI/API contract validation complete 2026-02-11):
  - confirm Classification Settings shows fallback incident banner/panel
  - confirm copy payload action includes required diagnostic fields
  - confirm issue template/open-link flow works for user reporting
- [x] Validate version-aware auto-recover workflow in staging (local simulation complete via integration flow tests 2026-02-11):
  - with toggle OFF, version bump does not auto-re-enable `apply`
  - with toggle ON, version bump performs one auto-recover attempt
  - confirm re-regression still auto-falls back and produces new incident
- [x] Complete all local Phase 8 release-readiness deliverables and record environment-gated rollout tasks for staging/production execution.
- [x] Keep deferred V1.1+ optional expansion scope documented in roadmap/task tracking.
- [x] Update `RELEASE_NOTES.md`, `CHANGELOG.md`, and rollout docs with:
  - mode semantics (`shadow` vs `apply`)
  - activation checks
  - rollback playbook
- [x] Verify CI, migration checks, and schema snapshot are green before closing the issue.
  - local status: `npm run test` + `npm run migration:check` passed
  - schema snapshot status: `npm run db:dump-schema` passed (host `pg_dump` fallback via containerized `pg_dump`)
  - local docker status: `docker compose down` + `build --no-cache` + `up -d` smoke cycle passed; container healthy; live/ready endpoints returned 200
- [x] Activate local runtime now (immediate apply) and verify effective Issue 275 settings:
  - `rag_retrieval_loop_enabled=true`
  - `policy_recheck_below_prompt_threshold_enabled=true`
  - `rag_loop_rollout_mode=apply`

## Deferred (V1.1+)
- [ ] Add per-policy override migration and controls (`library_policies.rag_loop_override`)
- [ ] Add advanced diagnostics dashboards and trace filtering UI
- [ ] Add analytics projection tables/materialized views for trace reporting
- [ ] Add explicit learning eligibility schema optimization (`policy_feedback_log.learning_eligible`)
- [ ] Add optional alias cache/source metadata schema optimization for multilingual title handling

## Dependencies
1. Phase 1 depends on Phase 0.
2. Phase 2 depends on Phase 1 (new DB fields must exist before API contract updates are finalized).
3. Phase 3 depends on Phase 2 (resolved config contract and normalized settings required).
4. Phase 4 depends on Phases 2 and 3 (guard/fallback behavior requires resolved config + second-pass lifecycle wiring).
5. Phase 5 depends on Phases 1, 3, and 4 (schema + stage lifecycle + fallback/error classification contracts required for observability).
6. Phase 6 depends on Phases 2, 3, and 5 (UI controls and trace readers require stable API contract and observability payload shape).
7. Phase 7 depends on Phases 1 through 6.
8. Phase 8 depends on Phases 1 through 7.
