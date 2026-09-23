# Prospective inventory ranking: outcome

Date: 2026-09-22. Implements the [design and recommendation stack](prospective-inventory-ranking-design.md).

## Implemented

Fixed the preceding benchmark's placement bias: a correction awaiting a move or
sync remains eligible, and a contradictory destination is not hidden merely
because it is absent from current inventory.

Added an automatic, in-process capture at the existing complete description
comparison. The frozen description/metadata and company-assisted experimental
rankings are saved with the classification, using a typed-identity-bound receipt.
It adds no provider calls and does not alter policy scores, prompts, route
authorization, retry decisions, or library eligibility. No new acknowledgement
or review card is required.

Small ESM modules separate capture/validation, the read-only SQL query, and delayed
outcome aggregation. The existing CLI supports both its historical grouped
benchmark and the new prospective mode. No schema migration is required.

```text
node server/src/scripts/runInventoryOutcomeCalibration.mjs --prospective
```

Optional ISO timestamps `--since` and `--until` fix the capture window. The report
also records the later outcome cutoff. Prospective mode rejects retrospective
`--seed`, `--size`, or `--folds` flags rather than silently ignoring them. It
requires the existing configured database and defaults to the last 30 days.
No eligible observations means `awaiting_eligible_outcomes`, not zero accuracy.

Selected [open PR #545](https://github.com/cloudbyday90/Classifarr/pull/545) randomly
from the available not-yet-applied PRs. Applied its client ESLint 10.11.0 and Node
type-definition 26.6.2 changes locally, preserving other dependencies. No PR merge,
application version bump, release, deployment, or Node runtime change was made.

## Verification

The final focused unit run passed seven suites / 146 tests, including malformed evidence,
missing companies, tie abstention, capture immutability, cross-item/copy rejection,
live evaluation propagation, persistence, delayed labels, contradictory choices,
retry/synopsis deduplication, correction-before-placement, output redaction, and
CLI bounds/cleanup. The focused real PostgreSQL suite passed both tests. It verifies
exact-event feedback joins, rejection of older feedback, manual corrections
without a current-placement requirement, and actual view eligibility.

The first database run exposed millisecond truncation from `Date.parse(Date)`.
The evaluator now uses `Date.getTime()` for PostgreSQL date values. A dedicated
regression and the SQL integration test verify that valid captures survive.

The broad backend run also caught a shared-path regression: offline replay began
including a changing live-capture timestamp. Offline preparation now explicitly
disables capture; its deterministic comparisons remain intact. Live capture stays
enabled by default and has separate propagation/persistence assertions.

The final full backend coverage run passed 1,382 suites / 40,567 tests. Fresh
coverage was 90.36% statements/lines, 83.78% branches and 92.51% functions. The
client coverage run passed all 371 files / 5,173 tests, with 85.62% statements,
77.60% branches, 85.12% functions and 87.69% lines. The coverage ratchet passed;
no baseline was lowered. These repository totals are not evidence of live model
accuracy, and changes from the historical ratchet baseline are not attributable
to this patch alone.

The final full PostgreSQL integration run passed 147 suites / 1,704 tests. One
existing opt-in provider-fault suite/test remained skipped; no skip or waiver was
added. The result artifacts remain local under ignored `.tmp/`.

Client clean installation with lifecycle scripts disabled reported zero
vulnerabilities. Client lint and production build passed. Server lint, typecheck,
and both dependency-usage gates passed. Markdown lint, copyright, npm CLI flags,
ESM/static-import and mock-shape checks, and whitespace checks passed. The previous commit's hosted
[CI run](https://github.com/cloudbyday90/Classifarr/actions/runs/35802959386)
completed its build and database tests successfully.
This commit's hosted checks run separately after push; local success is not a
claim that those new hosted checks have already completed.

## What this does not prove

Fixtures prove mechanics, not a real accuracy increase. The running app has not
been deployed with this change; no real prospective outcome count or company
benefit is claimed. Existing classification history cannot be reconstructed into
honest pre-feedback captures. Records follow its retention, and reports remain
`promotionAllowed: false`. This compares two candidate-ranking formulas using
actual live description evidence, not two end-to-end AI responses.

## Next high-value item

Deploy through the normal application workflow and let automatic company backfill
and passive capture accumulate real traffic. Read one fixed-window paired report,
checking company coverage, corrections, per-library regressions and abstentions.
Then validate the promotion decision on a disjoint later cohort before enabling a
reversible company-assisted shortlist. Do not build another sampling workflow or
raise displayed confidence to substitute for evidence.
