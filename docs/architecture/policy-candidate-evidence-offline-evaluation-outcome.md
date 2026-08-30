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
`abstain` reference decisions. The eight-case corpus correctly demonstrates
why the result is not ready for runtime use: candidate scope and exact
contrastive evidence each have 50% review recall, while the snapshot semantic
signal reaches 66.7% review precision, 50% recall, 25% abstention, and 62.5%
three-way agreement.

## Delivered Implementation

- Added modular ESM contract, mapping, metrics, and evaluator services.
- Added a strict, versioned JSON fixture contract and a mirrored Draft 2020-12
  schema.
- Expanded the corpus to eight documentary/comedy/series and uncertainty cases
  with reviewed admit, review, and abstain references.
- Added the independently documented snapshot adapter and fixed-path runner.
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

The semantic-snapshot validation pass completed on 2026-08-30:

- `npm run test:offline:policy-candidate-evidence-evaluation` passed and
  produced a valid eight-fixture report.
- `npm run test:offline:policy-candidate-semantic-snapshot-evaluation` passed
  with valid content-address, fixture/snapshot-binding, and status-only output.
- Focused server tests: 9 suites and 32 tests passed.
- Root lint, server/client type checks, documentation lint, production client
  build, static ESM import checks, test mock-shape checks, and copyright checks
  passed without regression.
- The final security diff scan reviewed all 16 changed executable/package/test
  files and found no reportable issue.

## Next Item

Build a deterministic **snapshot-artifact generator and review workflow** for
a larger, independently human-reviewed corpus. It must redact source content
before embedding, record corpus/snapshot provenance and content addresses, and
evaluate precision, recall, abstention, and confidence intervals by cohort.
Keep it offline and do not connect it to routing or the pending-review UI.
