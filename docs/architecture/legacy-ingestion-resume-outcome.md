# Legacy import recovery — outcome and verification

## Finding

The local unknown-owner warnings represent unfinished historical import records,
not ownership of the user's media. Read-only inspection found two affected
libraries and eight completed tracked ingestions. Historical sync records cannot
be assigned a made-up current owner: that would hide whether their original
writer could return. Container health and quiet database sessions are not proof
that an external process will remain stopped.

The existing reviewed repair safely records a full replay but leaves the library
disabled. The missing step was an explicit, durable continuation for a library
that is already enabled. The [design](legacy-ingestion-resume-design.md) documents
the decision, official PostgreSQL/W3C sources, alternatives and trade-offs.

## Implemented behavior

- An eligible enabled library offers **Recover and resume import**. An active
  administrator must review the current records and confirm older writers have
  stopped and will remain stopped during recovery.
- One short transaction retires only the reviewed unfinished markers, preserves
  existing inventory and records a full-replay checkpoint with a versioned audit
  receipt. Audit failure rolls everything back.
- The existing watchdog acquires new tracked ownership, replays a full scan,
  preserves inventory through source outages, and hands completed ingestion to
  the existing bounded metadata backfill. Downstream readiness remains gated.
- Recovery changes neither library/source enablement nor routing. Disabled
  libraries retain maintenance-only reconciliation; archived or unconfigured
  libraries cannot request automatic resume. Music remains unsupported.
- Confirmation IDs bind the actor, library, reviewed revision and recovery mode.
  Lost responses can be checked or retried without changing intent. Old receipts
  remain readable. A scheduled receipt is historical evidence of the request,
  not proof that the import or backfill has completed.
- The UI explains ownership in plain language, requires a labeled checkbox and
  announces results through a status region. The preview uses non-persistent SWR;
  no background task, provider call or mutation starts by opening the review.

No new schema, singleton service, scheduler, worker limit or provider is added.
The static ownership review pins the new pure ESM policy and reviewed changes;
its passing result is drift evidence, not proof of compatibility with all old
external writers.

## Verification

Targeted tests pass for Plex/Jellyfin/Emby movie and TV recovery, source outage
and cooldown followed by successful full replay, duplicate/lost confirmation,
changed configuration, active owners, audit rollback, paused enablement and old
receipt compatibility. Existing inventory is retained until complete valid scan
finalization; backfill enqueue is generation-bound and not duplicated.

Real Chromium tests cover the older maintenance contract, keyboard-only enabled
confirmation with exactly one recovery POST and no settings write, status
announcements, unsaved-setting preservation, and mobile bounds at 390 px. The
mobile screenshots were inspected after waiting for the sidebar to close.

Validation on September 28, 2026:

| Check | Result |
| --- | --- |
| Backend unit tests with coverage | 1,526 suites / 46,124 tests passed |
| Real PostgreSQL integration | 192 suites / 2,240 tests passed; one existing opt-in suite/test skipped |
| Frontend with coverage | 403 files / 5,674 tests passed |
| Chromium recovery/progress flows | 3 tests passed |
| Backend and frontend type/lint checks | Passed |
| Frontend production build | Passed |
| Coverage ratchet | Passed without baseline changes |
| Copyright, dependency and ownership preflight | Passed |
| ESM imports/mock shapes and documentation lint | Passed |
| Policy naming/language/delivery/maintenance gates | Passed |

Two initially invalid integration fixtures attempted to create an enabled archived
library and a music library. The schema correctly rejected both. The tests now
use the real archived-disabled invariant and explicitly assert music rejection;
no production constraint was weakened. An optional-request-field regression was
also caught and corrected: omitted `resume` retains the original two-field body.

The isolated fresh-install/published-upgrade drill is recorded separately after
testing the committed source. It is not a live-container deployment.

## PR and operational scope

GitHub MCP searches for open PRs in `cloudbyday90/Classifarr` returned none during
this round. No PR could be selected randomly; no closed PR was substituted or
merged. There is no release or version bump.

The live libraries were not reconciled, enabled/disabled, or redeployed during
this implementation. The previous no-cache deployment remains separate. Applying
this feature to historical live markers still requires a truthful administrator
confirmation; the agent has not made that confirmation for the user.

## Next component

Fence **enrichment persistence**, not just queue acknowledgement. The current
`queueTaskProcessorEnrichment.mjs` writes enrichment and classification history
before its claim-fenced completion call. Revalidate the current task claim in the
same short transaction as local result writes, without holding a transaction
across provider I/O. Preserve existing item/source identity and provider-recovery
fences; do not replace them with the queue token.

Acceptance: pause worker A during a provider call, reclaim with worker B, then
release A. A must not overwrite B's metadata/history or advance readiness, while
B completes normally. Also test cancellation, outage/restart, duplicate delivery,
and movies/TV across supported sources. This closes a separate data-integrity
boundary; it does not claim exactly-once remote effects or automatically prove
that arbitrary legacy database writers have stopped.
