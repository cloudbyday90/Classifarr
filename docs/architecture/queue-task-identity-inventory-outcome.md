# Queue task identity inventory and historic refresh outcome

November 26, 2026. The inventory starts from `490225966` and follows the
[design and tradeoffs](queue-task-identity-inventory-design.md).

## Catalog and owner inventory

The production database factory read catalog metadata in a read-only
transaction against the repository's migrated PostgreSQL 18.6 integration
fixture. Both queue and History primary keys are sequence-backed BIGINT.
Four foreign keys reference the queue ID, all BIGINT and cascading on
deletion. The refreshed History count is 14 BIGINT references, with ten
cascading and four using the default no-action rule. This accounts for
the manual routing state widening since the November 14 assessment.

| Persisted queue reference | Writer, reader and lifetime |
| --- | --- |
| `classification_queue_decision_witnesses.queue_task_id` | The witness repository writes task and History bindings. The admin reader verifies the stored witness identity. Deleting the task or linked History row removes its witness. |
| `classification_retry_lineage_proofs.task_id` | The retry service saves a proof on task insertion. The queued retry lifecycle checks the claim and source before transferring or recovering a completed local result. The proof cascades with the task. |
| `queue_identity_repair_previews.task_id` | Repair previews bind a task revision and actor for a bounded time. Confirm reads under those checks. The previews cascade with the task. |
| `queue_metadata_recovery.task_id` | Discovery stores probe state. The recovery repository binds the leased probe to the failed task and the read model exposes progress. The state cascades with the task. |
| `classification_intake_receipts.queue_task_id` | Intake records and reconciliation feed the private report with exact lookup by task. These receipts survive task cleanup and have a separate 30-day reporting window and pruning. |
| `policy_runtime_historic_route_safety_refresh_receipt_items.retry_task_id` | The historic retry transaction saves the task link. The actor-bound reader left-joins the task while retaining the saved receipt item after the task is gone. |
| `queue_identity_repair_receipts.task_id` | The repair command records the applied result. Readiness and guarded retry use the saved task and receipt identity. A queue deletion does not cascade to this receipt. |
| `image_index_reconciliation_state.task_id` | Image index admission saves the current episode's task. Progress and attempt checks use that state. A missing task does not by itself authorize a new episode. |

Those eight columns are BIGINT. The name-based catalog search also
returned `post_upgrade_tasks.task_id`, a text key for registered upgrade
work. Its source owner does not bind it to a queue row.

The source trace also found these embedded and diagnostic references.

- History's retry outcome link stores `replacement_task_id` from the inserted
  row. The lineage writer compares canonical task and source IDs under the
  existing claim before changing ownership. Queue routing separately uses its
  row ID, claim token and stored History reference to withhold uncertain replay.
- Stale cleanup writes `metadata.stale_cleanup.queue_task_id` as decimal
  text in the handoff statement. The marker is used to prevent repeat
  admission. Receipt reconciliation's recursive links are History IDs.
- Classifier failure logs retain exact task IDs for correlation.
  Ollama gateway work attribution carries canonical decimal task text.
  Neither diagnostic link grants queue or provider authority.

This is a catalog and source inventory of identified application-owned
links. It does not establish data volumes, identify arbitrary external
copies or test a migration. Keep the current keys and use exact validation
at the remaining writers. Consider an independent public identifier only
when a public or cross-installation contract requires one.

## Repair and verification

The historic receipt writer now uses the shared BIGINT normalizer. The
queue insertion and receipt binding still use one transaction, and an
absent requested item still rolls back task admission. Safe task IDs keep
their numeric representation inside the writer. Large IDs are bound as
exact decimal text and remain private to the receipt store.

- Before the fix, both high-ID HTTP cases reported zero queued and two
  failed items. Repository tests also showed that coercive values could
  reach the receipt update.
- All 93 focused unit tests and 101 isolated PostgreSQL tests passed. The
  HTTP fixture exercised actual sequence allocation, adjacent links above
  the JavaScript safe range, the BIGINT maximum, and distinct task
  statuses in read-only reconciliation. It supplied an administrator
  identity and used the existing read/write middleware. Repeated receipt
  reads performed no writes, and another actor received 404.
- Another 98 isolated PostgreSQL tests passed across queue identity repair,
  its backfill and image index reconciliation.
- A forced missing requested item used the production repository and
  rolled back the new queue row. The source History row remained
  eligible and the receipt finalized with a failed item. No follow-up
  work was dispatched.
- Astra traced the two remaining writers and recommended the historic
  flow first because its refusal prevents task admission. GitHub listed
  zero open pull requests.
- Full local CI passed with 64,800 backend tests, one existing skip, and
  7,748 client tests. Statement coverage reached 89.33% for the backend
  and 87.84% for the client. Type checks, the coverage ratchet, server and
  Markdown lint, ESM checks and the staged secret scan passed. The root,
  server and client dependency audits reported zero vulnerabilities.

## Next recommended item

Apply the same exact-ID admission to the live classification intake
receipt writer. In the isolated fixture, a safe numeric task ID recorded
its receipt. Both adjacent large IDs and the BIGINT maximum returned
false without creating a row, even though PostgreSQL read them back
exactly. Verify all intake lifecycle transitions and retained reporting
in a separate change. Preserve the intake receipt's independent
retention and the existing distinction between task and History IDs.
