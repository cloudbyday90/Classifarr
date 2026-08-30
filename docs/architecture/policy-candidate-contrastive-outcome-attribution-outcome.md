# Policy Candidate Contrastive Outcome Attribution Outcome

Status: Implemented (unreleased)

Date: 2026-08-30

## Delivered Outcome

Classifarr now measures the relationship between a prior exact cross-library
identity status and a later server-validated operator resolution. The new
**Inventory Contrast** Statistics tab shows six fixed status buckets and only
aggregate counts/rates. It is descriptive: it cannot alter policy, AI, retry,
learning, routing, or the existing operator decision.

Each new attribution retains exactly a version, prior contrastive status, and
candidate-set selection status. It never retains or returns media, catalog,
candidate, library, destination, actor, provider, prompt, response, or free
text. Historic decisions are not backfilled; use normal retry and operator
resolution flows to create new observations.

## Delivered Implementation

- Added a shared ESM candidate-set resolution reducer and extracted the generic
  complete-UTC-day metrics window from the existing retrieval-specific module.
- Added a separate contrastive outcome-attribution service, projection, static
  aggregate repository, metrics service, and authenticated route.
- Extended the existing outcome write boundary only to persist the allow-listed
  two-axis attribution outside the mutable outcome path.
- Added an API leaf, client allow-list presentation utility, and a separate
  native-table Statistics tab with atomic polite status feedback.
- Added focused server/client, API-barrel, route, integration, security-boundary,
  and accessibility coverage.

## Open Pull Request Check

The GitHub Pull Requests MCP query returned no open pull requests for
`cloudbyday90/Classifarr` on 2026-08-30. No unrelated, closed, or merged pull
request was applied locally.

## Validation

The final validation pass completed on 2026-08-30:

- Server unit suite: 912 suites and 26,144 tests passed.
- Server integration suite: 75 of 76 suites and 868 of 869 tests passed; one
  existing suite/test is intentionally skipped.
- Client suite: 262 files and 3,764 tests passed.
- Typecheck, lint, documentation lint, production client build, static ESM
  import and mock-shape checks, copyright check, whitespace check, and coverage
  ratchet all passed.
- The coverage ratchet reported no regression in either server or client
  statements, branches, functions, or lines.
- The completed security diff scan reviewed all 32 changed implementation and
  test files, found no reportable issue, and verified the aggregate-only,
  authenticated, parameterized, fail-closed boundary.

## Next Item

Add a bounded replay/evaluation fixture set for documentary, comedy, and
Katrina-like ambiguous examples. The evaluation should compare deterministic
candidate scope, exact contrastive status, and a proposed semantic-retrieval
signal offline. It must report precision/recall and abstention rates before
any RAG or local-model evidence is allowed into the operator workflow.
