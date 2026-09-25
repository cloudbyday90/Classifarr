# Intake decision capture recovery: design

Status: Unreleased, September 24, 2026. Verification belongs in the separate
[outcome document](intake-decision-recovery-outcome.md).

## Evidence and scope

Read-only inspection found the live container on `2f17b44e`, before the two newest
capture migrations. It has zero correction outcomes, zero feedback receipts and
four intake receipts. Therefore no production quality regression can yet be
selected. Do not deploy, tune thresholds, create synthetic labels or claim a
measured accuracy gain to fill that gap.

Review of `383c1af4` identified a narrower reliability defect: original decisions
are saved in history before best-effort intake capture. If that capture fails,
existing reconciliation repairs the classification link but never copies the
already-saved decision. This is recoverable evidence loss, not absent evidence.
Fix this path before future collection; keep the planned measured experiment as
the next evaluation step.

## Design

Extend existing queue maintenance, not a new scheduler, dashboard or approval:

1. Existing receipt and classification-link reconciliation runs first.
2. Scan at most 500 recent, linked receipts missing decision context, in stable
   queue-ID order. Read only the bounded saved projection and typed validation
   fields from the exact history row. Never fetch titles or raw metadata.
3. Reuse the existing original-decision validator. Accept only versioned movie/TV
   captures matching history identity and method; no current-destination inference.
4. Fill only null contexts for the same classification ID. Recheck the retained
   time window, original capture and typed source fields at write time. Skip locked
   receipts and preserve any context or link written concurrently.
5. Advance an in-memory keyset cursor after a successful bounded pass, including
   malformed/missing-history rows, so a fixed invalid prefix cannot starve later
   valid rows. Wrap after the scan reaches its end; restart safely rescans. A failed
   query does not advance the cursor. Concurrent calls share one pass.

No new table, migration, durable cursor, external service or dependency is needed.
Recovery only changes the receipt's context and update timestamp, not its retention
origin, queue state, feedback, learning or routing. Failures remain advisory and
use fixed, rate-limited warning codes; expiry remains independent.
Classification-link repair also rechecks that the link is still absent at update
time. An unrepresentable latest classification ID is skipped, not cast into the
receipt's integer field and not substituted with an older classification.

This can recover an existing original capture while history survives. It cannot
recover a deleted source, recreate an uncaptured historical decision, infer a
missing feedback label or promise every historical retry is retained. Locked or
late-repaired rows are retried on subsequent sweeps; sustained backlog and restarts
can delay progress. No evaluation uses skipped-lock reads as its denominator.

## Official research and tradeoffs

Sources discovered through search/navigation and read September 24, 2026:

- [PostgreSQL 18 LIMIT and OFFSET](https://www.postgresql.org/docs/18/queries-limit.html)
  requires deterministic ordering for predictable bounded subsets. Use keyset
  progression rather than a repeated first page or growing offsets.
- [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html)
  describes `SKIP LOCKED` as useful for queue-like consumers, not consistent general
  reporting. Apply it only to maintenance; leave the evaluator's repeatable reads.
- [PostgreSQL 18 UPDATE](https://www.postgresql.org/docs/18/sql-update.html)
  documents joined updates and bounded batching. Match each receipt to one validated
  candidate and guard the current link/context before mutation.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
  emphasizes provenance and quality. Copy the exact original projection, not a
  reconstructed current placement. This backend change makes no WCAG claim.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented measurement limitations and feedback integration. Recovery
  improves evidence availability, not proof of classification correctness.

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Bounded exact-copy recovery in existing maintenance | Self-healing without user work or routing changes | Needs retained source; eventual repair | Implement |
| Make diagnostic capture block classification | Atomic evidence in every successful transaction | Couples classification availability to diagnostics | Defer larger redesign |
| Infer historical decisions from current placement | Appears to fill gaps | Fabricates baselines and contaminates evaluation | Reject |
| Add another broker or recovery dashboard | Additional coordination/visibility | Operational complexity without fixing the source gap | Reject |

Recommendation stack: exact original capture → idempotent bounded recovery →
honest retained coverage → one measured movie/TV regression experiment.
