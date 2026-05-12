# Retry Classification From Command Center - Implementation Plan

## Overview
This plan defines how to add a safe, deterministic retry flow for items in **Needs Attention** so admins can re-run classification as if the request was newly received.

Primary targets:
- `client/src/views/CommandCenter.vue`
- `client/src/api/index.js`
- `server/src/routes/classification.mjs`
- `server/src/services` (new retry/reset service or extension)

## Problem Statement
When an item lands in `awaiting_decision`, operators currently have manual resolution options, but no direct way to:
- wipe stale classification-specific state for that item, and
- re-run classification through the normal queue pipeline.

This slows validation of recent fixes and makes bulk reprocessing cumbersome.

## Goals
- Add **Retry Classification** action per item in Needs Attention.
- Add **Retry Classification All** at the bottom of Needs Attention, next to **Confirm All**.
- Ensure retry enqueues correctly for single and bulk flows.
- Ensure retry clears classification-specific state so the rerun behaves like a fresh request.
- Verify queue behavior for initial multi-request intake and multi-retry actions.
- Preserve existing security posture (authn, authz, CSRF, least privilege, and auditability).

## Non-Goals
- Reworking policy question UX.
- Replacing queue architecture.
- Replaying original webhook payload byte-for-byte (functional parity is sufficient).

## Verified Status (Working Tree Audit - 2026-02-26)
Legend: `[x]` complete, `[~]` partially complete, `[ ]` not started.

- `[x]` Command Center UX: per-item `Retry Classification` and footer `Retry Classification All` are implemented.
- `[x]` Backend endpoint: `POST /api/classification/retry` is implemented with payload validation and bounded batch size.
- `[x]` No-migration v1 approach is respected; implementation reuses existing schema.
- `[x]` Security validation coverage for retry endpoint now includes unauthenticated/non-admin/CSRF denial tests, plus read-only key denial.
- `[x]` Transactional retry/reset service exists with artifact cleanup, enrichment cleanup/reset, optional learning purge, and enqueue.
- `[~]` Duplicate handling is implemented as deterministic `skip` (`duplicate_pending_task`) instead of canceling existing pending tasks.
- `[x]` Follow-up enqueue of fresh `metadata_enrichment` task after classification enqueue is implemented (best-effort, lower priority, linked items only).
- `[x]` Structured retry audit logging is implemented (`correlationId`, `actor`, `route`, `result`, `reasonCode`, counts).
- `[x]` Existing Logs surface now supports retry audit trail filtering (`audit=classification_retry`) without adding a new panel.
- `[x]` Unit and integration tests for retry service/route/cleanup are implemented and passing.
- `[x]` Full queue ordering + webhook burst regression validation is covered by integration tests.
- `[~]` Manual docker validation checklist remains pending.

## Current State (Baseline)
- Needs Attention supports `Confirm` and `Change`, plus `Confirm All`.
- Queue infrastructure supports persisted classification tasks and concurrency.
- Classification history stores pending/completed rows with related records (clarifications, corrections, embeddings, notifications, etc.).

## Proposed UX

### 1) Per-item Action
- Add button on each Needs Attention card:
  - `Retry Classification`
- Behavior:
  - disabled while in-flight for that item
  - on success, item disappears from Needs Attention and appears in queue processing/up-next

### 2) Footer Bulk Action
- In the existing Needs Attention footer (where `Confirm All` is shown), add:
  - `Retry Classification All`
- Behavior:
  - retries all visible `needsAttentionItems`
  - shows summary result (`queued`, `skipped`, `failed`)
  - refreshes pending classifications and queue panels

### 3) Optional Bulk Selection (Future)
- Keep first release simple: all visible items.
- Add selective checkbox bulk retry in a future increment if needed.

## Backend Design

### 1) New API Endpoint
- Add endpoint:
  - `POST /api/classification/retry`
- Payload:
  - `classificationIds: number[]`
  - `options?: { purgeLearning?: boolean }`
- Response (per item):
  - `{ classificationId, queued, taskId, skipped, reason, error }`

### 1.1) Migration Requirement Assessment
Decision for this feature scope: **No database migration required**.

Why this is sufficient for v1:
- We are reusing existing tables and fields:
  - `classification_history` (read/delete existing rows)
  - `task_queue` (enqueue new `classification` tasks)
  - existing dependent tables already referenced by current cleanup logic.
- No new statuses, enums, or constrained values are required:
  - `task_queue.source` is already flexible (`VARCHAR`) and can store `manual_retry` without schema change.
  - No new `classification_history.status` value is introduced.
- No new persisted settings are required for the initial UX/API flow.

When a migration WOULD become required:
- If we add a dedicated persistent retry audit table (instead of structured app logs only).
- If we add retry-specific runtime settings stored in DB (rather than existing config surfaces).
- If we need new indexes for scale-driven performance hardening (e.g., very large bulk retry workloads).

Implementation rule:
- Keep v1 migration-free.
- Re-evaluate after load testing and production audit signals; only add migration(s) with measurable need.

### 1.2) Endpoint Protection Requirements (Mandatory)
- Route must remain behind existing admin route protection (`authenticateToken` + `requireAdmin` via `/api/classification` mount).
- Add explicit write-guard in route handler path (same pattern as sensitive mutation endpoints) to avoid accidental future exposure if mount rules change.
- Enforce CSRF on the endpoint (already expected for `POST` flows; validate in tests).
- Reject API keys without write/admin-equivalent scope if API key access is added in future.
- No unauthenticated, user-tier, or read-only access paths.

### 2) Reset + Requeue Transaction
For each classification ID, execute safely inside a DB transaction:
1. Lock and load classification row (`FOR UPDATE`).
2. Validate status eligibility (`awaiting_decision`, optionally `pending_retry`).
3. Build fresh classification payload from stored metadata/title/media info.
4. Cancel duplicate pending/processing classification queue rows for same identity (tmdb/media/title key) before enqueue.
4.1. If item is linked to `media_server_items` (`metadata.itemId` or deterministic lookup), perform enrichment queue cleanup:
  - remove item from `enrichment_retry_queue` for `omdb`, `tavily`, `tmdb` (delete rows for that `media_item_id` to avoid stale state and unique-key conflicts).
  - cancel/remove pending `metadata_enrichment` tasks in `task_queue` for that same item identity.
4.2. Clear stale enrichment payload for linked media item before retrying classification:
  - remove stale metadata keys from `media_server_items.metadata`:
    - `omdb`
    - `tavily_imdb`
    - `tavily_advisory`
    - `tavily_content_type`
    - `tavily_holiday`
    - `tavily_anime`
  - set `media_server_items.enrichment_status = 'pending'` for that item.
5. Remove classification-scoped artifacts:
  - `clarification_responses`
  - `classification_corrections` (and linked audit artifacts if present)
  - `content_analysis_log`
  - embedding rows/retry rows referencing this classification
  - non-essential app notifications tied to this classification ID
6. Delete the original `classification_history` row.
7. Optionally purge learned exact-match pattern for same TMDB/media if `purgeLearning=true`.
8. Enqueue new `task_queue` row (`task_type='classification'`, `source='manual_retry'`, priority aligned with manual/admin operations).
9. If a linked media item exists, optionally enqueue a fresh `metadata_enrichment` task after classification enqueue to rebuild OMDb/Tavily context cleanly (priority lower than classification).

### 3) Idempotency + Safety
- Ignore already-missing IDs as `skipped:not_found`.
- Prevent duplicate requeue for same item in the same request.
- Return partial success without failing the whole batch.
- Apply strict input validation:
  - `classificationIds` required, array, bounded max size (e.g. 100 per call), integers only, deduped server-side.
  - return `400` for invalid payload shape.
- Use parameterized queries only (no string interpolation in SQL).
- Log structured audit events for retry operations (actor, item count, success/fail counts, correlation id), without leaking secrets or full metadata blobs.
- Include enrichment cleanup result in response for observability:
  - `enrichmentQueueRowsRemoved`
  - `metadataEnrichmentTasksRemoved`
  - `enrichmentMetadataReset`

## Queue and Ordering Verification
Add tests to prove:
- multiple webhook requests enqueue multiple distinct classification tasks.
- bulk retry enqueues one task per retried item.
- dequeue ordering remains `priority DESC, created_at ASC`.
- retries do not create duplicate pending tasks for same item identity.

## Test Plan

### 1) Server Route Tests
- New tests in classification routes:
  - single retry success
  - bulk retry partial success
  - invalid IDs / empty payload validation
  - idempotent repeated retry call behavior
  - unauthenticated request denied (`401/403`)
  - non-admin authenticated user denied
  - CSRF missing/invalid denied for `POST`
  - read-only API key denied (if route supports API keys)
  - admin/write path allowed

### 2) Service Tests
- Retry/reset service tests:
  - transactional cleanup correctness
  - artifact cleanup coverage
  - dedupe behavior
  - enqueue payload completeness

### 3) Frontend Tests
- Extend Command Center tests:
  - per-item `Retry Classification` button renders and calls API
  - footer `Retry Classification All` renders with multiple pending items
  - busy/disabled states and success/error messages
  - no retry action rendered for unauthorized contexts (if role-aware UI is present)

## Security Regression Checklist (Release Gate)
- Endpoint is mutation-protected and admin-only.
- CSRF validation is enforced and tested.
- No sensitive data exposure in API responses or logs.
- Bulk retry has bounded request size to reduce abuse risk.
- Audit log entries exist for manual retry actions.
- Existing protected routes still pass their auth/CSRF tests after this change.

## Logging and Observability Requirements (Mandatory)

### 1) Structured Log Coverage
- Every retry request must emit structured events with a shared `correlationId`.
- Required fields on all retry logs:
  - `correlationId`
  - `actor` (user id/name if available)
  - `route` (`/api/classification/retry`)
  - `batchSize`
  - `classificationId` (per-item logs)
  - `result` (`queued|skipped|failed`)
  - `reasonCode` (stable machine-readable value)

### 2) Severity Rules
- `info`:
  - retry request accepted
  - per-item retry queued
  - batch summary (queued/skipped/failed counts)
- `warn`:
  - expected recoverable conditions:
    - `not_found`
    - `status_ineligible`
    - `duplicate_pending`
    - `enrichment_cleanup_skipped_no_media_item_link`
- `error`:
  - transaction failures
  - enqueue failures after cleanup attempt
  - unexpected DB/logic exceptions

### 3) Noise Control and Deduping
- Do not log full metadata blobs on success paths.
- Collapse repetitive per-item warnings into summarized batch warning when high volume.
- Keep one final batch summary event per request.

### 4) Redaction and Data Safety
- Never log:
  - webhook secrets/keys/tokens
  - full raw request payload
  - full media metadata JSON
- Log only minimal identifying fields:
  - `classificationId`, `tmdbId` (if present), normalized `title`, `mediaType`.

### 5) Error Log Integration
- For `error` conditions, include stable `reasonCode` and optional `classification_id` mapping.
- Preserve historical RAG/error rows; do not blanket-delete `error_log` entries.
- If old classification ID is replaced, add trace event linking old->new path for diagnostics.

### 6) Operator-Facing Feedback Contract
- API response returns per-item diagnostics:
  - queue result
  - cleanup actions performed
  - reason codes for skips/failures
- UI should present concise summaries:
  - `Queued X, Skipped Y, Failed Z`
  - with expandable detail for failed items only.

### 7) Logging Test Gates
- Route/service tests must assert:
  - `info` emitted for accepted request and summary
  - `warn` emitted for recoverable skip paths
  - `error` emitted for hard failure paths
  - no secret-bearing fields in logger payloads
  - correlation ID continuity across per-item logs in one request

## Pre-Implementation Verification Checklist (Bug Prevention)

### 1) Relational Safety Before Deleting `classification_history`
- Risk:
  - FK references can block delete or leave inconsistent request/webhook records.
- Verification:
  - Confirm behavior against current schema references in `database/schema/current.sql` for:
    - `media_requests.classification_id` (FK to classification_history)
    - `webhook_log.classification_id` (FK to classification_history)
    - `clarification_responses.classification_id`
    - `content_analysis_log.classification_id`
    - `classification_embeddings.classification_id`
    - `embedding_retry_queue.classification_id`
    - `embedding_errors.classification_id`
    - `pattern_match_log.classification_id`
- Fix/Enhancement:
  - In transaction, apply compatibility-safe cleanup order:
    1. `UPDATE media_requests SET classification_id = NULL WHERE classification_id = $1`
    2. `UPDATE webhook_log SET classification_id = NULL WHERE classification_id = $1`
    3. `DELETE FROM clarification_responses WHERE classification_id = $1`
    4. `DELETE FROM content_analysis_log WHERE classification_id = $1`
    5. `DELETE FROM classification_corrections WHERE classification_id = $1` (explicit even if cascade exists)
    6. `DELETE FROM classification_embeddings WHERE classification_id = $1` (or rely on cascade, but explicit is safer across drift)
    7. `DELETE FROM embedding_retry_queue WHERE classification_id = $1`
    8. `DELETE FROM embedding_errors WHERE classification_id = $1`
    9. `DELETE FROM pattern_match_log WHERE classification_id = $1`
    10. `DELETE FROM classification_history WHERE id = $1`
  - Keep this order to avoid environment-to-environment FK drift regressions.

### 2) Atomicity and Data-Loss Protection
- Risk:
  - Item may be deleted but not re-queued if enqueue fails.
- Verification:
  - Simulate enqueue failure in tests and assert rollback leaves original record intact.
- Fix/Enhancement:
  - Wrap per-item reset + enqueue in a single DB transaction.
  - Commit only after `task_queue` insert succeeds.
  - On any error, rollback and return per-item failure result.

### 3) Concurrency and Double-Click/Race Control
- Risk:
  - Multiple retries can enqueue duplicates for the same item.
- Verification:
  - Concurrent retry tests for same ID and overlapping bulk requests.
- Fix/Enhancement:
  - Lock target row (`SELECT ... FOR UPDATE`).
  - Server-side dedupe of incoming `classificationIds`.
  - Pre-enqueue check and cancel/skip existing `pending|processing` classification tasks for same identity key.
  - Return `skipped:duplicate_pending` when applicable.

### 4) Identity Key and Null-TMDB Handling
- Risk:
  - Dedupe logic fails when `tmdb_id` is null, causing duplicate queue entries.
- Verification:
  - Tests for both TMDB and non-TMDB items.
- Fix/Enhancement:
  - Identity priority:
    1. `(tmdb_id, media_type)` when TMDB exists
    2. fallback `(normalized_title, year, media_type)` when TMDB is null
  - Normalize title (trim + lowercase) before identity comparisons.

### 5) Learning Pattern Purge Scope (Selected Line Item)
- Risk:
  - Over-broad purge can remove unrelated learning and degrade classification quality.
- Verification:
  - Tests proving only intended records are removed.
- Fix/Enhancement:
  - If `purgeLearning=true`, remove only:
    - `pattern_type='exact_match'`
    - matching `tmdb_id` + `media_type` of the retried item
  - Do not purge broader heuristic/policy patterns in v1.
  - Keep behavior explicit in API response (`purgedLearning: true/false`).

### 6) Notification/UI Consistency
- Risk:
  - Stale Needs Attention notifications remain after retry.
- Verification:
  - After retry, item should disappear from pending list and stale app notification should no longer point to old classification ID.
- Fix/Enhancement:
  - Delete or mark read `app_notifications` rows where JSON data contains matching `classificationId`.
  - Refresh `pending classifications`, `queue pending`, and `live stats` after retry.

### 7) Request/History Continuity
- Risk:
  - Clearing classification may break request traceability (Overseerr/manual request linkage).
- Verification:
  - Ensure `media_requests` and `webhook_log` rows remain valid after retry and new run links cleanly to new classification.
- Fix/Enhancement:
  - Null old foreign key references before delete.
  - Allow new run to establish fresh `classification_id` linkage naturally.

### 8) Security Hardening Beyond Auth/CSRF
- Risk:
  - Bulk endpoint becomes abuse vector or leaks internals.
- Verification:
  - Negative tests for payload abuse and sensitive-field leakage.
- Fix/Enhancement:
  - Enforce max batch size (e.g., 100 IDs).
  - Reject non-integer IDs and malformed payloads.
  - Return minimal operational errors; keep internal stack traces/log internals server-side.
  - Add correlation ID to audit logs for bulk operations.

### 9) Queue Semantics Under Multi-Request Load
- Risk:
  - Initial multi-request bursts or retry-all operations could reorder or starve tasks.
- Verification:
  - Integration tests for webhook bursts and retry-all batches; assert queue count and ordering semantics.
- Fix/Enhancement:
  - Preserve queue ordering contract: `priority DESC, created_at ASC`.
  - Keep retry source priority consistent with admin/manual expectations (documented value).
  - Ensure enrichment cleanup does not remove unrelated queue rows:
    - only affect rows tied to the resolved `media_item_id` / item identity.

### 10) Backward Compatibility and Safe Rollback
- Risk:
  - If hard-delete path causes unexpected behavior in one environment, rollback is difficult.
- Verification:
  - Include testable fallback strategy.
- Fix/Enhancement:
  - Feature-flag the retry mutation path (`enabled` by default in dev, controlled in prod if needed).
  - Fallback mode option: soft-reset status + enqueue without deleting history (emergency switch only).
  - Document rollback steps in release runbook.

## Detailed Test Gates (Must Pass Before Merge)
- Unit:
  - `[x]` retry service cleanup order
  - `[x]` transactional rollback on enqueue failure
  - `[x]` purge scope correctness for `exact_match`
- Route/security:
  - `[x]` unauthenticated/non-admin/CSRF failures
  - `[x]` valid admin/write-path success and payload validation checks
  - `[x]` payload validation bounds and type checks
- Integration:
  - `[x]` multi-item retry behavior and queue insertion validated
  - `[x]` concurrent retry requests do not duplicate pending tasks (same-item concurrent retry integration test)
- `[x]` webhook burst queueing remains correct after feature introduction
  - `[x]` OMDb/Tavily-linked retry removes item from `enrichment_retry_queue` and clears stale enrichment metadata keys only for that item
  - `[x]` retry does not remove enrichment queue rows for unrelated items
- UI:
  - `[x]` per-item retry and footer `Retry Classification All`
  - `[x]` busy/disabled states prevent duplicate clicks
  - `[~]` post-action refresh behavior is implemented; explicit dedicated regression test is still limited

## Enrichment-Aware Retry Rules (OMDb/Tavily)
- Scope:
  - Applies when retried classification can be mapped to a concrete `media_server_items.id`.
- Required behavior:
  - Item is removed from enrichment retry queue state (`enrichment_retry_queue`) for that media item.
  - Item-specific stale OMDb/Tavily metadata is cleared before re-run.
  - Unrelated items are untouched.
- Safety:
  - If no linked `media_item_id` can be resolved, skip enrichment cleanup and proceed with classification retry (report as `enrichmentCleanupSkipped:no_media_item_link`).
- API visibility:
  - Return per-item cleanup diagnostics so operators can confirm queue/data reset happened as expected.

## Rollout Plan

### Phase 1 - Backend
- `[x]` Add retry endpoint and service logic.
- `[x]` Add server tests.

### Phase 2 - Frontend
- `[x]` Add per-item retry button.
- `[x]` Add `Retry Classification All` in Needs Attention footer next to `Confirm All`.
- `[x]` Add client tests.

### Phase 3 - Validation
- `[x]` Run unit + integration test suites (targeted retry route/service + retry integration + UI tests completed).
- `[ ]` Manual validation on local/docker:
  - `[ ]` retry single item
  - `[ ]` retry all pending items
  - `[ ]` confirm queue progresses and items reclassify cleanly

## Future Scope (Optional Enhancements)

### Phase 4 - Selective Bulk Retry (UI + API)
- Add checkbox selection per Needs Attention item.
- Add footer actions:
  - `Retry Selected`
  - `Clear Selection`
- Keep `Retry Classification All` as the quick action.
- API remains `POST /api/classification/retry` with selected IDs.
- Security impact:
  - unchanged auth/CSRF requirements
  - enforce same payload bounds and dedupe rules
- Migration impact:
  - none expected

### Phase 5 - Dry Run / Impact Preview
- Add preview endpoint:
  - `POST /api/classification/retry/preview`
- Return a non-mutating summary:
  - retry-eligible count
  - skipped reasons (not found, status ineligible, duplicate pending task)
  - estimated queue additions
- Use this to confirm operator intent before large bulk actions.
- Security impact:
  - same admin-only and CSRF protections
  - ensure preview does not expose sensitive metadata fields
- Migration impact:
  - none expected

### Phase 6 - Retry Profile Options
- Add optional retry options in UI:
  - `Purge learned exact-match patterns` (toggle)
  - `Include pending_retry items` (toggle)
  - `Max items per batch` (bounded)
- Persist defaults only if product decides this is needed.
- Security impact:
  - validate all options server-side and ignore unsupported flags
  - retain least-privilege mutation controls
- Migration impact:
  - only if defaults are persisted in DB settings

### Phase 7 - Operator Audit and Traceability UX
- Add Command Center or System audit panel for retry actions:
  - actor
  - timestamp
  - batch size
  - queued/skipped/failed counts
- Keep logs structured and redact sensitive payload fields.
- Security impact:
  - audit visibility should stay admin-only
  - do not expose full request payload or secrets
- Migration impact:
  - none if reading existing logs
  - migration required if introducing a dedicated retry audit table

### Phase 8 - Reliability and Performance Hardening
- Add load tests for:
  - large multi-request intake
  - repeated bulk retries under queue pressure
- Add concurrency guards if production audit signals show duplicate enqueue race windows.
- Add index tuning only if query plans/metrics indicate bottlenecks.
- Security impact:
  - preserve request-size limits and rate controls for mutation routes
- Migration impact:
  - possible index migration(s) if needed by measured workload

## Future Feature Gates
- Optional phases only proceed after:
  - v1 retry flow is stable in production audit signals
  - security regression suite remains green
  - no queue duplication regressions under integration/load tests
- Any optional feature that adds persisted state must include:
  - explicit migration decision
  - rollback plan
  - changelog + docs update

## Final Hardening Checks (Before Implementation Starts)

### 1) Discord Interaction Staleness
- Problem:
  - Existing Discord messages/buttons can reference an old `classification_id` after retry, causing invalid or misleading actions.
- Fix:
  - Mark old classification Discord interactions as stale on retry:
    - update `clarification_status` to terminal stale/cancelled value where applicable.
    - ensure Discord action handlers reject stale classification IDs with explicit user-facing message.
  - If feasible, edit or reply to previous Discord message with "This request was retried; use latest prompt."
- Verification:
  - Retry an item with active Discord prompt and confirm old buttons no longer mutate state.

### 2) Old-to-New Classification Traceability
- Problem:
  - Support/debugging becomes difficult without mapping between replaced and rerun classification records.
- Fix:
  - Emit structured audit event per retried item:
    - `oldClassificationId`
    - `newTaskId`
    - `newClassificationId` (once completed, if available)
    - actor, timestamp, correlation id
  - Include mapping metadata in API response where known.
- Verification:
  - Given an old ID from logs/UI, operators can deterministically find the rerun path.

### 3) Batch Chunking and Transaction Duration Control
- Problem:
  - Large Retry-All calls can hold locks too long and increase timeout/deadlock risk.
- Fix:
  - Process retry-all in server-side chunks (e.g., 25–50 items per chunk).
  - Keep per-item transaction boundaries small and independent.
  - Add overall request guardrail (max IDs per call) plus chunk-level timeout handling.
- Verification:
  - Retry-all with large set completes with stable DB latency and no long-running transaction warnings.

### 4) Endpoint Abuse Protection (Rate Limit + Cooldown)
- Problem:
  - Repeated retry-all calls can flood queue and starve normal workload.
- Fix:
  - Add route-level rate limiting for `POST /api/classification/retry` (admin-scoped but still bounded).
  - Add short server cooldown guard for repeated identical bulk requests from same actor.
- Verification:
  - Rapid repeated calls are throttled predictably and logged with clear reason.

### 5) Controlled Rollout Feature Flag
- Problem:
  - If unexpected behavior appears in production, immediate rollback needs to be low risk.
- Fix:
  - Gate mutation path behind runtime flag (default enabled in dev; configurable for prod).
  - Disabled flag behavior:
    - hide UI retry buttons
    - API returns controlled `503 feature_disabled` response
- Verification:
  - Toggle flag without restart (if runtime settings support it) and confirm behavior switches cleanly.

### 6) Provider-Outage / Missing-Config Scenarios
- Problem:
  - Retry should still clean stale state even when AI, OMDb, or Tavily is unavailable.
- Fix:
  - Decouple cleanup success from enrichment/provider availability.
  - If providers are unavailable:
    - still perform reset + queue insertion
    - return status indicating queued/deferred rather than hard failure where possible
- Verification:
  - Simulate AI offline and OMDb/Tavily unavailable; retry still removes stale queue/data and creates recoverable pending work.

### 7) UI Safety Against Duplicate Operator Actions
- Problem:
  - Double-clicks or overlapping actions can trigger duplicate retry operations.
- Fix:
  - Disable per-item and retry-all controls while in-flight.
  - Add request idempotency key per action burst from UI.
  - Show deterministic toast/summary for partial results.
- Verification:
  - Rapid repeated clicks produce one effective retry action per item.

### 8) Stats and Dashboard Consistency Contract
- Problem:
  - Retry operations can be perceived as count regressions if metrics contract is unclear.
- Fix:
  - Define expected metric behavior:
    - old classification removed from pending list
    - new queue item appears in pending processing
    - history/live-feed reflects rerun as new operational event
  - Document this in release notes and operator docs.
- Verification:
  - Manual validation script confirms expected deltas before/after retry.

### 9) Repair Path for Partial Failures
- Problem:
  - If cleanup succeeds but post-cleanup step fails in unusual edge cases, operators need a deterministic recovery path.
- Fix:
  - Return per-item structured failure reasons and recovery hints.
  - Add admin-only repair endpoint or script (future-safe) for requeueing from old record snapshot if needed.
- Verification:
  - Inject failures in tests and confirm recoverability without manual DB surgery.

### 10) Pre-merge Signoff Matrix
- Required signoffs before merge:
  - Backend: FK-safe cleanup + transaction integrity confirmed
  - Security: auth/CSRF/rate-limit tests green
  - Frontend: duplicate-click protections and refresh behavior verified
  - Ops: feature-flag rollback path validated

## Acceptance Criteria
- `[x]` Needs Attention cards display `Retry Classification`.
- `[x]` Footer shows both `Confirm All` and `Retry Classification All` when multiple items exist.
- `[x]` Retried items are requeued through normal classification flow.
- `[x]` Stale retry-related artifacts are cleaned during retry reset (classification-linked cleanup + enrichment cleanup).
- `[x]` Multi-item retries queue/process correctly in tested scenarios (including same-item concurrent retry and webhook-burst ordering regression coverage).
