# Server tooling PR #530 outcome

Date: 2026-09-07.

## Local implementation

Applied [PR #530](https://github.com/cloudbyday90/Classifarr/pull/530)'s exact package
and lockfile patches locally after a random draw from three open PRs. The original
GitHub PR was not merged. Existing runtime dependency updates were preserved.

Installed versions were verified with `npm ls --depth=0`: `@types/node` 26.4.1,
`globals` 17.12.0, Jest 30.5.1 and Knip 6.34.0. The host used
`npm --prefix server ci --ignore-scripts`; its registry audit reported zero known
vulnerabilities at install time. This is an advisory check, not a security guarantee.

The [design](server-tooling-530-design.md) links the official September Jest/globals
releases, August 31 Knip release and Node declaration source, and compares options.
The recommended stack is the exact lockfile, existing ESM runner, real PostgreSQL
regressions, typechecks, scoped ESLint and production Knip dependency analysis.

## Outcome and limits

The updated Jest runner executed the capture/persistence and database regression
tests successfully. Typechecks and scoped ESLint passed with the updated Node
declarations and globals; Knip production dependency analysis passed. The normal
Docker installation/application build also succeeded. The companion
[capture outcome](original-candidate-capture-outcome.md) records the final test
counts and container verification.

The benefit is maintained development tooling with relevant ESM resolution fixes.
The cost is continuing to validate behavior changes in tooling updates. The
existing Node 26 declaration / Node 24 runtime mismatch remains a separate
alignment concern; no newer runtime API was introduced. No full-repository Knip
export scan or full Jest suite was claimed. No dependency major migration,
release, version bump, image publication or original-PR merge was performed.
