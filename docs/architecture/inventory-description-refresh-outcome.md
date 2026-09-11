# Automatic inventory description refresh — outcome

Implemented locally on September 11, 2026; unreleased. No version bump.

## Delivered

- Added small ESM repository, worker, sync-signal and scheduler modules.
- Extracted one verified embedding-batch writer shared with the existing manual
  retrieval command. Both paths use the same representation checks and lock.
- Added hash-only cache presence lookup. Routine refresh does not load all
  vectors or run the expensive historical comparison sampler.
- Registered automatic startup/periodic refresh and a successful-sync hint.
  Unchanged descriptions reuse existing vectors; interrupted work resumes its
  verified batches. No additional acknowledgement, policy declaration or UI.
- Added cooperative queue/sync admission, bounded batches, configuration
  rechecks, shutdown cancellation and exponential failure cooldown.
- Kept cache cleanup active when RAG is disabled. No cloud inference, model
  download, policy mutation, routing change or external API was added.

The recommendation remains bounded periodic reconciliation with sync hints.
Its benefit is hands-off recovery and coverage of every current inventory
writer. Its tradeoffs are eventual freshness, bounded corpus scans and possible
starvation under sustained foreground work. A durable per-item outbox would
reduce scans at greater scale but adds schema and writer-maintenance complexity.
The [design document](inventory-description-refresh-design.md) records the full
option comparison, recommended stack, official research and date limitations.

## Compose findings and measurements

The first admission check exposed four historical sync records still marked
running, between approximately 20 and 55 days old. Every library had a newer
completed sync. Counting any historical running row would have blocked this
worker forever. Admission now follows the existing queue read model: inspect
the latest sync per library. It also ignores pending retries not yet due,
matching task-queue dequeue timing. No historical records were modified.

The rebuilt service then correctly yielded during a genuine startup sync and
metadata-enrichment work. Once quiet, its scheduled task completed automatically
at `2026-09-11T11:11:04.573Z`:

| Measurement | Result |
| --- | --- |
| Eligible unique descriptions | 6,644 |
| Cached vectors reused | 6,644 |
| New descriptions embedded | 0 |
| Remaining descriptions | 0 |
| Expired rows removed | 0 |
| Separate warm worker invocation | 1,254 ms |

The previous retrieval command took roughly 34 seconds but also ran historical
comparison work. This is not a like-for-like speedup or an accuracy measurement.
It demonstrates that automatic maintenance need not repeat that work.

A separate live database session holding the shared advisory lock caused the
worker to return `already_running`, without duplicate inference. Compose was
rebuilt and health-checked. The build used an uncommitted working tree and did
not claim release/maintenance provenance or publish an image.

After the final admission refinement, the running repository module's SHA-256
matched the workspace file. Automatic refresh completed again at
`2026-09-11T11:14:20.358Z` and `11:16:01.083Z`. A final warm invocation took
1,122 ms and again reused all 6,644 vectors without new embeddings.

## Validation

- Backend unit suite: 1,214 suites / 34,356 tests passed.
- Focused refresh/retrieval/scheduler/sync suite: 8 suites / 111 tests passed.
- Real PostgreSQL/pgvector integration: 3 suites / 11 tests passed, including
  latest-sync supersession, future retry admission, transaction-local timeout
  isolation, cache provenance/expiry and restart checkpoint reuse.
- Client coverage suite: 365 files / 5,035 tests passed. No client source changed.
- Backend lint, server type checking, documentation lint, static ESM import and
  ESM mock-shape checks passed. No schema/API/dependency/workflow change.

The full backend coverage pass also passed all 34,356 tests: statements/lines
89.97%, branches 81.02%, functions 92.09%. The combined server/client coverage
ratchet passed without baseline changes. Client coverage was statements 85.49%,
branches 77.39%, functions 84.98%, lines 87.55%.

The pre-existing production-naming CI gate still reports 26 references above
its zero-reference baseline. Those unrelated production files and the gate were
not changed; this work must not be described as all CI green.

GitHub MCP was queried for all open PRs in `cloudbyday90/Classifarr` twice during
this task. Both queries returned an empty list. There was no open PR to select
randomly or implement; no PR was merged.

## Next high-value component

Use these maintained, description-selected neighbors in live AI candidate
comparison, including contrary examples from competing libraries. Keep item
identity, media type and explicit exclusions authoritative. Do not let a
library's previous incorrect placements become self-confirming truth.

This component makes the index hands-off; it does not yet change the destination
chosen for Deep Water, raise policy scores or prove classification correctness.
That live consumer integration is the next component, not another review form.
