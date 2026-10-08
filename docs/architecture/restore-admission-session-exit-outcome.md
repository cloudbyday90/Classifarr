# Restore-admission session-exit outcome

Date: 2026-10-08. Implements the
[design](restore-admission-session-exit-design.md), on `main`.
No version bump, release, PR merge or Unraid change.

## Cause and change

The intermittent `RESTORE_RUNTIME_BUSY` at the final handoff in
`runtime-admission.test.mjs` came from treating a synchronous pool release as
acknowledged PostgreSQL session exit. Installed pg 8.23.1 / pg-pool 3.14.0 starts
disconnect asynchronously. PostgreSQL can correctly reject an exclusive restore
while the previous shared-lock session is still exiting.

A real-database controlled delayed-disconnect test demonstrates that window:
release returns, the session-exit observer times out, and restore remains blocked
without invoking its callback. After actual disconnection and observed session
exit, the same restore succeeds exactly once. The uncontrolled baseline passed
four tests locally; this is a controlled reproduction of the timing condition,
not a claim that the natural race reproduced on every run.

The small ESM fixture observes exact PID/start-time identities through read-only
catalog queries, with a five-second ceiling and bounded query time. It refuses
non-fixture database names, fails on unknown observations, and cleans up only
clients it acquired. Adjacent schema-maintenance handoffs, including fresh-schema
idempotence, use the same barrier. The delayed-disconnect test deliberately holds
one disposable session open; it does not kill an external writer or retry a
write-capable restore until it happens to succeed.

Production restore/normal admission, schema maintenance, leases, memory limits,
retry budgets, privileges and migrations are unchanged. There is no automatic
takeover or relaxed busy check in this fix.

## Local verification

- Original focused admission baseline: 4 passed.
- Controlled admission suite: 5 passed.
- Admission, seed and restore integration checks: 17 passed across 4 suites.
- Final expanded admission/schema-maintenance selection: 34 passed across 5 suites.
- Focused unit tests cover admission, restore sessions, startup and the new
  observer, including invalid deadlines, unknown observations and fixture scope:
  71 passed across 4 suites.
- Backend lint/typecheck, both Knip modes and 40 dependency/toolchain contracts
  passed. Copyright, Markdown and whitespace checks passed.
- Ownership preflight passed its unchanged reviewed baseline: 501 unresolved
  paths and `productionCompatible: false`. This is not full writer isolation.

- The first full database run passed 2,942 tests across 244 suites, with one
  failure and one intentionally skipped test/suite. The failure was a five-second
  PostgreSQL **connection** timeout in the existing private-read authority case
  of `ingestion-fence-authority.test.mjs`, not an admission assertion. This run
  overlapped the Docker build. After the build, the isolated authority suite
  passed all 38 tests in 3.101 seconds without a timeout change. This establishes
  that the failure was not reproduced in isolation, not that build contention
  has been proven to be its cause.
- The final full database rerun, after the build and against the unchanged
  implementation, passed **2,943 tests across 245 suites**, with one deliberate
  skipped test/suite, in 975.266 seconds. Its disposable database was removed.
  Existing five-second connection deadlines and all assertions remain unchanged.
  Together with the isolated rerun and hosted CI pass, this leaves no reproduced
  authority-test failure in this round; the initial timeout remains recorded.
- The default database matrix excludes `ai-provider-fault-compose.test.mjs`,
  which requires its dedicated isolated provider-stub runner. That deliberate
  skip is not described as a passing provider-fault rehearsal.

## No-cache image and schema evaluation

Built from clean implementation commit
`0f95bd9e12f3815a91106adfdaa8577471f55adc`, on `main`, using the existing local
Compose override, `PGVECTOR_BUILD=multi`, `--no-cache` and
`--require-provenance`. The local image ID is
`sha256:690bc2f56940fe8b4a5d1c092f375eac1bbb836442f44fe4dbbfc71a60054765`.
This is a local Docker identity, not a published registry acceptance claim;
`PGVECTOR_BUILD=multi` builds CPU variants, not a native architecture matrix.

Before replacement, a local database backup was created and verified by checksum
and `pg_restore --list` (75,923,700 bytes). Its private scratch path is
`.tmp/pre-memory-fingerprint-d5225167-9963-4d0d-9b45-21b2b04c7d43.dump`.
The rollback image is retained as
`classifarr:pre-memory-d5225167-9963-4d0d-9b45-21b2b04c7d43`; backup contents and
credentials are not committed. No restore was performed.

Image checks passed for Linux directory fsync, complete exclusive migration
copy, unchanged source and duplicate-destination refusal. Candidate and prior
image both passed the real loopback HTTP/2 transfer (26,624 bytes, nghttp2 1.70.0).
Their production inventories are equal: 172 npm packages and 58 APK packages,
Node 24.21.0, with Knip absent from the runtime image. Probe containers used
read-only filesystems, non-root users, no network and no extra capabilities;
their cleanup was verified.

Ran `check-schema-snapshot-container.mjs --dump`, then its check mode, against
the exact candidate image. Both used disposable PostgreSQL 18 databases and
cleaned up. All 22 data-only migration seeds were included; the migration tip
remains `20261005_180000_ingestion_compatibility_fence.sql`, and
`database/schema/current.sql` is unchanged. No live database was used for schema
generation.

Only the existing local Compose container was recreated. It reports the expected
image/revision, is healthy, and retains user `1000:1000`, read-only root,
no-new-privileges, capability drop ALL with the existing CHOWN/SETUID/SETGID
allowlist, and its 2 GiB limit. No Compose/template settings or Unraid deployment
were modified.

Five-minute observation collected 19 samples, all healthy, with zero cgroup
allocation failures, OOM kills or restarts. Sampled raw cgroup usage ranged from
377.6 to 845.4 MiB; the recorded cgroup peak was 850.6 MiB. The final sample was
399.9 MiB. A read-only aggregate of application error-log rows since this
container started was empty. These are whole-container observations, not Node
heap measurements or proof of long-term memory retention/absence of leaks.

## Hosted checks and release limits

Implementation commit `0f95bd9e12f3815a91106adfdaa8577471f55adc` is pushed to
`origin/main`.
[CI run 37771035502, attempt 1](https://github.com/cloudbyday90/Classifarr/actions/runs/37771035502)
passed. Its integration log reports 2,943 tests passed across 245 suites, with
the same one deliberate provider-fault skip, in 777.348 seconds. The database
job also passed released-schema replay and mixed-profile upgrade steps.
Server/client tests, lint, typechecks, coverage
ratchet and the production-policy/shared-control browser steps also passed.
Image verification, schema drift, PostgreSQL startup/monitoring/lifecycle,
loaded shutdown, queue-claim recovery, installation acceptance and the CI release
readout jobs/steps passed. The readout is not permission to publish a release.

The same revision's Gitleaks, OSV, Trivy, CodeQL, copyright and resource-capacity
workflows passed. Release-only provider-fault receipts, registry publication and
native multi-platform acceptance were not run for this ordinary `main` push.
The local image remains tied to the implementation commit even when a subsequent
documentation-only commit records the final results. No release was created.

## Random open PR trial

Fresh enumeration found two open PRs, 555 and 556. Random selection chose
[PR 555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Its exact manifest/lockfile patch raises
client Node declarations from 24.19.1 to 26.6.4 and undici-types to 8.9.0.

Applied the patch locally without installing or merging it. Existing runtime
baseline tests changed from 8 passing to 7 passing / 1 failing: Node declarations
no longer matched deployed Node 24. Reverted only that trial; all 8 pass again,
and both client files are unchanged. No compatibility gate was relaxed and no
part of this incompatible PR is retained.
At final enumeration both PRs remain open; PR 556 is the corresponding server
Node 26 declaration update, not a compatible alternative to the selected trial.

## Recommendations

The separate [dependency/pin audit](dependency-pin-audit-2026-10-08.md) records
official sources, hidden updates, compatible holds, pros/cons and ordered batches.
Next: align the frontend build/test overrides with their parents and review the
Vite/PostCSS patches, then handle runtime transport/IP and CI artifact updates
separately before freezing a release candidate. Do not use Node 26 declarations
or a blanket major-version override as a shortcut.
