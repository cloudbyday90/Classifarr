# Inventory provider recovery: outcome

## Delivered

Implemented the [design](inventory-provider-recovery-design.md) with modular ESM
policy, lease persistence, reporting and retry-hint parsing. One recovery record
per current inventory item persists across process restarts and ordinary log
retention. It is distinct from the existing source-conflict recovery ledger:
syntactically valid IDs returning 404 are not mislabeled as conflicting source IDs.

Failures retain a case ID, typed identity, category, bounded completed-attempt
count, first/last observed time and resolution time. Attempts interrupted before
commit are not counted as completed attempts. Repeat failures update the same
case without another warning; a new cause is reported. Successful validated
metadata acquisition resolves an open case and releases ownership atomically.
Source changes invalidate the case and all in-flight ownership, including an
identity that changes away and then back. Old learning metadata is never replaced
by a failed response. No guessed identity, routing change or music ingestion was
introduced.

The five-minute lease is deliberately longer than normal provider request
timeouts. Expiry allows a new attempt, but does not allow an expired worker to
write. Duplicate or abandoned work cannot overwrite a newer result. The existing
queue's processing-task recovery still determines when an interrupted task itself
becomes available; lease expiry does not bypass queue ownership or admission.

## Retry behavior

- Transient failures: initially 6–7.2 hours, exponentially increasing to a jittered
  20–24-hour window.
- Missing identity, authentication, TLS and invalid response: initially 24–28.8
  hours, increasing to a jittered 140–168-hour window.
- Valid Retry-After timing can extend that wait, bounded to 30 days. Oversized or
  malformed headers cannot persist arbitrary data. The 30-day cap is a local
  operational bound, not a promise to honor a provider's longer delay.
- A changed source resets the case and cooldown. A changed credential does not
  yet trigger an immediate item recheck; periodic recovery remains available.

These delays are conservative product policy, not timing requirements imposed by
the cited standards. The change does not replace existing transport-level retry
or queue resource controls.

## Querying retained cases

There is no new public endpoint or UI in this increment. An administrator can
query cases read-only in PostgreSQL, joining titles only when needed:

```sql
SELECT id AS item_id, library_id, title, media_type, tmdb_id,
       inventory_tmdb_recovery->>'case_id' AS case_id,
       inventory_tmdb_recovery->>'category' AS cause,
       inventory_tmdb_recovery->>'attempt_count' AS completed_attempts,
       inventory_tmdb_recovery->>'first_seen' AS first_seen,
       inventory_tmdb_retry_after AS next_recheck
FROM media_server_items
WHERE inventory_tmdb_recovery->>'status' = 'open'
ORDER BY inventory_tmdb_retry_after, id
LIMIT 50;
```

No old log is retroactively assigned an invented diagnosis. Existing items start
without a case; the next eligible observation creates one. Resolved state remains
bounded to one record per item until a new case or source change replaces it;
deleting the inventory item removes its state. Configured log retention is unchanged.

## Validation

Completed checks:

- Full backend unit suite: 1,480 suites and 44,107 tests passed.
- Full PostgreSQL integration suite: 177 suites and 2,000 tests passed; one suite
  and one test were skipped by the existing configuration.
- Focused PostgreSQL regression suite: 6 suites and 99 tests passed, including
  recovery, source guards, acquisition history and library-move invalidation.
- Backend coverage: 90.30% statements/lines, 84.53% branches, 92.25% functions;
  coverage ratchet passed. Client code was unchanged; the ratchet used its existing
  coverage report rather than claiming a new frontend test run.
- Production image built. Disposable fresh-install schema round-trip passed with
  all 287 migrations represented. PostgreSQL normalized the expanded trigger
  predicate on its first round-trip; the regenerated snapshot passed the repeat.
- Type checking, test/security lint, dependency analysis, migration/snapshot
  integrity, copyright, ESM import/mock checks and Markdown checks passed. Security
  lint retains one pre-existing non-literal-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`; none was introduced here.

All provider fault responses are synthetic; database tests and schema generation use disposable
PostgreSQL instances. The running Classifarr container and persistent library data
were not modified. No release or PR merge is part of this change.

GitHub's open-PR search returned no open PRs for this repository on 2026-09-27.
Consequently no random open PR could be selected or implemented.

## Next bounded component

Add evidence-gated external-ID revalidation for unresolved 404 cases. Query the
item's known external IDs under a shared provider budget, record no-match and
disagreement explicitly, and verify a type-consistent candidate against current
source evidence before proposing any ID change. Pair this with a compact
administrator recovery view: affected item, cause, next check and one useful
action. Preserve the lease/source guards and test interruption between verified
repair and downstream backfill. Do not use title similarity as authority.

## Subsequent delivery — 2026-09-27

The bounded, review-only external-ID diagnosis is now implemented and tested;
see its separate [design](inventory-identity-revalidation-design.md) and
[outcome](inventory-identity-revalidation-outcome.md). The authorized no-cache
[local deployment](provider-recovery-local-deployment-outcome.md) includes both
the recovery cases and diagnostic, with persistent data retained. This updates
the earlier delivery's deployment status; no live provider recovery is claimed
for an item that has not yet reached its scheduled retry. The authenticated,
actionable recovery view remains the next bounded component.
