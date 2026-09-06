# Suggestion cohort provenance and freshness

## Problem and decision

Atomic review protects suggestion status, but does not establish whether its
evidence still describes the destination or policy. Threshold and weight
suggestions also lacked supporting feedback IDs. Capture the complete bounded
analysis input automatically, share its immutable record across suggestions,
and revalidate it inside the application transaction.

The producer reads one repeatable-read snapshot. Its versioned manifest records
the policy configuration, destination identity, lookback period, capture time,
and every projected feedback row, including denominators and counterexamples.
Only metadata and scores consumed by analysis are retained; titles, reasons,
credentials, and unrelated provider data are excluded. Limits are 5,000 rows and
2 MiB of canonical JSON; overflow fails explicitly rather than sampling silently.

Each suggestion binds its resolved configuration and supporting IDs to the
cohort fingerprint. SHA-256 detects inconsistent records; it is not a signature
or a defense against an administrator who can rewrite the database. Cohort rows
cannot be updated. Owning-policy deletion can remove them with existing history.

## Application and regeneration

After the existing policy-authority and pending-status locks, application checks
the immutable record, binding, current root-policy configuration, active library
identity, and every original feedback member. Missing, changed, detached, or
aged-out members fail closed with HTTP 409 before effects or audit writes.
New feedback does not invalidate a complete historical cohort. Members must
still fit the requested rolling lookback at validation time.

Policy locking remains first. Library and feedback share locks use NOWAIT to
avoid waiting in the reverse order of library deletion. Contention returns a
distinct busy conflict and rolls back, without treating busy evidence as stale.
These row locks survive until commit; normal updates and deletes cannot race
between validation and application. This does not freeze linked presets,
overrides, media-server configuration, or an entire classification model.

Storage checks the captured input again before writing suggestions. During
analysis with a usable cohort, pending suggestions with missing or stale provenance become
`superseded`; their original evidence and review fields remain untouched. A
fresh suggestion can then be stored without manual rejection. Current duplicate
suggestions keep their existing evidence. Rejection remains available for legacy
pending suggestions. The UI refreshes on conflicts and never retries a mutation
automatically. No classification routing or semantic readiness gate changes.

## Research and alternatives

Sources were discovered with web tools and checked on 6 September 2026 for an
August 2026 baseline. Stable recommendations predate that baseline; living
PostgreSQL documentation is not represented as an archived August snapshot.

| Choice | Advantage | Cost / limitation |
| --- | --- | --- |
| Shared immutable cohort (selected) | Complete input attribution without per-suggestion duplication | Schema and bounded storage overhead |
| Supporting IDs only | Small and simple | Omits denominators and cannot detect modified content |
| Fresh analysis at apply time | Uses latest input | Changes what the reviewer approved and increases work |
| SHA-256 plus explicit row locks (selected) | Detects drift and closes validation/write races | Busy conflicts; hashes do not authenticate authors |
| Serializable transaction alone | Detects some anomalies | Cannot guarantee cross-writer rules when other writers use weaker isolation |

W3C PROV distinguishes entities, activities, and derivation. Here the manifest
is an input entity, analysis is the activity, and the suggestion is derived
output. This is a design mapping, not an RDF export or conformance claim.
[W3C PROV-O](https://www.w3.org/TR/2013/REC-prov-o-20130430/).

PostgreSQL recommends explicit locking for consistency rules involving writers
at weaker isolation. Checks must use current locked rows, and locks must cover
the subsequent write. [PostgreSQL application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html).

HTTP 409 represents conflict with current resource state; specific error codes
let the client refresh without reporting success or retrying an approval.
[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html).

The status and policy filters have explicit accessible names. W3C recommends
identifying each form control and documents `aria-label` when a visible label
is not used. [W3C labeling controls](https://www.w3.org/WAI/tutorials/forms/labels/).

## Recommendation stack

Use small ESM modules for the canonical contract, capture/freshness repository,
and existing suggestion lifecycle. Store shared immutable PostgreSQL manifests,
validate under row locks, preserve superseded history, and retain explicit human
application. Verify with real PostgreSQL mutation and concurrency tests before
considering broader dependency snapshots or additional automation.
