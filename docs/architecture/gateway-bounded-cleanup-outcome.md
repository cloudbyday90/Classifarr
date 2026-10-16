# Bounded gateway cleanup — outcome

## Status

Implementation and verification in progress on main, 2026-10-16. No production
activation, branch, release or PR merge. The approved scope, research, alternatives
and stack are in the [design](gateway-bounded-cleanup-design.md); explicit optional
installation is described in [operations](gateway-bounded-cleanup-operations.md).

The cleanup extension adds native UUIDv7 operations, narrowly granted routines,
fresh transactional row checks, durable attempt/cooldown accounting, and separate
post-commit confirmation. A new constrained worker shares maintenance exclusion
with the archiver, without taking the lifetime inference lock. All recovery holds
remain indefinite because expiry is not implemented. Newer recovery pairs share
the original exact-batch retry budget.

Archive continuation retains the existing manifest and exact-prefix verification:
all pre-deletion verified copies must be protected, and the current pair must
cover the exact batch. Post-deletion copies establish a new rolling set; protected
historical copies remain. No ordinary application schema migration is introduced.

## Verification

Host checks: 411 gateway unit tests across 19 suites passed; the broader gateway
PostgreSQL run passed 192 tests across 13 suites. After the final transaction
durability guard, all 10 cleanup integration tests passed again. These include
real restricted-login checks, rollback, committed-but-unconfirmed recovery,
preserved retry budgets across replacement pairs, lifecycle/row drift refusal,
maintenance exclusion and actual inference claim/completion after deletion.
The routines force synchronous commit even if the session default is disabled.

Typecheck, test/security lint, both Knip modes, copyright, inventory ownership,
Markdown, static-import, ESM mock-shape and npm-flag checks passed. No security or
ownership baseline was refreshed. Image checks and deployment evaluation follow.
Early SQL testing found an administrator-session role-switch test was insufficient;
the test now connects with a real restricted login. A Windows unit-test invocation
also required the existing explicit OpenSSL path; it did not identify a code bug.

GitHub MCP returned no open Classifarr pull requests on 2026-10-16. No closed PR was
substituted. Unraid, Plex and shared Ollama remain untouched.

## Next boundary

Back up and verify restoration of the complete maintenance catalog, then implement
protection expiry using confirmed deletion plus the minimum 30-day window. The
current 1 GiB storage cap can safely pause cleanup after only a few full-copy
batches; this is not a sustained high-throughput compaction claim.
