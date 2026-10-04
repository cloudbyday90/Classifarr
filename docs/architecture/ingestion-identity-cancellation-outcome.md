# Ingestion identity cancellation outcome

Date: 2026-10-04. See the separate
[design, official research and tradeoffs](ingestion-identity-cancellation-design.md).

## Delivered

The existing import owner's cancellation signal now reaches identity planning,
cached-proof checks, TMDb external-ID/detail reads, and source revalidation.
Pending rate-limit waits remove their timers/listeners on cancellation. Recovery
does not reinterpret a cancelled operation as a provider failure or proceed to
fallback persistence. Plex, Jellyfin and Emby identity reads also enforce the
same 1 MiB decoded-response limit already used for TMDb identity reads.

The change extends existing small ESM modules and the existing TMDb facade; it
does not introduce another singleton, package, scheduler, schema migration or UI.
Ordinary no-signal callers remain supported. Existing generation/ownership checks,
independent identity evidence, attempt limits and durable cooldowns remain intact.

## Diagnosis is not live repair

The current local warnings were traced with read-only SQL: eight old running
markers across two enabled movie libraries have no matching ingestion ledger.
A third library completed import with one TVDB conflict recorded as
`insufficient_evidence`. This patch does not manufacture ownership, choose a
disputed ID, retire those legacy records or claim those warnings are fixed.

Use the existing reviewed **Recover and resume import** action after verifying
older instances and external writers have stopped. That is a one-time operator
decision, not something proved by container age, memory usage or a rebuild.

## Verification

- Regression-first: six cancellation-boundary tests failed on the old code and
  passed after the fix. Cached-proof cancellation, cancellation between two TV
  identity lookups, pending token cancellation and workflow callbacks are covered.
- Focused unit/transport run: 111 tests passed across five suites. Actual native
  HTTP tests cover pre-cancelled requests, stalled response closure, decoded gzip
  response limits and cancelled TMDb rate admission. Separate Plex/Jellyfin/Emby
  adapter tests also passed.
- Isolated PostgreSQL: 97 tests passed across four suites, including recovery,
  legacy reconciliation, identity persistence and fairness. The new test observes
  the actual HTTP request and durable claim, terminates only the synthetic
  library's owning database backend, and verifies prompt transport cancellation,
  unchanged inventory, no false completion/outcome, and preserved identity retry
  state across full import replay. Only the synthetic import retry deadline is
  advanced; the identity cooldown is not reset. This does not prove that a real
  one-day cooldown elapsed.
- Linux container: 85 tests passed across five suites, zero skipped, including
  the real directory-fsync test and cancellation tests. The container had no
  external network, read-only source/root, bounded CPU/memory/PIDs and no live data.
- Backend lint, type checking, normal/production dependency analysis, migration
  integrity, copyright, npm flags, static-import, ESM mock-shape and Markdown
  checks passed. The ownership drift gate passed after reviewing exactly three
  changed fingerprints: the import runner's signal handoff and two read-only
  source adapters. Their SQL analyses and review categories are unchanged.
  `productionCompatible` remains false for existing unresolved writer debt.

- Full backend coverage run: 1,668 suites / 51,340 tests passed, one test failed,
  and one Linux-only filesystem test was skipped on Windows (694 seconds). The
  sole failure was an exact request-options expectation missing `signal: null`.
  After correcting that test-only assertion, Jest's `--onlyFailures` rerun passed
  all 23 tests in the affected suite. Runtime code did not change; the full suite
  was not repeated after that assertion update. The Linux run above covers the skip.
- Coverage: statements/lines 90.05%, branches 85.53%, functions 91.45%. The
  unchanged ratchet passed using this backend report and the existing report for
  the unchanged client. No new full frontend test run is claimed. Frontend build
  and TypeScript checks passed. Additional ID-matching and adapter regressions
  passed 178 tests across six suites. The staged secret scan found no leaks.

Post-rebuild results will be recorded after completion.

## Delivery and recommendation

GitHub MCP and the saved GitHub CLI login both returned zero open Classifarr PRs.
There was no PR to choose randomly; none was substituted, merged or closed.
Work remains on `main`, with Unreleased notes and no release/version/tag change.

Keep lease cancellation → cancellable token admission → bounded HTTP → existing
fenced persistence. It removes obsolete work without weakening ownership or
identity requirements. The limitation is that only supplied cancellation signals
are covered: a healthy owner is not yet cancelled simply because an operator
changes source configuration or requests shutdown. Database operations are not
made cancellable by this patch.
An unusually large legitimate source response also defers at the 1 MiB boundary;
the limit is intentional, and an oversized reply is never accepted as identity proof.

Next engineering item: define and test deliberate import-stop/configuration-change
cancellation through the same boundary. Immediate local recovery still requires
the stopped-writer review above. The recovery-change skill kept those permissions
separate and required real HTTP/database failure tests; Plainspoken kept the
user-facing summary short while retaining the evidence here.
