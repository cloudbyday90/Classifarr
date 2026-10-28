# Automatic evidence gap audit outcome

Date: 2026-10-28. Status: agreed scope implemented and locally validated.
The [design](automatic-evidence-gap-audit-design.md) records official research,
alternatives, pros/cons and the final recommendation stack.

## Baseline and established facts

- Main is clean at `5decb2e16ec7cb949163047bbfa955ab80ef07f7` before this batch.
  Tools remain pinned Node 24.22.1 and npm 12.2.1; no global upgrade is planned.
- The GitHub MCP open-PR query returned no open PRs. No random candidate or stale
  Dependabot PR is applicable at this observation; none was invented or reopened.
- Current prospective capture/observation/holdout modules already enforce the
  accepted identity, unknown-kind, conflict, retention and sentinel boundaries.
- Existing automatic evaluation lifecycle supplies coalescing, ownership,
  cancellation checks and backoff. The source-pair composite also invokes model
  capture/pruning and must not be reused as a database-only audit.
- Inference workload consent and default RAG/inventory readiness would incorrectly
  suppress a no-AI diagnostic. Existing direct discovery admission plus the
  no-RAG/no-inventory foreground-idle predicate provide reusable controls.
- The public administrator Evaluation progress area already uses nonpersistent,
  protected polling and safe projection. It can host a quiet optional aggregate
  without another page. Status GET must only read the saved aggregate.
- Capture exclusions reconcile as a waterfall. Observation diagnostics overlap
  and may be bounded lower counts. No count of historically recoverable labels
  can be established from these sources.

## Implementation and decisions

Both planning decisions were confirmed: a separate audit/checkpoint and an
optional saved-status summary in the existing administrator Evaluation progress
area. Small contract, projection, repository, thread, lifecycle, schedule, status,
restore and presentation modules own the separate responsibilities.

The minute scheduler waits four minutes after registration, coalesces calls and
uses advisory ownership, existing shared heavy-work/memory admission and the
foreground-idle predicate. Success waits five minutes; failures persist bounded
five-to-sixty-minute backoff. A fifteen-second abortable read takes the database
clock and one repeatable-read thirty-day source snapshot. SQL preflights its
materialized payload before transfer; the isolated worker adds transport, heap,
deadline and strict output bounds. Only a singleton aggregate and ordinary
scheduler receipts are written. Restore invalidates the aggregate in its existing
transaction, for merge and replace.

The protected, rate-limited, parameter-free `GET /api/stats/evidence-gap-audit`
only reads saved state. `runInventoryOutcomeCalibration.mjs --gap-audit-status`
does the same and rejects other mode options. Neither initiates work. Status
availability is independent of evaluation history. Counts are withheld on failure,
deferral, corruption, future timestamps or fifteen-minute staleness. Nonpersistent
client polling clears access loss; monotonic age includes request latency and
survives pause/resume and Vue proxying. Native disclosures stay mounted across
refreshes, preserving focus; concise polite status messages omit ticking dates.

Capture exclusions reconcile as a waterfall. Overlapping observation reasons,
including duplicate groups that hit the sentinel, are reported separately.
Intake saturation is a lower bound; it has no exact missing-comparison count.
Historical recovery remains unassessed. Current placement supplies no missing
identity/action proof. No classifier formula, routing, learning or label policy
changed, and no provider was called.

## Validation and delivery

Focused backend checks: six suites / 64 tests passed. Real disposable PostgreSQL
checks: one suite / five tests passed, covering coherent reads during concurrent
commits, read-only enforcement, active cancellation, payload withholding,
publication fencing, restart cooldown, backoff, advisory contention, source
immutability and transactional reset rollback. Focused client checks: three files
/ 22 tests passed, including access loss, paused/hidden expiry, delayed responses,
privacy rejection, native disclosure persistence and named API wiring.

Full client coverage passed 478 files / 7,399 tests: statements 87.80%, branches
81.84%, functions 87.57%, lines 89.49%. The real Chromium Evaluation progress test
passed keyboard disclosure, focus retention after an unverified response, mobile
reflow, paused clearing and access loss. All eight production route/asset checks
passed. Desktop and mobile audit views were inspected.

Lint, server/client types, both Knip dependency checks, all four production-policy
audits, ESM imports/mock-shape checks and whitespace checks passed. Markdown lint
passed 2,380 documents; copyright checked 1,814 files. The generated fresh-install
schema includes the additive migration and reproduces with a disposable
PostgreSQL/pgvector fixture. Inventory ownership review keeps existing unresolved
writer debt and approves only exact reviewed drift; it does not grant production
writer authority. Independent review caught the Vue proxy freshness issue; its
fix and regression tests passed. Final server review found no further defect.
Full backend coverage passed 1,888 suites / 60,811 tests, with one skipped, in
980.99 seconds: statements/lines 89.20%, branches 86.50%, functions 90.78%.
The ratchet passed against both fresh reports without changing its baseline.
The staged redacted Gitleaks scan passed. Ignored private/intermediate receipts
are not part of the commit. The disposable schema fixture was removed; unrelated
worktrees were preserved. Final delivery receipts follow after the push.

GitHub MCP was rechecked after implementation: no open PRs, including Dependabot,
were available. No random PR could be selected or stale PR rebased in this batch.
The earlier PR #570 remains a separate, already completed local implementation.

No production database, live recovery, historical import, release or deployment
was performed. Work stays on `main` as requested.

## Next recommendation

Freeze feedback action/reference provenance at its authorized writer, then read
it through the shared conservative adapters. This will improve future evidence
coverage; it cannot truthfully fill missing old identity/action proof. A later
historical recovery job needs independent source evidence, a bounded dry run and
separate review before any import. Keep placement-informed suggestions separate
from verified evaluation labels.
