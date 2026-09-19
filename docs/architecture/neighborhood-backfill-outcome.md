# Neighborhood-aware backfill: implementation outcome

Date: 2026-09-19. [Design, tradeoffs and official sources](neighborhood-backfill-design.md).

## What changed

Classifarr now automatically prioritizes missing descriptions from underrepresented
groups it previously learned from complete library data. Ordinary missing items
still receive capacity. Failed descriptions retain their due times and provider
outages retain their cooldowns; the user does not need to acknowledge or start a job.

Two small ESM services own private source bindings and expiring group references.
The existing profile worker publishes references only after fresh source checks;
the existing description worker consumes them within its original work budget.
Scheduler lifecycle owns and clears the shared service. No new singleton, schema,
endpoint, UI panel, polling mechanism, model call or routing authority was added.

Only aggregate recovery counts appear in existing scheduler logs. References never
contain source text or vectors, and hashes/memberships are not logged. Existing
SWR/UI behavior is unchanged. The policy score is not increased by this work.

## Fresh local Compose evidence

A read-only check loaded the current inventory and cached vectors from Compose,
built profiles, staged references, re-read the source and verified its fingerprint
and model representation before publication. Synthetic masks changed only
in-memory availability sets; they did not delete or alter stored vectors or media.

| Check | Result |
| --- | --- |
| Inventory scope | 10 movie/TV libraries; 6,652 distinct cached descriptions |
| Valid complete references | 8 libraries; 2 safely use ordinary backfill |
| Missing-group simulation | Smallest group removed in each of 8 libraries: 4 movie, 4 TV |
| Missing descriptions | 432 |
| Correctly identified repair priorities | All 432, with no extra descriptions selected |
| Underrepresented groups | 8 during simulated loss; 0 after restoration |
| Provider calls | 0 embedding and 0 generation calls; model inspection only |
| Data writes | 0 |

The actual running scheduler independently progressed from 0 known references
after startup to 8 on the next backfill pass. All 6,652 cache checkpoints remained
present; it generated zero new embeddings. This verifies automatic wiring, not
just a standalone service invocation. Compose remained healthy with a read-only
root filesystem, and no data volumes were removed.

This is recovery detection evidence, not proof of classification accuracy. The
previous held-out benchmark and its limitations remain applicable. No thresholds
were tuned and no routing model was promoted based on this check.

## Automated verification

- Synthetic regression detects a completely missing minority group while total
  availability is still above 99%.
- Tests cover movie/TV scope, shared/duplicate descriptions, changed text or
  memberships, model/configuration changes, expiry, restart, cancellation, stale
  publication, incomplete fits, support mismatches and redacted summaries.
- Worker tests verify fair fresh-work capacity, unchanged eight-call limits,
  fallback on optional reference failure and automatic recovery after backfill.
- PostgreSQL integration verifies real pgvector expiry, priority planning,
  retained per-item retry delays, due retry recovery and profile reconciliation.
  Both focused integration suites passed: 12 tests.
- Full client suite passed: 368 suites / 5,120 tests. Coverage: 85.61% statements,
  77.56% branches, 85.08% functions and 87.66% lines.
- Full backend suite passed: 1,296 suites / 37,639 tests. Coverage: 90.16%
  statements and lines, 82.65% branches and 92.25% functions.
- Both new services have 100% line/function coverage; recovery branch coverage is
  98.24% and source-binding branch coverage is 94.28%. The queue planner has 100%
  line/function/branch coverage. The combined server/client coverage ratchet passed.
- Full/production dependency checks, server/client type checks, security/test/client
  lint, Markdown, static-import and ESM mock guards passed during implementation.
- [PR #531](pr-531-local-codeql-validation.md) was applied and its workflow
  contracts tested locally, without merging the PR.

Markdown and test lint were repeated after the integration/documentation changes;
`git diff --check` passed. Compose build and health checks passed. All public changes
are intended for one normal commit/push; no private fixture or temporary report is
included. Hosted security workflow results cannot be inferred from local tests.

## Limitations and next high-value item

The two unknown libraries had discarded members in their selected clustering fit;
they were not incomplete or unconverged. This implementation intentionally refuses
to invent a complete assignment from a fit that omits members. Ordinary discovery,
backfill and profile refresh continue for those libraries automatically.

Next: retain validated per-group membership directly from the fit worker, with
discarded/outlier descriptions explicitly separated. That should let valid groups
in these two libraries participate in recovery without mislabeling outliers or
requiring users to declare library purposes. Test it against fresh movie/TV data
and held-out difficult cases before changing classification behavior.

Follow-up: the [outlier-aware recovery outcome](outlier-aware-recovery-outcome.md)
records implementation and verification of that membership-preservation step.

The current reference is process-local and expires after 30 minutes without a
complete validated refresh. Long outages, restarts and changed sources fall back
to ordinary backfill. Durable reference storage is deferred until operational
evidence justifies its retention, migration and stale-data complexity.

## Rollback and release boundary

Rollback is a new commit removing the sidecar wiring and restoring the previous
queue order. Existing validated vector checkpoints and retry journals remain
usable; do not delete them. Revert the four CodeQL pins separately if needed.
No release, tag, database migration or product-version bump is part of this change.
