# Policy Candidate Adjudication Outcome

## Status

Implemented on 2026-08-30. No release was created.

## Delivered Behavior

When a current policy result is `prompt_select`, Classifarr can now ask the
configured classification provider to compare a bounded set of two or three
policy-eligible destinations. The result is explicitly advisory: it is shown
in the existing Needs Attention decision card and the operator still chooses
the destination before media can route.

The server records one of three fixed outcomes:

- `proposed` — a valid response selected one of the bounded candidates;
- `abstained` — the provider requested clarification or did not propose one;
- `response_rejected` — the provider response was malformed or outside the
  advisory contract.

No model reason, confidence, prompt, chain-of-thought, raw response, or
library evidence is retained or displayed.

## Implementation Map

- `policyCandidateAdjudicationContract.mjs` defines the policy-owned bounded
  candidate contract and persistence projection.
- `policyCandidateAdjudicationEvidence.mjs` assembles and provider-scopes
  profile and retrieval evidence.
- `policyCandidateAdjudicationResult.mjs` validates provider output and
  reduces it to a review-only result.
- `policyCandidateAdjudicationPresentation.mjs` converts persisted status into
  fixed operator-safe language.
- `classificationPolicyPathService.mjs` selects the path and bypasses the RAG
  rerouting loop for adjudication so a provider cannot gain route authority.
- `classificationAiService.mjs` projects local versus remote evidence and
  disables the generic RAG prompt section in this mode.
- `ollamaLocalEndpointTrust.mjs` independently verifies that an Ollama host is
  syntactically local before detailed evidence is eligible for its prompt.

## Provider Evidence Trust Boundary

An Ollama provider type alone is not proof that its configured endpoint is
local. Detailed profile distributions and limited historical titles are now
sent only to the Docker `ollama` service name, `localhost`, loopback, private
IPv4, or private/link-local IPv6 endpoints. The check never resolves arbitrary
DNS names, so a hostname cannot widen the boundary through DNS changes. All
other Ollama hosts receive the same aggregate-only evidence as cloud providers.

This preserves a typical Unraid private-LAN address such as `192.168.50.95` as
a local endpoint while protecting against a public or third-party Ollama URL.

## Local Validation

Focused server validation passed:

- 229 focused tests across the contract, evidence minimization, result
  validation, deterministic mode, protected policy path, prompt construction,
  persistence, and presentation.
- Server TypeScript checking passed.

Full backend unit validation also passed: 889 test suites and 25,672 tests.

Focused client validation passed:

- 6 tests for the decision card, including the fixed advisory presentation and
  rejection of raw reasoning fields.

Full client validation also passed: 252 test files and 3,677 tests, followed
by Vue type checking, ESLint, and a production Vite build.

The project test wrappers were used because direct package-runner invocations
do not load the repository's ESM and Vite alias setup.

## Open-PR Check

The repository Pull Requests page was checked on 2026-08-30 and reported zero
open pull requests. No arbitrary closed or merged pull request was copied into
this change; there was therefore no independent open PR to implement locally.

## Follow-up

The highest-value next component is a **current-library item retrieval index**:
create embeddings from actual `media_server_items`, maintain them on library
refresh, retrieve only the bounded candidates, and measure whether that
improves operator agreement without increasing false automatic routes. This is
separate from the existing classification-history RAG corpus and needs its own
schema, backfill, lifecycle controls, privacy budget, and evaluation cohort.
