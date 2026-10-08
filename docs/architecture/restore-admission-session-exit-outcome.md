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

## Verification recorded before image evaluation

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

Full integration, image evaluation and exact revision details are appended after
they finish; this document does not yet claim release readiness.

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

## Recommendations

The separate [dependency/pin audit](dependency-pin-audit-2026-10-08.md) records
official sources, hidden updates, compatible holds, pros/cons and ordered batches.
Next: align the frontend build/test overrides with their parents and review the
Vite/PostCSS patches, then handle runtime transport/IP and CI artifact updates
separately before freezing a release candidate. Do not use Node 26 declarations
or a blanket major-version override as a shortcut.
