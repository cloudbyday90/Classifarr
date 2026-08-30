# Current-Library Candidate Retrieval Telemetry Outcome

Status: Implemented (unreleased)

Date: 2026-08-30

## Delivered Behavior

Classifarr now records a content-free retrieval observation whenever the
bounded current-library candidate lookup runs. The observation is persisted on
the already-retained classification history row and is visible only through a
read-only aggregate Statistics report.

The new **Candidate Retrieval** Statistics tab shows:

- retrieval availability and catalog-match presence;
- a five-band latency distribution;
- bounded AI proposal/operator agreement and pending proposals; and
- an explicit explanation that agreement is observational, not routing or
  model authority.

New installations and existing history begin with no telemetry data. This is
expected: no backfill is attempted because the prior rows do not contain a
trusted measurement of lookup latency. New candidate-adjudication
classifications populate the report after their first complete UTC-day window.

## Implementation Map

- `currentLibraryCandidateRetrievalTelemetry.mjs` owns the fixed telemetry
  contract and persistence projection.
- `currentLibraryCandidateRetriever.mjs` measures the read-only lookup and
  emits the bounded observation for both available and unavailable outcomes.
- `policyCandidateAdjudicationEvidence.mjs` carries only the validated
  telemetry projection back to the classification path; it is never provider
  evidence.
- `classificationPolicyPathService.mjs` preserves the telemetry through
  adjudication, AI-unavailable, and deterministic-abstention outcomes.
- `classificationPersistenceService.mjs` writes the allow-listed projection.
- `currentLibraryCandidateRetrievalMetrics*.mjs` separate report shaping,
  static aggregate SQL, and service orchestration.
- `statsRouteCurrentLibraryCandidateRetrieval.mjs` exposes the authenticated
  read-only endpoint; the Vue Statistics tab consumes it through the existing
  centralized API layer.
- `20260830_100000_add_current_library_candidate_retrieval_metrics_index.sql`
  adds the version-filtered aggregate-query index.

## Boundaries Preserved

No telemetry field contains catalog title, identifier, library identity,
provider/model identity, prompt, response, actor, or exact lookup duration.
The telemetry object cannot be supplied by a browser or provider, and the
aggregate endpoint accepts only a bounded day window. It cannot route media,
retry classification, change a policy, call an AI provider, learn, or create
an embedding.

## Validation Completed

- Server unit coverage passed: 896 suites and 25,818 tests. It covers
  latency-band mapping, persistence rejection, retriever success/failure
  telemetry, aggregate-window/report calculations, static SQL
  parameterization, metrics service, route bounds, and policy-path
  propagation.
- Client unit coverage passed: 253 files and 3,689 tests, including loading,
  error, and accessibility behavior for the read-only view.
- Integration coverage passed and verifies the authenticated statistics response is
  aggregate-only and exposes no item, catalog, provider, prompt, response, or
  destination fields.
- The authoritative schema snapshot check and migration integrity check passed.
  The migration was applied to local Compose PostgreSQL, and the exact
  aggregate query was prepared and executed read-only before commit.

## Next Item

Implement the separate
[candidate-set outcome attribution](current-library-candidate-retrieval-outcome-attribution-design.md)
before interpreting an operator alternative as a lexical-retrieval miss. After
a representative attributed cohort exists, keep lexical retrieval if
availability and latency are healthy, outside-candidate selections are low,
and policy-ranking review explains the remaining alternatives. Consider a
versioned current-library embedding lifecycle only after an explicit recall
decision with retention, deletion, partitioning, poisoning, cost, provider,
and offline-evaluation controls. Do not infer that need from an empty or
immature telemetry window.
