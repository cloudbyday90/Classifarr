# Server tooling PR 597 assessment outcome

November 23, 2026 Eastern. See the
[design](server-tooling-pr-597-design.md) for candidate releases and tradeoffs.

## Adopted versions

Adopted Knip 6.46.1, Testcontainers 12.2.2 and `@testcontainers/postgresql`
12.2.2 locally. Independent generation against today's registry refreshed
several unrelated development packages. Kept the selected PR's reviewed
package resolutions and corrected the PostgreSQL adapter's declared range
to its published `^12.2.2`. Both installed Testcontainers packages are
still pinned directly to 12.2.2.

All changed lock entries are development-only. The reviewed graph upgrades
`@types/dockerode` and `async-lock`, uses the already locked `ssh2` directly,
and drops `ssh-remote-port-forward` and its redundant type entries. The
package manifests and lock preserve production resolutions, overrides and
the existing lifecycle script decisions. [Selected PR](https://github.com/cloudbyday90/Classifarr/pull/597)

## Verification

- Node 24.22.3 and npm 12.2.2 completed a strict clean install. The installed
  full tree resolved successfully and the development-inclusive server audit
  reported zero vulnerabilities on November 23, 2026 Eastern.
- Cold Knip passed in standard and production dependency modes. The tooling
  policy suite passed 126 tests with one Linux-only WASI control skipped on
  Windows. The updated Testcontainers pair started and tore down the
  isolated PostgreSQL fixture for all 30 scoped tests. This run covered the
  local Docker path. Custom `.cmd` credential helpers and remote SSH daemon
  connections were outside these controls.
- Fresh backend coverage and the normal quality gates passed on the selected
  pins. [Combined test results](learning-answer-receipt-identity-outcome.md)
- Both Dependabot heads were current at the initial comparison. PR 596's
  server tests failed on the current base at the version assertion and
  interceptor composition check. The selected changes were tested locally
  on `main` with the PR left unmerged.
  [PR 596 test job](https://github.com/cloudbyday90/Classifarr/actions/runs/45150533936/job/137610501954)

## Follow-up

Qualify the runtime dependency change in PR 596 separately using its failed
check evidence and the affected transport tests.
