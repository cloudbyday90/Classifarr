# Current-Library Candidate Retrieval Outcome

## Status

Implemented on 2026-08-30. No release was created.

## Delivered Behavior

For a valid two-to-three-candidate `prompt_select` adjudication, Classifarr
now reads the synchronized current inventory for those candidate libraries
only. It first recognizes an exact TMDb ID, then a title/year match, and then a
bounded PostgreSQL plain-text match between a bounded incoming
title/genre/description query and catalog fields plus the locally held
summary/overview metadata.

Each candidate receives at most three title/year matches. A trusted local
Ollama endpoint may receive those small title facts. Cloud providers, public
or DNS Ollama hosts receive only status, match count, direct-match status, top
match kind, and top relevance. No summary, overview, arbitrary metadata,
prompt, raw provider response, or model reasoning is returned or persisted.
Catalog titles are normalized to a bounded single line and retrieval labels
are allow-listed before prompt construction.

The result is evidence for the existing advisory candidate comparison only.
It cannot auto-route an item, change an existing policy, modify RAG history,
or bypass the operator confirmation card.

## Implementation Map

- `currentLibraryCandidateRetrievalContract.mjs` validates and bounds the
  server-owned lookup request.
- `currentLibraryCandidateRetrieverQuery.mjs` owns the static parameterized
  PostgreSQL statement.
- `currentLibraryCandidateRetriever.mjs` performs the read-only lookup and
  fail-closed unavailable projection.
- `policyCandidateAdjudicationEvidence.mjs` combines current-library evidence
  with the existing profile and history evidence, then minimizes it by provider
  trust boundary.
- `classificationPolicyPathService.mjs` supplies metadata to that evidence
  builder without changing its deterministic decision path.
- `aiPromptBuilderFormatters.mjs` presents the bounded catalog facts as
  untrusted evidence within the existing closed-candidate prompt.

## Verification Plan

Focused tests cover request bounding, query parameters, unexpected database
rows, per-candidate caps, unavailable retrieval, local detail, remote detail
removal, and the policy-path metadata handoff. Full backend type, lint, Knip,
and unit suites follow before commit.

## Local Retrieval Evaluation

The exact prepared SQL was executed read-only against the local Compose
PostgreSQL instance with 6,690 synchronized items. A no-match probe over the
three largest movie candidates examined 4,601 candidate rows and completed in
218 ms (`EXPLAIN ANALYZE`); a smaller two-library probe completed in 28 ms.
Those are development measurements, not an SLA. They support shipping this
bounded lookup without a write-heavy GIN index now while retaining the next
step to instrument latency and reassess an index or embedding lifecycle on
larger inventories.

## Open-PR Check

The repository Pull Requests API was checked on 2026-08-30 and returned zero
open pull requests. No arbitrary closed or merged pull request was copied into
this change, so there is no local-only PR implementation in this outcome.

## Next Item

Measure this lexical lookup under a realistic library-sync cohort. If its
latency or recall warrants it, design a separately authorized **current-library
embedding lifecycle**: versioned item text projection, queue/backfill,
incremental refresh, candidate-only vector filtering, permission-aware
partitioning, deletion propagation, fixed retrieval caps, and an operator
agreement/false-route evaluation cohort. Do not start embedding every item
until the provider, resource, retention, and evaluation policy is approved.
