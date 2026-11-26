# Exact task IDs in queue metadata checks and identity repair

November 26, 2026. Queue tasks, repair previews and receipts already store a
BIGINT task reference. Metadata checks and repair service admission capped
those IDs at JavaScript's safe-integer limit. Readiness could return a larger
decimal-string cursor that the next page rejected. Preview and confirmation
both call the metadata checker, so the maintainer approved widening the
complete workflow together after Astra reviewed its data and authority paths.

## Research and tradeoffs

PostgreSQL BIGINT supports positive IDs through 9,223,372,036,854,775,807.
RFC 8259 identifies the smaller binary64 range through 9,007,199,254,740,991
as interoperable for JSON integers. PostgreSQL's bound query parameters can
carry exact decimal text to a BIGINT predicate. W3C guidance on structural
metadata and compatible API evolution supports keeping the existing string
response types and documenting the complete range.
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[node-postgres query parameters](https://node-postgres.com/features/queries) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

An identifier selects a row. The existing administrative session and active
actor checks establish access, and the preview, receipt, task and source
checks bind each operation. The selected batch remains one transaction.
[OWASP object-level authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/) ·
[PostgreSQL transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)

| Option | Benefit | Cost |
| --- | --- | --- |
| Keep the safe-integer cap | Retains a smaller input range | Leaves valid tasks inaccessible and can interrupt pagination |
| Widen the metadata check first | Enables independent diagnostics | Leaves confirmed repair, retry, and backfill capped |
| Widen the complete repair flow | Supports existing BIGINT rows and preserves response types | Requires testing the shared read and write boundaries together |

## Recommended implementation

1. Apply the existing canonical BIGINT parser before diagnostic or repair
   service work. Accept safe positive numbers and canonical decimal strings.
   Keep decimal-string `taskId` values in the check, preview, receipt and
   readiness results and for `nextCursor`. An omitted `afterId` requests the
   first page. Keep the internal zero cursor private.
2. Validate IDs before the browser builds the task URL, cursor query or
   selected retry body. Keep the same endpoint, response handling,
   cancellation and no-automatic-retry options. UUID receipts, TMDb IDs,
   actor IDs, source revisions and fingerprint bytes retain their contracts.
3. Keep readiness read-only and each retry explicitly selected. Existing
   admission, provider limits, locking, transaction timeouts and retry
   budgets continue to apply. Contention, changed evidence or cancellation
   uses the current failure path. A lost response calls for the saved
   receipt check, and completed retries replay the saved result.
4. Verify adjacent large tasks and the BIGINT maximum against isolated
   PostgreSQL through the existing HTTP routes. Check cross-task refusal,
   continuation at a large cursor, mixed-invalid batch atomicity and
   compatibility with the existing administrator, rollback and replay tests.

The existing schema, queue worker and repair limits serve the widened
selectors. Further UUIDv7 work depends on a separate identity decision.
