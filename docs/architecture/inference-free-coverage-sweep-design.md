# Inference-free coverage sweep: design

## Root cause and scope

September 25, 2026. Commit `1bacd75b` safely advances fully accounted evaluation
windows without AI permission. It intentionally leaves incomplete windows in place.
Because evaluation and capture still share a cursor, one early cache miss can hide
later deterministic or cached opportunities in the frozen movie/TV cohort.

Give diagnostic coverage its own small durable cursor. Reuse the automatic worker,
shared heavy-job admission, five-minute cooldown and bounded history. Do not add a
queue, endpoint, inference call, routing capability or user approval step.

## Ownership and behavior

- The sweep visits one interleaved movie/TV window of at most 25 eligible cases per
  successful tick, within the existing frozen cohort of at most 300. Missing,
  unavailable and invalid evidence is recorded honestly before moving on.
- The capture cursor, quotas, reservations and unfinished response checkpoints
  remain owned by capture. Surveying a gap must not discard its pending work.
- Capture progress can still be consumed by the prior strict completion path when
  the sweep actually evaluates that same capture window with complete evidence.
  Published capture may wait for the sweep to return; it must not preempt fairness.
- A private singleton stores only sweep revision, offset and a hashed evidence
  revision. No media identifiers, titles, prompts or responses are added.
- The evidence revision uses the existing history definition: cohort, source,
  representation, policy, configuration and labels, excluding cached responses
  and the window offset. Cache fill/expiry does not restart the survey; changes to
  logical evidence do. The next selected window starts at zero after such drift.
- New or expired cohorts start a new scope. Population shrink normalizes an
  out-of-range offset. Single/empty windows do not cause repeated cursor writes.
- There is no promise of finishing a stable revision while its inputs continually
  change. Readiness, memory pressure, cancellation and failures still defer work.

Before granting progression, reread the bounded snapshot under the same admission
and deadline. Check the full evaluated fingerprint (including the cache), plus
cursor ownership. Publish report, bounded gap history and conditional sweep update
in one transaction. Compare expected revision, offset and evidence key; increment
revision to fence duplicate and late updates after wraparound. Roll back on errors.
Do not hold the snapshot transaction open during CPU evaluation. Ingestion may
change after the freshness reread; the next tick fingerprints current inputs again.

The additive migration creates the independent checkpoint without rewriting any
capture state or historical evidence. Generate and verify the schema using an
isolated disposable database; do not migrate the live installation in this task.

## Options, pros and cons

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Advance the shared cursor over gaps | Small change | Can abandon unfinished capture ownership | Reject |
| Evaluate every AI window in one tick | No durable sweep cursor | Larger bursts and weaker bounded scheduling | Reject |
| Independent diagnostic cursor | Fair bounded coverage, restart safety, capture isolation | Additive schema and up to one sweep of capture acknowledgement latency | Implement |

Final stack: modular ESM selection/planning → existing isolated worker/admission →
transactional PostgreSQL checkpoint and bounded history → existing protected GET
and nonpersistent Vue SWR summary. Keep music excluded and library names irrelevant.
Gap coverage is not accuracy, training or authorization to promote a policy.

## Official research, checked September 25, 2026

Sources were discovered through online search/link tools; recommendations below
are project-specific applications rather than claims of standards certification.

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  describes coherent repeatable-read snapshots and UPDATE predicate rechecks.
  Preserve read snapshots and short revision-guarded publication transactions.
- [AWS retry/idempotency guidance](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
  motivates explicit operation identity. Revision and evidence scope distinguish a
  duplicate save from a new visit to the same offset.
- [W3C WCAG 2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
  informs automatic-update controls. Preserve the existing keyboard-pausable
  summary and focus behavior; no new panel or forced live announcement is needed.

## Acceptance

Use synthetic data to demonstrate all 12 windows of a 300-case cohort despite an
early gap; later cached evidence remains visible. Verify exact gap counts, restart,
source/configuration drift, cache fill/expiry, single/tail windows, cancellation,
concurrency, wraparound, transaction rollback and unchanged capture checkpoints.
Test schema creation/replay and existing capture recovery, run full regressions,
and record actual results in a separate outcome document. No release or deployment.
