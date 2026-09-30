# AI readiness upgrade backfill — outcome

Date: 2026-09-30. Implements [the design](ai-readiness-upgrade-backfill-design.md).

## Operator behavior

Older installations with **no previous Ollama verification check** automatically
become eligible for the existing strict capability test. Checks run on a
five-minute schedule, with an additional startup check after two minutes. These are scheduling
opportunities, not a promise that a busy or unconfigured installation is ready.

The worker waits for supported inventory, finished ingestion/backfill and local
resource headroom. It does not require RAG, modify libraries, route media or
download a model. A ready result already shown in AI Settings is untouched.

Only the fixed JSON-schema probe can produce verification-ready evidence. An
unavailable model or invalid response records an honest non-ready result. Once
recorded, successful and unsuccessful checks both survive restart without
automatic repetition. Previously failed, expired or model-changed results still
use **Test Ollama Verification** after the operator resolves the cause.

## Concurrency and recovery

- Same-process calls join one in-flight promise; the scheduler owns all timers.
- PostgreSQL session ownership prevents competing automatic model requests.
- Saved endpoint/model identity is pinned to the tested configuration. A settings
  revision/fingerprint change discards the old result.
- The missing-result check is repeated under a settings-row lock: a concurrent
  manual verdict wins, even when the automatic probe returned ready.
- Stop or lease loss prevents subsequent stages. While the process remains
  alive, an in-flight run stays joined through its bounded transport timeout;
  no orphan timeout race. Existing process shutdown may terminate it earlier.
- No row transaction spans model I/O. A lost database write remains discoverable
  on the next sweep. This permits repeated idempotent inference after a crash,
  not exactly-once inference.
- Capability outcome history is best effort. Scheduler aggregates classify the
  sweep as observation; completed sweeps are not proof of model readiness.

No schema migration, new API contract, release or production restart was needed
to implement this change. The new behavior takes effect when this code is deployed.
No live model request was made during validation.

## Validation

Focused validation passed: 21 server suites / 359 tests across resource studies,
readiness, capability behavior, inventory gating and scheduler lifecycle. Two
real-PostgreSQL suites / ten tests cover this backfill and retry co-load.
Specifically, database tests exercise RAG-disabled legacy settings, fresh setup,
ingestion/handoff waits, restart, competing workers, manual-result races,
configuration replacement, failed-probe persistence and rollback on shutdown or
write failure before commit.

Full regression suites passed: 1,555 backend suites / 47,215 tests and 411
frontend files / 5,795 tests. Backend coverage is 90.23% statements/lines,
85.07% branches and 92.03% functions. These are unit-suite coverage results;
the separate PostgreSQL validation above is targeted, not the full integration suite.

The coverage ratchet consumes backend JSON summary and frontend HTML. When
selecting explicit reporters, retain both required formats; frontend JSON alone
does not satisfy the existing gate. Use `--coverage.reporter=html` alongside
`--coverage.reporter=json-summary` for the frontend run. The frontend rerun
passed all 5,795 tests; the final coverage ratchet passed without baseline changes.

Server lint, type checking, dependency checks, ESM static-import/mock-shape gates,
copyright and Markdown checks passed. Ownership inventory review preserves the
existing unresolved writer classifications; passing that gate is not a claim
that all historical writers are compatible.

## Recommendation and next component

Keep the scheduler-owned missing-result approach: it restores missing evidence
without slowing startup or silently trusting a configuration. Its deliberate
trade-off is that sustained ingestion can delay the check and failed checks need
an explicit retest.

The companion resource study exposed repeated metadata-refill demand when an
enabled provider cannot fill its missing metadata. Validate that path against
real provider waits next: unnecessary queued work could also delay this readiness
gate. Do not suppress all backfill to make readiness pass.

Then expose **waiting for import**, **checking**, and **needs a retest** with one
clear next action in the existing AI readiness card. A durable retry budget for
transient failures remains separate—not an endless five-minute model retry loop
or a weakened verification gate.
