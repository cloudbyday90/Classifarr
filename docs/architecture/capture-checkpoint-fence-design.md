# Automatic capture checkpoint fence design

Date: 2026-11-02 (America/New_York). Status: implemented and verified.
Observed result: [checkpoint fence outcome](capture-checkpoint-fence-outcome.md).
Predecessor: [reservation fence outcome](capture-reservation-fence-outcome.md).
Implementation base: 988807e2d915e03ea1cba74cd62bfa6db1d4d058 on main.

## Observed gap and completion condition

At the implementation base, automatic capture acknowledges a private revision/UUID
claim on the discovery-lock-owning session. Reservations and finalization require
it, but the worker constructs budget.checkpoint(revision) without that authority. Its open,
record and publish transactions still check revision only. A replaced worker
that has not observed session loss can overwrite progress or publish a cache.

Publish already updates checkpoint progress and then writes the shared cache
atomically in the same transaction. Fencing only open/record would leave its
later progress overwrite unfenced. The coherent first batch therefore covers
all three existing automatic checkpoint transactions, including that current
publication. It adds no publication producer or permission.

Completion: after a replacement claim commits, an old claim cannot commit a new
open, record or publish transaction. A transaction serialized before replacement
may commit first, and its acknowledgement may arrive later. This does not make
response delivery evidence of current ownership or make SQL and provider HTTP
atomic. Charged generation may already have completed before a save is refused.

## Private authority and modular implementation

Require checkpoint(revision, attemptId) without a legacy or missing-authority
fallback. Bind it through the existing per-flight claim helper, exposing only
fixed open/record/publish callbacks. Keep UUID, raw database clients and claim
capabilities out of provider inputs, public results, logs and status projections.
No persisted claim is read back to recover authority after restart or uncertainty.

Extract the checkpoint factory and its SQL into small leaf service modules,
preserving the repository's existing transaction/bootstrap helper and factories.
Reuse the current owned-row lock and private refusal pattern without introducing
an attempt framework or renaming the historical finalization_attempt_id column.
Review every affected ownership-inventory entry/digest; retain unresolved
classification where advance and other existing compositions remain unfenced.
Do not silently regenerate or relax an ownership baseline.

For each automatic checkpoint transaction:

1. Validate the private authority and preserve existing payload-validation
   boundaries. Run the current short write transaction on one checked-out client.
2. Lock the exact singleton/revision/UUID row before retention/reuse decisions
   or checkpoint DML. Recheck cooperative stop after the awaited lock.
3. Accept only exact numeric rowCount 1 as ownership proof. Exact zero can mint
   a private server-owned refusal and must roll back, including any default-row
   bootstrap. Missing, null or invalid counts are contract failures.
4. Run retention/key/eligibility reads and writes as separate commands after the
   owner lock, using their existing statement-time predicates with fresh anchors.
   Require UUID on checkpoint reads/updates and publication's source SELECT.
5. Preserve the existing atomic progress update plus cache insert/replace. Hold
   the budget row lock through transaction settlement; no database transaction
   spans provider HTTP. ON CONFLICT does not need a new authority protocol when
   the owned source and prior progress update retain that lock.

Open must verify authority even when it returns retained progress without a
write. Preserve exact plan/configuration/model matching, cloned results, reuse
of a matching published batch and its original lease. Keep the seven-day payload
lease, record validation/order and local batch update only after acknowledged
transaction success. A new owner may reuse valid retained evidence; do not add
historical UUID backfills, payload versions or lease renewal.

## Refusal, cancellation and uncertainty

After a repository transaction settles, the private per-flight wrapper latches
only a trusted ownership refusal from open, record or publish. Reuse the existing
deferred result/five-minute local fallback and suppress stale durable cleanup,
including when admission later replaces the thrown error. Permanent worker stop
keeps precedence. Provider-created messages/codes cannot mint this evidence.

A zero checkpoint update/source count due to a changed key, expired lease or
ordinary eligibility refusal is not proof of ownership loss; preserve its current
budget-changed behavior. Malformed counts, serialization errors, generic query
failures and rejected/lost COMMIT replies also cannot mint ownership evidence.
An uncertain write may be durable: do not replay it, refund a charged attempt,
recover a claim or assume a remote operation was undone. Preserve current cleanup
authority for ordinary failures after an acknowledged claim.

Keep inherited isolation, the existing 15-second statement/one-second lock limits,
pool-acquisition policy, stop checks, admission lifetime, workload gates, quotas,
status/cooldown rules and scheduling. Queued stop may still wait for acquisition;
this batch adds no SQL cancellation, timeout or bounded whole-worker shutdown
claim. Disabled/fresh configurations still perform no automatic capture work.

## Deliberate authority boundaries

The separate manual developer capture has no budget checkpoint; its existing
private cache writer stays unchanged. Manual cache replacement remains independent.
This is not a global cache fence or a guarantee against every stale writer.
Older binaries and physical database rollback remain outside the claim protocol.

Same-revision advance still clears progress/fingerprint without UUID and remains
the next separate mutation to assess. Configuration/revision changes and both
restore modes already invalidate the claim; preserve those boundaries and their
atomic rollback behavior. Ordinary read retention/pruning is unchanged.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Fence open/record only | Smaller edit | Existing publish can still overwrite progress/cache | Insufficient for this batch |
| UUID guard on DML only | Narrow predicates | Misses retained open returns and clear refusal evidence | Prefer owner prelock as well |
| Fence all three existing automatic transactions | Coherent owner boundary; preserves atomic publish | Extra short lock query and compatibility review | Recommend |
| Fence manual writer/advance/global publication together | Wider protection | Mixes separate authority and lifecycle contracts | Defer |

Final stack: private acknowledged claim, owner prelock plus guarded commands,
settled trusted refusal, unchanged atomic save and no uncertain replay, then real
database/HTTP proof. Next assess same-revision advance while retaining independent
manual cache authority.

## Verification and delivery

Use existing isolated PostgreSQL fixtures with the production database factory
and real owner-session claims. Cover replacement before each operation and while
waiting for its lock, both commit orders, retained open returns, restart reuse,
lease/key/config changes, restore invalidation, missing singleton rollback,
malformed results, stop/precommit rollback and inherited isolation. Demonstrate
durable commits with delayed/lost acknowledgements without retry or budget refund.

Reuse loopback HTTP capture fixtures to prove charged results are preserved as
charged, stale saves cannot replace progress/cache after replacement, private
refusal survives admission replacement, and the independent manual writer still
works. Run focused checks before fresh affected coverage and quality gates.
The separately selected [client PR proposal](client-tooling-pr-579-design.md)
retains its own dependency and browser validation.

Keep design/outcome separate, update Unreleased and relevant follow-ups, perform
artifact maintenance and staged secret/diff checks, then commit/push all changes
on main. Add no schema, public fields, UI, setting, job, CLI trigger, provider
permission, routing/learning change, release, deployment or service restart.

## Official research

Discovered/read through MCP on November 2, 2026:

- [PostgreSQL 18 row locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  and [transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html):
  serialize conflicting rows and preserve stronger-isolation refusal without replay.
- [PostgreSQL statement time](https://www.postgresql.org/docs/current/functions-datetime.html):
  a command dispatched after lock acquisition obtains a fresh statement anchor.
- [node-postgres transactions](https://node-postgres.com/features/transactions):
  keep all transaction commands on one checked-out client.
- [RFC 9110 retry semantics](https://www.rfc-editor.org/rfc/rfc9110.html):
  unknown remote outcomes do not establish permission to repeat a non-idempotent action.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/):
  apply minimization by retaining private coordination authority without adding
  identifiers or operator controls. W3C does not prescribe this database fence.
