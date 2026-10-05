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
  Linux-directory-fsync skip. The image check exercised that case on Linux.
  New failure classifier coverage is 100% across all four metrics. Combined
  server/client coverage ratchet passed without changing thresholds.

## Local image verification

Built from clean source `cc944b40d45c8b75ade0e8d6c06265b13e80274d` with
`docker-compose-smart.mjs build --no-cache --require-provenance classifarr`.
Local AMD64 image ID:
`sha256:90b72e7c81d4d2df846f9b9fb075d9e185ef07df8ff07ba303cc1657d0c7d99a`.
This is local image evidence, not a signed published registry artifact.

- Replaced only local Compose's `classifarr` using `up -d --no-build
  --force-recreate --wait classifarr`; it became healthy. No volume deletion or
  manual database recovery. Unraid and the unrelated local container were untouched.
- Ran the Linux directory-fsync scenario using this image's production functions:
  complete exclusive copy, unchanged source and refusal to overwrite all passed.
- Ran `dumpSchema` in an isolated PostgreSQL 18 container from this exact image,
  loaded the dump into another disposable database and dumped again. Zero drift;
  `database/schema/current.sql` is unchanged. No new migration was necessary.
- Both temporary image-test containers were removed and cleanup verified.
- At 216 seconds, health was healthy with zero container restarts/OOM events.
  All ten libraries had completed fresh post-restart scans; Family contained 866
  items and Movies 2,342 (previously 2,339). No unfinished legacy ownership markers,
  all 12 safeguards `ENABLE ALWAYS`, protocol ready and repair `not_needed`.
  Database sessions were loopback-only. Health returned 200; unauthenticated
  library access returned 401.
- Through 261 seconds, zero ownership/migration/comparison warnings appeared.
  No live fault was injected; fault classification is established by the HTTP,
  PostgreSQL and unit fixtures, not by manufacturing a production incident.
- Sampled memory ranged from about 594 MiB to 1.278 GiB under the existing 2 GiB
  cap. CPU settled from a 162% startup sample to 1.10%; final memory was 597.6 MiB
  with 42 PIDs. CPU/PID container limits remain unset. No runaway was observed;
  this short observation is not a sustained resource soak or peak-load guarantee.
- Three startup/background slow-query warnings remained (0.90, 1.18 and 3.56 s,
  with negligible pool waiting). They were not suppressed or established as a new
  regression. Retain them for the candidate resource/performance review.

## Release follow-up

Finish this round, then freeze a candidate and execute the release runbook.
Main `8014a74e` initially had queued checks. On reinspection, GitHub reported that
hosted runners could not acquire the jobs; the affected jobs never executed.
This is an external release-verification blocker, not evidence of failing tests
or a dependency finding. The exact inspected runs were:

| Check | Observed result |
| --- | --- |
| [CI](https://github.com/cloudbyday90/Classifarr/actions/runs/37368839100) | Required jobs cancelled after runner-assignment failure; downstream gates skipped |
| [OSV](https://github.com/cloudbyday90/Classifarr/actions/runs/37368839819) | Scanner never ran: runner-assignment failure |
| [Trivy](https://github.com/cloudbyday90/Classifarr/actions/runs/37368838541) | Both scan jobs unassigned |
| [CodeQL](https://github.com/cloudbyday90/Classifarr/actions/runs/37368838694) | JavaScript/TypeScript passed; Actions analysis unassigned |
| [Resource regression](https://github.com/cloudbyday90/Classifarr/actions/runs/37368838679) | Job unassigned |
| [Copyright](https://github.com/cloudbyday90/Classifarr/actions/runs/37368838575) | Job unassigned |
| [Gitleaks](https://github.com/cloudbyday90/Classifarr/actions/runs/37368838578) | Passed |

Official [GitHub incident](https://www.githubstatus.com/incidents/3q1yb5m7ltvb),
discovered through web search and opened October 5, reports hosted-runner assignment
failures/delays since 19:11 UTC, with degraded availability still reported at
20:47 UTC. The observed failures are consistent with that incident. Do not change
runner permissions or bypass gates; require fresh successful checks for the final
candidate after service recovery. These older runs do not verify this new commit.
No release, tag, registry push or promotion was performed.

Keep additional feature/refactor opportunities separate from confirmed release
blockers. Local health alone cannot establish published-image, upgrade, resource
soak or native architecture acceptance. The next step is the exact-candidate
release check, with any concrete failure investigated before publication. No new
application defect blocking release was established in this round; missing CI
and release acceptance evidence still blocks a release-readiness claim.
