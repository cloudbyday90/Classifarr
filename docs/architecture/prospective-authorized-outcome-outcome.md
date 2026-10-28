# Prospective authorized-outcome integration outcome

Date: 2026-10-28. Status: both scope decisions explicitly confirmed and runtime
implementation completed according to the
[design](prospective-authorized-outcome-design.md).

## Established facts

Two read-only investigations and parent inspection found the prospective path is
a private CLI with existing repeatable-read bounds and frozen ranking formulas.
It misses canonical authorized snapshots, filters unavailable correction targets
too early and currently assigns mixed action kinds to correction by precedence.

The new material finding is that the old ranking payload does not persist typed
item identity. Its WeakMap check precedes asynchronous persistence preparation;
the co-saved original destination identity is built afterward. Matching either
current history or that sibling cannot independently establish what was ranked.

The second finding is that frozen legacy feedback snapshots lack action kind.
Their mutable flag compares selection with the shortlist leader, not necessarily
the original destination or explicit action. Inferring a confirmation from it
would introduce another semantic mismatch into the new cohorts.

## Implemented result

New `inventory_description_company_shadow_v2` captures freeze `identityKey` at
mint time. Persistence rechecks the original held object after asynchronous
preparation, omits a mismatched diagnostic and records its existing fixed reason
without replacing the capture or changing classification.

Small modules separate typed capture identity, exact BIGINT/time values, legacy
SQL, observation adaptation and connected holdouts. The prospective repository
materializes the existing canonical projection once. Full provenance survives
validation and event deduplication before the observation sentinel. Retained
correction snapshots require exact class proof; legacy feedback remains
unknown-kind. Missing/unverified evidence cannot be overridden by a favorable
observation. Unavailable contradictions and mixed kinds remain excluded.

Structurally valid old captures keep exclusion hashes/aliases but cannot acquire
scorable identity from history. Connected groups are planned before grading and
reserve the earliest comparison. Even the bounded overflow sentinel contributes
validated exclusion aliases; it cannot score or release a later favorable retry.
Reports expose explicit gap counters and fixed identity/legacy/placement limits.

Retained correction snapshots can remain useful when exact classification and
typed identity are independently established. Legacy feedback action provenance
is a candidate for the following bounded writer upgrade; this batch should not
manufacture it retrospectively.

No migration or public API change was needed. Ranking weights, numerical choices,
provider calls, activity semantics, learning and routing remain unchanged. No live
UnRaid database query/mutation, provider call, release or deployment was performed.
The independent [PR #570 outcome](client-tooling-pr570-outcome.md) records its
separate local dependency implementation and validation.

## Verification

- Broad backend regression: 198 suites and 2,866 tests passed.
- Final focused capture, persistence, prospective/activity and CLI regression:
  six suites and 136 tests passed.
- Complete backend coverage: 1,884 suites passed, 60,639 tests passed and one test
  was skipped; 1,016.087 seconds on this host. This is test duration, not an
  application benchmark. Coverage is 89.20% statements/lines, 86.48% branches and
  90.76% functions. No skip, timeout or assertion was relaxed.
- The final held-capture fixture was strengthened with a valid replacement for
  the changed identity; all 62 persistence tests passed. The implementation still
  drops the original mismatched capture instead of accepting that replacement.
- Disposable PostgreSQL regression: five suites and 65 tests passed, covering
  canonical-only choices, exact class/typed identity, retained event/context
  bindings, missing/unknown legacy evidence, alias deduplication before caps,
  expiry and event chronology, unavailable contradictions and BIGINT identity.
  The subsequent final sentinel/SQL suite passed all 18 tests.
- Source/test ESLint, TypeScript, both Knip modes and the existing inventory
  ownership gate passed. Static imports, ESM mock shapes, migration/schema
  integrity, Markdown, copyright, whitespace and redacted staged secret checks
  passed. The coverage ratchet uses fresh backend and frontend reports and passed
  without changing its baseline. Runs overlap and are not unique-test totals.

The initial new database fixture omitted a destination required by the existing
completed-history constraint. A later manual-receipt fixture rounded PostgreSQL
microseconds through a JavaScript Date. Both fixtures were corrected; constraints
and exact event bindings were retained. Review then found and fixed overflow
holdout release and BIGINT JSON rounding, with dedicated regressions. An additional
overflow bridge case ensures all bounded sentinel aliases remain exclusions.

## Modernization and next item

The user subsequently asked about backfill and automating placement-informed
learning. The separate [automation design](placement-informed-automation-design.md)
and [investigation outcome](placement-informed-automation-outcome.md) distinguish
current conventions from historical proof. Normal operator actions already feed
prospective capture automatically; this commit does not add a live recovery job.
The next bounded recommendation is an automated, read-only gap audit before any
historical import or ranking promotion. Frozen action/reference capture for
legacy feedback is the next identified writer gap.
