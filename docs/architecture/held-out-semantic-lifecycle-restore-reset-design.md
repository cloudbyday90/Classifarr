# Held-out semantic lifecycle restore reset design

Status: implemented on 2026-09-08. Research checked against the linked primary
sources on 2026-09-08.

## Problem

The passive held-out lifecycle re-audit has two derived, aggregate-only state
tables: its latest source checkpoint and its latest audit receipt. They are
correctly omitted from configuration backups, because neither is portable
policy configuration. Before this change, however, a merge or replace restore
left the destination instance's existing cursors in place.

That can make a restored configuration look already observed. If its resulting
aggregate source fingerprint happens to match the retained cursor, the passive
worker can correctly stay quiet for the wrong reason. The restore must instead
make its derived state describe the restored durable source, without exporting
or reconstructing private lifecycle detail.

## Decision

Add one small ESM service that deletes only these two derived tables:

- `held_out_semantic_study_lifecycle_reaudit_state`
- `held_out_semantic_study_lifecycle_source_checkpoint`

`restoreAllTables` calls it at the start of every merge and replace restore.
It runs on the same PostgreSQL transaction client as the policy restore. A
restore failure rolls back both the policy writes and the derived-state reset;
a successful restore commits both together. The existing passive scheduler
observes the restored durable evidence on its next bounded run and decides
whether an eligibility audit is allowed.

```text
restore begins in one transaction
  -> clear aggregate source checkpoint and audit receipt
  -> restore durable policy configuration
  -> commit
  -> passive aggregate source check
       -> defer, or run the existing private eligibility audit
```

The reset does not add source evidence, run an audit itself, or turn a restore
into study execution.

## Research basis

W3C Data on the Web Best Practices calls for versioning and provenance so
consumers can understand changing data. Keeping backup configuration separate
from destination-local derived cursors prevents an old observation from being
misrepresented as provenance for the restored state. [W3C Data on the Web Best
Practices](https://www.w3.org/TR/dwbp/)

W3C PROV distinguishes entities, activities, and derivations. The durable
policy source, restore activity, source checkpoint, and audit receipt are
separate artifacts, so the reset discards only the derived local artifacts.
[W3C PROV overview](https://www.w3.org/TR/prov-overview/)

PostgreSQL documents a transaction as an all-or-nothing operation whose
intermediate state is hidden from concurrent transactions. The reset uses the
restore transaction rather than a later independent cleanup, so a committed
restore never exposes a configuration paired with stale derived state.
[PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)

OWASP recommends parameterized queries and avoiding dynamic SQL built from
input. Both statements are fixed SQL with no user-controlled identifier or
value. [OWASP SQL Injection Prevention Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Preserve destination cursors | No extra write. | A cursor can describe the pre-restore configuration and suppress an observation. | Reject |
| Export and restore cursors | Preserves scheduling history. | Makes derived local state portable and can associate a cursor with the wrong destination source. | Reject |
| Delete only on replace restores | Minimizes merge writes. | Merge can also change durable source evidence, leaving the same stale-cursor bug. | Reject |
| Reset both derived tables inside every restore transaction | Matches cursors to restored source, works for both modes, and needs no operator input. | One small pair of deletes per restore; the next scheduled check may run again. | Adopt |

## Recommendation stack

1. Treat lifecycle checkpoints and audit receipts as derived, destination-local
   provenance rather than backup configuration.
2. Reset all dependent derived state atomically with every configuration
   restore.
3. Reuse the existing passive, aggregate-only re-audit after commit; do not
   couple an audit to restore writes.
4. Keep the aggregate state library- and configuration-agnostic and free of
   policy, library, media, provider, actor, rule, and configuration values.
5. Continue to require a real independently labelled 24–32-case cohort plus
   readiness and frozen-study preflight before semantic work.
6. Allow semantic counter-evidence only after a good measured error profile;
   ambiguous items go to review and never automatic routing.

## Non-goals

This change does not export or reconstruct lifecycle details; create a cohort;
collect labels; run readiness, frozen-study preflight, a private eligibility
audit, semantic retrieval, or AI; alter policy; expose an endpoint; or route
media.
