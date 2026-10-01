# Legacy import recovery and automatic backfill handoff

## Decision — September 2026

Add an explicit **Recover and resume import** action for already-enabled movie/TV
libraries. Keep the existing disabled-library reconciliation action unchanged.
Both require an administrator session, an exact reviewed revision, a unique
request ID and confirmation that old instances/external writers have stopped.
Neither a reboot nor an old timestamp establishes that fact automatically.

Here, **ownership** means exclusive permission for a background import job to
write results, not ownership of media files. Historical running records may lack
that permission record. Recovery marks those reviewed attempts interrupted and
requests a new full import; it never invents successful historical ownership.

## Gap and implementation

The existing safe maintenance path requires disabling, reviewing, reconciling,
then manually re-enabling. Reconciliation alone leaves the scheduler unable to
continue. The new opt-in path atomically retires reviewed markers and records a
durable full-replay checkpoint while leaving the existing enabled setting intact.
The normal watchdog then performs owned ingestion and existing paged backfill.

1. Preview remains read-only, non-persistent SWR. An additional eligibility result
   checks existing library/source configuration without returning credentials.
2. `resume: true` is an explicit request; omitted/false retains the old contract.
   The library and source must already be enabled/configured and supported.
3. Acquire the existing per-library session lock and bounded ingestion capacity.
   Revalidate the administrator, lock rows, and compare the exact preview. The
   lock remains held until the transaction commits. No provider I/O occurs here.
4. Mark reviewed legacy sync/capture records failed, retain inventory, create a
   retry-wait checkpoint, and commit an audit receipt in the same transaction.
5. Bind idempotency to the requested mode as well as actor/library/revision.
   A lost response may be checked/retried without changing intent. Older audit
   receipts remain readable as disabled-library maintenance receipts.
6. Return a scheduled handoff, not a claim that scanning or backfill is complete.
   Existing source cooldowns, readiness gates, worker limits and configuration
   changes remain authoritative. Disabling afterwards pauses subsequent work.

No library IDs, names or Plex-only rules enter eligibility. Plex, Jellyfin and
Emby movie/TV fixtures exercise the same path; music remains unsupported. No
schema change, new timer, broker, force-takeover endpoint or live reconciliation
is required. The live two-library cohort is diagnostic evidence, not permission
to make a stopped-worker attestation on the user's behalf.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Clear records by age or reboot | Fully automatic | Cannot exclude reconnecting historical writers | Reject |
| Existing disabled-library repair only | Explicit maintenance boundary | Requires multiple manual configuration changes | Retain |
| Explicit recover-and-resume under the same lock | Fewer steps; durable handoff; no settings toggle | Still needs truthful one-time stopped-writer confirmation | Implement |
| Fence every historical writer at the database role boundary | Could permit stronger autonomous recovery | Requires complete writer/privilege and upgrade compatibility work | Separate component |

Recommended stack: existing PostgreSQL session/row locks → small ESM recovery
policy → atomic checkpoint and versioned receipt → existing watchdog/backfill →
named API functions and SWR review with native labeled confirmation controls.

## Official research

Sources discovered through online search and read in September 2026:

- [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  distinguishes cooperative advisory locks from row locks. The current import
  lock excludes cooperating jobs, not arbitrary older/external writers.
- [PostgreSQL consistency checks](https://www.postgresql.org/docs/18/applevel-consistency.html)
  support rechecking locked rows in a short transaction. Do not separate preview
  checks from the transaction that changes durable state.
- [W3C error prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data)
  supports reviewing and confirming stored-data changes. The action and its
  future import/pruning consequences must be explained before confirmation.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  supports announcing a recorded handoff without moving focus or calling it
  completed work. Existing progress remains separate from the audit receipt.

See the [separate outcome document](legacy-ingestion-resume-outcome.md) for the
observed failure mode, verified results and next independently testable component.

The subsequent [review lifecycle hardening](legacy-ingestion-review-lifecycle-design.md)
binds browser responses to the current visit and disables confirmation during
refresh. It preserves this backend contract and the stopped-writer prerequisite.
