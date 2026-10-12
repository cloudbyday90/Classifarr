# Completed refresh-cycle memory outcome

Date: October 12, 2026. Main; no release or version change.
See the separate [design, official sources and tradeoffs](refresh-cycle-memory-design.md).

## Implemented

The existing full-catalog diagnostic now records bounded, scalar-only samples
for each successful representative/comparison refresh. Each sample associates
worker/attempt/status with main-thread memory, whole-process RSS, raw container
memory, sampled weak-reference counts and both model caches' estimated occupancy.
The recorder copies numbers, not snapshots or model references. Inspection does
not prune or renew cache entries. Explicit representative-cache construction uses
the same production defaults; no runtime service behaviour or safeguard changes.

Catalog receipts are now v3 and require complete cycle evidence, correspondence
with successful attempts, post-drain revalidation, and empty caches/exited workers
after stop. The Markdown report shows comparable first/last post-drain refreshes
and shutdown. Failed-run traces preserve only allowlisted numeric cache fields.
No heap dump, forced collection, new SQL, provider request, migration or UI change.

## Random PR trial

Fresh enumeration found two open PRs. Random selection chose
[#558](https://github.com/cloudbyday90/Classifarr/pull/558), exact head
`e8a7ee2e490e5437375aa3a4628943657fa1783e`. Applied its exact client manifest and
lockfile patch locally. Strict installation, complete dependency-tree check,
full npm audit (zero advisories), API and component typechecks passed. The
toolchain suite passed 40/41, rejecting Node 26 declarations under pinned Node 24.
The exact PR patch was reverted and dependencies restored; no merge or retained
dependency update. Successful typechecking alone is not runtime compatibility.
Restored client typechecks and all 41 toolchain tests passed again. Current
outdated metadata also lists vue-router 5.4.0 and TypeScript 7.0.2; neither is
silently bundled into this memory-diagnostics change.

## Verification

Focused diagnostics/receipt tests passed 124 tests across seven suites. Cases
cover missing/duplicated/wrong-worker cycles, unknown fields, invalid numbers,
forced-GC evidence, out-of-order timestamps, incomplete revalidation, cache
bounds, uncleared caches, active workers, scalar-copy isolation and redaction.
The read-only ownership gate, server lint and server typecheck passed without
baseline updates. Full-suite and actual image results follow after completion.
Both dependency-boundary checks, ESM import/mock-shape checks and copyright also
passed. No quality threshold was reduced.

## Limits and next decision

The shared-catalog fixture uses synthetic transports and vectors but real SQL,
refresh builders, threads, cache behaviour and consumer code. It is not the full
application scheduler or a reconstruction of Unraid's retained heap. Season-level
mapping expansion remains a separate distribution to add to the corpus fixture.
Do not infer a leak from an RSS increase or a surviving weak reference alone.
Only observed lifecycle/GC evidence should justify a follow-up runtime fix.
