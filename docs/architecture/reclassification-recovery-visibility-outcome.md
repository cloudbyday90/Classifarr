# Reclassification recovery visibility outcome

Date: 2026-09-24. Unreleased; no version bump, tag, release or deployment.

## Delivered behavior

- Exact batch-to-operation references are persisted before filesystem work.
  Failure to bind an eligible batch item rolls back a new reservation.
- Recovery atomically completes the matching batch attempt with journal,
  classification history and correction evidence. Another attempt cannot be
  marked successful merely because its classification or destination matches.
- Progress, list and detail APIs derive counts from current item outcomes.
  Repeated skips, retries and recovered failures no longer inflate displayed
  counts. Existing stored counters remain legacy bookkeeping, not read authority.
- Paused and cancelled batches stay stopped. Claims check current item and batch
  state; late success/failure handlers cannot overwrite a skipped/cancelled item.
  Finishing previously admitted work is not permission to start another move.
- Batch SWR polling continues while a completed/cancelled batch still has a
  recoverable move. Reads are deduplicated, visible-tab only and memory-only;
  errors are shown, responses for another batch are ignored, and unmount stops
  polling. Reopening the modal revalidates it.
- Paused batches with no work remaining offer Close, not a redundant Resume.
  Keyboard-accessible details retain the operation reference. One compact live
  status message announces counts; individual rows do not repeatedly announce.
- History list/detail expose safe recovery summaries separately from confidence.
  History is a snapshot refreshed by its existing page loads and batch updates,
  not an independently polling activity monitor. Recovery never changes the
  classification confidence score.
- API reads do not initiate recovery or access media providers. New recovery
  objects contain no private journal plans, file paths or credentials.

## Persistence and compatibility

Existing JSONB result fields hold the exact operation reference and compact
completion receipt; no schema change is necessary. Standalone moves continue
to work when lazily created batch tables do not yet exist. The journal retains
its existing 30-day completed-operation policy; a completed batch receipt stays
with the batch after journal detail expires. No existing logs are deleted.

Legacy failed batch items without a durable reference are not guessed/backfilled
from title, destination or error text. A deliberate retry can bind an unresolved
operation before checking its evidence. Skipping/cancelling remaining batch work
does not undo a move which already started.

## Local verification

Targeted backend tests: 8 suites / 99 tests passed. Recovery integration tests:
3 suites / 39 tests passed with isolated PostgreSQL and synthetic providers.
Focused frontend tests: 4 files / 66 tests passed. Full client coverage:
379 files / 5,264 tests passed; production build and type checks passed.

The Chromium browser test traverses History, batch creation, validation,
interruption, recovery, keyboard expansion and the finished paused state.
All API calls are intercepted with synthetic fixtures; it asserts no automatic
resume/retry writes. Its screenshot was visually inspected.

Full backend coverage: 1,416 suites / 41,572 tests passed. Full integration:
155 suites / 1,763 tests passed, with one existing suite/test skipped. The final
focused tests above cover the later small UI/cache-control edits and additional
unit cases. Both coverage ratchets pass: server lines 90.33%, branches 83.94%;
client lines 87.74%, branches 77.66%. Lint, ESM checks, copyright, dependency
checks, migration/snapshot integrity, Markdown and RAG API documentation checks
pass. The only pre-existing lint warning is the non-literal file path in
`captureOperatorCorrectionFrozenPolicy.mjs`.

## PR availability

GitHub MCP search of open pull requests in `cloudbyday90/Classifarr` returned an
empty list. No random PR could be selected; no closed PR was substituted or
merged.

## Next high-value component

Build a restart-safe batch coordinator using the existing database/queue
infrastructure. Individual admitted moves now recover, but the request-owned
batch loop has no durable worker lease/cursor for its remaining items after a
process restart. Resume only batches intentionally left running; preserve
pause/cancel and bound concurrency. Test crashes before claim, after admission,
after file work and before acknowledgement with both movies and TV shows.

Do not add another dashboard or approval gate before this execution gap is
closed. This makes existing automation dependable instead of adding operator
work. See the [design and trade-offs](reclassification-recovery-visibility-design.md).
