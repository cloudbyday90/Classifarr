# Issue RAG/AI Resilience Best Practices Log

Related implementation plan: `docs/implementation_plan_rag_ai_resilience_and_command_center_consistency.md`  
Related task list: `docs/issue-rag-ai-resilience-task-list.md`

## Purpose
Track online best-practice and official documentation references used to justify implementation decisions for:
- AI response contract enforcement
- Streaming timeout/partial-result handling
- RAG retrieval resilience and reason-code taxonomy
- Stage-event deduplication and metrics parity
- Progress-phase skipped-state UI semantics
- pgvector indexing/query optimization

## Citation Requirements
For each source, include:
1. URL
2. Publisher/owner
3. Publication or last-updated date (if available)
4. Why this source is relevant
5. Decision mapping (which plan section/task it informs)
6. Adopted guidance vs rejected guidance

## Source Categories (Required)
1. AI provider/runtime official docs used by Classifarr.
2. Structured output / response contract enforcement patterns.
3. Streaming generation timeout/cancellation best practices.
4. PostgreSQL + pgvector official docs for HNSW/vector indexing.
5. Logging dedupe/event fingerprinting and observability parity practices.
6. UI process-step semantics for skipped vs pending states.

## Findings Log
Use one section per finding.

### BP-001
- Source: https://docs.ollama.com/capabilities/structured-outputs
- Type: Official docs (Ollama)
- Date: Accessed 2026-02-18 (last-updated not published on page)
- Summary: Ollama supports structured outputs with JSON mode and JSON schema in `format`; docs recommend schema-first validation and lower temperature for deterministic output.
- Decision mapping: Phase 1 parser contract hardening and repair flow (`classify`/`verify` strict format requirements).
- Adopted: Keep deterministic output contract, require strict local validation after model output, and prefer low temperature for repair attempts.
- Rejected alternative (if any): Prompt-only free-text conformance without schema/validation.

### BP-002
- Source: https://docs.ollama.com/api/chat and https://docs.ollama.com/api/streaming
- Type: Official docs (Ollama API reference)
- Date: Accessed 2026-02-18 (last-updated not published on pages)
- Summary: Chat endpoint defaults to `stream=true`; streamed responses are NDJSON with `done`/`done_reason`; non-streaming (`stream:false`) is simpler and recommended for structured outputs in some cases.
- Decision mapping: Phase 1 streaming guard, partial-stream protection, completion-only parse gating.
- Adopted: Parse only finalized payloads (`done=true` equivalent completion semantics); treat partial stream chunks as non-authoritative for final classification parse.
- Rejected alternative (if any): Parsing intermediate partial stream chunks as final classification output.

### BP-003
- Source: https://developers.openai.com/api/docs/guides/structured-outputs
- Type: Official docs (OpenAI)
- Date: Accessed 2026-02-18 (last-updated not published on page)
- Summary: Structured Outputs supports `response_format` JSON schema with `strict: true`; schema design and validation are explicit requirements.
- Decision mapping: Phase 1 mode-aware contract enforcement and parser diagnostics (`contract_version`).
- Adopted: Provider-specific strict schema mode where supported; keep local validator as final gate.
- Rejected alternative (if any): JSON mode-only behavior without schema strictness.

### BP-004
- Source: https://developers.openai.com/api/reference/resources/responses/methods/create
- Type: Official API reference (OpenAI)
- Date: Accessed 2026-02-18 (last-updated not published on page)
- Summary: Streaming emits explicit lifecycle events (`response.output_text.delta`, `response.completed`) and status transitions.
- Decision mapping: Phase 1 stream timeout/abort handling and parse finalization policy.
- Adopted: Final parse attempted only once response completion signal is reached; incomplete streams route to transient error path.
- Rejected alternative (if any): Accepting latest available delta text at timeout as final parse candidate.

### BP-005
- Source: https://ai.google.dev/gemini-api/docs/structured-output
- Type: Official docs (Google Gemini API)
- Date: Last updated 2026-02-11 UTC
- Summary: Gemini structured output uses `response_mime_type=application/json` + `response_json_schema`; supports schema subset; values still need application-side semantic validation.
- Decision mapping: Phase 1 provider adapter behavior and post-parse validation; Phase 2 failure classification for schema incompatibility.
- Adopted: Validate semantics after syntactic schema conformance; keep schema subset constraints explicit in provider adapters.
- Rejected alternative (if any): Assuming schema-conformant output is always semantically valid.

### BP-006
- Source: https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/increase-consistency
- Type: Official docs (Anthropic Claude)
- Date: Accessed 2026-02-18 (last-updated not published on page)
- Summary: For guaranteed JSON schema conformance, use structured outputs; prefill technique is deprecated for newer models.
- Decision mapping: Phase 1 output consistency strategy (contract-first vs prompt tricks).
- Adopted: Prioritize structured-output features and explicit schema contracts over prefill formatting hacks.
- Rejected alternative (if any): Prefill-based enforcement as primary format control strategy.

### BP-007
- Source: https://github.com/openai/openai-node and https://github.com/openai/openai-python
- Type: Official SDK docs (OpenAI)
- Date: Accessed 2026-02-18
- Summary: SDK defaults include bounded retries (2), retryable classes (connection/408/409/429/5xx), and long default timeouts (10 minutes).
- Decision mapping: Phase 1 and Phase 2 timeout/retry budgets and rollback safety limits.
- Adopted: Explicitly set stricter runtime timeout and retry policy in classification/retrieval paths instead of relying on broad SDK defaults.
- Rejected alternative (if any): Using default 10-minute timeout behavior in latency-sensitive queue processing.

### BP-008
- Source: https://developers.openai.com/api/docs/guides/rate-limits
- Type: Official docs (OpenAI)
- Date: Accessed 2026-02-18
- Summary: Recommends random exponential backoff with jitter; retry storms can worsen limits; rate-limit headers provide reset/remaining signals.
- Decision mapping: Phase 2 bounded retries and retry telemetry, Phase 5 rollout monitoring.
- Adopted: Jittered exponential backoff with cap and retry budget accounting in reason codes.
- Rejected alternative (if any): Fixed-delay retries without jitter or limit-header awareness.

### BP-009
- Source: https://github.com/pgvector/pgvector
- Type: Official project docs (pgvector)
- Date: Accessed 2026-02-18
- Summary: HNSW index guidance for cosine ops and tuning (`m`, `ef_construction`, `hnsw.ef_search`); docs call out iterative scans in 0.8.0+.
- Decision mapping: Phase 2 missing text HNSW remediation and retrieval quality/performance tuning.
- Adopted: Add idempotent text HNSW index check/fix and preserve tunable search parameters for low-signal retries.
- Rejected alternative (if any): Deferring text index remediation despite confirmed missing index.

### BP-010
- Source: https://www.postgresql.org/docs/current/sql-createindex.html
- Type: Official docs (PostgreSQL)
- Date: Accessed 2026-02-18
- Summary: `CREATE INDEX CONCURRENTLY` avoids write lockout in production but has caveats (longer build, invalid-index leftovers on failure, cannot run in transaction block).
- Decision mapping: Phase 2 migration strategy for index creation in live systems.
- Adopted: Use concurrent index build strategy with post-checks for invalid indexes.
- Rejected alternative (if any): Blocking index creation in production traffic window.

### BP-011
- Source: https://www.postgresql.org/docs/current/using-explain.html and https://www.postgresql.org/docs/current/indexes-partial.html
- Type: Official docs (PostgreSQL)
- Date: Accessed 2026-02-18
- Summary: EXPLAIN is required to validate planner behavior; partial indexes are useful for targeted subsets but require predicate/query alignment.
- Decision mapping: Phase 2/5 verification evidence for index impact and conservative partial-index use.
- Adopted: Require EXPLAIN-based verification in rollout validation; keep partial-index use constrained to proven workload patterns.
- Rejected alternative (if any): Introducing multiple speculative partial indexes without workload evidence.

### BP-012
- Source: https://opentelemetry.io/docs/specs/otel/logs/data-model/ and https://opentelemetry.io/docs/specs/semconv/general/recording-errors/
- Type: Official specification docs (OpenTelemetry)
- Date: Accessed 2026-02-18
- Summary: Log records should carry consistent severity/context fields; `EventName` should identify event class; errors handled/retried should not be recorded as operation failures; `error.type` should align across spans and metrics.
- Decision mapping: Phase 3 dedupe/event identity and metrics parity contracts.
- Adopted: Canonical single-write stage events with stable event identity fields and consistent error typing between logs and metrics.
- Rejected alternative (if any): Counting handled retry events as terminal failures in metrics.

### BP-013
- Source: https://docs.datadoghq.com/observability_pipelines/processors/dedupe/ and https://www.elastic.co/docs/reference/fleet/fingerprint-processor
- Type: Official vendor docs (Datadog, Elastic)
- Date: Accessed 2026-02-18
- Summary: Production pipelines commonly dedupe repeated logs by matching/fingerprinting selected stable fields.
- Decision mapping: Phase 3 duplicate `RAG`/`RAGLogger` elimination strategy.
- Adopted: Maintain a deterministic stage fingerprint (`module|stage|reason_code|correlation_id`) and suppress duplicate DB writes.
- Rejected alternative (if any): Message-text-only dedupe keys without stage/context fields.

### BP-014
- Source: https://mui.com/material-ui/react-stepper/ and https://carbondesignsystem.com/components/progress-indicator/usage/
- Type: Official design system docs (MUI, Carbon)
- Date: Accessed 2026-02-18
- Summary: Multi-step UI should distinguish current/completed/not-started/error/disabled states; optional/skipped steps must be explicitly marked as not completed when bypassed.
- Decision mapping: Phase 4 `signal_combine` skipped-state rendering and truthful progression semantics.
- Adopted: Add explicit `skipped` status and distinct styling/labels, separate from `pending` and `completed`.
- Rejected alternative (if any): Showing skipped steps as pending/inactive without semantic distinction.

## Phase 0.5 Re-baseline Matrix Template (Required)
Use this matrix after Phase 0 research to drive updates in:
- `docs/implementation_plan_rag_ai_resilience_and_command_center_consistency.md`
- `docs/issue-rag-ai-resilience-task-list.md`

Instructions:
1. Add one row per high-impact finding.
2. Mark whether the finding changes scope, sequence, criteria, or rollout.
3. Record exact downstream phases impacted (Phase 1-5).
4. Document plan/task edits made, or rejection rationale.
5. Do not start Phase 1+ until all `Status` values are `Integrated` or `Rejected (documented)`.

| Finding ID | Finding Summary | Source URL | Impact Type (Scope/Sequence/Criteria/Rollout) | Impacted Phases | Plan Updates Required | Task List Updates Required | Decision (Adopt/Reject) | Rationale | Status |
|---|---|---|---|---|---|---|---|---|---|
| BP-001 | Ollama supports JSON/schema-constrained output and local validation patterns | https://docs.ollama.com/capabilities/structured-outputs | Scope, Criteria | 1 | Keep strict contract + validator and repair constraints | Add explicit contract checks and validation tests | Adopt | Matches parser-hardening objective and current architecture | Integrated |
| BP-002 | Stream is default; done/done_reason and non-streaming tradeoffs are explicit | https://docs.ollama.com/api/streaming | Scope, Criteria, Rollout | 1 | Parse only finalized responses, guard partial stream use | Add timeout/abort routing and completion-only parse checks | Adopt | Directly addresses malformed parse from partial/incomplete outputs | Integrated |
| BP-005 | Gemini structured outputs require schema subset and post-parse semantic validation | https://ai.google.dev/gemini-api/docs/structured-output | Scope, Criteria | 1,2 | Add provider adapter constraints + semantic validation | Add tests for schema subset and semantic validation failures | Adopt | Prevents false confidence in syntactic-only compliance | Integrated |
| BP-009 | pgvector HNSW and 0.8.0 iterative scan guidance supports missing-index remediation | https://github.com/pgvector/pgvector | Scope, Sequence | 2 | Add idempotent text HNSW migration/check and retrieval verification | Add index presence and EXPLAIN verification tasks | Adopt | Evidence aligns with missing `idx_embeddings_hnsw` in incident env | Integrated |
| BP-010 | PostgreSQL concurrent index build is safer for live writes with known caveats | https://www.postgresql.org/docs/current/sql-createindex.html | Rollout, Criteria | 2,5 | Use concurrent build + invalid-index post-check | Add migration guardrails and rollback notes | Adopt | Reduces production lock risk | Integrated |
| BP-012 | OTel requires consistent event identity and excludes handled/retried errors from failure metrics | https://opentelemetry.io/docs/specs/semconv/general/recording-errors/ | Scope, Criteria | 3 | Canonical event typing and parity logic | Add parity checks and retry-handled exclusion tests | Adopt | Resolves current stage-log vs metrics mismatch | Integrated |
| BP-013 | Fingerprint-based dedupe patterns are standard in log pipelines | https://www.elastic.co/docs/reference/fleet/fingerprint-processor | Scope | 3 | Define deterministic stage fingerprint and single DB write | Add dedupe tests using fingerprint key | Adopt | Directly addresses duplicate `RAG`/`RAGLogger` rows | Integrated |
| BP-014 | Stepper/progress UIs require explicit state semantics for bypassed/optional steps | https://mui.com/material-ui/react-stepper/ | Scope, Criteria | 4 | Add `skipped` state in backend/UI contract | Add skipped-state rendering tests | Adopt | Eliminates misleading pending `signal_combine` display | Integrated |

## Phase 0.5 Delta Summary Template
Fill this in after the matrix is complete.

- Added phases/steps:
- Added explicit source-backed requirements for parser strictness, stream completion gating, index rollout safety, observability parity, and skipped-state UI.
- Modified phases/steps:
- Phase 1 acceptance now enforces measurable parser outcomes and contract diagnostics versioning.
- Phase 2 now explicitly requires concurrent-safe index remediation and EXPLAIN-based verification.
- Phase 3 now explicitly enforces canonical event identity + dedupe fingerprint policy.
- Phase 4 now explicitly requires skipped-state semantics distinct from pending/completed.
- Removed phases/steps:
- None.
- Updated acceptance/verification criteria:
- Added source-backed thresholds and validation requirements for parser, retrieval indexing, and parity contracts.
- Updated risks/mitigations:
- Added migration-risk mitigation from PostgreSQL concurrent index guidance.
- Added observability parity mitigation from OTel error semantics.
- Updated feature-flag/rollout decisions:
- Reinforced staged enablement and rollback based on parser and latency indicators.
- Rejected recommendations and why:
- Rejected prompt-only formatting controls without schema validation (insufficient determinism).
- Rejected prefill-first consistency strategy (deprecated guidance and weak guarantees).

## Decision Summary
After findings are complete, summarize final decisions:
1. AI contract handling:
- Use provider-native structured output features where available; enforce local strict validation and parser contract versioning.
2. Streaming partial/timeout handling:
- Parse only finalized outputs; route timeout/abort as transient handling paths; never treat partial deltas as final classification content.
3. Retrieval reason-code taxonomy:
- Preserve granular cause codes (timeout/provider/db/embed/aborted) and avoid collapsing into generic failures.
4. Log dedupe strategy:
- Canonicalize stage-event DB persistence and dedupe via deterministic fingerprint fields.
5. Metrics parity strategy:
- Align logs and metrics on consistent `error.type` semantics; exclude handled/retried outcomes from terminal failure counters.
6. `signal_combine` skipped-state behavior:
- Add explicit skipped status and distinguish it from pending/completed in backend contract and UI stepper.
7. pgvector index strategy:
- Add/verify missing text HNSW index with concurrent-safe migration and EXPLAIN-backed query-plan validation.

## Open Questions
- Q1: Should provider-specific structured-output mode be hard-required per provider or soft-fallback with repair path?
- Q2: What retry budget/latency cap should be globally enforced for pass1/pass2 in production defaults?
- Q3: Should dedupe fingerprint include `classification_id` in addition to `correlation_id` for cross-run aggregation behavior?
