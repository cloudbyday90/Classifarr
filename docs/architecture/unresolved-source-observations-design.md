# Unresolved source observations design

Date: 2026-09-07. Follows the
[identity-conflict investigation](media-sync-identity-warning-outcome.md).

## Decision

Retain source items rejected by sync identity validation in separate tables. A
source key plus server and library identifies observed membership, not a TMDb
identity. Capture only bounded title, year, media type, fixed issue/provider field
categories and server timestamps. Never copy raw metadata, credentials, provider
candidate IDs or resolved identity evidence into this store. Invalid source keys
cannot form a record; count those cases separately.

Use a small ESM capture service with pure normalization and parameterized SQL in
separate modules. Existing sync captures each page automatically. Database-issued
per-library generations and row locks reject writes/completion from superseded
captures. Valid source identities remove their previous unresolved observation;
only a successful full scan with usable source keys removes unseen memberships.
A valid duplicate cannot clear a rejection within the same capture; a later
consistent capture can clear it. Failed and incremental
scans keep unseen evidence, with their incomplete state exposed. Library/server
deletion cascades. Retain at most 20,000 unresolved observations per library and
exclude evidence older than 30 days; purge expired records during capture. Report
capacity omissions explicitly. This is current retained evidence, not an audit log.

Expose an authenticated, rate-limited, no-store library summary with at most 12
active libraries and five example observations per library. Include retained
counts, capture state, omissions and dates. Uncaptured or expired libraries are unknown,
not zero-conflict results. A separate Vue component displays plain text and native
table captions/headers, keyboard scrolling and loading/error statuses. No controls
assign identity, enqueue classification or demand routine operator review.

## Alternatives and recommendation stack

| Option | Advantages | Costs or limits |
| --- | --- | --- |
| Separate bounded observation store — selected | Preserves membership visibility, strict authority separation, automatic lifecycle | New tables and projection; finite retention and preview |
| Insert conflicted records into trusted inventory | Reuses existing views | Risks enrichment/routing treating unverified IDs as usable |
| Keep warnings only | Smallest storage footprint | Cannot describe retained membership or coverage; manual investigation |
| Keep all raw responses indefinitely | Maximum forensic detail | Unbounded storage, private payload exposure and ambiguous authority |

Recommended stack: source-key validation → sanitized observation capture →
generation-guarded persistence → bounded authenticated projection → descriptive UI.
Keep TMDb resolution, semantic evidence, readiness studies and routing separate.
Equal titles or source placement do not establish correct classification.

## Official research

Sources checked through search/open tools on September 7, 2026:

- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/): provenance,
  quality and fitness-for-use information support keeping source observation
  distinct from verified identity; protect sensitive data when publishing it.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html):
  concurrent writes require deliberate handling. The chosen per-library lock and
  generation check prevent stale capture work from replacing newer state.
- [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html):
  validate backend feeds as untrusted inputs. Here strict keys, finite fields,
  parameterized SQL and explicit output bounds enforce that boundary.
- [W3C table captions](https://www.w3.org/WAI/tutorials/tables/caption-summary/):
  label tabular data with a caption; use associated headers and accessible states.

These are application design choices informed by the sources, not a certification
or a claim about later September changes. The separate
[outcome](unresolved-source-observations-outcome.md) records implementation and tests.
