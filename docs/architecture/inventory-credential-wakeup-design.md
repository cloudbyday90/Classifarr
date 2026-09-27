# Verified inventory credential wakeups: design

Date: 2026-09-27. Scope: TMDb authentication recovery for movie/TV inventory.

## Problem and decision

Saving a corrected TMDb credential previously left authentication failures on
their existing 24-hour to seven-day item cooldown. The regular six-hour attempt
clock also prevented an immediate check. A settings save alone is not proof that
the new credential works, and resetting every provider failure would erase valid
404 and throttling protections.

Use the existing five-minute gap-analysis/refill cycle to verify saved active
credentials and release a bounded set of authentication cases. Do not add a
scheduler, external broker, retry endpoint, settings-save network call or AI call.
Unchanged library identity and ordinary enrichment admission remain authoritative.

## Durable workflow

1. A database trigger records a new random generation when a TMDb key or active
   flag changes. Language-only and same-value saves leave it unchanged. A change
   away and back still invalidates old work. Existing configurations receive an
   unverified generation during migration; the migration makes no network call.
2. When authentication cases exist, one worker claims a one-minute probe lease.
   Outside the transaction it checks the fixed TMDb configuration endpoint using
   the existing shared admission limiter, a five-second deadline and 64 KiB
   decoded response limit. HTTP success alone is insufficient: expected
   configuration fields must be present. Provider text and secrets are discarded.
3. Completion requires the same current configuration, generation and unexpired
   lease. Failed verification persists jittered backoff (15 minutes to six hours)
   and bounded Retry-After, up to the existing thirty-day operational cap.
   Provider Retry-After survives further key edits; editing settings is not a
   throttle bypass. Expired leases allow another worker to recover interrupted work.
4. Verified generations release at most 100 rows per batch, at least one minute
   apart globally for that configuration. The normal scheduler runs every five
   minutes; this is not a promise of immediate execution. An indexed, ordered
   cursor advances past malformed cases and wraps to revisit previously locked
   or blocked rows. The limit bounds returned/updated rows, not all database work.
5. Only valid open authentication cases predating verification qualify. Require
   current typed identity, active matching movie/TV library/server, no source
   conflict, an expired/no item lease and a future cooldown. Record a per-item
   generation receipt atomically with a 1–60 second retry jitter and clearing
   the attempt-admission clock. Preserve the diagnostic record, attempts, source
   identity and metadata. Restart/replay cannot release an item twice for that
   generation. New failures after verification retain their normal cooldown.
6. Existing refill, queue admission, source revalidation and provider leases do
   the actual work. Only successful observation persistence resolves the case
   and backfills metadata. A released case is not a recovered case.

Transactions use configuration-table → wakeup-row → item-row lock order. A short
configuration share lock prevents a settings writer racing batch authorization;
one-second lock timeout avoids waiting indefinitely. Row locks use SKIP LOCKED.
No PostgreSQL lock or transaction is held during network I/O. Failed accelerator
work leaves ordinary refill operational, with sanitized debug diagnostics.

## Official research

Sources were discovered through online search/navigation and inspected on
2026-09-27; these are design applications, not claims of platform certification.

- [TMDb application authentication](https://developer.themoviedb.org/docs/authentication-application)
  documents API-key and bearer authentication. Retain the existing API-key flow;
  do not treat an unsaved UI test as authorization for background recovery.
- [TMDb configuration endpoint](https://developer.themoviedb.org/reference/configuration-details),
  linked from its [image guidance](https://developer.themoviedb.org/docs/image-basics),
  provides configuration settings. Reuse that read-only
  endpoint, not an arbitrary media ID that could legitimately return 404.
- [TMDb rate limits](https://developer.themoviedb.org/docs/rate-limiting) requires
  respecting 429 and warns that limits can change. Keep conservative existing
  admission plus durable provider retry deadlines.
- [AWS idempotent retries](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
  motivates generation/lease tokens and atomic progress with effects. This is
  idempotent eligibility release, not a claim of exactly-once network execution.
- [AWS backoff and jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
  motivates spreading retry admission rather than synchronizing a large backlog.
- [PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html)
  explains short transactions, row locks and consistent lock order;
  [ordered limits](https://www.postgresql.org/docs/18/queries-limit.html) supports
  deterministic keyset progress rather than unbounded OFFSET scans.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  supports concise status updates without moving focus. This backend change
  reuses the existing pausable recovery view and its textual retry states; it
  adds no modal, misleading completion percentage or visual-only notification.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Reset on every save | Simple and quick | Unverified credentials and repeated resets; reject |
| Immediate settings-request sweep | Low initial latency | Couples saves to provider/database work; reject |
| Durable verification plus existing refill | Restart-safe, bounded, no new runtime dependency | Scheduler/queue latency; recommended |
| Dedicated broker/workflow engine | More orchestration features | New operational dependency for a small workflow; defer |
| Auto-replace missing IDs | May reduce review work | Credential health does not prove identity; reject |

Final stack: PostgreSQL generation/lease/receipt state → bounded ESM verifier →
transactional wakeup repository → existing refill/queue/provider limiter →
existing non-persistent SWR recovery view. No new dependencies or public API.

Do not generalize authentication wakeups to every failure category. A 404 needs
identity evidence, TLS failures need trustworthy transport, and throttling needs
time. No library names, genres or movie/TV categories are hard-coded as destinations.
