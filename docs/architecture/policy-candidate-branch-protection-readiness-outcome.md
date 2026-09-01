# Policy-Candidate Branch-Protection Readiness Outcome

## Repository findings

On 2026-09-01, `main` had no branch protection rule and no repository ruleset.
The new replay job is intentionally pull-request-only, so its first push-to-
`main` workflow run was skipped rather than executed. The public repository had
zero open pull requests, so no real PR run of the check was available.

The latest CI run also failed before the test suite at the server Knip
dependency-declaration gate. Knip identified three exports that were declared
but not imported by production code or tests.

## Delivered

Removed only the three stale ESM exports:

- the unused review-history retention-period aggregate;
- the unused default correction-review retention value; and
- the unused projection revision and snapshot-ID pattern aliases.

The remaining private constants and all exported runtime APIs retain their
existing values and behavior. This corrects the CI precondition without
changing policy, AI/RAG, persistence, data access, or routing.

## Validation

The repair is validated with the server Knip checks and focused correction-
review contract tests. Documentation linting, project linting, and TypeScript
checks confirm the unchanged ESM boundaries and documentation quality.

## No configuration or release change

No branch rule, ruleset, pull request, tag, image, release, or deployment was
created or modified. Making `main` protected remains deferred until a real PR
has emitted a successful **Policy Candidate Synthetic Replay** check and the
administrator explicitly chooses the direct-push/review policy.

## Next item

Create or use the next ordinary code-change pull request, confirm the replay
check passes there, then choose whether `main` should require pull requests
and configure the exact replay check as required. This is the first action that
can safely complete the branch-protection rollout.
