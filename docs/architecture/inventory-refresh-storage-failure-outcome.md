# Inventory refresh storage-failure handling outcome

Date: 2026-10-31. Status: implemented and verified locally on main.
See the separate [design, official research and tradeoffs](inventory-refresh-storage-failure-design.md).

## Implemented behavior

A small shared ESM service owns the existing refresh database taxonomy, fixed
diagnosis and one-hour storage retry interval. Genuine observed PostgreSQL `53100`
failures now retain `database_disk_full`, the SQLSTATE and bounded incident/stage
context instead of falling into unknown guidance. Existing logs carry fixed
storage checks and preservation instructions. A provider's matching code or raw
message cannot establish database origin. Memory, connection and configuration
resource conditions are not relabeled as disk-full.

Description recovery uses its existing capped slow-retry path. Representative
refresh holds a separate process-local storage deadline across initial/provider
configuration resets, ordinary failures and resource deferrals. Heavy work can
resume at the exact one-hour boundary through normal admission. The trusted
failure is consumed once and reused for reporting and retry choice. Cancellation,
deadline precedence and all other retry policies are preserved.

Completed database cache entries survive. The representative private model still
becomes unavailable on a genuine error, preserving its verification boundary.
No schema, endpoint, UI, job, setting, provider call, automatic deletion/restart,
ownership reconnect, routing change or learning authority is added. No release
or deployment is part of this delivery.

## Verification

Focused final checks passed nine suites / 182 tests, including cache preservation,
private-model invalidation, first state-read failure, configuration changes,
busy/disabled/cancelled states, exact retry boundaries, successful automatic
resumption, unknown/resource codes, hostile input and provider-spoof exclusion.

Isolated real PostgreSQL checks passed two suites / seven tests. A controlled
`RAISE` produces SQLSTATE `53100`, exercising database serialization, rollback,
pool reuse, worker/scheduler propagation and sanitized persisted logs. No disk
was filled. Existing cancellation/deadline cases remain covered. This demonstrates
handling of database-reported failure, not physical ENOSPC recovery or prevention.

Full backend coverage passed 1,902 suites / 61,716 tests, with one existing skipped
test. Coverage was 89.21% statements/lines, 86.60% branches and 90.73% functions.
The new shared diagnosis module and representative retry module each reached
100% across those metrics. The coverage ratchet passed without baseline changes.
It reused the October 30 client coverage report because client source is unchanged;
no fresh client build or test run is claimed.

Backend types, lint, both Knip modes, static ESM imports, mock-shape checks,
copyright, four policy gates and the unchanged ownership review gate passed.
The ownership report still records its pre-existing `productionCompatible: false`
result; this is not release-readiness evidence. No ownership/security baseline
was rewritten. Markdown lint, whitespace checks and the staged secret scan passed.

The artifact-maintenance handoff reused the same-day verified inventory. This
batch generated current test/quality receipts and coverage, without image builds
or additional removals. The disposable integration container is gone; the local
Classifarr container retained its identity, image and start time and was healthy.
Recovery assets and current evidence remain protected. No service was restarted.

## Limits and next item

The hold is not persisted: a process restart loses it. Preliminary readiness/state
probes may still run, and a new observed disk-full failure may extend the hold.
An hourly retry does not establish that storage has recovered. Existing pre-worker
readiness failures and unobserved direct checkpoint/advisory calls remain outside
this diagnostic coverage; they are not reinterpreted from raw error strings.

Recommended next code batch: carry trusted database diagnosis through preliminary
readiness failures while preserving their admission refusal. They currently become
generic deferred/unavailable results, so useful storage context can be lost before
the worker starts. Reuse the existing wrapper/diagnostic boundaries and logs; add
no new dashboard or manual trigger. Decide that scope separately.

For prevention, measure temporary-file demand and volume/quota behavior on an
isolated workload before selecting per-job limits or host changes. Resume the
existing automatic classification-evidence collection after a separately
authorized deployment, then prioritize a demonstrated routing defect. This code
does not resolve the original Unraid capacity cause or establish classifier accuracy.

GitHub MCP enumeration returned no open Classifarr PRs, including Dependabot;
there was no applicable random PR or stale dependency PR to rebase. No PR was
merged. Dependencies are unchanged. Unreleased records the behavior change.
