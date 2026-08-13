# Historic Route-Safety Refresh Recent Receipt Resume

Status: implemented. This document records the actor-bound discovery and resume
path for the administrator historic route-safety refresh receipt.

## Problem

The controlled retry command returns a receipt reference, and the maintenance
view intentionally keeps that reference only in memory. A reload therefore
used to lose the reference even while selected work was still running. The
existing direct receipt endpoint also required an administrator role but did
not apply the receipt's persisted creator relationship to its lookup.

The recovery path must make a reload useful without retaining the receipt in
browser storage, listing administrative history, or treating an opaque UUID as
authorization to read another administrator's remediation work.

## Research And Recommendations

OWASP recommends least privilege, deny-by-default behavior, authorization on
every request, and relationship-based object authorization rather than relying
on an unguessable identifier. OWASP API1 identifies object-level authorization
as a specific API concern. MDN documents that `sessionStorage` is scoped to a
browser tab; it does not replace a server authorization decision or safely
recover work in another authenticated session.

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [MDN: sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)

Options considered:

1. Retain the receipt UUID in `sessionStorage`.
   - Pros: minimal server work and fast same-tab recovery.
   - Cons: duplicates a `no-store` operational projection in the browser, does
     not recover a new authenticated session, and cannot enforce ownership.
     Rejected.
2. Add an administrator-wide receipt-history endpoint.
   - Pros: supports broad operational review.
   - Cons: expands the administrative data surface, makes retention and
     pagination a product concern, and does not satisfy object-level least
     privilege. Rejected.
3. Discover one server-selected recent receipt for the authenticated creator,
   then use the existing receipt reader with the same actor binding.
   - Pros: restores the intended retry lifecycle, keeps browser state
     ephemeral, bounds the lookup, and prevents a UUID from granting access.
     Selected.

## Final Recommendation Stack

1. Every controlled retry derives `user:<authenticated-user-id>` on the
   server. A missing or malformed identity fails closed; there is no shared
   `admin` fallback receipt owner.
2. `GET /api/classification/pending/route-safety-refresh/receipts/recent`
   requires an authenticated administrator and discovers at most one receipt
   created by that actor during the fixed 60-minute server window. It accepts
   no cursor, window, actor, or receipt input from the caller.
3. Discovery returns only `mode`, a contract version, and either `null` or the
   single `retryReceipt` UUID. It returns no receipt items, actor value,
   timestamps, selected-record count, task state, metadata, policy, provider,
   route, or learning data.
4. The existing direct receipt endpoint filters by both receipt UUID and the
   same server-derived actor ID. A missing receipt and another actor's receipt
   both return the existing generic 404 response, preventing object existence
   disclosure.
5. Both reads run in repeatable-read, read-only transactions and set
   `Cache-Control: no-store`. The actor-and-created-time index supports the
   bounded discovery lookup without scanning retained receipt items.
6. On maintenance-view entry, the client asks only for the server-selected
   recent reference. When present, it immediately uses the existing protected
   reconciliation read and visible-tab-only polling. Discovery cannot overwrite
   an explicit retry started while the discovery request is in flight.

## Implemented Outcome

`policyRuntimeHistoricRouteSafetyRefreshActorIdentity.mjs` owns canonical actor
reference validation. `classificationRouteHistoricRouteSafetyRefreshActor.mjs`
enforces that an administrator role also has a stable authenticated identity.
`policyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService.mjs`
owns the narrow read model; the receipt repository owns its indexed query.

The maintenance composable does not use local or session storage. It resumes
only the latest receipt returned for the current actor, then delegates status
reading and polling to the existing receipt contract. Clearing the receipt view
remains an in-memory display action; a page reload can rediscover a qualifying
server-owned receipt.

Receipts created before this actor-bound contract, or outside the fixed window,
are intentionally not discoverable. Their UUID is not a bypass: direct reads
also require the matching actor relationship.

## Verification

Focused service, route, repository, integration, client API, composable, and
view tests cover canonical actor derivation, rejected invalid identity,
administrator-only discovery, no-store responses, one-row/windowed lookup,
generic foreign-receipt 404 behavior, safe response projection, reload resume,
and discovery-versus-explicit-retry race handling.
