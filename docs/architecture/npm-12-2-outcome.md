# npm 12.2 Update Outcome

Date: 2026-10-02. Design: [npm 12.2 update](npm-12-2-design.md).

## Changes

- npm/npx 12.2.0 is pinned in Docker, CI and workspace metadata.
- Strict, exact dependency-installer decisions replace implicit defaults.
  Only bcrypt's installer is approved; optional/telemetry installers stay denied.
- An ESM regression suite checks version alignment, policy coverage and actual
  offline npm execution for unknown, denied and approved local installers.
- Setup guidance no longer passes npm 12 the unsupported native-build flag;
  the existing CLI flag checker now detects that pattern.
- The Windows ESLint warning was reproduced and reported in
  [microsoft/vscode-eslint#2237](https://github.com/microsoft/vscode-eslint/issues/2237).
  It remains an upstream issue, not a warning suppressed or fixed by this update.

## Validation

| Check | Result |
| --- | --- |
| Clean root, client and server installs with npm 12.2.0 | Passed; no installer-policy warnings |
| npm/npx version checks | Both 12.2.0 in the isolated local CLI |
| Dependency lockfile comparison | Identical graphs; only root npm engine requirements changed |
| Root dependency regression suite | 42 tests passed, including three real npm policy cases |
| Linux installer-policy regression suite | 10 tests passed with the image-installed npm; network disabled |
| Targeted backend regression tests | 54 passed: CLI flags, workflow contract and ownership gate |
| Client unit tests | 416 files / 5,910 tests passed |
| Client production build | Passed |
| Server security/test lint, client lint, both type checks | Passed |
| npm audits: root, client, server | Zero reported vulnerabilities at review time |
| Documentation, copyright and CLI-flag checks | Passed |
| Full backend unit tests | 1,619 suites / 49,543 tests passed; one skipped; one initial review-record failure corrected and retested in the 54-test targeted run |
| Linux candidate build | Passed on unchanged retry after initial registry read timeouts |
| Linux runtime checks | npm/npx 12.2.0, Node 24.18.1 and bcrypt hash/compare passed |
| Linux startup/upgrade smoke suite | All four scenarios passed; disposable containers and volumes removed |
| Linux migration-tree suite | All 5 tests passed, zero skipped, including the strengthened real directory-fsync copy case |

### Review Record Repair

The full backend run exposed five stale/missing ownership-review entries from
the preceding pgvector commit `db329d57`, not a new npm behavior regression.
Reviewed changes were the forward-only 0.8.6 migration guard, the 0.8.7 migration,
the fresh schema's version/ledger entry, and two disposable release rehearsals
preparing the pinned extension version before replay.

Only those fingerprints and the missing migration entry were updated. Existing
`sql_history` and `maintenance_debt` classifications and analysis fingerprints
were retained. No unresolved writer was reclassified as safe; the gate still
does not authorize production ownership takeover. Its regression rerun passed.

### Platform Skip Review

The one Windows skip is `embeddedMigrationTree.test.mjs`'s complete-copy case.
It invokes real directory `fsync`, a Linux deployment operation. Ubuntu CI's
normal backend suite selects it; it is not permanently disabled. Keep that
platform boundary rather than remove the durability call to satisfy Windows.

The test now checks the full source digest after copying, requires the precise
`EEXIST` refusal on an existing destination, and verifies both trees remain
unchanged after that refusal. See [Linux filesystem testing](../testing-linux-filesystem.md)
for the purpose, execution path and limits.

### Test Harness Corrections

An initial Linux policy probe timed out while loading npm from a Windows bind
mount. The unchanged tests passed using npm installed inside the image instead;
the 30-second per-command limit was not relaxed. The filesystem test uses a
disposable development layer with `--include=dev` because the production image
sets `NODE_ENV=production` and intentionally omits Jest and test files. Its test
and minimal Jest configuration are mounted read-only; test fixtures live only
in the container. No production dependency policy was bypassed.

## Limits And Deployment

The new npm CLI was installed under ignored `.tmp/` for testing; the host's
global npm was not replaced. The production container and persistent data were
not restarted or changed. Image validation uses a separate local candidate tag,
not a release image. No application version, PostgreSQL version or schema change
is part of this round.

Candidate: `classifarr:npm-122-check`, image ID
`sha256:f96d5c03705abeb94a603ca2e33d69004db8583dadea1587c4024131b85e3a0e`.
The live container remained healthy on its previous image with zero restarts
and no OOM event. The separate development image added locked Jest dependencies
only for the Linux filesystem test; it was not deployed.

Windows validation does not certify macOS or Linux ARM64 native installers.
Audit results are point-in-time advisory checks, not proof of absence of defects.
The install policy is not a runtime sandbox.

The requested random PR could not be selected: GitHub MCP search and the saved
GitHub CLI login both returned **zero open Classifarr PRs**. No unrelated PR
was substituted and none was merged.

## Next Update

Update the image's Node LTS patch and Alpine patch together, retaining PostgreSQL
and pgvector versions. Recheck native bindings, amd64/arm64 builds and isolated
upgrade/startup behavior before deployment. Review application npm dependencies
as a separate step after that runtime baseline is validated.

- [Node 24.21.0 release](https://nodejs.org/en/blog/release/v24.21.0)
- [Alpine 3.24.2 release](https://alpinelinux.org/posts/Alpine-3.21.8-3.22.6-3.23.6-3.24.2-released.html)

No release is created by this change.
