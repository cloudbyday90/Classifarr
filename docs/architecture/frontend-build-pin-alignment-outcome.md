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
- Markdown lint: passed for 2,014 files at the initial documentation check.

Backend coverage, the coverage ratchet and exact-image results are recorded
below after execution; this preliminary checkpoint is not release approval.

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
