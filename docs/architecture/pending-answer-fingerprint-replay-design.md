# Exact pending-answer fingerprints and receipt replay

November 22, 2026 Eastern. Follow-up to the
[manual exact-item memory repair](manual-exact-item-memory-id-outcome.md).

## Contract

The answer builder previously converted History IDs to JavaScript numbers
before hashing. Adjacent BIGINT rows could produce the same fingerprint when
their remaining contract fields matched. The cleanup apply service also
converted submitted IDs before its first row lock.

Validate History IDs with the shared positive BIGINT helper before building
the answer contract. Keep the existing v1 serialization, digest and numeric
safe IDs. Use exact decimal strings above the safe range. Web, bulk and
Discord answer admission keeps the existing safe-integer limit.

New pending-answer receipts carry the History ID of the locked row. Completed
replay still compares version, fingerprint, action and destination and also
checks the saved ID when present. Legacy receipts without the field remain
eligible only for safe IDs under the original replay checks. A malformed or
mismatched saved ID fails closed. Cleanup uses the same receipt binding and
revalidates the fingerprint against the current locked question before any
resolution write. The cleanup apply service checks the whole batch against
the existing safe-ID parser before taking any locks. Invalid stored answers
keep cleanup's existing fresh-evaluation outcome.

## Official guidance and tradeoffs

RFC 8785 recommends JSON strings for integers outside binary64's exact range.
Use that representation for the History field while preserving existing
safe-ID bytes. W3C Web Architecture calls for distinct identifiers for
distinct resources. Here each History row contributes its exact identity to
the fingerprint and the receipt.
[RFC 8785, section 3.1](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.1),
[W3C Web Architecture, Identification](https://www.w3.org/TR/webarch/#identification)

PostgreSQL retains row locks through transaction completion. RFC 9110 advises
against automatically retrying a non-idempotent request without proof of its
semantics or outcome. Retain the existing transaction and completed-replay
criteria, with the row identity checked as part of the saved receipt.
[PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html),
[RFC 9110, section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)

The recommended stack is shared exact ID validation, compatible v1 hashing,
and an explicit row ID on new receipts. It avoids migration and digest churn
for existing clients. Consumers handle numbers and decimal strings, and old
receipts continue to rely on the row lookup and original checks inside the
safe range. An unconditional version bump would invalidate safe pending
answers, while accepting an alternate rounded digest would retain ambiguity.

## Verification

Pin a fingerprint captured before the change and compare safe numeric and
canonical string inputs. Test adjacent large IDs, the BIGINT maximum, and
refusal of invalid IDs. With isolated PostgreSQL, prove exact completed
replay, cross-row receipt rejection, legacy safe replay, and refusal of mixed
cleanup selections before any row changes. Exercise the existing answer caps
and the guarded cleanup write path. Run fresh coverage and quality gates.

The shared exact-item learning execution state still evaluates the stored
answer without the new History field. The next batch should verify the field
in that state and trace remaining request and response boundaries before
enabling large pending answers on web, bulk or Discord.
