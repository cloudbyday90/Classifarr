# Classification organization metadata: outcome

Date: 2026-09-22. Implements the
[organization contract and research](classification-organization-metadata-design.md).
The separate [PR #541 outcome](client-tooling-pr-541-outcome.md) covers client
tooling. No release, version bump or PR merge.

## Implemented repair

Studio information was present in inventory but was not selected by refill,
forwarded by payload builders, retained by the classification parser, or restored
when constructing classification metadata. Retry/reprocess builders also omitted
production companies, even when history still contained them. Tests starting with
already-reconstructed inventory metadata could not detect these losses.

The new `metadataOrganizations.mjs` module centralizes bounded copying and merging.
The existing services call it at their handoffs rather than adding another large
singleton. Training and query studio normalization use the same name function.

| Path | Result |
| --- | --- |
| Inventory refill | Selects and forwards the source studio |
| Queued enrichment | Re-reads studio after source-identity checks; old missing/stale payloads recover |
| Existing, ID-enriched, title-searched and basic classification | Retains source studio and company observations |
| Classification retry and enrichment follow-up | Preserve both roles and copied values |
| Completed-history reprocessing | Retains available organization observations |
| Metadata recheck | Fills missing roles or compatible expanded company sets; conflicts remain neutral |
| Learned profile | Uses explicit studio only; never guesses one from company order or TV networks |

Production companies remain available to existing company-aware policy, prompt
and embedding consumers. They are not silently relabeled as the learned studio
feature. Only company names and optional valid numeric IDs survive the adapter;
URLs, arbitrary fields and source assertions of authority do not.

No database migration, model-weight change, threshold adjustment or new UI is
needed. Existing identity, freshness, eligibility, confirmation and routing gates
remain in place. These fields are observations, not instructions or permission.

## Recovery boundary

An old queued enrichment task with no studio, or with an obsolete studio, now
uses the current matching inventory row. A source that no longer supplies studio
clears the queued value. Changed identity or unresolved source conflict still
prevents provider work and persistence through existing guards.

New retries recover information that remains in their source metadata. This
cannot reconstruct already-erased historical observations without a current
source, and does not rewrite history or mass-requeue reviewed items. An absent
studio is still unknown, even when production companies are available.

## Verification and limits

Eight new arrival-path tests failed before the implementation and passed after:
movie and TV, each through existing metadata, direct ID enrichment, title search
and basic fallback. Each path also checks retry parity at the learned-feature
boundary and verifies that routing/history writers are not called.

The final full backend unit run passed 1,375 suites / 40,360 tests. The final
targeted regression set passed seven suites / 173 tests. The new adapter's 24
tests achieved 100% statements, branches, functions and lines in a targeted
coverage run. This is not a repository-wide coverage claim.

SQL-backed checks exercise real refill/enrichment/history services with synthetic
provider responses and temporary tables. They recover missing and stale queued
studios for both media types. Learned-retrieval tests verify positive/negative
studio fit, cached model reuse, arrival/retry equivalence, and neutral studio fit
when only companies remain. Three older temporary-table fixtures needed their
missing `studio` column added to match the existing production schema. The merge
tests also cover ID preservation and ID/name conflicts across source lists, not
only within a single provider response.

The full database integration rerun passed 146 suites / 1,698 tests. One existing
opt-in Compose provider-fault test was skipped; it was not enabled or waived for
this change.

A disposable container using the running Compose application's immutable image,
Node 24.18.1, and a read-only current-source mount passed eight synthetic arrival
paths / sixteen arrival-plus-retry captures. It ran with networking disabled,
read-only filesystem, dropped capabilities and a non-root user. There were zero
external provider calls, database writes or routes. The normal application was
not rebuilt, restarted or redeployed, and the smoke container was removed.

This is an ingress/contract regression check, not an AI accuracy benchmark or a
new 120-item live cohort. The decision tree is stopped before side effects in the
arrival smoke; separate SQL retrieval tests cover the learned consumer. Do not
interpret restored fields as a guaranteed confidence increase or automatic route.

Client validation for the independent tooling change passed 371 test files /
5,173 tests, type checking, lint, production build and seven real-browser
route/asset checks. Installation and production-only dependency audits reported
zero known vulnerabilities. No runtime dependency or CI configuration changed.

Server type checking, ESLint, both Knip gates, static ESM/mock-shape checks,
copyright, npm-flag checks, documentation lint and whitespace checks passed.
Staged secret scanning found no leaks. No coverage baseline or test waiver was
changed. The previous commit's CI completed successfully; this commit still
requires its own CI run after push.

## Recommendation and next item

Follow-up implemented: [production-company learning outcome](production-company-learning-outcome.md).
The original recommendation below is retained as the decision history.

Keep the shared ESM contract on the existing PostgreSQL/local-RAG stack. Its
benefit is preserved evidence and automatic recovery at existing handoffs; the
tradeoff is that invalid or contradictory observations deliberately contribute
less evidence instead of producing a fabricated feature.

Next: **learn production-company sets as a separate, attributable feature across
inventory and new arrivals**. Fresh TMDB classification supplies companies but
does not supply the source's singular studio. Do not bridge that gap by choosing
the first company or hardcoding library identities.

Use identity-bound inventory provider observations, bounded name/ID sets and the
same feature transformation at training and query time. Evaluate a separate
company-set channel with held-out item/description exclusions and per-library
movie/TV coverage. Keep it distinct from studio and validate against independent
outcomes before allowing it to affect automatic-routing decisions. This extends
what the model can actually learn rather than adding another review screen or
lowering a confidence threshold.
