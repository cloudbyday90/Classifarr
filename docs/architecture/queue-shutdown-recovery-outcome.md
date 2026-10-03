# Queue Shutdown Recovery Results

Reviewed: 2026-10-03. No release or version bump.

## Outcome

One failed shutdown release no longer skips every remaining tracked queue claim.
The regression test reproduced that failure before the fix and passed afterward.
The new ESM helper snapshots the tracked set, attempts releases sequentially and
reports failures without exposing database errors. Existing claim tokens, retry
budgets, resource limits and shutdown deadlines are unchanged.

| Real-image case | Before restart | Replay and stale writes |
| --- | --- | --- |
| Graceful stop, 60-second host deadline | Exit 0; clean database; tracked claims released | Two fresh tokens; old writes rejected |
| Frozen app, 10-second host deadline | Exit 137; database crash recovery required; unexpired claims retained | Two fresh tokens after expiry; old writes rejected |

Both cases completed one synthetic metadata effect through the production
transactional write session. Old completion, failure, release and metadata writes
were rejected while the replacement was processing and after it completed. The
graceful case also checked rejection while released tasks were still pending.
Attempts stayed at zero; the committed sentinel survived. This checks queue
acknowledgement for classification, not exactly-once external actions.

The forced-kill fixture initially allowed only 30 seconds for replay. Metadata
reclaimed promptly, but classification correctly waited for the existing
60-second recovery sweep. The fixture now allows 90 seconds for claims and
120 seconds for held replacement work. Production timing was not changed and
the sweeper was not invoked manually to make the test pass.

## Test image and isolation

Both cases used `classifarr:queue-recovery-check`, pinned to
`sha256:e8572a4e14ae704ae5a65a4801fe7ae21645a8918e21adbc474a2905a9c8285c`.
The local test image layers the two changed runtime service files over the
previous tested `classifarr:pg-lifecycle-check` image. It is not a fresh full
release build. CI runs the same rehearsal against its newly built candidate.

Fixtures are mounted read-only and arm only after normal startup in an empty,
isolated installation. Synthetic handlers replace provider work only; actual
queue selection, CPU/memory admission, token checks and metadata transaction
guards remain active. No external provider, live media, host data mount, Docker
socket or privileged container is used. Each container is limited to 2 CPUs,
2 GiB memory and 128 PIDs. Generated containers and volumes are removed by exact
name and ownership label; disposable test data is intentionally discarded.

Live Classifarr, its data and other installed containers were not restarted or
changed. Existing Compose and Unraid templates need no changes for this fix.

## Validation

- Focused backend regression: 202 tests in seven suites passed.
- Live PostgreSQL claim-fencing integration: all nine tests passed.
- Full frontend coverage: 5,912 tests in 416 files passed. The production build
  and all 28 tooling dependency tests also passed.
- Both queue stop/restart cases passed, including exact generated-resource cleanup.
- All four existing HTTP/maintenance loaded-shutdown cases passed on the same
  image, preserving their 10-/60-second and clean-/forced-stop expectations.
- Static ownership review includes the new isolated SQL test adapter. Passing
  this gate means no unreviewed drift, not that existing shared-writer debt is
  resolved or legacy ownership can be assumed.
- Repository lint, backend/frontend type checks, both backend Knip modes,
  copyright, ESM import/mock-shape checks, syntax and diff whitespace passed.
  Markdown lint checked 1,779 documents with zero errors.
- Full backend coverage: 49,915 tests in 1,634 suites passed. One existing
  Linux-only directory-fsync test is skipped on Windows and remains enabled in
  Linux CI. The new release helper has 100% statement/branch/function coverage.
- The combined coverage ratchet passed with current reports from both suites.
  Backend line/branch coverage is 90.05%/85.45%; frontend is 88.09%/78.92%.
  No threshold, assertion or platform condition was relaxed.

GitHub MCP and the saved GitHub CLI login returned zero open Classifarr PRs.
There was no PR to randomly select or implement. None was merged.

## Recommendation and next work

Adopt the [design's recommendation stack](queue-shutdown-recovery-design.md):
token-fenced claims, independent release attempts, expiry-based reclaim,
transactional metadata effects, and real-image stale-write tests.

Benefit: a single failed release no longer delays unrelated claims, and recovery
has process-level evidence. Cost: additional Docker/CI time; a slow or failed
write can still wait for expiry. This does not provide exactly-once execution.

Next: **external-action idempotency during classification retries**. Audit the
window between a successful Radarr/Sonarr request and the local acknowledgement;
test interrupted responses and replay against deterministic fake providers.
The current routing adapters already check provider IDs before adding; failed
lookups fall through to an add, and the provider clients treat HTTP 409 as
already-existing. Verify identity and destination after ambiguous responses
before treating them as successful recovery. Prefer existing durable receipts
and provider checks before adding a new outbox or schema. Native ARM64 and
same-image release-load acceptance remain separate release gates.

Follow-up: [bounded Radarr/Sonarr add reconciliation](arr-add-reconciliation-outcome.md)
implements the provider identity/destination checks and interrupted-response tests
described above, without adding a new outbox or broadening queue retry authority.
