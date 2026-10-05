# Command Center recovery guidance outcome

Date: 2026-10-05. Branch: main. No release, PR merge, or Unraid deployment.

## Implemented

The [design](command-center-recovery-guidance-design.md) adds a compact banner to
Command Center using the existing library poll. It separates automatically handled
imports from operator review, incomplete connections and a verified missing
database safeguard. It links to the existing library workflow; it cannot claim
ownership, attest that a worker stopped, run recovery, or change permissions.

Normal automatic work is collapsed. Disabled/archived/unsupported libraries stay
quiet. Failed, offline and forbidden reads remove stale actionable guidance.
Status is memory-only, library names are escaped, and rendered rows are bounded.
The existing single-flight polling remains visibility-aware; no background worker
or provider request was added.

Following operator feedback, removed import-ownership jargon from banner copy.
Added scenario-specific catalog diagnostics: exact migration history, connection
protocol and named missing/disabled/changed triggers. Advice distinguishes a pending
update from damage after a recorded update; it never claims missing history proves
a failed migration or suggests replaying non-idempotent SQL. No diagnostic repair
is executed by this read-only feature.

The recovery-change skill kept status observation separate from transactional
admission. Sharing the existing catalog predicate changes no recovery lock, write,
retry budget or authorization. Reviewed the two changed ownership-manifest entries
explicitly: their analysis digests and classifications are unchanged. The existing
502 unresolved entries and `productionCompatible: false` remain recorded.

## Validation

- Isolated PostgreSQL: five suites, 112 tests passed, including legacy recovery,
  reconciliation, library lifecycle, source recovery and Jellyfin restarts.
  Added real SQL assertions for fresh, automatic, active-owner, disabled,
  unconfigured, current-writer review and missing-fence guidance.
  Read-only diagnostics distinguish missing history, missing/changed/disabled
  triggers and incompatible connections; synthetic changes roll back together.
- Production Vue build and Chromium fixture: read-only network behavior, internal
  links, keyboard disclosure/refresh, unavailable/resolved transitions, memory-only
  status and 390/320-pixel layout passed. This uses synthetic HTTP responses, not
  the Unraid application. Browser testing caught and fixed focus loss during
  refresh; a stable status receives focus only if resolution removes its control.
- Updated one old test's page-wide `details` selector to target the recommendation
  it actually tests; corrected the shell fixture to return the API's unwrapped
  library array. No application behavior was relaxed to accommodate those tests.
- Replaced outdated migration documentation paths and removed suggestions to
  fabricate success records, delete migration history or create schema from
  ordinary service constructors. Documented the existing guarded maintenance CLI.
- Lint, server/client typechecks, dependency-tree inspection, 30 tooling tests,
  copyright, ownership review and dependency preflight passed.
- Full backend unit coverage: 1,700 suites and 52,840 tests passed; the Linux-only
  directory-fsync case is skipped on Windows and checked separately in Linux.
- Full client coverage: 437 suites and 6,338 tests passed. Coverage ratchet passed;
  no baseline was lowered. The focused API transport test also passed (18 tests).
- ESM static-import checks, Markdown lint (1,916 files), whitespace checks and
  staged-secret scanning passed.

The requested exact-image no-cache rebuild/schema/local health checks are recorded
below after completion.

## Random open PR trial

GitHub MCP enumerated open PRs 555 and 556. A cryptographic random selection chose
[PR 556](https://github.com/cloudbyday90/Classifarr/pull/556) again, head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Applied its exact two-file manifest/lock
patch locally and ran `npm ci`, tooling policy, typecheck and audit under the pinned
Node 24.21.0 / npm 12.2.0 toolchain.

The proposed `@types/node` 26.6.4 / `undici-types` 8.9.0 combination failed the
runtime-major guard (29/30 tests passed) and Discord `BodyInit`/`File` typechecking.
Audit reported zero known npm advisories, which does not establish compatibility.
Reverted only the trial patch, restored dependencies with `npm ci`, and verified
typecheck plus all 30 tooling tests pass. Neither merged nor closed the PR, and
did not weaken type checks or change the deployed Node major to accept it.

[Definitely Typed's versioning guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md),
discovered through search and read on October 5, explains that declarations target
the corresponding library major/minor, while patch numbers are independent.
Retaining the runtime-compatible Node 24 declarations is the recommendation.

## Recommendation stack

1. Keep read-only guidance and guarded library recovery together: actionable and
   compatible with saved templates; a dashboard cannot diagnose an app that failed
   to boot.
2. Next, add durable, sanitized startup-failure receipts so a failed migration can
   name its actual error after startup is restored. Current diagnostics identify
   catalog discrepancies, not historical failure causes or arbitrary host mounts.
3. Continue privileged-writer isolation separately. The compatibility fence blocks
   unmodified older clients, not a database owner deliberately bypassing it.
4. Keep metadata-completion tracking on the follow-up list: import completion alone
   is not proof that import-and-metadata recovery has finished.
