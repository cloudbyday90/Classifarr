# Source-conflict authority guard design

Date: 2026-09-07. This follows the
[unresolved source-observation outcome](unresolved-source-observations-outcome.md).

## Problem

A source item can be rejected during sync because its provider identity is
ambiguous, while an older `media_server_items` row for the same library, server
and source key still has a TMDb ID. Before this change, automatic existing-media
classification, awaiting-decision reconciliation and metadata/TMDb enrichment
could use that older row as authority. The observation store correctly retained
the conflict, but its consumers did not read it.

## Decision

Use one small ESM SQL-predicate module for an exact, fresh conflict match:
`(library_id, media_server_id, external_id)`. A matching observation whose
`last_seen_at` is within the existing 30-day observation retention period is
positive disqualifying evidence. Automatic consumers exclude that inventory row.
The predicate is not a replacement-identity resolver and it never changes the
stored historical row by itself.

Apply the predicate to:

- existing-media lookup, which feeds the authoritative existing-media signal;
- awaiting-decision reconciliation based on source placement;
- automatic metadata-enrichment candidate selection and task preflight;
- TMDb identity, provider-rating and metadata persistence statements.

The task preflight skips with the fixed reason
`current_source_identity_conflict`, before provider calls or queue state writes.
Each persistence statement repeats the exclusion predicate. A conflict that
arrives after preflight therefore rejects a late write. A narrow race can still
allow provider work already in flight, but it cannot make the conflicted source
row authoritative or persist an inferred identity, rating or metadata result.

## Evidence lifecycle and boundaries

A valid source observation removes its corresponding conflict record and allows
the normal automatic paths to resume. Full, usable capture can also remove an
unseen conflict according to the existing observation lifecycle. Partial,
failed or omitted captures preserve a fresh recorded conflict; lack of a new
record is never treated as proof that the identity is valid. After the 30-day
retention period, the guard no longer blocks the historical row, while the
system still does not claim that the source identity was revalidated.

The exact tuple prevents a conflict in one placement from suppressing an
independent placement with the same TMDb ID. Historical inventory and conflict
observations remain available for diagnostics. Manual identity review remains an
explicit human workflow. Semantic candidate evidence remains outside this
automatic-authority change; it must continue to send ambiguity to review rather
than route media automatically.

No schema, public API, provider credential or release change is required. The
module accepts only a validated PostgreSQL placeholder token and every runtime
value, including the retention period, remains bound as a SQL parameter.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Fresh exact conflict gate with conditional writes | Preserves history, blocks unsafe automation and resolves automatically after valid evidence | Adds correlated predicates and conservative short-term skips | Selected |
| Clear the stored TMDb ID on every conflict | Stops lookup immediately | Destroys historical evidence and creates repair work | Reject |
| Require only the latest completed capture in each read | Looks snapshot-oriented | A partial, failed or omitted later capture could hide still-fresh conflict evidence | Reject |
| Log a warning without changing consumers | Minimal code | Keeps automatic authority available to a known conflict | Reject |
| Require routine operator confirmation | Explicit | Adds operational work and does not close write races | Reject |

Recommended stack: validated source capture → bounded conflict observation →
fresh exact conflict gate → queue preflight plus conditional persistence →
historical diagnostics → explicit review for unresolved cases. Keep semantic
counter-evidence advisory and review-only until its frozen-study readiness gate
has measured a suitable error profile.

## Official research

Sources were discovered and read through MCP/web tools on September 7, 2026.
They are living documents, so this records the review date rather than claiming
an archived future snapshot.

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default decisions and testing authorization logic. A fresh
  recorded conflict is treated as disqualifying evidence for automated authority
  until it is positively cleared or expires.
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
  recommends parameterized queries. The shared predicate validates its fixed
  placeholder and binds the retention value instead of interpolating data.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  explains statement-level visibility and predicate re-evaluation for concurrent
  updates. The guard therefore runs at both preflight and each write boundary.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) distinguishes
  provenance and quality information from fitness for a particular use. The
  source conflict is retained as provenance/quality evidence and limits
  automatic authority without becoming a replacement identity.

These choices apply the sources to Classifarr; they do not claim standards
conformance or establish classification correctness. The separate
[outcome](source-conflict-authority-guard-outcome.md) records implementation,
validation and the next item.
