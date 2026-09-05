# Media identity receipt recovery design

## Problem

An ID confirmation can commit while its HTTP response is lost. The existing
client then discards the preview and cannot distinguish a completed transaction
from a failed request. The next action must recover evidence of the earlier
confirmation without repeating the write.

## Recommendation stack and alternatives

| Option | Benefits | Costs | Recommendation |
| --- | --- | --- | --- |
| Authenticated GET of the existing audit receipt | Read-only, repeatable, retains the original actor and source provenance | Missing evidence cannot prove a failed write | Implement |
| Automatically resend confirmation POST | Simple client retry | Confuses transport failure with transaction failure | Reject |
| Infer completion from the current inventory ID | Easy lookup | Another actor or later source update may have supplied that ID | Reject |
| Minimal reference in tab session storage | Supports reload and navigation without storing media content or credentials | Storage can be unavailable; closing the tab can lose the reference | Implement with an in-memory fallback |
| Separate receipt table or duplicate audit payload | Independent retention policy | Another persistence contract and migration of existing receipts | Defer |

Use the existing session guards, a small ESM receipt service, a single PostgreSQL
snapshot for authorization and receipt lookup, the named client API layer, and a
separate recovery composable/notice. Add a partial expression index to the audit
log for the actor and preview reference. No new dependency or release is needed.

## Read contract

`GET /api/media-identity-review/:itemId/receipts/:previewId` accepts a positive
database integer and a canonicalizable UUID v4. Existing ordinary administrator
session restrictions exclude API keys, refresh tokens, and scoped automation.

A single SELECT joins the current active administrator to at most two matching
`media_identity_confirmed` audit entries. It binds the actor and preview reference
using query parameters. Duplicate or malformed receipts fail closed. The source
item ID must match the receipt. Only the original actor can recover that receipt.
Unauthorized actors receive 403; absent and other-actor receipts produce the
same `not_observed` outcome. Responses have `Cache-Control: no-store`.

A confirmed result projects only the receipt ID, preview ID, item ID, typed TMDb
ID, original source version, and confirmation time. It describes a historical
confirmation, including when the inventory item has since changed or been deleted.
It does not assert the current inventory state. Source titles, provider payloads,
request headers, and unrelated audit metadata are excluded.

`not_observed` means no matching committed receipt was visible to this read. The
write may still be in flight, have rolled back, or the evidence may be unavailable.
Repeated GETs may subsequently observe a commit. Reads never consume previews,
change IDs, create audit entries, call providers, or schedule classification.

## Browser behavior

Before sending the explicit confirmation, retain one versioned item/preview
reference in session storage. Store no media title, candidate, or access token.
The reference grants no authority; the server always checks the current actor.
If persistence is blocked, retain the reference in memory and explain that reload
recovery is unavailable. Do not silently treat browser storage as reliable.

After an uncertain POST outcome, perform one receipt GET. Restore and check a
pending reference on page reload. A successful normal confirmation clears the
reference. A recovered receipt remains visible with its historical identity and
audit ID. Unknown outcomes offer an explicit read-again action and an explicit
return to the queue without confirming the outcome. No automatic POST retry or
background polling is introduced. Stale async responses cannot overwrite a new
review, clear a newer reference, or change a disposed view.

The shared HTTP transport currently retries network errors and selected HTTP
errors for all methods. An explicit, typed `skipAutomaticRetry` option disables
both transport retries and authentication replay for this confirmation POST and
its receipt GET. The recovery composable owns the single initial read and any
operator-requested subsequent read. A receipt access failure stays visible in the
workflow instead of silently replaying or redirecting it. Other API callers retain
their existing behavior pending a separate retry-contract audit.

Native buttons, descriptive text, status messages, and logical focus support
keyboard and assistive-technology use. An unknown result must not announce that
the identity was saved or that the write failed.

## Official research

Sources were discovered through web tools and checked on 2026-09-05 for the
requested August 2026 baseline. Living pages are not archived August snapshots.

- Safe GETs and caution around automatic non-idempotent retries:
  [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html).
- Check every request and bind permissions to the actual resource:
  [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- Preserve the server-held transaction details and confirmation sequence:
  [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html).
- Read committed statements see a snapshot of committed data:
  [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).
  An expression index supports the JSON reference lookup:
  [PostgreSQL 18 expression indexes](https://www.postgresql.org/docs/18/indexes-expressional.html).
- Session storage is scoped to a browsing session and access can throw:
  [WHATWG Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html).
- Announce outcome changes and describe errors in text:
  [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  and [error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification).

## Validation and next item

Test existing and malformed receipts, duplicates, actor isolation/revocation,
source deletion, read-only transactions, an uncommitted write becoming visible,
network loss, reload, unavailable storage, cancellation, and late responses.
Measure the index plan against a representative audit-log fixture. Keep the
original ID/audit atomicity tests. Use local Docker and keyboard browser checks.

The user's clarification prioritizes automatic library understanding over more
manual setup. Next, unify observed-library prevalence and metadata coverage in
the existing profile pipeline; see the [assessment and direction](library-observation-automation-direction.md).
Keep the shared mutation-retry contract as a separate correctness follow-up.
Independently labelled cohort readiness still precedes review-only semantic
counter-evidence; automatic routing is out of scope for this patch.
