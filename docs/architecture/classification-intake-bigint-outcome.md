# Exact classification IDs in intake receipts outcome

November 22, 2026 Eastern. Implementation of the approved
[design and tradeoffs](classification-intake-bigint-design.md).

Intake receipts now store the History link as `BIGINT`. The receipt and
witness writers bind canonical decimal text validated against the PostgreSQL
range. A safe JavaScript number and its canonical string identify the same
row. The repository refuses noncanonical input and numbers that may already
have lost precision. The existing private report preserves safe numbers
and writes larger IDs as decimal strings.

Existing numeric decision contexts retain their original meaning and
representation. A larger link records no decision context. Evaluation
therefore counts it as missing decision evidence. Link recovery uses the
newest retained witness that joins to History, within the existing time and
row limits. It leaves a receipt already linked by a live writer intact. The
existing queue repair and metadata retry guards respect a large link even
when the decision context is absent.

The separate queue witness detail reader still requires a safe numeric
classification ID. It reports a larger witness as unavailable with the
existing invalid-witness reason, even when the exact row can support intake
reconciliation. Public ID contracts and other History references each need
their own compatibility review.

## Verification

- The new assertions failed against the old receipt and witness writers.
  Astra reviewed the implementation and the distinction between internal
  link recovery and the separate witness detail reader.
- All 168 focused PostgreSQL tests passed with coverage. They exercised the
  int32 boundary, adjacent IDs beyond the JavaScript safe range, the BIGINT
  maximum, retained snapshots, report fields, recovery after an injected
  intake write failure, link races, repair refusal and retention.
- An isolated PostgreSQL 17.11 fixture held a conflicting lock. The migration
  failed with `55P03`, leaving the populated integer column intact. It
  succeeded after lock release and stored the BIGINT maximum.
- The prior snapshot upgraded on packaged PostgreSQL 18.7, and the
  repository schema comparison passed. A separate fresh database loaded
  the current snapshot and reported the BIGINT type and migration marker.
- The ownership inventory keeps the prior analysis and classifications for
  the changed sources. The new migration uses the existing schema
  maintenance review. The authenticated PR list was empty.
- All 138 focused unit tests passed. CI preflight, server lint, both type
  checks, Markdown lint, the static import and mock shape checks, and the
  affected policy gates passed.

## Next recommended item

Trace `manual_routing_check_state.classification_id` through admission,
attempt ownership, persisted outcomes and History. The foreign key already
points to a BIGINT row, but the check's own INTEGER key can refuse to create
state before it admits a routing check. Use the same exact ID contract where
the current callers can support it.
Evaluate the reclassification batch and move references together afterward,
since they share an external move lifecycle. Revisit UUIDv7 after that work
and a concrete identifier requirement.
