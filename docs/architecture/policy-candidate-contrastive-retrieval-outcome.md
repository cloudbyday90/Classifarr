# Policy Candidate Contrastive Retrieval Outcome

Status: Implemented (unreleased)

Date: 2026-08-30

## Delivered Outcome

Pending confirmation and destination-selection decisions now receive a
content-free cross-library identity result when a stable TMDb ID and at least
two policy-ranked active same-media-type candidates are available.

The new **Cross-library identity check** appears below the existing candidate
evidence card. It can say that current inventory supports the leader, favors an
alternative, is shared and non-discriminating, supplies no match, lacks a
stable identity, or was unavailable. The alternate-match case is displayed as
counter-evidence, not a destination choice or automatic route.

Older pending decisions will not gain this result retroactively. Use **Retry
Classification** to evaluate the current policy and generate the new bounded
check for an item.

## Implementation

- Added separate ESM contract, query, retriever, and evidence-projection
  services rather than enlarging the existing lexical RAG/current-library
  singleton.
- Added one exact, parameterized `media_server_items` lookup over only the
  policy-owned candidate IDs. The query returns no catalog text.
- Added fail-closed persistence and runtime-question projections that retain
  only fixed version, provenance, and status identifiers.
- Added a client allow-list presentation utility and an accessible fixed-copy
  status card; it does not render raw server values or move focus.
- Added tests for active same-media candidate bounds, absent stable identity,
  parameterization, unexpected and duplicate database rows, retrieval failure,
  every comparison state, persistence containment, runtime projection, client
  fail-closed behavior, and accessible rendered copy.

## Pull Request Check

The GitHub Pull Requests MCP query returned no open pull requests for
`cloudbyday90/Classifarr` on 2026-08-30. No unrelated, closed, or merged pull
request was applied locally.

## Validation

- Focused server tests: 6 suites, 80 tests passed.
- Focused client tests: 3 files, 14 tests passed.
- Full workspace suite: server unit 905 suites / 26,012 tests; integration 75
  passed with one existing skip; client 260 files / 3,746 tests.
- Quality checks passed: typecheck, lint, docs lint, client production build,
  static ESM import checks, ESM test-mock-shape checks, copyright check, and
  `git diff --check`.
- Coverage-ratchet check passed for both server and client.
- Security-diff review covered all 19 changed code and test surfaces and found
  no reportable issues. The contrastive path was specifically reviewed for
  candidate-set authorization, parameterized inventory access, data
  minimization, persistence projection, and accessible client rendering.

## Next Item

Add aggregate-only contrastive-outcome attribution: bucket operator resolutions
by the fixed contrastive status and record whether the final selection remained
within the policy candidate set. This will tell us whether an
`alternative_identity_match` predicts a changed operator decision and whether
neutral Katrina-like new items require better policy metadata or a carefully
evaluated semantic-retrieval trial. It must not persist catalog, candidate,
destination, or media identity, nor change routing.
