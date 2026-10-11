# Identity conflicts: why approval exists and where automation fits

## Evidence and current behavior — 2026-10-11

The local audit found nine shows with multiple declared TVDB IDs and two grouped
shows with multiple TMDb series. A description or artwork proves metadata exists;
it does not choose between conflicting identities. Seven proposed single-series
mappings matched all 489 source episodes by exact TMDb membership and numbering.
That is useful evidence, but `compareScopeEvidence` does not resolve each parent
TVDB declaration or independently confirm every cross-provider identity. Its
response explicitly says `crossProviderVerified: false`.

Automatic identity recovery already exists in `mediaSyncIdentityRecovery.mjs`;
this proposal extends it rather than creating a second system. Its structural
gate requires a declared TMDb candidate and exactly one IMDb ID, and refuses TV
items with more than one TVDB ID as `insufficient_evidence` before catalog calls.
Otherwise it checks typed external-ID agreement, the declared candidate set,
strict title/year evidence and a fresh source digest. Existing owned persistence
and metadata backfill consume the result. See the retained
[original self-healing design](source-identity-self-healing-design.md).

Approval was a deliberate product-policy boundary, not a PostgreSQL ownership
repair and not proof the admin knows more than the catalog. It records which
mapping the operator authorizes while retaining the original source declarations.
The active admin is the decision actor; the ingestion worker still owns the
database write lease. A completed mapping requires both full verification and
atomic inventory persistence. The seven explicit local approvals subsequently
applied through normal scheduled sync, reducing eleven unresolved items to four.
They were not approved or deployed on Unraid.

The remaining cases lack episode evidence: one missing-ID episode, one declared
episode outside the proposed catalog scope, and two grouped shows with unverified
later seasons (37 episodes with no external IDs). The prior audit did not prove
why Plex lacks those identifiers, nor that every conflicting parent ID is stale.
Do not describe those possibilities as established causes.

## Proposed automatic recovery contract — not implemented in this batch

Extended automatic reconciliation should prove equivalence rather than simulate admin
approval. Reuse existing provider adapters, evidence services and owned capture;
do not introduce a title-based or AI-confidence shortcut.

1. Discover and re-read bounded, typed candidate IDs. Classify every declared ID
   as equivalent, contradictory, absent, unavailable or still ambiguous. Missing
   records and timeouts are not evidence that an ID is obsolete.
2. For a single work, require one unique canonical candidate, complete source
   coverage and no unexplained contradictory declarations. Resolve exact episode
   external IDs when available; confirm media type, parent, season and membership.
   A show-level ID or matching title cannot fill an episode identity gap.
3. Preserve grouped libraries and shows. Only propose a complete, unambiguous
   season mapping with every source season verified. Never assign an arbitrary
   parent ID or present a partially mapped group as repaired.
4. Extend the existing system-verification receipt separately from `approved_by`: rule
   version, typed scope, evidence fingerprints and source/configuration revisions.
   Use a new reviewed schema migration if the stored contract needs it; do not
   invent an administrator or retrofit existing approvals as automatic evidence.
5. Materialize under existing ownership and final drift checks, then let ordinary
   metadata/description/vector backfill consume the repaired typed scope. Record
   completion atomically; do not clear an unresolved item on discovery alone.

First implement a read-only eligibility audit, not an automatic data migration.
Measure exact equivalence and abstention reasons on all affected libraries and
supported adapters. After verifying that rule, design a resumable deployment
enrollment: no work on fresh installations without affected rows; one bounded
installation worker, item/provider cooldowns persisted across restarts, 90-second
evidence deadline, at most four works/32 seasons/2,000 source and 10,000 catalog
episodes per check, bounded response bodies, and a reviewed maximum attempt
policy. Reuse existing provider failure admission; do not reset budgets on upgrade.

Transient provider failures retry with backoff; contradiction or incomplete scope
abstains with actionable diagnostics; cancellation preserves unresolved state;
unknown errors retain sanitized context for an issue report. A source/configuration
change invalidates the proposed write. Revoked operator intent must not be
automatically reactivated. Read retries are safe; an uncertain committed write
requires an idempotent receipt lookup, not a blind replay. Optional vectors do not
hold identity repair open. Never disable memory or ownership safeguards.

## Recommendation stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Pick the first ID or match a title | Low effort | Can merge different works silently | Reject |
| Require approval for every conflict forever | Explicit intent | Unnecessary work for provable aliases | Safe current fallback, not the end state |
| Automatically reconcile proven equivalence | Library-agnostic, auditable, deployable | Needs stronger cross-provider proof and durable system provenance | Next staged improvement |
| Refresh/rematch source metadata | May supply missing episode IDs | Changes a shared provider; can alter grouping | Separate, specifically authorized operation |

Recommended order: make current status honest, audit automatic eligibility,
implement only proven reconciliation with negative tests, then enroll existing
deployments in bounded backfill. Leave genuine conflicts and incomplete groups
for review. Local approval receipts are not a release-time migration for other
installations.

## Official research

Retrieved through MCP on 2026-10-11:

- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data)
  distinguishes title search from lookup using an existing external ID. External
  lookup is evidence to inspect, not a guarantee that all returned scopes agree.
- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details)
  addresses episodes within a series and season; parent metadata alone is not
  complete episode membership evidence.

These sources support the lookup mechanisms. The stricter reconciliation and
backfill rules above are project design recommendations, not claims that TMDb
mandates our approval policy. Outcomes belong in the separate recheck outcome
document; no automatic approval or shared-provider mutation is implemented here.
