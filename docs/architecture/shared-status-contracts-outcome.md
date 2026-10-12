# Shared status components: outcome

Date: 2026-10-12. Starting source:
`4c03a23796e42e6a477e0d62d60080969b72e9e6` on `main`.
Node 24.21.0 / npm 12.2.0 on Windows. Version remains 0.49.1-beta.

## Delivered

ConnectionStatus and Toast complete enrollment of all 14 common Vue components
in the existing strict project. Initial enrollment produced 16 diagnostics;
explicit prop, date, store-entry and action contracts fix those diagnostics
without suppressions, wildcard declarations or configuration relaxation.

Caller inspection also found a runtime defect: TMDb and Discord pass text errors,
but the component previously read an object-only `.message`. Both text and
structured results now render. Structured warning messages no longer dump unknown
object fields. Codes, troubleshooting, server/version information and timestamps
remain available. Text stays escaped.

Toast timers, IDs, order and convenience methods are unchanged. Dismissal now uses
the project's checked listener-prop binding, a native non-submit button and a
descriptive accessible name. This is not a new notification announcement/focus
policy or a claim of full accessibility conformance. No dependency, server, API,
database migration, memory safeguard or recovery policy changed.

See [design, alternatives and official sources](shared-status-contracts-design.md).

## Verification

- Both client typecheck scopes passed after implementation.
- Chromium shared-controls suite: seven tests passed, no retries. The new case
  verifies real Teleport, named buttons, Enter/Space dismissal, escaped markup,
  zero form submissions and no API requests or page errors.
- The first targeted unit/compiler run passed 66 of 67 checks. Its sole failure
  was a test assuming whitespace between adjacent spans; the assertion now
  verifies exact label/value pairs without depending on whitespace formatting.
- Client all-dependency npm audit: zero known vulnerabilities. No manifests or
  lockfiles changed; no new install or package provenance claim is made.
- Full frontend coverage: **460 files, 6,926 tests passed**, no skips; 378.24 seconds.
  Statements 87.34%, branches 81.11%, functions 87.06%, lines 89.09%. This includes
  the corrected rendering assertion, 28 real-compiler contract tests and the
  automatically expanded event-lint checks for both enrolled components.
- Dependency/toolchain contracts: 42 passed. Retained PR workflow contracts: six
  passed. Client config tests: 12 passed. Client lint, both typecheck scopes,
  production Vite build and all eight production-route Chromium checks passed.
  ESM static-import, npm CLI flag, copyright and whitespace checks passed;
  Markdown validation checked 2,135 documents with no errors.

The browser runner emitted the existing NO_COLOR/FORCE_COLOR environment warning;
it did not affect the tests. Image checks are recorded separately below.

No new full backend run or combined coverage ratchet is claimed for this frontend
change. Existing backend reports must not be presented as current evidence.

## Open PR

Fresh GitHub MCP enumeration returned only [#560](https://github.com/cloudbyday90/Classifarr/pull/560).
Random selection chose that PR. Its immutable head and complete two-file/four-pin
diff match the previous review and are already implemented in the starting source.
There is no unapplied PR change to duplicate. No PR-state write was performed.
The six local workflow contracts passed against the retained implementation.
At the final inventory check GitHub returned zero open PRs and reported #560
closed at 13:48:32 UTC with `merged: false`. Its closure occurred outside this work.

## Local image evaluation

Before replacement, the local desktop-linux container ran image
`sha256:a774eb830ca03a7b09b2626b51b50bb3fc12a06ee51e6e505b605c1d961ae72b`,
healthy with zero restarts and no OOM flag. A new private 75,915,211-byte database
backup passed checksum and archive-readability checks; an exact rollback image
tag was retained. Neither backup nor private logs belong in Git.

The read-only baseline at 13:56:52 UTC reports ten active/covered libraries,
6,837 classifications, four unresolved identities (two source review and two
retry wait), zero pending text embeddings and 6,815 pending image embeddings.
A unique ten-item consumer batch took 6 ms. The probe made no writes/provider
calls. One existing memory-pressure warning had occurred since startup; this
work does not fix that separate condition or weaken its protection.

The no-cache Compose build completed from clean implementation commit
`72c265854b776dbb351faa81c9ba2250dc11f86c`. Exact local artifacts:

- Image/index ID: `sha256:eae9a58a47a4b365097bf5af7a8aa96591cd91a0294b5c1fb528f610c26ac7de`.
- Exported manifest: `sha256:174af1cc297e2d5e1f82784111994e712de115a2ae967fae64bfcceb86656cb0`.
- Exported config: `sha256:f5dccfb5dc7f084823dc2e3079d6c9f4860e46184d7eb11333269664545d3127`.
- OCI revision matched the full implementation commit before fixture execution
  and after replacement. These are local identities, not published digests or
  signed registry provenance. This outcome's follow-up commit is documentation only.

`dumpSchema()` ran after the build against that exact image in a fresh disposable
container, using the ordinary entrypoint, no network or published ports, 1 GiB,
two CPUs and 256 PIDs. The snapshot remained unchanged through
`20261010_220000_source_catalog_mappings.sql`, including 22 seed migrations.
Fresh-database consumer checks passed with no invented pending work or unresolved
identities. The owned fixture container and data directory were removed and their
absence verified; the backup and rollback image were retained.

Only local Classifarr was replaced, with `--no-build --pull never --no-deps`.
It started at 14:07:01 UTC; Docker health and HTTP `/health` passed. Running image
matched the tested image; restart count zero, OOM false, UID/GID 1000:1000,
read-only root, 2 GiB limit and no-new-privileges remained set.

The read-only probe at 14:07:43 UTC returned the same counts as the baseline;
the ten-item batch took 7 ms with zero writes/provider calls. No WARN/ERROR was
recorded since this startup at that observation point. A quiet 42-second startup
does not establish that the earlier memory-pressure condition is resolved.
Unraid and shared Plex/Ollama were not changed by these checks. Other local
containers were left alone.

## Recommendation stack

1. Retain the existing ESM/JSDoc, Pinia and supported Vue compiler stack. Benefit:
   checked boundaries without a framework migration. Limit: untyped external data
   still needs runtime validation at its existing service/API boundary.
2. Next enroll `ArrConfigWarning.vue` as a small settings component. Its empty
   array state and untyped navigation argument use the same patterns exposed here;
   review its API response, native buttons and route selection together.
3. Expand checking to settings connection-state producers in reviewed batches.
   The common components are covered, not every consuming screen.
4. Separately profile toast timer ownership and define announcement/focus behavior
   before changing notification lifecycle. Keep application memory safeguards on.

The dependency-update skill required a fresh immutable PR check rather than a
duplicate application. The image-evidence skill keeps the later rebuild tied to
an exact source/image and disposable schema data, not production app-data.
