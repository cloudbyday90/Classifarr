# Capture reservation fence design

Date: 2026-11-02 (America/New_York). Status: agreed; implemented and verified.
Predecessor: [finalization fence outcome](capture-finalization-fence-outcome.md).
Outcome: [implementation and observed limits](capture-reservation-fence-outcome.md).

## Observed boundary

Automatic capture already acknowledges a private UUID claim on the actual
discovery-lock-owning backend. Finish checks that UUID, but reservation still
checks only configuration revision, quota day, window and remaining budget.
An older worker that has not observed session loss can therefore reserve another
call after a replacement has claimed the same revision.

The reservation callback first resets the UTC quota day, then charges one call
and 8,448 tokens. Failed charges currently throw inside the transaction, rolling
back its reset and any default-singleton bootstrap. Preserve that refusal
behavior while adding ownership proof before either reservation-specific write.

Only the automatic budget worker uses this reservation method in production.
The separate manual developer capture does not reserve through this repository;
it publishes through a different private cache writer. Checkpoint open/record/
publish and same-revision advance also lack claim predicates, but include more
payload and publication semantics. Keep them as the next separate batch.

## Recommended first batch

Require the existing acknowledged UUID on every budget reservation, with no
unfenced or legacy fallback. Keep it private in the existing per-flight helper,
adding a bound reservation operation for the worker's existing checkpoint.reserve
callback. Provider/capture dependencies receive that fixed callback, not the UUID,
claim operation, raw connection or arbitrary SQL capability.

Within the existing short write transaction:

1. Validate the UUID before database work. Keep existing transaction/bootstrap
   and cooperative-stop behavior.
2. Lock the exact singleton/revision/UUID row before the UTC reset. Recheck stop
   after acquisition. Only an exact zero-row owner check proves non-ownership;
   missing or invalid counts remain contract failures.
3. Reset the UTC day using a reservation-only guarded SQL variant, retaining
   the shared reset used by ordinary reads unchanged. Keep the lock through
   reset, charge and transaction settlement.
4. Require the UUID again on the charged UPDATE, preserving quota, day, window,
   increment and maximum-call formulas. Exact quota/window refusal keeps the
   existing budget_exhausted meaning; invalid results remain failures.
5. Throw a private server-minted ownership refusal inside the transaction on
   proven mismatch, so bootstrap/reset rollback remains intact. Recognize it by
   private identity rather than an error message, SQLSTATE or provider code.

After the repository attempt settles, the per-flight helper latches that trusted
ownership refusal. Return the existing deferred outcome and five-minute local
fallback, and suppress a now-unauthorized cleanup finish even if admission
replaces the thrown error. Permanent worker stop retains precedence. A generic
query error, rejected/lost COMMIT reply or provider-created lookalike does not
prove ownership loss and must not set this latch. Existing failure handling
continues for those outcomes without replaying the reservation.

Use small SQL/ownership-refusal leaf modules as needed, retaining the existing
factories. Do not introduce an attempt framework or rename the schema merely to
broaden the historical finalization_attempt_id column's internal use.

## Completion condition and limits

After a replacement claim commits, the old claim cannot commit a new automatic
reservation's UTC reset or charge. A refusal or uncertain reservation reply
prevents the generation POST that awaits it. No budget is refunded, replenished
or replayed, and no uncertain operation becomes permission for a retry.

A charge accepted before replacement remains charged. Its acknowledgement can
arrive later, and an old worker can still dispatch that already-authorized POST
after replacement if lease loss remains unobserved. This database fence cannot
make SQL and HTTP atomic or cancel remote work already accepted. Do not hold a
transaction across HTTP or promise prevention of every stale dispatch. Provider
inspection may already have happened before the generation reservation.

Keep existing statement/lock limits, inherited isolation, acquisition policy,
resource admission, workload checks, ownership lifecycle, budgets, stop handling
and cooldown rules. No new queue, whole-worker deadline or cancellation protocol
is added. Ordinary reads retain their current maintenance writes. Older binaries
that omit the predicate and unfenced checkpoint/publication paths remain explicit
limitations. This adds no schema, public result field, endpoint, UI, setting, job,
operator CLI trigger, routing/learning change, release or deployment.

## Options, pros and cons

| Option | Benefit | Cost or remaining gap | Decision |
| --- | --- | --- | --- |
| Revision-only reservation | No change | Old same-revision claim can spend more budget | Insufficient |
| UUID on charge only | Small rollback-safe charge guard | Old work can reach/reset the row before rejection; weak failure diagnosis | Prefer explicit owner prelock |
| Owner prelock plus guarded reset/charge | Clear refusal, rollback and serialization boundary | One extra short lock query; accepted earlier POST remains possible | Recommend first |
| Fence all checkpoints and publication now | Broader persistence protection | Couples retained payload, rotation and shared cache authority | Separate next batch |
| Durable provider dispatch protocol | Could coordinate later dispatch evidence | Requires new receipts and remote idempotency/recovery decisions | Defer |

Recommendation stack: bind private reservation authority, enforce serialized
ownership before reset/charge, preserve rollback and trusted refusal handling,
then prove database/HTTP boundaries. Assess checkpoint/advance/publication
ownership next without changing manual cache authority incidentally.

## Verification and delivery

Use the production database factory and real owner-session claims against
isolated PostgreSQL. Cover replacement before reservation and while waiting for
the row lock, both commit orders, UTC rollover, disabled/closed/exhausted budget,
missing singleton, invalid authority, stop/rollback and inherited isolation.
Verify exact counters and absence of committed bootstrap/reset on refusal.

Use real loopback HTTP generation to prove no generation POST after ownership
refusal or uncertain reservation acknowledgement. Also demonstrate that a
reservation committed before replacement remains charged despite a delayed/lost
reply, without claiming remote atomicity. Verify trusted refusal survives later
admission replacement and prevents cleanup, while forged messages remain unknown.

Run focused tests, affected quality/ownership gates and coverage checks. Review
changed ownership entries individually without relaxing their classifications
or baseline. Record observed results in a separate outcome, update Unreleased,
perform artifact maintenance, and commit/push on main after validation.

## Official research

Retrieved through search MCP on 2026-11-02:

- [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html):
  concurrent row changes are rechecked at Read Committed; stronger inherited
  isolation can instead reject a conflicting transaction. Do not add replay.
- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  row locks serialize conflicting updates through transaction settlement.
- [node-postgres transactions](https://node-postgres.com/features/transactions):
  reset and charge must remain on one checked-out transaction client.
- [RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html):
  retrying a non-idempotent request requires evidence of safety. Local ownership
  rejection and an unknown remote outcome are different evidence boundaries.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/):
  apply minimization by reusing private authority without adding identifiers,
  telemetry or operator controls. W3C does not specify this database fence.
