# Identity observation and semantic-learning reassessment outcome

Date: 2026-09-10. See the separate
[design](identity-observation-and-semantic-learning-reassessment-design.md)
for the analysis, alternatives, and research.

## Reconciled implementation

The daily source-identity replay observation now retains exactly 120 UTC
calendar dates. It calculates the first retained date as `today - (N - 1)` and
continues to delete only earlier rows. This corrects the former inclusive
121-date result without changing what the observer reads, calls, stores, or
authorizes.

The correction preserves the existing boundaries:

- selection remains a short `REPEATABLE READ READ ONLY` database transaction;
- source-server and TMDb work still occurs only after that transaction ends;
- persisted data remains a fixed aggregate receipt; and
- the scheduled task still cannot call AI, retrieve RAG evidence, alter a
  policy, or route media.

## Verification

- The focused ESM test suites for the observer and its read boundary pass
  locally: 2 suites, 10 tests.
- The regression suite proves the 120-day boundary and the one-day boundary.
- The running local Compose service is healthy and contains both the observer
  and the private semantic-study capture modules. Its current logs report no
  pending embedding backfill.
- GitHub's documented open-pull endpoint returned zero open pull requests for
  this repository on 2026-09-10. No unrelated, closed, or merged pull request
  was substituted or merged.

## What this does not claim

This is not an AI/RAG improvement, a semantic evaluation result, or a routing
change. The prior commit remains an identity-repair observability component.
It does not solve the policy-candidate coverage gap that prevents the real
semantic study from forming a valid broad-policy cohort.

## Next item

Implement a modular **draft-only declared-purpose reconciliation service**.
It should reconcile later validated operator outcomes with policy coverage,
identify only aggregate coverage gaps, and prepare a normal policy-edit draft
without silently applying it. That is the smallest component that can increase
valid candidate comparison coverage while preserving the distinction between
what is currently in a library and what the owner intends the library to be.
