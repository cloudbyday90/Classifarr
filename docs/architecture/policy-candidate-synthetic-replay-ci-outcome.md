# Policy-Candidate Synthetic Replay CI Outcome

## Delivered

`ci.yml` now contains the independently named **Policy Candidate Synthetic
Replay** job. It runs only for pull requests targeting `main` and invokes:

```text
node scripts/run-policy-candidate-synthetic-replay-evaluation.mjs
```

The runner consumes only the checked-in opaque fixture corpus and prints its
existing aggregate report. No action in the job installs a package, uses a
secret, retains an artifact, accesses live media or a provider, calls AI/RAG,
or carries routing authority.

## Security outcome

- The trigger is `pull_request`, not `pull_request_target`.
- The job uses explicit `contents: read` permission only.
- Checkout uses the repository's full-SHA pin and disables persisted
  credentials.
- Node setup uses the repository's existing full-SHA action pin and `.nvmrc`.
- The job has a five-minute time limit and no cache, artifact, environment, or
  user-provided command input.

## Validation

Local validation results are recorded with this change:

- GitHub Actions syntax validation via `actionlint .github/workflows/ci.yml`.
- Fixed offline replay execution via
  `npm run test:offline:policy-candidate-synthetic-replay`.
- Repository documentation linting and whitespace validation.

## Pull-request inventory

The public pull-request list was checked on 2026-09-01 and reported **zero
open pull requests**. No random open PR therefore existed to implement locally,
and none was fabricated, merged, or otherwise changed.

## No release

This is an unreleased CI and documentation change. It does not create a tag,
image, GitHub release, policy revision, or runtime deployment.

## Next item

After the check passes once on a real pull request, make **Policy Candidate
Synthetic Replay** a required status check for `main`. That is a repository
administrator change, not a code change; it should be made only after the
check name and successful behavior have been observed in GitHub Actions.
