# Policy Candidate Evidence Offline Evaluation Outcome

Status: Implemented (unreleased)

Date: 2026-08-30

## Delivered Outcome

Classifarr now has a reproducible, local-only gate for evaluating a future
semantic/RAG signal against deterministic policy evidence. The command

```text
npm run test:offline:policy-candidate-evidence-evaluation
```

reads one committed fixture file and writes a JSON report to standard output.
It performs no AI call and cannot change an item, policy, route, retry,
learning state, database, or operator workflow.

The report compares three signals with explicit `admit`, `review`, and
`abstain` reference decisions. The initial corpus correctly demonstrates why
the result is not ready for runtime use: candidate scope and exact contrastive
evidence each have 50% review recall in the small cohort, while the manually
specified semantic proposal has 100% agreement only because it is a design
fixture, not a measured retriever.

## Delivered Implementation

- Added modular ESM contract, mapping, metrics, and evaluator services.
- Added a strict, versioned JSON fixture contract and a mirrored Draft 2020-12
  schema.
- Added the four-case documentary/comedy/Katrina-like offline corpus and its
  fixed-path runner.
- Added focused tests for valid input, unknown-field rejection, enum rejection,
  duplicate IDs, fail-closed reports, signal mappings, metrics, and corpus
  validity, including inherited JavaScript property-name rejection.
- Updated the Unreleased changelog with the evaluation and its authority
  boundary.

## Open Pull Request Check

The GitHub pull-request query returned no open pull requests for
`cloudbyday90/Classifarr` on 2026-08-30. Therefore no unrelated PR could be
selected and applied locally; no closed or merged change was substituted.

## Validation

The focused validation pass completed on 2026-08-30:

- `npm run test:offline:policy-candidate-evidence-evaluation` passed and
  produced a valid four-fixture report.
- Focused server tests: 5 suites and 26 tests passed.
- Server unit tests: 917 suites and 26,239 tests passed. Server integration
  tests: 75 of 76 suites and 868 of 869 tests passed; the one existing skip is
  intentional.
- The full client suite completed before the server-only hardening change: 262
  files and 3,766 tests passed.
- Lint, server/client type checks, documentation lint, production client build,
  static ESM import checks, test mock-shape checks, copyright checks, and the
  coverage ratchet passed without regression.
- The final security diff scan reviewed all 12 changed executable/package files,
  including the own-property lookup hardening, and found no reportable issue.

## Next Item

Build a **read-only, snapshot-pinned semantic retrieval adapter** for this
offline evaluator. It should consume a redacted, versioned local embedding
snapshot and emit only `supports_leading_candidate`,
`supports_alternative_candidate`, or `abstain`. First enlarge the corpus with
human-reviewed examples and publish precision, recall, abstention, and
provenance results; do not connect the adapter to routing or the pending-review
UI.
