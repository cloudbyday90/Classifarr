# Retry lineage ownership and atomic completion

November 21, 2026 Eastern. Reviewed at main `28b69d93a`. The user approved
retaining original associations while work waits, using a durable transfer
record, and recovering committed work without restarting automatic routing.
The [producer correction](retry-lineage-producer-outcome.md) stopped a new
retry from inheriting its source's old lineage after an empty capture.

## What the previous records proved

The retry transaction reads request and webhook IDs, clears associations by
source History ID and enqueues work. Its `replacement_task_id` outcome field
correlates the source with that task when the outcome write succeeds. The
queries do not lock the selected reference rows or prove which associations
the subsequent cleanup changed.

Ordinary webhook and request writers can assign a classification or clear an
association. Request upserts can also change the item behind the request ID.
At consumption, a `NULL` owner cannot establish which operation cleared it.
A queue claim establishes worker ownership of the task. It supplies no proof
of authorization to move the reference rows described by arbitrary task
metadata. Some ordinary queue payloads also carry lineage through metadata
assembly. The rebinder must use a server-owned source of authority.

The current rebinder runs after replacement History persistence and issues
separate requests, webhook and outcome writes. It does not require the
original owner to match and cannot roll back an earlier successful write if
a later write fails. Intake and evaluation receipts are diagnostic downstream
records. The existing routing marker represents a potentially committed external
write and has a different lifecycle from a local completion marker.

The installed baseline passed 159 tests in six focused suites and 67 tests in
four isolated PostgreSQL suites. These establish current behavior, including
retry admission, capture, persistence and historic receipt reconciliation.
They do not establish the new authority or completion contract.

## Agreed ownership model

For new retries with populated, validated lineage, keep the associations on
the source until the replacement commits. This establishes a meaningful current
ownership predicate at consumption. It also changes what request and webhook
readers see while the retry waits, fails or is cancelled. Their existing foreign
keys can keep the source row from being deleted while it owns the references.
The design must account for History cleanup and retention with such links.
Clear-and-resync deletes History inside its reset transaction and already
reports foreign-key conflicts. Preserve that refusal for live associations.
Queue retention prunes terminal tasks independently, so a task-owned completion
record needs a lifetime consistent with queue reclaim and existing retention.

| Option | Benefit | Cost or limit |
| --- | --- | --- |
| Retain the links until transfer | A current owner can be verified with ordinary row locks and predicates | Links remain visible on the original classification while work waits |
| Detach with per-reference reservation | Preserves immediate unlinking and identifies the exact detach generation | Every ownership writer must invalidate reservations and recovery must coordinate their lifetime |
| Detach and require `NULL` at consumption | Small SQL change protects currently linked rows | Cannot distinguish an intervening assignment and clear, or prove original detach authority |

Astra recommends retaining ownership until transfer. Both static reviews
identified the same gap in detached references and the same limit of the
existing queue proof. Reference-free retries retain their existing behavior.
Legacy tasks without durable producer proof cannot reassign links.

## Transaction contract

- For new work, bind the exact expected reference set, typed item and source
  classification to a server-owned durable task record before enqueue commits.
  Require the source outcome link to acknowledge the exact task. Establish
  exact ID representations and bounded list admission for these records.
- On the normal queue entry point, verify the live task claim, repository-owned
  proof, latest source-to-task relationship and item identity. Lock and check
  each reference's current association and qualified item fields. Verify the
  complete expected set whenever work is attempted.
- Insert the replacement and apply the entire transfer in one bounded database
  transaction. Share its client with pending-decision replacement. Check exact
  affected rows, require the original outcome write to succeed and persist an
  exact local completion reference in the same transaction. Set a consistent
  lock order and keep provider I/O outside this transaction.
- A lost COMMIT reply needs an exact task-bound read before another local write.
  The existing uncertain-route barrier continues to govern provider replay.
  A new claim can observe the saved replacement, including any existing routing
  admission. A local result alone leaves automatic routing withheld.
- Missing, changed and legacy proof need fixed internal results and focused
  PostgreSQL tests. The recommended default rejects the entire transfer and
  preserves the newer owner. Mixed-version workers need a rollout boundary
  because older code still writes reference associations by ID alone.

### Refusal and reclaim

If an expected row moved, disappeared or changed its bound identity, refuse
the entire retry with a fixed Queue reason. This also applies to lineage-bearing
older retry tasks that lack producer proof and have no existing routing
admission to observe. Preserve current owners and leave
the replacement History, pending lifecycle and outcome writes unapplied. Treat
the refusal as terminal for the same task, including individual and bulk
requeue controls. A new operator recovery action would need its own authority
because enqueue already retires the source as reclassified. Continue ordinary
classification for unrelated task sources without granting lineage authority
to their metadata. Keep genuine SQL failures and stale claims distinct.

On reclaim, look up the committed replacement under the live claim before
checking current owners. Later valid transfers do not undo that commit. If
routing admission exists, observe its existing routed or unconfirmed result
and require any local completion marker to agree. If only local completion is
proven, identify the saved History and report that automatic routing was not
started. A durable History ID cannot recreate a process-local consensus grant
or prove downstream notifications, enrichment or acknowledgement completed.
Preserve the saved pending question, retry schedule and budget. If the saved
History is unavailable or superseded, retain the completion boundary and report
that state instead of producing another replacement.

Astra also identified two earlier completion paths that must honor the same
boundary. Manual library selection can finish a pending task via its own
History insert and routing path. The unsupported-media worker shortcut can
acknowledge a task before the classifier. Check protected and unproven legacy
retry tasks at these boundaries. For the first stage, explicitly refuse manual
selection for such tasks until it can share the same transfer transaction.

### Storage and lock order

Use one private record per populated retry, keyed by the existing BIGINT queue
task ID. Store the source ID, typed media identity and the exact current request
and webhook rows, up to 256 per table and 64 KiB per proof. Permit optional
reference fields to stay absent and require supplied fields to agree with the
source identity. A protected TVDB-only attempt needs enough saved metadata to
classify without a title-based TMDB search. The command's existing INTEGER
source ID bound still applies.

Write the committed replacement ID and completing claim token together.
Observe that completion under a later claim and require the completing claim
for first routing admission. A duplicate invocation under the same claim
cannot acknowledge work already committed by its peer. The record follows the
queue row through reclaim and acknowledgement until queue retention removes it.
History keeps the ordinary outcome link independently. Removing or superseding
the replacement does not reopen the task for classification.

Take the task claim lock first. Acquire the pending-identity advisory lock
before History row locks. Lock active pending predecessors and then source
History before media requests and webhook rows in ascending ID order. Use
the same client through replacement insertion, reference transfer, source
outcome and local completion. Recheck the claim deadline after waits and at
the commit boundary. Two partial indexes bound the lookup to the source's
references. A terminal failure acknowledgement locks its task before checking
the remaining lifetime.

Report refusal through the existing Command Center queue failure presentation
and omit retry controls for terminal cases. Save the separate routing hold in
the existing queue result. Retain the existing status message semantics when
refreshing results. [W3C status message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

## Sources and recommendation

Reviewed via MCP on November 21, 2026 Eastern.

- PostgreSQL defines all-or-nothing transactions and rechecks UPDATE predicates
  after waiting on a concurrent writer at Read Committed. Apply those properties
  to current owner checks, exact affected rows and a shared transaction.
  [Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)
  · [Transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  · [Explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
- OWASP recommends denying by default and checking authorization on each use.
  Apply that guidance to server-owned task and reference relationships, including
  when an earlier capture exists. [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- W3C PROV distinguishes entities, activities and derivation. The application
  inference is to record the source classification, retry task and replacement
  separately from authority to move a reference. This design does not introduce
  an ontology or a public provenance API. [PROV Data Model](https://www.w3.org/TR/prov-dm/)

Recommended sequence. Preserve original associations while new retries wait.
Bind the exact expected transfer to the durable task. Verify the claim, item and
current owners at consumption. Commit the full transfer and its completion
record together. Recover committed work by exact task identity, and assess wider
ID support after those boundaries are proven.
