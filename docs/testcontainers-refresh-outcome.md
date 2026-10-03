# Testcontainers refresh outcome

Date: 2026-10-03. Started on clean `main` at
`27305f63014f9596a08700bb3e39ac5c02672c6b`. See the
[design, tradeoffs and official sources](testcontainers-refresh-design.md).

## Changes

- `@testcontainers/postgresql` and core `testcontainers`: 12.1.0 → 12.2.0.
- Required npm `docker-compose` wrapper: 1.4.2 → 1.5.0. This is not an update
  to Docker Desktop, the Compose CLI or a saved deployment template.
- Seven ESM dependency contracts cover image-reference spelling and identity,
  closure of a real Docker log transport, and cancellation before attachment.
  Tests use public exports, not private implementation imports. The delayed
  attachment case uses a controlled stream; the other log case uses real Docker.
- Core is now an explicit development dependency for those public API imports.
  The existing Knip test-only dependency allowlist includes it, just as it
  includes the PostgreSQL module; no runtime dependency check is disabled.

Only three resolved package versions changed. No resolved package was added or
removed, no runtime dependency changed, and no new installer was introduced.
Eleven incidental transitive updates were removed from the initial generated
lockfile. All security overrides and exact-version installer decisions remain.

## Verification

Pinned Node 24.21.0 and npm 12.2.0 were used throughout.

- Before the update, four new regression checks failed on 12.1.0: two tag/digest
  cases and both transport-closure cases. Three reference-spelling checks passed.
  Failed checks still closed their streams and the disposable database was removed.
- After the update, the focused contract run passed all 7 tests with no skips.
- Full PostgreSQL/pgvector integration run: **231 suites and 2,707 tests passed**
  in 1,212.559 seconds. This includes the seven new contracts (not additional
  tests to add to that total), persisted pgvector upgrades and recovery cases.
  The existing opt-in provider-fault Compose suite accounts for the one skipped
  suite/test; its separate runner was not executed in this dependency batch.
  No test was newly skipped and no timeout or production assertion was weakened.
- Existing integration-runtime and Jest-runner unit checks: 2 suites, 7 tests passed.
- Repository dependency-tooling checks: 30 passed, no skips.
- Clean `npm ci` under strict script policy and `npm ls --all` passed.
- Server npm audit including development dependencies: zero known vulnerabilities.
- OSV Scanner 2.6.0: zero findings across all three lockfiles, 1,143 package
  records scanned. The existing scanner configuration is empty; no exception added.
  An initial local invocation used an incorrect executable path; it was corrected
  to the image's actual `/root/osv-scanner` before the successful scan.
- Full backend lint, scoped backend typecheck and both Knip modes passed.
- npm flag, static-import, copyright and Markdown checks passed.
- Ownership-drift check passed without baseline changes. Its existing unresolved
  classifications do not grant writer ownership or authorize live recovery.
- Staged Gitleaks 8.30.0 scan passed with no findings. No secret-scanner exception
  was added. Temporary logs and audit/tree artifacts remain ignored under `.tmp`.

No full unit-suite, client/browser, coverage-ratchet, new application-image,
native ARM/NAS or live-provider verification is claimed. This is a development
tooling update; no live container was restarted and no production data was changed.

## CI link supplied during the work

[Run 37142677429](https://github.com/cloudbyday90/Classifarr/actions/runs/37142677429)
failed at source `62f547ea976192b04b5ec37bbb81f016b64c8272`. Its database and build
jobs passed. The isolated installation test observed exit 1 after deliberate
restore interruption, but no recognized restore-rejection message. Release
acceptance correctly failed downstream. Its original cause remains unproven.

The starting commit's [run 37146400793](https://github.com/cloudbyday90/Classifarr/actions/runs/37146400793)
completed successfully, including installation acceptance, database tests,
build/test and release acceptance readout. Release-only jobs were skipped.
Its OSV, Trivy, CodeQL, Gitleaks, copyright and resource-capacity workflows also
passed. That is evidence for `27305f63`, not this working tree and not proof that
the older failure is fixed.
The earlier [diagnostic change](architecture/restore-ci-diagnostics-outcome.md)
retains bounded same-run evidence if it recurs. Do not weaken the release gate,
increase a deadline speculatively or call this Testcontainers update its repair.

## PR availability and next work

GitHub MCP and saved-login GitHub CLI returned no open Classifarr PRs. Random
selection was impossible; no closed or unrelated PR was substituted or merged.

Recommended stack:

1. Evaluate this commit's CI independently; investigate any restore recurrence
   using its own image identity and sanitized diagnostics.
2. Review Supertest 7.3.0 → 7.3.1 next. Its
   [published-source change](https://github.com/forwardemail/supertest/compare/a3f5cb85b9aacc16c95987660ffe12f7d2cb2415...3634bddc2471b9cfda66ed4f5701187cee7b7f21)
   binds newly created test servers to IPv4 loopback and waits to form the final
   URL until the listener is ready. This addresses a macOS wildcard-port sharing
   case where requests could reach another process. Benefit: local-only test
   listeners and safer request targeting. Risk: changed asynchronous startup;
   verify real HTTP/authentication, failure cleanup and supplied IPv6 servers.
   This candidate was researched, not installed or tested in this batch.
3. Review Knip 6.38.0 → 6.39.0 separately; keep both dependency-check modes.
4. Keep Node typings on 24.x and the client TypeScript 7 migration separate.

The dependency-update skill kept install policy and unrelated resolutions stable.
The release-evidence skill kept CI claims tied to their actual source revision.
Benefit: upstream cleanup fixes with reproducible regression evidence. Cost:
maintaining a small public-API contract suite and Docker-backed validation.
No version bump, tag, release, branch, PR merge or deployment was created.

Follow-up: the Supertest batch has its own [design](supertest-loopback-design.md)
and [validation outcome](supertest-loopback-outcome.md); this document's test
results remain specific to the Testcontainers batch above.
