# gRPC dependency maintenance outcome

Date: 2026-09-30. Implements the
[dependency maintenance design](2026-09-30-grpc-dependency-design.md).

## Change delivered

The only dependency resolution change is server `@grpc/grpc-js` 1.14.4 → 1.14.5.
No package declaration, override, deployment template, application version,
database schema or runtime service changed. Two ESM regression suites and the
Unreleased changelog describe and protect the corrected behavior.

The security-triage and fix workflows kept package presence separate from actual
application exposure, and required independent boundary investigation and patch
review. Neither inspection established an exploitable Classifarr application
path; the upstream defects were reproduced against the installed dependency.
The independent candidate review reported no concrete bypass or regression.

## Validation

Commands below run from the repository root unless marked otherwise.

| Gate | Command / evidence | Result |
| --- | --- | --- |
| Lockfile update | `npm --prefix server update @grpc/grpc-js --package-lock-only --ignore-scripts --no-audit --no-fund` | Only version, tarball URL and integrity changed |
| Clean install | `npm --prefix server ci --ignore-scripts --no-audit --no-fund` | 651 packages installed |
| Syntax | `node --check` on both new test files | Passed |
| Pre-patch fixtures | New suites on 1.14.4, after test-harness corrections | 10 security assertions failed, 13 controls passed |
| Post-patch focused tests | From server: `node scripts/run-jest.mjs --runTestsByPath src/__tests__/grpcAuthContextDependency.test.mjs src/__tests__/grpcErrorDisclosureDependency.test.mjs src/__tests__/runtimeDependencyCompatibility.test.mjs --runInBand --no-coverage` | 27 tests, 3 suites passed |
| Dependency tree | `npm --prefix server ls @grpc/grpc-js` | One instance, 1.14.5, under Dockerode/Testcontainers |
| Production graph | npm query for production `@grpc/grpc-js`, with `--omit=dev --no-expect-results` | Empty; no production dependency edge |
| Development-inclusive audit | `npm --prefix server audit --include=dev --audit-level=low` | Zero vulnerabilities |
| OSV | All three lockfiles, unchanged `osv-scanner.toml` | 132 root / 727 server / 338 client package records; no issues, exit 0 |
| Real Docker integrations | Repository Jest wrapper, `--runTestsByPath` for `mediaSyncRecoveryFairness`, `library-catalog-archive`, `pgvector-extension-upgrade`, `--runInBand --no-coverage` | 29 tests, 3 suites passed |
| Backend coverage | `npm --prefix server run test:coverage` | 47,618 tests / 1,567 suites passed, 614.424 seconds |
| Frontend coverage | `npm --prefix client run test:coverage` | 5,795 tests / 411 files passed, 242.25 seconds |
| Quality gates | `npm run lint`, `npm run typecheck`, `npm run test:ci:preflight`, `npm run lint:docs`, static-import and ESM mock-shape checks, console-spy check, policy naming/language/maintenance gates, `git diff --check` | Passed |
| Frontend build | `npm --prefix client run build` | Passed |
| Coverage baseline | `npm run coverage:ratchet:check` | Passed without changing any baseline |

Backend statement, branch, function and line coverage is 90.19%, 85.12%, 91.87%
and 90.19%, respectively. Frontend coverage is 86.11%, 78.76%, 85.56% and 88.03%.
The ownership drift gate passes with 490 reviewed unresolved paths and
`productionCompatible=false` unchanged; this is not automatic recovery approval.

OSV used the existing pinned scanner image
`ghcr.io/google/osv-scanner-action@sha256:71ad04ab2f8798be47870f9b18817ad317c2f8f2f97aa6726ba10d5578bc174a`.
Only the three lockfiles and scanner configuration were mounted read-only; no
secrets or Docker socket were passed to the scanner. No advisory was suppressed.

The pre-patch run exposed the synthetic exception message over actual RPCs in
all four shapes, and returned certificate identity from unauthorized socket state.
The same assertions pass after the package update. Normal responses, deliberate
public errors and authorized peer identity remain valid. Initial fixture issues
(Jest ESM import and the gRPC stream `write`/`end` API) were corrected before the
recorded red/green comparison; they were not treated as vulnerability evidence.

Limit: socket-state tests do not exercise live certificate negotiation. The
internal upstream method import intentionally tests the shared guard and may
require adjustment if a future dependency release moves that method. Custom
BuildKit usage and explicit insecure debug opt-in are not certified safe.

## PR, deployment and next work

The GitHub MCP search returned no open repository PRs on September 30. None was
available to select randomly; no PR was merged or substituted with a closed one.

No release or live-container restart is part of this dependency-only update.
Existing Unraid installations require no template or environment changes for it.
Stored GitHub login remains unchanged; temporary request-local token omission
does not repair an invalid token in another shell's environment.

Next high-value component: the privileged provisioning/maintenance handoff,
including existing-volume upgrades, encrypted restores and custom UID/GID in
disposable tests. Accept it only when the runtime cannot reconnect as database
administrator or read privileged credentials, maintenance waits for runtime exit,
and existing Unraid templates continue working unchanged. Preserve unknown-owner
recovery safeguards until writer capability migration is complete.
