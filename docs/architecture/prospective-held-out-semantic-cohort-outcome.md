# Prospective held-out semantic cohort outcome

Status: Implemented, unreleased. See the separate
[design](prospective-held-out-semantic-cohort-design.md) for the decision,
research, alternatives, and recommendation stack.

## Delivered

- Added an ESM-only, stdin-free private cohort command:
  `npm --prefix server run study:capture:held-out-cohort --silent`.
- Added a parameterized current-inventory frame reader that chooses canonical
  movie/TV identities, excludes current source-conflict observations, retains
  metadata only in memory, and samples deterministic bounded strata.
- Changed held-out candidate preparation to use broad policy signals with an
  empty RAG cache before semantic retrieval. The existing held-out semantic
  retriever now evaluates only a cohort that was already fixed.
- Added a balanced 24–32-case planner. It requires a valid `ready` two- or
  three-candidate policy contract for every selected case, never replaces a
  failed case after retrieval, and returns no partial cohort.
- Added content-free fixture, snapshot, and manifest construction for a future
  independently labelled bundle. The bundle contains no human labels and has
  no readiness, policy-change, or automatic-routing authority.
- Added status-only aggregate eligibility diagnostics so a failed cohort run
  identifies the contract state that prevented sampling without exposing media
  records.

## Local Compose execution

The command ran against the real local Compose inventory in a read-only process
on 7 September 2026. It sampled the configured 96-candidate frame for each
stratum and returned `insufficient_eligible_cases`. All **384** screened cases
reported `not_pending_policy_decision`; none met the current broad-policy
`ready` candidate-comparison contract. It produced no cohort, semantic snapshot,
fixture bundle, human label, readiness result, or frozen study preflight result.

This is the correct fail-closed result. It is evidence that the current policy
configuration does not presently expose a broad-policy comparison cohort; it
is not evidence about semantic accuracy, a provider failure, a human label, or
a reason to loosen the study gate.

The command's redacted receipt is retained only under ignored `.tmp/`. The
database remained read-only during the run. A pre-rebuild local database dump
was also retained under `.tmp/` with a SHA-256 checksum. No release, tag,
policy mutation, routing change, or production data export occurred.

## Verification

- Focused held-out service and script tests: 26 tests across 6 suites passed.
- Server lint and TypeScript type checks passed.
- Static ESM import and ESM test mock-shape checks passed.
- A clean no-cache Compose provenance rebuild passed and recreated a healthy
  service from the committed source revision.
- The real local cohort command completed with the fail-closed aggregate result
  above. Its receipt includes no raw media metadata.

## Pull-request check

GitHub's pull-request endpoint for `cloudbyday90/Classifarr` returned zero open
pull requests on 7 September 2026. There was therefore no random open PR to
implement locally; no closed or merged PR was substituted.

## Follow-up

The subsequent [policy-eligibility audit](held-out-semantic-policy-eligibility-audit-outcome.md)
confirmed that the complete canonical population has no broad-policy ranked
candidate under this study boundary. The next item is native policy-intent
coverage design, followed by a new audit and then cohort capture. Only a
complete cohort with genuine independent double-blind human labels can proceed
to the existing readiness and frozen-study preflight gates.
