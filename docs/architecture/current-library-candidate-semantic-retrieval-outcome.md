# Current-Library Candidate Semantic Retrieval Outcome

## Status

Implemented and validated locally on 2026-09-01. No release is created by
this change.

## Delivered Behavior

The policy engine still owns candidate selection and the operator still owns
routing. When the engine chooses the existing `prompt_select` path, the new
retriever now:

1. formats the incoming canonical metadata with the existing embedding
   formatter;
2. creates one embedding only when RAG is enabled;
3. searches a fixed HNSW window only across the two or three policy-owned
   candidate libraries; and
4. returns no more than three stable-ID-joined current inventory items per
   candidate as advisory evidence for the existing constrained AI comparison.

The persisted candidate-adjudication record retains only a fixed semantic
availability status. It does not retain titles, descriptions, identifiers,
vectors, prompts, model responses, provider details, or scores.

## Files and Boundaries

- `currentLibraryCandidateSemanticRetrievalContract.mjs` owns fixed budgets,
  candidate ownership, and metadata formatting admission.
- `currentLibraryCandidateSemanticRetrieverQuery.mjs` owns static,
  parameterized, stable-ID-scoped SQL.
- `currentLibraryCandidateSemanticRetriever.mjs` owns the read-only provider
  call, query-local pgvector recall settings, result minimization, and
  fail-closed behavior.
- Existing policy evidence, prompt, result, and presentation modules receive
  fixed projections only. The review UI shows the semantic availability only
  in the existing evidence disclosure.

This preserves the principles documented in the
[design](current-library-candidate-semantic-retrieval-design.md): no global
library search, no model-owned destination selection, no automatic route, and
no duplicate embedding corpus.

## Validation

- The complete server unit suite passed: 1,009 suites and 28,077 tests. This
  includes provider failures, unavailable RAG, invalid candidate contracts,
  remote-provider data minimization, projection allow-listing, prompt
  construction, policy-path propagation, and existing settings routes.
- The complete Vue unit suite passed: 311 files and 4,192 tests, including the
  compact evidence disclosure and normalized fixed semantic status.
- Node syntax checks passed for all changed server and client modules.
- A read-only local Compose query executed the same stable-ID current-inventory
  join against three policy candidates and returned bounded results for each
  candidate. It confirmed the existing HNSW corpus can support this component
  without a migration or a backfill.
- A no-cache local Compose rebuild completed successfully. The recreated
  container became healthy, and an in-container, provider-free integration
  probe returned `available` semantic evidence with at most three items for
  each of three policy candidates.

## Pull Request Check

The GitHub Pull Requests API returned no open pull requests for
`cloudbyday90/Classifarr` during this work. Consequently, no unrelated PR was
implemented locally; doing so would require inventing a source change.

## Follow-up

Build an offline, labelled evaluation set for ambiguous documentary, reality,
and genre-overlap cases. Measure whether candidate-scoped semantic
counter-evidence safely identifies broad-policy false positives before any
proposal to change deterministic policy scores, candidate ranking, or routing
thresholds.
