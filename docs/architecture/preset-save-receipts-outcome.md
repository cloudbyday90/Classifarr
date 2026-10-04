# Durable preset creation: outcome

Date: 2026-10-04. Branch: `main`. Starting revision: `40e53720`.

## Delivered

The Presets Manager now reserves a save request before creating a preset. The
server records the preset and its receipt atomically. A lost response no longer
requires guessing from names in the saved list.

- Reloading the manager reads the signed-in user's unresolved request. It does
  not repeat or cancel a write. No drafts, credentials or request IDs are stored
  in browser storage.
- **Check save status** confirms a saved result or closes the pending attempt.
  A delayed request cannot create after that cancellation. If nothing was saved,
  the open form retains its draft and becomes editable again.
- One unresolved creation is admitted per user across tabs and server instances.
  Repeating the same completed request returns its receipt. Changing its content
  returns a conflict. Different users have independent slots and cannot use each
  other's request IDs.
- Only server-issued requests can create. Expired, missing and cancelled IDs
  cannot silently become new commands. Deleting a preset does not erase the
  recorded saved outcome or cause it to be recreated.
- Client calls remain single-attempt and bounded. Database operations have local
  statement, lock and idle-transaction limits. An explicit status check is a POST
  because it can cancel pending work; ordinary status GET is read-only.
- Unexpected database errors become a fixed safe error code/message before the
  generic error handler. Raw draft values and database failure text are not
  forwarded to logs or the browser by this path.
- Small ESM payload, service, route and receipt-validation modules keep this out
  of the large router. Both legacy and new creation share preset-key generation.
  The new modules and save controller are included in existing typechecks.
- Migration and fresh-install snapshot are updated together. No Compose edits,
  environment variables, new dependencies, background worker or release are needed.
  The running application image has not been rebuilt or replaced in this round.

The [separate design](preset-save-receipts-design.md) records the HTTP contract,
bounds, retention, options, and verified PostgreSQL, HTTP, Stripe and W3C sources.

## Verification

- Isolated PostgreSQL 18 / pgvector 0.8.7 and real HTTP: **27 tests passed** across
  the new receipt contract and existing preset API. Includes a dropped HTTP
  response, lost commit acknowledgement, rollback after insertion, concurrent
  admission/completion, row-lock serialization, lock timeout, actor isolation,
  payload bounds, deletion, expiry and bounded retention.
- Release-schema-to-current replay: **94 migrations replayed / 316 total**;
  upgraded and fresh-install catalogs match. This proves schema equivalence,
  not container upgrade or release acceptance.
- Focused client tests: **61 passed**. Full client coverage: **431 files / 6,221
  tests passed**, no skips, 374.39s. Statements 86.60%, branches 79.45%, functions
  86.17%, lines 88.48%.
- Full backend coverage: **1,656 suites / 50,770 tests passed**, 630.517s.
  The one pre-existing Windows skip is the real Linux directory-fsync test;
  see [Linux filesystem testing](../testing-linux-filesystem.md). No new skips
  were added. Statements 90.04%, branches 85.51%, functions 91.55%, lines 90.04%.
  The combined coverage ratchet passed with both current reports.
- Chromium: **14 executions passed**, seven scenarios repeated twice without
  retries. Covers the real save form, failed save with retained draft, recovery
  after reload, no automatic replay, existing edits and modal caller regressions.
- Client/server typechecks and lint, production build (2.32s), static imports,
  ownership guard, npm CLI flag check, copyright check, Markdown lint and staged
  secret scan passed. Git diff whitespace checks passed.

Local logs: `.tmp/preset-receipts-*.log` (ignored, not committed).

## Review notes

The first schema dump omitted the optional `pg_stat_statements` section because
the disposable database did not preload that extension. Regenerated with the
matching preload setting and verified that unrelated schema objects were retained.
The snapshot was never generated from the live database.

The first backend coverage run flagged fixed column-list interpolation. Replaced
it with literal SQL column lists and restarted the run; no check was suppressed.
Also fixed a browser fixture's missing `globalThis.URL` qualifier. The ownership
baseline only changes the reviewed new migration and updated snapshot, with no
new ingestion authority or writer exemption.

Docker Desktop was started with the user's approval. Test databases were isolated
and removed after use. Existing application containers were not rebuilt, replaced,
reconfigured or used as test databases. No live presets were created or deleted.

## Limits and recommendation stack

1. **Keep server-issued receipts for creation.** Benefit: restart/reload discovery
   and reliable cancellation without browser storage. Cost: two additional short
   write requests per successful save, plus one status read on manager mount.
2. **Next: resume the dependency/tooling review.** Recheck official releases and
   advisories, select a bounded update, and test it independently. Benefit: keeps
   security maintenance moving. Cost: another validation round; no version bumps
   were mixed into this save-state change.
3. **Retire or migrate the legacy unkeyed create API deliberately.** Existing
   clients retain their old behavior and do not gain receipt guarantees. A later
   compatibility change should also standardize attribution on the authenticated
   principal; only the new receipt path does that in this round.
4. **Define concurrent-edit semantics before adding update receipts.** Existing
   PUT uses one attempt plus manual list review, not durable receipts. Revision
   checks would prevent stale overwrites, at the cost of explicit conflict UX.
5. **Before release: cross-browser and screen-reader acceptance.** Chromium and
   DOM tests do not establish Firefox/WebKit or full WCAG conformance.

Unresolved requests never expire just because they are old. Resolved receipts are
pruned in batches of at most 100 after 30 days when that user begins another save;
idle users' old receipts may remain longer. A request resolved elsewhere and later
pruned may require reloading the manager to rediscover current state. Independent
new drafts are not deduplicated by name. Restoring an older database can erase
newer receipts and is outside this guarantee. No full process-kill or container
replacement rehearsal was performed; new-router recovery and real transactions
were tested instead.

## PR and publication scope

GitHub MCP and the saved GitHub CLI login both returned **zero open Classifarr
PRs**. There was no random open PR to implement; none was invented or merged.
Work remains on `main`, under Unreleased, without a branch, tag or release.

The recovery-change skill shaped the durable admission/cancellation contract and
isolated database tests. Plainspoken kept operator messages and progress concise.
