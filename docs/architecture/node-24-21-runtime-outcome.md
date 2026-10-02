# Node 24.21 Runtime Update Outcome

Date: 2026-10-02. See the [design and tradeoffs](node-24-21-runtime-design.md).

## Changes

- Node 24.21.0 is aligned across `.nvmrc`, all workspace engines/lockfile roots,
  the shared Docker stage and the isolated AI provider fault fixture.
- The official multi-platform base index is pinned; its Alpine release is
  3.24.2. Build-time checks reject mismatched Node, Alpine, npm and npx versions.
- Six ESM regression checks prevent configuration drift. The existing CI
  tooling command includes them.
- npm/npx remains 12.2.0. Application dependency versions, database schema,
  pgvector 0.8.7, deployment templates and persistent-data paths are unchanged.

## Validation

Passed locally:

- The amd64 production image built successfully, including the Vue production
  build. Native bcrypt accepted the correct password and rejected the wrong
  password in a non-root, read-only, network-disabled probe.
- The final image reported Node 24.21.0, Alpine 3.24.2, npm/npx 12.2.0,
  PostgreSQL 17.11/18.6, and pgvector 0.8.7 for both PostgreSQL majors.
- The ARM64 backend-builder stage also completed. Its real ARM64 bcrypt binding
  passed correct/incorrect password checks under emulation in a non-root,
  read-only, network-disabled container. Node/Alpine/npm/npx matched the baseline.
  This is not a full production-image or native-hardware acceptance result.
- All 48 dependency/toolchain tests passed on Windows and in Linux Node 24.21.0,
  including the six new baseline checks.
- All 157 focused backend tests passed on Linux Node 24.21.0 across ten suites:
  runtime dependencies, HTTP transport/cancellation/response limits, embedded
  identity, migration-tree copying, pgvector build failures/replay, startup-smoke
  helpers and the ownership gate. All five migration-tree cases ran, including
  the Linux directory-fsync test; none was skipped.
- All four disposable PostgreSQL startup-smoke scenarios passed: fresh install
  without pg_stat_statements files, existing-cluster preload recovery, PG17-to-18
  upgrade with old configuration paths, and included-config diagnostics.
- Host lint and both workspace type checks passed. These ran on the existing
  host Node 24.18.1; they are static checks, not new-runtime execution evidence.
- Lockfile comparison confirmed only the root Node-engine field changed in each
  of the three locks. Dependency versions and integrity records are unchanged.
- Markdown lint, copyright checks, npm CLI policy and whitespace checks passed.
- An intentional mismatched `ALPINE_RELEASE=3.24.1` build failed at the version
  assertion against the real 3.24.2 base, before installing npm.

The first focused-test attempt failed because the disposable source snapshot
excluded Git metadata required by the ownership test. Initializing an empty Git
repository inside that disposable snapshot allowed the same test to inspect
the real copied sources; no test or gate was weakened. The real working-tree
ownership check also passes independently.

The full Linux frontend/backend suites and full ARM64 production build were
interrupted deliberately after the shared-host incident below. They are
**incomplete**, not passing runs. Both architecture-specific frontend builds
completed, but that is not full ARM64 runtime acceptance. Full suites on the new
runtime and native ARM64 installation/upgrade evidence remain release gates.

Local logs are under ignored `.tmp/runtime-2421-*`; they are not published
release artifacts. The amd64 validation image is `classifarr:runtime-2421-amd64`
with image ID
`sha256:e28f4f0325bea71e243da37ebfddb0b4cad32ae441c30e46689c134aff1243c8`.
Its revision label is `runtime-2421-validation`, not a release provenance claim.

## CI Run Review

The supplied [run 37069069814](https://github.com/cloudbyday90/Classifarr/actions/runs/37069069814)
tested commit `1f80c1b9`. It failed before application tests at the ownership
review gate: four changed source digests and one unreviewed pgvector migration.
The affected files were the 0.8.6/0.8.7 migrations, schema snapshot, library
profile upgrade rehearsal and schema release replay. Its database tests and
fresh-install/published-upgrade jobs passed. Release acceptance was blocked by
the failed repository-validation prerequisite, not another database failure.

Commit `2078a887`, already pushed before this runtime update, corrected those
five review entries while preserving their classifications and analysis
digests. Its [CI pipeline 37074523665](https://github.com/cloudbyday90/Classifarr/actions/runs/37074523665)
passed build/tests, database tests, installation/upgrade and acceptance readout.
That is evidence for the previous runtime, not a substitute for this update's
new-runtime checks. No further ownership-registry change was needed here.

A separate [OSV run 37074524403](https://github.com/cloudbyday90/Classifarr/actions/runs/37074524403)
failed on `braces 3.0.3` in the root/server development dependency trees.
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
describes stack exhaustion from deeply nested brace patterns. The GitHub
advisory API listed no patched version when checked on October 2. A fresh web
search, [npm version history](https://www.npmjs.com/package/braces?activeTab=versions)
and live `npm view braces version dist-tags versions --json --prefer-online`
against `registry.npmjs.org` confirmed 3.0.3 remains the latest published version.
Upstream's newest Git tag is also 3.0.3. There is a proposed
[fix in PR 72](https://github.com/micromatch/braces/pull/72), but it remains open
and unmerged; it is not an official patched release. The
[original issue](https://github.com/micromatch/braces/issues/70) remains open.

No suppression, reachability exemption, unmerged fork or dependency replacement
was introduced in this runtime change. The security check remains unresolved
and requires a focused follow-up; development-only classification is not proof
of no exposure. `brace-expansion` is a different package; updating it does not
update `braces`. A controlled review of PR 72 is a candidate next step, not a
claim that its patch has already been independently validated here.

## Shared-Host Observation

Parallel architecture builds, validation-image unpacking and full test suites
coincided with four automatic restarts of the **existing** Classifarr container.
No live deployment or restart command was issued. Docker did not report an OOM
kill. Logs showed `database_unavailable`, unconfirmed database shutdown and
repeated PostgreSQL startup failures; PostgreSQL recovery fsync exceeded 60
seconds, and a database process was observed waiting on I/O.

Only this round's heavy validation jobs were stopped. The existing container
recovered automatically on its unchanged image and became healthy, with
PostgreSQL accepting connections. Subsequent serial amd64 build, startup smoke
and focused tests did not increase its restart count beyond four. Storage
contention is a plausible contributor, **not a confirmed root cause**. No
database integrity audit was performed, so health is not a claim of such an audit.

The entrypoint currently invokes `pg_ctl start` without an explicit timeout.
[PostgreSQL documents](https://www.postgresql.org/docs/current/app-pg-ctl.html)
a default 60-second wait and warns that an operation can continue after the
client reports a timeout. This warrants a bounded, progress-aware startup and
recovery design, with an isolated slow-storage reproduction before changing
supervision. Do not disable fsync, assume an owner is dead, or make a timeout
silently count as healthy.

Prefer a separate validation host; otherwise run heavy work serially. Docker's
[CPU/memory constraints](https://docs.docker.com/engine/containers/resource_constraints/)
and [block-I/O controls](https://docs.docker.com/engine/containers/run/)
address different resources. CPU/memory caps alone did not establish storage
isolation here. No live container resource settings were changed.

## Deployment And Limits

Candidate images are local validation artifacts, not a release. This change
does not replace the running container or install Node globally on the host.
ARM64 runs on this workstation use emulation, not native ARM hardware.
No production database or media library is mounted into test containers.

The base digest does not freeze subsequent APK repository packages. The outcome
records observed versions rather than claiming all image inputs are immutable.

## Pull Request Check

Both GitHub MCP search and the saved GitHub CLI login returned zero open
Classifarr PRs. No random PR could be selected, and no PR was merged.

## Next Update

1. Resolve the `braces` security finding: identify the actual callers and
   untrusted-input boundaries, then test an upstream repair or compatible
   replacement. Do not equate a green npm audit with a green OSV check.
2. Harden database startup/recovery against slow storage, with finite budgets,
   progress evidence and safe shutdown. Reproduce on disposable data first.
3. Resume small dependency batches, starting with the PostgreSQL client:
   installed `pg` 8.23.0 versus available 8.23.1. Verify pool shutdown, connection
   errors, TLS and migrations against disposable PostgreSQL. Availability was
   checked with npm's registry and the [upstream pg manifest](https://github.com/brianc/node-postgres/blob/master/packages/pg/package.json).

No release is created by this commit.
