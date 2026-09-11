# Retrieval Evaluation Recovery — Outcome

Status: implemented, unreleased on 11 September 2026. No version bump or release.

## Delivered

- Corrected the Windows-only expectation in the completion command test so it
  follows the native Node path behavior used by the implementation.
- Recompute reviewer consensus on every attempt and verify an existing
  reference-set document before continuing after a downstream failure.
- Return `reference_set_conflict` when current labels differ from the saved
  reference set; preserve the existing file and stop before inference.
- Reject equivalent input/output paths, including dot-segment aliases and
  Windows separator/case variants, before starting a stage.
- Keep changes in the existing ESM modules. Add no settings, confirmation
  controls, dependencies, database schema, or production routing behavior.

## Local study result

The real Compose packet-capture command returned `not_ready` and created no
study packet. Read-only diagnostics established the current blocker:

| Observation | Measured value |
| --- | --- |
| Normal policy lifecycle receipts | 0 |
| Complete policy-purpose evidence | 0 |
| Active policies | 10 |
| Policies with only inferred profile purposes | 10 |
| Candidate items inspected | 6,649 |
| Qualifying comparisons | 0 |
| Independent labels available | No |

All inspected items were excluded with `no_qualifying_policy_evaluations`;
the policy source screen reported `all_purpose_rules_excluded_as_inferred_profile`.
No real scoring or representation-comparison result is claimed. The recovery
test uses synthetic packet/label data and an unavailable-provider stub only.

## Validation

The regression test first reproduced the failure on the second invocation:
`reviewer_consensus_incomplete` after a valid reference set was already saved.
With the fix, both attempts reach the provider stage. A subsequent change to
both reviewers' labels produces a conflict and preserves the original file.
Additional checks cover read/write errors and path aliases. Verification passed:

- Full Windows backend suite: 1,204 suites, 34,020 tests.
- Focused recovery suites: 17 tests on Windows and 16 on Linux (the additional
  Windows test checks case aliases). Linux used an isolated filesystem with
  Node 24.18.1, npm 12.0.2, and freshly installed locked dependencies.
- Backend security/test lint, backend type checking, documentation lint,
  static ESM imports, ESM mock shapes, and `git diff --check`.
- Local Compose rebuild and `GET /health`: healthy, database connected.

No client code or API contract changed, so no additional frontend tests were
needed for this patch.

## Pull requests

The GitHub MCP search for open pull requests in `cloudbyday90/Classifarr`
returned an empty set on 11 September 2026. No open PR was available to select,
implement, or merge. [Repository pull requests](https://github.com/cloudbyday90/Classifarr/pulls)

## Next high-value component

Reassess the study source-selection gate. The present evaluator depends on
declared policy evidence, so it cannot measure the library-profile inference
that Classifarr is meant to improve on this installation.

Design an evaluation-only inventory sampler that can compare item descriptions
and neighbors across libraries while recording inferred purposes as inferred.
Use independently established outcomes where available and report unlabeled
coverage honestly. Keep that sampling contract separate from live routing
admission; accepting an item for measurement must not promote an inferred
library profile into an operator declaration. This is the next component to
implement before adding more completion commands or study controls.
