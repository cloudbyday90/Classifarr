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

## No-cache image and local evaluation

Built with `docker-compose-smart.mjs build --no-cache --require-provenance` from
clean source `040ff8bfd0ecf14456df13a266f878dad10320e4`.
The local Docker image identity is
`sha256:6660a86a6581a6890225296a7a620e882ea133a969891e2244ac1a1c5813fb61`.
This is local image evidence, not a published registry or multi-platform release.
The final documentation receipt commit does not change this tested code revision.

After building, ran the repository schema-dump implementation against an isolated
PostgreSQL 18 database in that exact image, then loaded and dumped the snapshot
again. The snapshot round trip had zero drift and no tracked schema change.
The same image passed a network-isolated Linux smoke of the production migration
tree functions: directory fsync, complete exclusive copy, source preservation and
refusal to overwrite. This supplements the Windows-only test skip; it is not a
claim that the Jest suite ran inside the production image. Disposable containers
were removed; no live data was mounted in either check.

Recreated only the local Compose service with `--no-build --force-recreate --wait`.
It is healthy on the exact image, with zero restarts or OOM kills. Health returns
200 and the anonymous library API still returns 401. No Unraid container, remote
database, published image, or saved deployment template was changed.

Read-only checks before and after replacement show all 10 local libraries have
completed imports, including Family and Movies. Inventory counts are unchanged.
There are zero unfinished legacy markers. The compatibility migration is recorded,
the connection uses protocol 1, and all 12 safeguard triggers use ALWAYS mode.
Every post-upgrade library has null recovery mode/diagnostics, so no repair warning
is indicated. This proves import status, not completion of optional or metadata
backfill work.

After the startup recovery interval, the exact catalog diagnostic also reports no
failed checks. New-container logs contain no legacy-ownership warning, unavailable
source-pair error, migration failure, or WARN/ERROR-level line during this short
observation. CPU samples varied from 0.66% to 100% (Docker's per-core scale), memory
from roughly 448 to 784 MiB within the existing 2 GiB limit, and task counts from
39 to 46. The saved local configuration has no explicit CPU quota or PID limit.
These samples and zero OOM/restarts are not a sustained soak or proof that every
background workload is bounded; keep that resource-hardening work separate.

All observed client connections to this database were loopback connections. That
is consistent with the local-only setup; a point-in-time view cannot prove that a
disconnected writer will never reconnect. The damaged-safeguard screenshot came
from synthetic browser responses, not the local database. No maintenance repair
or ownership claim is needed on the observed local state.

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
2. Next, provide a guided, narrowly scoped maintenance repair for verified disabled
   safeguards. The user's "how?" feedback identifies a real gap: diagnostics are
   implemented, but telling a self-hosting admin to enable triggers is not a usable
   end-to-end repair. The design records the required backup, locking, recheck,
   privilege and audit boundaries; that repair is not implemented in this round.
3. Add durable, sanitized startup-failure receipts so a failed migration can name
   its actual error after startup is restored. Current diagnostics identify catalog
   discrepancies, not historical failure causes or arbitrary host mounts.
4. Continue privileged-writer isolation separately. The compatibility fence blocks
   unmodified older clients, not a database owner deliberately bypassing it.
5. Keep metadata-completion tracking on the follow-up list: import completion alone
   is not proof that import-and-metadata recovery has finished.
