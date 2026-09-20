# Shared frozen-evaluation snapshot design

Date: 2026-09-20. Scope: reconcile the existing fresh-policy and leader/scorer
evaluators, not introduce another evaluator or alter live classification.

## Root cause and decision

The fresh evaluator already permits metadata-only enrichment after its inputs
are captured. The leader/scorer runner instead invalidates every changed digest.
Both prepare their evidence from a bounded, read-only repeatable-read snapshot;
neither replaces frozen inputs with a later database read. This discrepancy
discarded the last scorer pilot's completion status during ordinary enrichment.
Its historical report remains unchanged; this fix is prospective.

Extract the existing drift contract into a small, pure ESM service. Capture
initial digests before preparation, compare the union of component keys at each
check, and accumulate observed drift even if a later check returns to baseline.
Do not trust an unchanged aggregate fingerprint in place of component checks.
Unexplained or inconsistent fingerprint changes fail closed.

| Change | Frozen evaluation | Live-source freshness |
| --- | --- | --- |
| None observed | Valid, subject to existing error/cancellation checks | Verified at checks |
| Only `metadata` / `observedTraits` | Retain frozen measurements | Not verified; explicitly historical |
| Documents, identities, memberships, libraries, policies, configuration, vectors, provenance | Invalidated | Not verified |
| Added/removed or unknown component, unexplained fingerprint, failed verification | Invalidated | Not verified |

Library-scope and policy-authority inputs are covered by their existing digests.
This is not a new tenant/ACL monitor: the CLI has no independent user-permission
revision field. No claim is made about unobserved changes between checkpoints.
Description changes remain document changes, not tolerated metadata refresh.

Both reports share `evaluationSnapshotValid`, `snapshotScope: frozen_at_start`,
`sourceVerified`, `liveMetadataRefreshed`, `changedComponents` and a bounded
`verificationFailure`. These fields distinguish source validity from provider
or evidence errors. No field grants routing or model-promotion authority.

Keep the fresh evaluator's existing preparation/25-call/final checks. Add a
pre-inference check to leader/scorer runs requesting inference, retain their
final check, and prevent calls if the pre-check detects invalidation. Preserve
actual completed call counts, runtime cleanup, cancellation and admission waits.
No model download or new paid/local scoring cohort is needed for this refactor.

## Options and recommendation

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Invalidate on every enrichment | Simple | Forces needless reruns; reject |
| Ignore all drift | Fewer interruptions | Conceals changed scope and policies; reject |
| Shared frozen-validity/freshness contract | Reuses existing behavior, lets enrichment continue | Historical results require explicit labeling; implement |
| Hold a transaction throughout inference | Stable database view | Long-lived transaction and no current-scope check; reject |

Recommended stack: existing repeatable-read capture → existing grouped training
and frozen evidence → shared drift contract → bounded optional inference →
aggregate historical/current-status report. Live routing and scoped SWR cache
invalidation remain unchanged: permission/source/model changes must not reuse
cached live scores. The frozen-benchmark exception is not a cache exception.

## Official sources and security

Discovered through search and opened on September 20, 2026. Mutable sources are
current documentation, not archived September snapshots.

- [PostgreSQL 17 transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html)
  explains consistent reads within repeatable-read transactions. Retain the
  existing bounded capture and release the transaction before inference.
- [node-postgres transactions](https://node-postgres.com/features/transactions)
  requires a single checked-out client for transaction statements. Preserve the
  existing serialized reader and cleanup rather than replacing it.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  supports provenance, scoped cache invalidation and fail-closed controls. Our
  application decision is to allow only two known enrichment components for
  historical offline measurements; all other changes remain invalidating.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  calls for accessible, non-focus-stealing feedback and cautions against overly
  chatty updates. No UI is added. Any future summary should say “Completed using
  earlier metadata; library enrichment continued,” with technical details on
  demand. This is not a WCAG conformance claim.

Reports retain aggregate digests and fixed reason codes, not private titles,
descriptions, raw exceptions or provider responses. Verification reads cannot
mutate the starting source. No domain writers, automatic reruns, new manual
acknowledgements, schema changes, dependencies or release are introduced.

## Verification plan

Test both evaluators against identical metadata and safety drift fixtures;
exercise added/removed provenance, mismatched fingerprints, mixed and reverted
drift, cancelled/failed verification, embedding drift and unchanged inputs.
Check zero calls before invalid pre-inference checks, retained costs after final
invalidation, no source mutation and closed runtimes. Run repository checks and
an isolated local Compose zero-inference smoke; do not manufacture live metadata
changes or retroactively reinterpret the previous scorer pilot.
