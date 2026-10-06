# Comparison streaming verification outcome

Date: 2026-10-06. [Design, options and official research](comparison-stream-verification-design.md).

## Implementation

Comparison refresh now uses an independent `readVerification` transaction that
validates and fingerprints every exact vector in bounded batches without returning
a decoded vector map. Shared metadata canonicalization and float64 hash encoding
keep fitting and verification keys identical. Initial fitting reads and caller
ownership are unchanged. No memory threshold, hysteresis, deadline, retry, cache
capacity, database schema or deployment-template change.

The existing resource-study adapter now calls the production verification method
and marks those reads as `streamedVerification`; full-read and build counts remain
comparable. Workload, limits, schedules, deadlines and acceptance are unchanged.

## Verification

The original full-map reader deliberately fails the isolated completed-batch
collectibility assertion. The streamed implementation passes it. Diagnostic GC
is confined to that standalone test, not the application or natural image study.
Canonical parity includes a frozen key from pre-change commit `e376a142`, empty
and shared sources, orphan vectors, ordering, exact changes, malformed/foreign/
duplicate/missing rows, row/component bounds and cancellation.

Three isolated PostgreSQL suites / 15 tests passed. Both full and streamed reads
retain the active repeatable-read view during concurrent deletion/replacement;
subsequent reads detect the committed changes. Aborts roll back and return a usable
connection. Repository metadata/state use synthetic adapters; vector rows and
transaction behavior use actual PostgreSQL. This is not a live-provider rehearsal.

Initial new tests had two fixture mistakes (sharing a movie description into a TV
library); the scope guard rejected both. Corrected fixtures use a second movie
library. No validation rule was relaxed.

Full backend validation passed: 1,724 suites / 53,609 tests, with one existing
platform-specific skip (no coverage run). Server typecheck, lint, both dependency
boundary checks, 40 dependency-tooling tests, static ESM imports, copyright,
ownership and Markdown checks passed. No frontend code or dependency was retained
from the PR trial. Image/local evaluation follows from the committed source.

The ownership gate required review of the changed repository source. Inspected
its complete query adapter and new callees: fixed reads and transaction-local
settings only, no protected inventory DML, no provider calls in a transaction.
Updated only that reviewed source digest and explanation; its analysis digest and
unrelated ownership debt are unchanged.

## Random PR trial

Fresh enumeration found #555 and #556. Randomly selected
[client typings #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`, and applied its exact two-file diff.
The unchanged runtime-major gate rejected Node 26.6.4 declarations for Node 24.
Reverted only the trial changes before installation; no dependency changes or
merge. Registry metadata confirms the proposed undici-types ~8.9.0 dependency.
Client outdated also reported postcss 8.5.29 and Vite 8.3.3; these were not installed
or assessed as a security batch. TypeScript 7 is a separate major update.

## Next decision

Measure the unchanged shared-catalog workload before claiming a whole-container
peak improvement. Shorter reachability is not a GC scheduling guarantee. Preserve
the previous run and any failed candidate receipt. Select the next optimization
from measured remaining build-stage allocations, not by raising limits or hiding
resource deferrals. No release, tag, new branch or Unraid mutation.
