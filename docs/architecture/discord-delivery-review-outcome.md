# Discord delivery review — outcome

Date: 2026-10-04. Starting revision: `1eba7db6`. Branch: `main`.
Toolchain: Node 24.21.0 / npm 12.2.0.

## Delivered

Discord settings now includes an on-demand administrator review panel. It shows
page-scoped Delivered / Unconfirmed / Rejected counts, a short next step for each
classification, and native disclosures for recorded channel/message IDs and
timestamps. Counts are not global delivery percentages. Phone layouts keep the
labels readable; loading/error announcements do not steal keyboard focus.

The named client API function, request-state composable, Vue component, route
handler and read repository are separate ESM modules. The existing primary key
supports bounded keyset pagination, with 25 returned records, four concurrent
reads per handler instance, read-only transactions and SQL timeouts. Requests
are authenticated/admin-only and non-cacheable. Responses exclude credentials,
nonces and raw history/provider payloads. The browser performs one timed request
per explicit action, cancels on unmount and retains labelled old data on failure.

No automatic polling, provider calls, database mutations, new dependency, schema
change or deployment configuration is needed. Existing pending/uncertain receipts
are never reset or marked delivered by a page refresh. Existing installations can
review receipts even after Discord is disabled or its channel changes. Legacy
messages without receipts and test/system alerts are explicitly outside coverage.

## Research changed the proposed reconciliation step

The previous follow-up proposed entering a message ID to confirm an uncertain
delivery. That is **not implemented**: the current Discord contract does not
promise a durable nonce on a later message read, and the official repository's
historical explanation says it is not stored. Bot/channel/title matching would
not prove a unique receipt. A verification button based on that assumption would
be misleading. Sources and alternatives are in the
[design](discord-delivery-review-design.md).

This slice delivers visibility, not automatic healing of ambiguous historical
sends. Passive matching Gateway confirmations from the previous implementation
still work. No resend, clear-receipt or manual “mark delivered” endpoint was added.
The recovery-change skill drove this evidence-only boundary and the real-I/O
checks; W3C guidance informed labelled counts, disclosures and live status text.

## Verification

- Focused Windows backend: **2 suites / 36 tests passed**; route authorization,
  invalid/oversized cursors, sanitized failures, response field allowlisting,
  bounded concurrency and existing Discord settings behavior.
- Full backend coverage: **1,662 suites / 50,957 tests passed** in 793.122
  seconds. The single Windows skip is the directory-fsync test run separately
  on Linux below. Statements/lines 90.09%, branches 85.50%, functions 91.56%.
- Focused frontend: **2 suites / 22 tests passed**; explicit loading, sample counts,
  pagination, stale/error/empty states, malformed data, escaped titles, cancellation
  and late responses. Full frontend coverage: **433 files / 6,253 tests passed**
  in 200.71 seconds; statements 86.64%, branches 79.51%, functions 86.21%, lines
  88.52%.
- Isolated PostgreSQL: **2 suites / 29 tests passed**; existing delivery races and
  persistence plus multi-page read-only review, legacy empty state, title bounds,
  transaction settings and a real conflicting table lock. Lock timeout rolls back
  cleanly and a later read succeeds. No application database was used.
- Chromium: **3 tests passed** at 320px and 1280px. Verified keyboard loading and
  disclosure, no horizontal page overflow, no initial fetch/polling/mutation,
  and no transport retry after 503. Screenshots were visually inspected. These
  exercise the production component and transport in an isolated fixture, not
  a deployed authenticated settings session.
- Isolated Linux: **2 suites / 19 tests passed**, no skips, including the Linux
  directory-fsync case. Reused locked-dependency test image
  `sha256:48613d647997b9486ba2112c4090256920b3c2369ffdac189e23c70b95441e3c`
  with read-only source, no network/live mounts, dropped capabilities,
  no-new-privileges, 2 CPUs, 1 GiB RAM and 128 PIDs.
- Client/server lint and type checks, production client build, dependency-usage
  checks, static-import and ESM mock-shape gates, ownership review, copyright and
  npm CLI policy passed. No security/ownership baseline was changed. Production
  output contains no browser-fixture entrypoints.
- Validation exposed a pre-existing lint traversal race with temporary Vue
  type-check directories. The client lint configuration now excludes `.tmp/`;
  a direct ESLint API check confirmed generated files are ignored and application
  source is still linted. No source rule or type-check baseline was weakened.

The combined frontend/backend coverage ratchet passed without baseline changes.
Markdown validation checked **1,848 files** with zero errors; whitespace checks
and the staged secret scan passed. Logs and browser screenshots are local-only
under `.tmp/` and `client/test-results/browser/`. This is not release or upgrade
rehearsal evidence. The full unrelated PostgreSQL integration suite was not rerun;
the two affected suites above were executed against isolated databases.

## Recommendation stack

1. **Use this read-only panel for triage.** Clear visibility at low cost; it does
   not resolve missing proof or guarantee the Discord message still exists.
2. **Next: persistent correlation plus bounded reconciliation.** Add a durable,
   authenticated marker to future notifications and verify exact stored bot,
   channel and message before completing a receipt. More protocol complexity,
   but no reliance on message titles or a short-lived nonce. Older unmarked
   messages must remain explicitly unconfirmed.
3. **Then: durable deferral and overall send deadlines.** Address saturated callers
   and provider waits while preserving the no-uncertain-replay rule.

Both GitHub MCP and the saved GitHub CLI login returned **zero open Classifarr
PRs**. There was no eligible random PR to implement; no PR was merged. No branch,
version, tag, release, live Discord action or application image rebuild was created.
