# Alias-consistent reviewed repair outcome

Date: 13 October 2026. No release or Unraid deployment.

## Delivered behavior

Supported failed manual/webhook requests can now receive an explicitly reviewed
TMDb replacement across root snake/camel-case IDs, nested media IDs and exact
legacy provider labels. All declarations must agree before review. A small ESM
planner validates both identities and produces fixed path/value patches; a single
parameterized PostgreSQL update and the existing durable receipt commit together.
The UI explains that task IDs change while original webhook evidence is retained.

Unknown/enriched request shapes remain held for separate investigation. The change
does not guess identities, alter media type, drop request context, reset attempts,
requeue on confirmation or expand automatic recovery. Explicit retry remains a
separate guarded command. No database migration or API request/response change was
required. Memory safeguards and ownership baselines were not modified.

Review identified an additional preservation risk in replacing a whole JSON
document: JavaScript cannot retain every numeric value PostgreSQL can store.
Targeted patches preserve unrelated large integers and precise decimals exactly.
The writer also rolls back if its result exceeds the saved-request size ceiling.

## Verification

- Focused unit/HTTP authorization checks: 90 tests in four suites passed.
- Isolated PostgreSQL: 110 tests in five suites passed, including all 68 ID paths,
  nested/legacy-only retries, contradictory aliases added after review, exact
  numeric preservation, oversize rollback, cancellation, receipt-write failure,
  concurrent writers, idempotence and unchanged recovery history/budgets.
- Type checking, ESLint, dependency/unused-code preflight, copyright, migration
  naming/schema integrity and ESM checks passed. Markdown: 2,190 files, no errors.
- Inventory ownership gate passed without baseline changes. Its existing
  unresolved ownership debt remains unresolved; it does not claim full production
  writer isolation.
- Full frontend coverage passed: 471 suites, 7,286 tests. Coverage: statements
  87.69%, branches 81.64%, functions 87.37%, lines 89.39%.

The first backend coverage run overlapped implementation refinement and was
stopped deliberately. The fresh run on frozen source passed all 1,831 suites:
57,888 tests passed, one existing Linux-only directory-fsync test skipped on
Windows. Backend coverage: statements/lines 89.72%, branches 86.32%, functions
91.09%. No runtime or test edits were made during this final run. The coverage
ratchet passed using the fresh backend JSON and frontend HTML reports; no coverage
baseline was changed.

## Packaged image and local evaluation

The no-cache Compose build used clean source
`93d7c300f35dbdb00d881d59279ce6d7acf64792`, without a version bump:

- Image: `sha256:09309cf543fa9b6b23a8d69b26ba5e54ca9c38a379cf4a6fca8ea7b715f5e9af`.
- Platform manifest: `sha256:a71644732e5c46c114ad5752db47398e5fa96730af9fe1a737f4809b2cbbdc16`.
- Config: `sha256:28e9905701722f3e35537b3796a13c9a9a310939f8cbca3ef773322f57f94562`.

An isolated fresh container ran the packaged services with no network or published
ports, bounded CPU/memory/PIDs, and unchanged entrypoint/authentication/migrations.
All declared ID paths changed together; episode coordinates and an unrelated
integer above JavaScript's safe-integer range were preserved. Confirmation made
eight synthetic provider reads and left the task failed at one attempt. After a
same-image restart, duplicate confirmation read the existing receipt without
provider access; the receipt survived synthetic task retention. The comparison
gate also rejected Unicode-padded competing identities. Schema matched, and the
owned container and data directory were removed. This is not an upgrade test or
proof of actual provider data identity.

A local custom-format backup was created before replacement:
`queue-alias-before-20261013-2321.dump`, 76,263,356 bytes, SHA-256
`483f4470cdff8f5b03680be731fdb8f00f4111610f4c4c71850db01ff16fb5df`.
Its archive listing contained 1,928 lines; a restore was not performed. The prior
local image remains tagged for rollback.

Local Compose replacement became healthy after its 23:28:37 UTC startup. The
database was connected, UI returned HTTP 200, and unauthenticated receipt access
returned HTTP 401. Read-only checks found 1,965 completed tasks, no failed tasks
and no new error-log rows since startup (using the database timezone conversion).
Memory sampled at 645.2 MiB of 2 GiB during startup and later 518.5 MiB; this is
not a leak test.
UID/GID 1000, read-only root filesystem, no-new-privileges and the 2 GiB limit were
retained; OOM was false and restart count zero. No real task was explicitly
approved or retried. Unraid, Plex and shared Ollama were not modified.

## PR and recommendation

GitHub MCP enumeration and a final recheck found zero open Classifarr PRs on
13 October 2026, so there was no eligible random PR to implement. No closed PR was
substituted or merged.
All seven workflows for the preceding main commit `2d491709f` had passed.

The [design and official research](queue-identity-alias-repair-design.md) record
the alternatives and recommendation stack. Shape-preserving atomic repair keeps
evidence and consumers consistent; its tradeoff is a deliberately narrow write
allowlist and continued administrator review for each replacement.

Next: assess bounded, opt-in processing of already-approved repair receipts, with
explicit retry consent, persisted limits and restart-safe outcomes. An approval
for one task must not silently authorize other requests with the same old ID.
