# Comparison failure causes outcome

Date: 2026-10-05. See [design](comparison-failure-causes-design.md).

## Change

Comparison preparation now preserves the failed step and a fixed cause code for
database connection, cancellation, locking, permissions, schema, capacity and
transaction conflicts; provider inspection failures; invalid/incomplete cached
vectors; bounded source validation; and deadlines. Unknown failures remain unknown
and request a reviewed GitHub report if persistent. Logs contain fixed guidance,
not SQL, arbitrary error messages, credentials, media or provider bodies.

The readiness hook is opt-in. Other workers retain their existing contract.
Identical warnings are deduplicated; changed causes or steps remain visible.
Only ready/revalidated context confirms recovery. No migration, API/UI change,
ownership takeover, new provider operation or relaxed safety limit was added.

Reviewed the shared readiness file's ownership fingerprint individually: its SQL,
ingestion predicates, admission and write behavior are unchanged. Updated only
that source digest; retained its analysis digest and existing review category.

## Random open PR trial

MCP enumeration returned open PRs 555 and 556; a cryptographic random draw selected
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Its exact client update was applied
locally: `@types/node` 24.19.1 → 26.6.4 and `undici-types` 7.24.6 → 8.9.0.

On Node 24.21.0/npm 12.2.0, clean installation, dependency-tree validation, audit
(zero findings) and client typecheck passed. The tooling policy rejected Node 26
declarations against the deployed Node 24 runtime: 29/30 tests passed. This is a
runtime/API policy mismatch, not a demonstrated client typecheck failure.

Restored the original manifest and lockfile and ran clean installation again;
all 30 tooling tests passed. No dependency changes retained and no PR merged,
closed or edited. A future Node-major update should review runtime, image, CI and
declarations together rather than update declaration files alone.

## Source verification

- Focused comparison/provider/recovery tests: 151 passed before the additional
  diagnostic-hook refusal regression; full-suite verification follows.
- Isolated PostgreSQL: both actual missing-relation and statement-cancellation
  errors passed through the worker and readiness wrapper with correct safe codes.
- Actual local HTTP 500, malformed JSON and oversized responses preserved fixed
  provider causes and existing backoff without duplicate immediate requests.
- Frontend: all 441 files / 6,383 tests passed with coverage. The initial run
  encountered the existing ESLint configuration hook's 10-second timeout while
  repository scans overlapped; 21 dependent tests did not execute. A complete
  rerun without overlapping scans passed, without changing timeouts or assertions.
- Lint, server/client typecheck, copyright, ownership review, both knip checks,
  static ESM imports, ESM mock shapes, Markdown and staged secret scanning passed.
- Root, server and client npm audits reported zero findings on October 5, 2026.
  This is scoped scanner evidence, not a claim of vulnerability-free software.
- Full backend: 1,707 suites / 53,132 tests passed, with one Windows-specific
  Linux-directory-fsync skip. The image check must exercise that case on Linux.
  New failure classifier coverage is 100% across all four metrics. Combined
  server/client coverage ratchet passed without changing thresholds.
- No-cache image rebuild, Linux filesystem check, schema round trip and local
  observation are pending. Source checks alone are not release-readiness claims.

## Release follow-up

Finish this round, then freeze a candidate and execute the release runbook.
At inspection, main `8014a74e` had queued CI, OSV, Trivy, CodeQL, resource and
copyright runs; only its secret scan had completed successfully. Queued checks are
unverified gates, not proven bugs or passes. This commit does not create a release.

Keep additional feature/refactor opportunities separate from confirmed release
blockers. Local health alone cannot establish published-image, upgrade, resource
soak or native architecture acceptance. The next step is the exact-candidate
release check, with any concrete failure investigated before publication.
