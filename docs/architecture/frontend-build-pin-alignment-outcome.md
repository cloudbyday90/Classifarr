# Frontend build pin alignment — outcome

Date: 2026-10-08. Baseline: `fc026fb8b97970c13c408cd731273cb2121fd168`.
See the [design and official sources](frontend-build-pin-alignment-design.md).
No release, version bump, API/schema change or memory-policy change.

## Implemented scope

Exact client pins: Vite 8.3.4, PostCSS 8.5.29, pluginutils 1.0.1 and
es-module-lexer 2.3.2. Both overrides now satisfy the reviewed parent requirements.
The necessary lockfile delta also includes Rolldown 1.2.13 and its 15 native
bindings, @oxc-project/types 0.153.0 and nanoid 3.3.20. In total, 22 package
records change versions; none are added or removed, and none introduce install
scripts. Foreign-platform optional bindings remain in the lockfile.

Root/server dependencies, Vue/Router/Pinia, TypeScript, browser binaries and
unrelated security overrides remain unchanged. Exact pins improve repeatability
but still require periodic review; they are not automatic security guarantees.

## Reproduction and local checks

The ten focused tests were written and run before updating dependencies:
five passed and five failed. Failures exposed the two stale parent contracts,
PostCSS splitting a comma inside a comment, and two Vite WASM-query requests
returning 500 instead of 403. This probe did **not** establish data disclosure.
After the reviewed clean installation, all ten pass. The file-boundary tests
use loopback and generated synthetic files, including a fake `.env`; no real
configuration or application data is read.

- Lock generation with `--ignore-scripts`, reviewed `npm ci`, and `npm ls --all`:
  passed. Missing optional peers/foreign-platform binaries are expected.
- Full-scope client `npm audit --json`: zero reported vulnerabilities, including
  development dependencies, on this date.
- Dependency/toolchain contracts: 40 passed, no skips.
- Client test-project configuration: passed; all suites remain included.
- Client lint and both Vue API/component typechecks: passed.
- Full client coverage run: 445 files / 6,421 tests passed, no skips, in
  249.14 seconds. Statements 86.96%, branches 80.37%, functions 86.54%,
  lines 88.78%; no threshold was lowered.
- Production Vite build: passed, 1,022 modules. All eight production-policy
  Chromium checks passed (9.7 seconds), including cold route budgets, lazy
  Command Center navigation and browser history. No page exceptions or API
  mutations. Only the existing conflicting color-environment warning appeared
  in the browser runner; it is not a build or application failure.
- Copyright check: passed for 1,543 files.
- Backend coverage: 1,751 suites / 54,344 tests passed in 748.216 seconds.
  One existing Linux directory-fsync test is skipped on Windows; its real
  operation passed separately inside the candidate Linux image, as below.
  Statements/lines 89.74%, branches 85.81%, functions 91.12%.
- Coverage ratchet passed using both fresh reports. No baseline was changed.
- Markdown lint: passed for 2,015 files after adding this outcome.

## No-cache image evaluation

Built on clean `main` commit `d8ec4dc9cf8779a17547e68e1e235295d423a596`, using
the existing local Compose override, `PGVECTOR_BUILD=multi`, `--no-cache` and
`--require-provenance`. Local Docker image ID:
`sha256:1dc10c5ce8c6becf35f060ef9934600ec8a5c6dd43a23d6cb3faaffebe2c4fa8`.
This is not a published registry or native multi-platform acceptance claim.
The pgvector `multi` option builds CPU variants, not multiple architectures.

Before replacement, the local database backup was checksum-verified and read
with `pg_restore --list`: 76,112,548 bytes, private path
`.tmp/pre-memory-fingerprint-146ef933-0417-4791-8840-9b6c951e7fed.dump`.
The exact prior image is retained as
`classifarr:pre-memory-146ef933-0417-4791-8840-9b6c951e7fed`; no restore occurred.
Backup contents and credentials are not committed.

Candidate-image Linux directory fsync, exclusive migration copy, unchanged
source and duplicate-destination refusal passed. Candidate and prior images
both passed a real 26,624-byte loopback HTTP/2 transfer using nghttp2 1.70.0.
Production inventories match: 172 npm and 58 APK packages, Node 24.21.0,
with Knip absent. Disposable non-root, read-only, network-isolated probe
containers were removed and cleanup verified.

After the rebuild, ran `check-schema-snapshot-container.mjs --dump` and then
check mode against the exact candidate. Both disposable PostgreSQL 18 databases
passed and were cleaned up. All 22 seed migrations were included, migration tip
`20261005_180000_ingestion_compatibility_fence.sql` is unchanged, and
`database/schema/current.sql` has no diff. No live database supplied this dump.

Recreated only the existing local Compose container. It reports the expected
image/revision and is healthy, with user `1000:1000`, read-only root,
no-new-privileges, drop ALL plus the existing CHOWN/SETUID/SETGID allowlist,
and the unchanged 2 GiB limit. No Compose/template or Unraid changes.
A bounded loopback probe inside this exact container read the HTML entry and
all 71 compiled JavaScript/CSS assets: HTTP status, MIME type and response hash
matched the image files (2,177,757 bytes including HTML). It made no API calls.
This checks Linux-built asset delivery; the eight browser navigation tests above
used the separate Windows production build and synthetic intercepted APIs.

Five-minute observation collected 19 healthy samples, with no allocation
failures, OOM kills or restarts. Raw cgroup usage ranged from 368.9 to 917.5 MiB;
the recorded peak was 934.3 MiB and the final sample 893.9 MiB. A read-only
aggregate of application error-log rows since startup was empty. These are
whole-container observations, not Node heap measurements, a controlled
before/after comparison, or proof that long-term memory retention is resolved.
Memory safeguards and admission limits remain unchanged.

## Hosted checks and limits

Implementation commit `d8ec4dc9cf8779a17547e68e1e235295d423a596` is pushed to
`origin/main`. At 22:37 UTC, [CI attempt 1](https://github.com/cloudbyday90/Classifarr/actions/runs/37852609737)
had passed database integration and fresh-install/published-upgrade jobs, plus
server/client tests, lint, typechecks, coverage, production-route and shared-control
Chromium checks. Its verification image and schema drift check also passed;
remaining PostgreSQL lifecycle/shutdown/queue recovery steps were still running.
This checkpoint does not claim the entire pipeline has completed.

The same revision's OSV, Trivy, Gitleaks, CodeQL, copyright and resource-capacity
workflows passed. Manual tag cleanup and optional synthetic replay were skipped
by their normal conditions, not counted as passes. No release-only provider-fault,
registry publication or native multi-platform acceptance was performed locally.
The final outcome-only commit does not replace the image's implementation
revision. No version, release tag, branch, PR state or production deployment changed.

## Random open-PR trial

Fresh enumeration found two open PRs, 555 and 556. Random selection chose
[556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Its server manifest/lock patch was
applied locally: @types/node 24.19.1 → 26.6.4 and undici-types 7.24.6 → 8.9.0.
The existing runtime-baseline suite changed from 8 passing to 7 passing/1 failing:
Node 26 declarations do not match the deployed Node 24 contract.

The trial was reverted, restoring 8 passing tests and an empty server manifest/
lock diff. It was not installed, merged, closed or retained in this commit.
PR 555 proposes the same major mismatch for the client; it is not an alternative
reason to weaken the runtime contract.

## Next recommendation

Review Engine.IO, ws and ip-address patches together with real transport,
timeout/reconnection and IPv4/IPv6 boundary tests. Then review CI action pins
with producer/consumer evidence checks before release preparation. Keep unrelated
major upgrades and broader pin cleanup separate. The earlier
[pin audit](dependency-pin-audit-2026-10-08.md) records the remaining holds.
