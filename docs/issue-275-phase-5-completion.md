# Issue 275 Phase 5 Completion

Date: 2026-02-11

## Scope
This document closes Phase 5 in `docs/issue-275-task-list.md`:
- second-pass error taxonomy expansion and deterministic reason-code mapping
- structured second-pass logging contract in `error_log`
- severity discipline (`INFO`/`WARN`/`ERROR`) and dedupe/fingerprint throttling
- trace sanitizer hardening (allowlist/redaction/truncation)
- fail-open logging persistence behavior
- observability query/API compatibility for expanded `error_log` fields

## Implemented Components

### 1) Second-pass taxonomy and reason mapping
- Updated `server/src/utils/ragErrorHandler.mjs`:
  - added second-pass error categories in `RAG_ERROR_TYPES`
  - added `RAG_SECOND_PASS_STAGES` and `RAG_SECOND_PASS_REASON_CODES`
  - added deterministic helpers:
    - `normalizeReasonCode(...)`
    - `normalizeSecondPassStage(...)`
    - `mapSecondPassError(...)`
  - integrated stage-hint categorization for second-pass failure patterns

### 2) Structured logging contract + fail-open persistence
- Reworked `server/src/utils/ragLogger.mjs`:
  - added `logStageEvent(...)` for second-pass event logging
  - contract includes:
    - `classification_id`, `tmdb_id`, `media_type`
    - `stage`, `reason_code`, `rollout_mode`, `strategy`
    - `recoverable`, `fallback_action`, `sql_state`, `correlation_id`
  - enforced severity discipline:
    - skip-by-design -> `INFO`
    - recoverable degradation -> `WARN`
    - actionable failures/non-recoverable -> `ERROR`
  - added fingerprint dedupe for repeated WARN/ERROR events
  - added schema-compat fallback insert path for pre-migration environments
  - logging failures remain fail-open (no classification interruption)

### 3) Classification call-site observability wiring
- Updated `server/src/services/classification.mjs`:
  - stage-error mapping now uses `mapSecondPassError(...)`
  - normalized unsupported internal stages (`strategy`, `retrieval_pass1`) into log-safe stage mapping
  - added `ragLoopLogContext` attachment to second-pass decisions
  - added `persistRagLoopStageEvents(...)` to emit structured stage logs after `classification_id` is known

### 4) Trace sanitizer and compatibility hardening
- Updated `server/src/utils/ragLoopHelpers.mjs`:
  - added trace allowlists and sanitizers for mode/trigger/stage/reason tokens
  - redacts sensitive free-text patterns in trace reason fields
  - preserves versioned trace payload (`trace_version`)
  - enforces deterministic max-event and max-byte truncation behavior
  - keeps legacy-safe behavior for malformed/partial event input

### 5) Logs API compatibility + observability filters
- Updated `server/src/routes/logs.mjs`:
  - list endpoint now supports filters:
    - `stage`/`error_stage`
    - `reasonCode`/`reason_code`
    - `sqlState`/`sql_state`
    - `classificationId`/`classification_id`
    - `correlationId`/`correlation_id`
  - list response includes expanded observability columns:
    - `classification_id`, `error_stage`, `reason_code`, `correlation_id`, `sql_state`, `rag_operation`, `recoverable`
  - export endpoint supports the same expanded filters

## Validation Evidence

### New/updated tests
- Added `server/src/__tests__/ragErrorHandler.test.mjs`
  - deterministic stage/reason normalization
  - SQLSTATE-family reason mapping/recoverability
  - second-pass categorization hints
- Added `server/src/__tests__/ragLogger.test.mjs`
  - structured contract writes
  - severity mapping rules
  - dedupe/fingerprint throttling
  - schema-fallback insert behavior
- Added `server/src/__tests__/logs-routes.test.mjs`
  - expanded filter coverage
  - backward compatibility on logs list response
  - export filtering compatibility
- Updated `server/src/__tests__/ragLoopHelpers.test.mjs`
  - trace allowlist/redaction behavior
  - deterministic event/byte truncation behavior

### Commands executed
- `npm --prefix server run lint:tests` (pass)
- `npm --prefix server test -- ragErrorHandler.test.js ragLogger.test.js ragLoopHelpers.test.js logs-routes.test.js classification.test.js ragRetriever.test.js` (pass)
- `npm --prefix server test` (pass)
- `npm --prefix client test` (pass)
- `npm --prefix server run test:integration` (pass)

## Phase 5 Status
Phase 5 is complete for Issue 275 with passing server/unit/integration coverage and client regression verification.
