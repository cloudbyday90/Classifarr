# Historic Route-Safety Refresh Maintenance Surface

Status: implemented. This document records the administrator-facing UI for the
existing controlled historic route-safety refresh and its receipt-bound status
read.

## Problem

The server already provides three bounded contracts: a read-only inventory, an
explicit retry command, and a protected receipt reconciliation read. Calling
them through an HTTP client was possible, but there was no product surface that
preserved the intended operator sequence: inspect, choose, acknowledge, run,
then observe the current runtime outcome.

The maintenance UI must not turn the inventory into an automatic retry, cache a
receipt that the server marks `no-store`, reveal raw classification history, or
continue polling after the worker-owned portion of a receipt is settled.

## Research And Recommendations

The WAI-ARIA `status` role is a polite live region intended for advisory
updates and should not move focus when it changes. Critical failure conditions
remain alerts. The Page Visibility API is explicitly intended to avoid polling
when a page is hidden. OWASP API3 and API5 reinforce that the browser must not
expand the server's allow-listed response or be treated as the authorization
boundary for an administrative command.

- [MDN: ARIA status role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role)
- [W3C WAI-ARIA alert pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/examples/alert/)
- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [OWASP API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
- [OWASP API5:2023 Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)

Options considered:

1. Add a button to the normal Command Center that retries every inventory item.
   - Pros: one visible place for operations.
   - Cons: weakens the separate administrator-maintenance boundary and risks
     making a historic recovery action appear routine. Rejected.
2. Use the generic SWR composable to poll and persist receipt data in browser
   storage.
   - Pros: less UI code and shared polling behavior.
   - Cons: conflicts with the server's `Cache-Control: no-store` receipt
   contract and retains an administrative operational projection locally.
   Rejected.
3. Add a focused hidden administrator-maintenance route with in-memory state,
   explicit selection and acknowledgment, and visible-tab-only receipt polling.
   - Pros: preserves the server's bounded lifecycle, avoids local persistence,
   makes the operator action unmistakable, and stops polling at stable runtime
   states. Selected.

## Final Recommendation Stack

1. `PolicyHistoricRouteSafetyRefresh.vue` is an `admin-maintenance` route under
   Policies. It is not added to normal navigation; the server remains the
   authorization authority for every read and mutation.
2. The view loads only the existing read-only, keyset-paginated inventory.
   Checkboxes start clear, selection stays in memory, and one execution is
   capped by the server-advertised maximum of 50 records.
3. A separate operator acknowledgment is required before the existing retry
   command can run. The UI sends only selected classification IDs and never
   synthesizes route, policy, provider, or task input.
4. The command response supplies a receipt ID that the client immediately uses
   for the existing read-only reconciliation endpoint. The client uses neither
   local storage nor the generic SWR cache for this `no-store` response.
5. The receipt view exposes only the existing safe classification ID, command
   outcome, current runtime outcome, timestamps, and aggregate counts. It does
   not display reason payloads, queue IDs, replacement IDs, history metadata,
   provider content, or policy content.
6. A five-second `setTimeout` loop runs only while receipt states are genuinely
   worker-in-flight, skips network reads when the tab is hidden, refreshes when
   it becomes visible, and stops after a stable observed outcome or any read
   failure. A manual refresh remains available.
7. Advisory refresh text uses `role="status"`; authorization or read failures
   use `role="alert"`. The view does not move focus when lifecycle data changes.

## Implemented Outcome

`useHistoricRouteSafetyRefreshMaintenance.js` owns inventory paging, in-memory
selection, controlled execution, receipt reads, and timer cleanup.
`historicRouteSafetyRefreshPresentation.js` owns fixed status labels, tones,
and the worker-in-flight decision. The view contains only rendering and the
explicit acknowledgement control.

The route is `/policies/historic-route-safety-refresh`, parallel to the
existing native-intent reconciliation administrator route. The route does not
create a new backend endpoint or database migration; it consumes the bounded
contracts implemented by 10R.3.4 through 10R.3.6.

## Verification

Focused client tests cover the safe status presentation, selection cap,
acknowledgment requirement, narrow API calls, receipt rendering, polling stop
conditions, manual refresh, safe error text, and the administrator-maintenance
route. Existing server authorization and response-redaction tests continue to
cover the underlying endpoints.
