# Dependency analysis refresh — outcome

## Retained change

On 2026-10-11, updated server Knip 6.40.0 to exactly 6.41.0, following the
[design and official research](knip-641-design.md). Its tooling subtree updates
oxc-parser and its platform bindings/types from 0.150.0 to 0.153.0, unbash from
4.0.11 to 5.0.0, formatly from 0.7.0 to 0.11.4 and formatly's
package-manager-detector from 1.8.0 to 1.9.0. All changed packages are development
dependencies. No package was added or removed, and runtime dependency records,
Knip rules/exclusions, install permissions and security overrides are unchanged.
Node 24.21.0 and npm 12.2.0 remain pinned. No application version bump or release.

The script-disabled review install and normal policy-controlled install passed.
Reviewed packages have no install hooks, and their engines accept the pinned Node
runtime. `npm ls --all` is clean. Full server and client npm audits, including
development dependencies, returned zero advisories. This is an audit result,
not a claim that every dependency has been exhaustively security-reviewed.

## Random PR trial

The fresh two-PR random draw chose
[PR #556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Applied its exact Node-types
26.6.4 and undici-types 8.9.0 diff locally; registry integrity matched.
Both install modes, tree validation and full audit passed. Server typecheck
failed at the Discord HTTP body boundary: the two Undici FormData/File types
are incompatible. Tooling passed 39/40 tests, with the runtime-major alignment
guard correctly rejecting Node 26 declarations for Node 24.

Restored the exact PR changes and confirmed both manifest/lockfile matched the
starting revision before applying Knip. No PR was merged. The retained Node 24
declarations pass typecheck and all 40 tooling tests. Neither the guard nor the
Discord types were weakened to accept this unrelated major upgrade.

## Identity outcome

Normal scheduled sync applied the seven explicitly approved mappings at 06:00
Eastern. At 10:01:13 UTC, all seven had current materialization receipts and no
deferred diagnostic; the local unresolved count dropped from eleven to **four**.
See the [separate identity audit](source-scope-audit-20261011.md) for the remaining
episode gaps and the distinction between metadata presence, approval and repair.
No sync was forced, no extra mapping was approved, and Plex/Unraid were unchanged
by this work. Optional vector completion is not implied by identity completion.

## Verification

Uncached development and production-dependency analysis passed on both Knip
6.40.0 and 6.41.0. Both existing cached 6.41 commands also passed. No rule, ignore
list or baseline was changed to achieve a pass. Both workspace typechecks and the
40-test tooling suite passed, as did documentation, copyright, ESM import/mock
checks and the four production naming/language/delivery/maintenance policy gates.

The full runtime unit, frontend coverage and PostgreSQL integration matrices
are not rerun for this development-only package change. No runtime/API/schema
code changed, and no old coverage report is presented as fresh evidence.
Image evaluation is recorded separately below after the requested no-cache build.

## Recommendation stack

Retain the bounded Knip update: it brings current analysis fixes at the cost of
native-tooling compatibility checks. Keep Node 24 runtime/types aligned; the
sampled PR does not justify a runtime major upgrade. Next review the four remaining
episode-evidence gaps, preserving grouped source shows and requiring consent before
shared Plex metadata mutations. Review client Playwright and Vue tooling separately.
