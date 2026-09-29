# Root YAML dependency remediation outcome

Date: September 29, 2026. Scope: GHSA-r3ph-w7gj-g6xm / Dependabot alert 112.
See the separate [design and research](root-yaml-dependency-design.md).

Outcome: **fixed for the YAML advisory**, with an unrelated Markdown advisory
still open. Do not interpret this as a clean repository-wide audit.

## Change

The root `js-yaml` override and its only lock entry now resolve 5.4.2 instead of
5.2.2. No other dependency version changed. The stale override, rather than the
linter's requested version, was keeping the vulnerable parser installed.

New native-ESM tests exercise the root dependency and confirm that the linter
resolves the same copy. The existing root-install CI job runs them using
`npm run test:tooling:dependencies`. Its triggers, job identity, permissions and
copyright check remain intact. Unreleased records the high-level security change.

No server/client source, package, database, routing, ownership or provider setting
changed. No release, version bump, live cleanup or container deployment is part
of this root-development-tooling correction.

## Local verification

Environment: Node 24.18.1, npm 12.0.2, Windows PowerShell.

| Gate | Command / evidence | Result |
| --- | --- | --- |
| Original defect | `node --test scripts/__tests__/yaml-merge-budget.test.mjs` before dependency update | Eight expected failures: empty sources bypassed the budget; ten resolution/compatibility checks passed |
| Syntax / patch | `node --check scripts/__tests__/yaml-merge-budget.test.mjs`; `git diff --check` | Passed |
| Reproducible install | `npm install --package-lock-only --ignore-scripts`; `npm ci` | Passed; only the YAML lock entry changed |
| Patched security and controls | `npm run test:tooling:dependencies` | 18 passed, zero failures |
| Actual documentation lint | `npm run lint:docs` | Passed across 1,658 Markdown files, including both new documents |
| Existing root checks | `npm run check-copyright`; `npm run lint:npm-cli-flags` | Passed; 1,393 copyright-covered files checked |
| Installed copies | `npm ls js-yaml --all`; `npm --prefix server ls js-yaml --all`; inspection of all three locks | Root and server each resolve 5.4.2; client has no copy |
| Workflow contract | Parse modified workflow; assert new test follows `npm ci` and permissions remain `contents: read` | Passed |
| Root audit | `npm audit --json` | No YAML advisory; audit exits 1 for a separate existing moderate `markdown-it` advisory, described below |

The original bypass no longer reproduces: direct empty mappings, aliased
sequences, repeated aliases and cumulative work across targets now throw a
merge-budget error. Each case runs under both YAML 1.1 and core-plus-merge schemas.
Inputs contain only a few source mappings; no high-volume CPU exhaustion test was
needed. Assertions do not depend on elapsed time.

Legitimate behavior remains intact: small allowed merges, explicit-key and
first-source precedence, normal YAML linter options, literal default-schema merge
keys (including a version directive), malformed-input rejection, valid Markdown
acceptance and invalid Markdown diagnostics all pass.

The security-fix workflow added independent read-only investigation and candidate
review. The reviewer found no concrete surviving bypass or regression, including
72 additional bounded checks of alternate schemas, package exports, explicit
tags, multi-document/event APIs and unlimited-budget controls. Eight ordinary
configuration/error cases also matched the old version. These were additional
review probes, not new committed test cases. Hosted Linux CI was not executed
by the reviewer; local verification above is the delivery evidence.

Runtime builds, database integration tests and the full client/server suites are
not repeated: those trees, schemas and runtime files are unchanged, and the
Dockerfile does not install the root dependency tree. Passing these focused checks
does not constitute a repository-wide security audit or proof of production
exploitability. The normal linter parser does not enable the affected merge mode.

## Remaining finding and follow-up

The audit separately reports
[GHSA-253c-mchw-3w2r](https://github.com/advisories/GHSA-253c-mchw-3w2r)
for root `markdown-it` with `linkify: true`. The advisory lists patched 14.3.1
and 15.0.1. This YAML fix does not resolve that separate dependency issue, and the
root audit must not be described as clean. A separately tested fix was offered
for approval; do not apply an unreviewed `npm audit fix` or change rendering modes
to hide the finding.

The separate [Markdown dependency remediation](root-markdown-dependency-outcome.md)
addresses this follow-up without changing the YAML delivery recorded here.

After root dependency remediation, the next application component remains the
actionable retry-readiness summary: small visual counts for ready work versus
provider waits, with the next check time and one relevant settings action.
Do not enable disabled providers or claim unknown legacy imports automatically.

The GitHub MCP open-PR search, including the final recheck, returned no open Classifarr PRs. There was no PR
available to randomly select or implement, and no PR was merged.
