# Runtime parser security outcome

Date: 2026-10-27. The [design](runtime-parser-security-design.md) records the
boundary, official research, alternatives and recommendation stack. No release,
tag, application version bump, deployment or production request is included.

## Applied graph and containment

Exact overrides now select body-parser 2.4.0 and qs 6.16.1. The only additional
parser package change is iconv-lite 0.7.2 to 0.7.3; content-type was already
2.1.0. The separately selected dotenv PR changes one more package record.
The complete lock changes four package records plus root metadata, with zero
package additions/removals and zero `hasInstallScript` changes. Existing script
decisions and other overrides remain intact. Node 24.22.1 and npm 12.2.1 were
used without changing global tools. Both clean installs succeeded (630 packages).

The fix stays in the shared upstream parser implementation. Normal and restore
bootstrap source, authentication, CSRF, maintenance allowlisting and size
configuration are unchanged. Separate test fixture/helper modules keep binary
HTTP and child-process mechanics out of application services.

## Ordered verification

1. Baseline: the corrected loopback child probes crash under body-parser 2.3.0
   in normal JSON, normal extended-form and restore JSON configurations with an
   unhandled Gunzip error (`Z_DATA_ERROR`). They first complete a delayed deflate
   frame and then exercise trailing gzip bytes. qs 6.16.0 throws a TypeError for
   the advisory input in both encoder branches. No live system was contacted.
2. Candidate: all three isolated probes exit successfully after request completion,
   corrupt gzip rejection and a later health request. There is no uncaught-error
   listener that could hide the original failure. qs tests assert safe fallback
   output, primitive fallback, null-prototype/nested/parsed objects and ordinary
   array/coercion behavior. Deliberately throwing application methods still throw.
3. Actual bootstrap compatibility: JSON and normal extended forms round-trip with
   identity, gzip, deflate, Brotli and Zstandard. Decoded size limits remain 413;
   normal parameter/depth limits, malformed JSON/compression and unsupported
   encodings reject before destination handlers. Restore keeps form bodies
   unparsed, CSRF rejection and maintenance restrictions. Existing malformed-JSON
   text remains unchanged. Combined parser/bootstrap/dotenv coverage passes four
   focused suites and 94 tests.
4. Quality: server source/test ESLint, TypeScript, both Knip scans, complete
   package-tree validation, static ESM imports and mock-shape checks pass.
   Dependency/tooling contracts pass all 59 tests. Independent candidate review
   found no concrete surviving bypass or compatibility regression.

Disposable PostgreSQL integration passes three suites and 76 tests covering
authentication routes, backup lifecycle and restore sessions. Full backend
coverage passes all 1,881 suites and 60,470 tests, with one existing skip, in
991.831 seconds. Coverage is 89.19% statements/lines, 86.48% branches and 90.75%
functions. The unchanged coverage ratchet passes with this fresh server report
and the immediately preceding validated client report. The client tree is
identical (d6a377530fab2f2847f4b01a936dbbb1ca825f1b); frontend tests/build were
not rerun for this server-only dependency change.

| Gate | Command | Result |
| --- | --- | --- |
| Focused runtime checks | `cd server; node scripts/run-jest.mjs --runInBand --no-coverage --testPathPatterns='runtimeParserSecurity.test\|dotenvRuntime.test\|createApp.test\|createRestoreApp.test'` | 4 suites, 94 tests pass |
| Complete backend coverage | `cd server; node scripts/run-jest.mjs --coverage --maxWorkers=2 --workerIdleMemoryLimit=512MB` | 1,881 suites pass; 60,470 pass, 1 existing skip |
| Disposable database integration | `cd server; node scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --testPathPatterns='auth-routes.test\|backup-restore-session.test\|backup-lifecycle.test'` | 3 suites, 76 tests pass |
| Source/test lint and types | `npm --prefix server run lint`; `npm --prefix server run typecheck` | Pass |
| Dependency scans | `npm --prefix server run lint:knip`; `npm --prefix server run lint:knip:production`; `npm --prefix server ls --all --json` | Pass |
| Tooling contracts | `npm run test:tooling:dependencies` | 59 tests pass |
| ESM contracts | `npm run esm:check-static-imports`; `npm run esm:check-test-mock-shapes` | Pass |
| Coverage ratchet | `node scripts/check-coverage-ratchet.mjs` | Pass; client report reused for identical tree |
| Full audit | `npm --prefix server audit --json` | Exit 1; 5 low package entries, 1 unpatched advisory |
| Runtime audit | `npm --prefix server audit --omit=dev --json` | Exit 0; zero findings in this scope |
| Documents / copyright | `node scripts/run-markdownlint.mjs`; `npm run check-copyright` | Pass |

The first probe draft incorrectly expected a 400 for a complete gzip frame plus
padding. Upstream behavior permits parsed success; the security assertion is
later process survival. That expectation was corrected before the recorded
baseline crash and candidate success. An early check also started before a
clean install finished and could not resolve a module; its completed-install
rerun passes. ESLint caught a test-helper promise executor return, which was
corrected without changing its behavior. Existing application limits and test
timeouts are unchanged; the final probe still reproduces the baseline crash.

## Audit scope and remaining work

The 2026-10-27 full server audit falls from eight affected package entries to
five low entries. The two parser advisories and Express's derived finding are
absent. `npm audit --omit=dev --json` reports zero findings for the server runtime
dependency scope; this is not an application-wide security guarantee or an image
scan.

The five remaining entries represent one
[deepmerge advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4),
propagated through Jest configuration packages. The version (4.3.1) is unchanged,
and no patched release is listed. Application runtime imports and a remote
configuration-to-merge attack path were not established. The Docker recipe omits
development dependencies; no current production image was inspected. Keep a
separate supported-fix review and do not downgrade Jest to 25.1.0 based on audit's
suggestion. The independent npm CLI bundled ip-address next-release hold remains.

Next classification item: include authorized operator correction receipts in
quality evaluation using typed identity, frozen snapshot and conflict checks.
Keep one-item routing consent distinct from generalized learning. The broader
documentary and seasonal-library fit gaps are unchanged by this security update.
Review qs PR 573's 6.17.0 minor features separately; its requested version is not
implemented by this exact 6.16.1 security patch.

## Delivery receipt

Code and the Unreleased changelog were committed on main as
6bcaea15c36d09919fd57ffa13f602ae2eace971, pushed and checked against the remote
main SHA. The staged diff passed whitespace and redacted Gitleaks checks.
The separate [PR outcome](dotenv-pr571-outcome.md) records the completed
housekeeping. Markdown lint passes all 2,368 documents and copyright checks pass.
The final receipt-only documentation commit requires no application retest.
