# Multi-window quality evidence: design

September 26, 2026. Follow `51eb6e16`: its frozen evaluator correctly exposes
missing evidence, but a 50-response cache cannot retain a 300-case experiment.
Keep that cache and the existing capture allowance unchanged.

## Decision

Use one explicitly started, database-backed study, not another queue or dashboard.
Retain at most 300 case outcomes and 600 distinct request usage records for one
frozen protocol. Store only opaque identities, destination hashes, fixed outcomes,
response digests and usage; never prompts, raw responses, titles or review labels.
Expire the study at the original protocol's 30-day deadline. Repeated collection
must not renew retention, replace completed outcomes with cache misses, or count
shared requests twice. Different output for the same exact request stops the
study as conflicted rather than choosing the favorable result.

Reuse the isolated production evaluator. Collect before cache replacement and
before diagnostic/capture progression; collect new publication before acknowledging
it. A crash after publication is recovered by the next pre-replacement collection.
Transient collection failures defer capture while preserving its checkpoint;
source/policy/model drift stops the study and releases normal capture. Explicit
stop is also available. No active study means no extra evaluation. Registration
and collection are study-only writes, never routing or inference authorization.

Use short row-locked transactions to merge observations. Worker's CPU work stays
outside transactions under existing shared memory/advisory admission. Validate
all worker output and stored JSON, enforce protocol identity and expiry on reads
and writes, and retain no more than one study. Historical results remain historical
after drift; never represent them as current-model verification.

Export a private JSON review packet only from evidence still matching the frozen
protocol. Allowlist item title/year/description and an unranked destination catalog.
Do not export current membership, corrections, scores, AI outcomes, prompts or
provider identifiers. Item and destination references match the existing label
contract. Reviewers may leave ambiguous cases unlabeled; real independence cannot
be established from submitted JSON. No HTML rendering or external export is added.

## Alternatives and recommendation stack

| Option | Advantage | Disadvantage | Decision |
| --- | --- | --- | --- |
| Enlarge the response cache | Simple | Changes capture contract and retains raw outputs | Reject |
| Sum existing aggregate reports | Cheap | Double-counts overlap and cannot regrade destinations | Reject |
| Private files collected manually | No schema | Easy to miss windows; no crash recovery | Reject |
| Bounded opt-in PostgreSQL study | Restart-safe, deduplicated, no extra inference | One migration and bounded cached replay overhead | Implement |
| Evaluation SaaS or another scheduler | More features | Data export and duplicate infrastructure | Defer |

Recommended stack: strict ESM contracts → existing isolated replay → deterministic
merge → PostgreSQL singleton/expiry → private blinded packet and aggregate report.
Preserve existing pausable Vue SWR; add no dense Command Center panel.

## Official research, discovered online

- [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html):
  snapshots do not themselves serialize read/modify/write decisions. Lock the study
  row during merging and use conditional writes; keep CPU work outside transactions.
- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/):
  document test sets, methods and limitations and involve independent assessors.
  Blind review material to predictions; never infer correctness from placement.
- [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide):
  preserve control of auto-updating information. This backend/private JSON workflow
  adds no moving content and leaves existing pause controls intact.

## Acceptance and limitations

Test full 300-case synthetic accumulation across bounded windows, duplicate and
reordered deliveries, restart, one-arm backfill, shared costs, rejected responses,
conflicting output, stale revisions, expiry, stop/start races and rollback. Exercise
real workers and PostgreSQL, migration idempotency and fresh schema parity. No live
generation, deployment, release or real human label fabrication is part of testing.

Exact source or model churn may stop a study; intentionally do not combine versions.
The capture cohort can differ from the unbiased quality cohort, so retention alone
does not promise every case will acquire evidence. A review packet cannot hide
destination clues embedded in source descriptions themselves. Hashes are not
encryption. Follow-up decisions must be based on observed coverage and genuine
independent labels, not another increase in requested sample count.

The CLI starts only from an already saved protocol, so a registration receipt
failure cannot lose the identity needed to inspect or stop the study. Stop deletes
only that protocol's study. Read-only report/packet commands use read-only database
sessions; explicit start/collect/stop commands enable only their scoped study writes.
Expiry is exactly 720 hours, independent of daylight-saving transitions. Expired
studies are excluded immediately and physically pruned during normal diagnostic
maintenance or the next registration; an offline installation cannot run cleanup.
Future classification/retrieval changes must bump the existing evaluator fingerprint
revision so an old study cannot silently combine outcomes from different algorithms.
