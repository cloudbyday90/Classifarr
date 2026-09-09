# Source identity atomic resolution design

Date: 2026-09-09.

## Problem

The `mediaSync` warning reported a source fingerprint for library 10 on media
server 1 with `conflicting_provider_ids` for `tmdb_id`. A read-only local query
matched that fingerprint to the bounded source-observation store. The same
library also has a separate TVDB conflict.

Two distinct IDs from one authority cannot both identify the same current
source item. Selecting the first, last, or configured-preferred candidate would
turn an upstream data conflict into an untraceable inventory error. A TMDb
external-ID lookup can add cross-provider evidence, but it cannot establish
that two different TMDb IDs are interchangeable.

The platform already has an ESM, source-independent external-evidence resolver
in `tmdbExternalIdentityResolution.mjs`. It queries TMDb by IMDb and TVDB IDs,
rejects ambiguous or malformed results, and requires every supplied independent
identifier to resolve to the same canonical TMDb ID. This is a useful evidence
adapter, not a source-order preference rule.

## Atomic, provider-neutral state model

The source key is the stable transaction key. Provider adapters only normalize
their source payload into candidate evidence; they do not choose the winning
identity. The shared identity boundary applies one of these outcomes:

| Outcome | Evidence requirement | Atomic action |
| --- | --- | --- |
| `resolved` | One valid, non-conflicting normalized provider identity | Remove a prior unresolved observation for that key in the capture transaction and permit normal inventory persistence. |
| `conflicted` | Two or more different values for the same provider, or another invalid provider identity | Upsert the bounded unresolved observation and exclude the item from identity authority, enrichment, classification, and routing. |
| `unavailable` | No usable source key | Increment bounded capture coverage counters without inventing a record. |

`MediaSourceObservationStore.capture` already applies its page update through
`withTransaction`: it advances the capture generation, updates the unresolved
state, and clears a resolved key as one PostgreSQL transaction. Remote requests
must remain outside that transaction. A later adapter-independent resolver can
use the existing external-evidence resolver to acquire and verify evidence
first, then submit a compare-and-apply transition using the same source key,
capture generation, and candidate-set digest. It must fail closed if the
evidence does not prove one canonical identity.

The compare-and-apply transaction must lock the current observation, confirm
that its generation and candidate digest are unchanged, persist the accepted
identity and its receipt, and remove the unresolved observation together. A
zero-row compare means the source changed during verification; it must refresh
the capture rather than apply a stale decision. The transaction must never call
a source server or metadata provider while holding a database lock.

The guard in `sourceConflictAuthorityGuard.mjs` makes a retained conflict
positive disqualifying evidence for 30 days. Absence, omission, a different
library, or a different media-server implementation cannot convert it into
authority. This preserves the model across Plex, Emby, Jellyfin, and future
sources without configuration-specific precedence rules.

## This change

`mediaSyncSkipSummary.mjs` is a small shared ESM service that accepts only two
fixed outcome codes and fixed identity issue categories. During a sync,
`mediaSync.mjs` passes each skipped item to that summary after source capture.
At completion it emits one bounded warning with aggregate reason and issue
counts. Source keys, titles, URLs, provider values, and fingerprints are not
forwarded into that summary.

This replaces repeated per-item warning handling for normal syncs. The bounded
source-observation endpoint remains the controlled place to understand retained
conflicts. It neither resolves an identity, changes a library, invokes AI, nor
routes media.

## Alternatives

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Choose a candidate by source order or configuration | Fewer warnings | Corrupts source identity and is provider-specific | Reject |
| Resolve only when independent evidence proves one identity and matches one declared source candidate | Safe future automation | Needs a revision-aware apply step and cannot repair contradictory source metadata | Recommend for a later, separately measured change |
| Persist full provider payloads in logs | Easy ad hoc diagnosis | Leaks source data and creates routine manual work | Reject |
| Retain conflict atomically and summarize it once per completed sync | Safe, bounded, library-agnostic, low operator load | Does not repair the upstream source | Adopt |

## Research and recommendation stack

PostgreSQL documents transactions as all-or-nothing units, which supports the
capture-state transition but argues against holding database locks while calling
remote providers. TMDb documents its find-by-ID endpoint as a lookup over
external identifiers, including IMDb and TVDB for TV shows; it remains evidence
to test, never a license to equate conflicting source IDs. Plex documents that
match hints can set those identifiers and that source matches can be corrected,
which explains a plausible upstream mechanism without proving the cause of a
specific item. W3C privacy principles require minimizing transferred and
retained data.

1. Normalize adapter evidence into a provider-neutral candidate contract.
2. Atomically persist `resolved`, `conflicted`, or `unavailable` by source key.
3. Keep conflicts as authority exclusions and summarize only fixed counts.
4. Add a resolver only when it can present independent, revision-bound proof of
   one identity that is among the current source candidates; send any remaining
   ambiguity to review, never automatic routing.

Sources: [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html),
[TMDb find by ID](https://developer.themoviedb.org/reference/find-by-id),
[Plex match hinting](https://support.plex.tv/articles/plexmatch/),
and [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/).
