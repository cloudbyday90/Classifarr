# Profiling maintenance worker outcome

Date: 2026-10-04. Branch: `main`. No release.
See the [design, tradeoffs and official research](profiling-maintenance-worker-design.md).

## Implemented

Normal embedded startup runs one fixed profiling-assessment child before the web
process. Restore mode skips it. Missing optional profiling is installed only
after known catalog eligibility, exclusive runtime/restore admission, a ready
existing restore gate and unchanged administrator identity. Already-active
profiling performs no DDL. Unknown or unavailable state defers without guessing.

The old generic database installer and web-preflight call are removed. A small
read-only status service replaces reason-string-based write selection. The worker
uses a single pinned transaction, fixed extension/schema, bounded SQL and 20-second
child lifetime, 128 MiB V8 old-space limit and bounded discarded output. Parent
logs contain a fixed operation/status, not child logs or raw database errors.

Completion is joined before app startup. Explicit optional deferral permits the
app to continue; a failed/killed/unjoined process does not. No persistent daemon,
scheduled retry, provider call, new host setting, mount or template is added.
Disconnect rolls back uncommitted work; uncertain commits are re-observed on the
next startup. Installed extension metadata is the durable completion record.

## Verification before image build

- Focused unit tests: 266 passed in 9 suites. Isolated PostgreSQL tests: 24 passed
  in 2 suites, including 8 new profiling scenarios. No skips.
- Full backend ESLint, backend typecheck and Knip, static-import check, migration
  and schema integrity, copyright and all 1,870 Markdown files passed.
- Reviewed ownership changes retain the generic database wrapper as unresolved
  analysis debt. Four fixed worker/status modules are separately coordinated,
  not ingestion owners. No existing unresolved entry is promoted.
  The gate passes with 19 owned, 242 separately coordinated and 501 unresolved
  entries; `productionCompatible` remains false.
- Current open-PR enumeration returned no PRs; none was selected or merged.

## Limits and next recommendation

This is an operation handoff, **not privilege isolation**. The compatible worker
still shares today's OS and SQL identity. Default startup still runs migrations;
historical migrations are unchanged. External PostgreSQL administrators remain
responsible for provisioning profiling; there is no automatic elevated fallback
for external schema mode or direct host development.

Legacy ingestion warnings are unchanged: neither profiling installation nor an
image rebuild proves a historical writer stopped. No owner is manufactured and
no real library is recovered by this change. Unraid remains untouched.

Next: compose schema migration and profiling maintenance into the protected
identity startup path, then remove direct runtime administrative access and port
remaining ingestion writers before enabling automatic legacy retirement. Preserve
the compatible non-root deployment mode until enforced separation is available.
