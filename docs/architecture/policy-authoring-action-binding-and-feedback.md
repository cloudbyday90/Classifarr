# Policy Authoring Action Binding And Feedback

Date: 2026-08-03

## Outcome

Phase 4R.3 is complete at the client/server-contract and component-test
boundary. Native policy creation now uses the named `createPolicy` API leaf
through `usePolicyNativeCreateAction`; it no longer depends on a parent save
callback to make the primary action functional. The action retains one
idempotency key per unchanged native request and presents success only after
the server returns a valid initial-intent establishment receipt.

`PolicyBuilderModal` emits the bounded `native-policy-created` event only after
that confirmation. `PolicyList` responds by refreshing its server projection;
it does not own native creation or infer that creation succeeded.

The shared `policyAuthoringActionFeedback` utility maps status and bounded
outcome codes to safe operator messages. It deliberately does not render
server-provided `error`, `message`, stack, transport, or provider text. Native
create, compatibility save, custom-value validation, and library-mapping
navigation now report one of pending, succeeded, rejected, stale,
retryable-error, or unavailable. A server establishment receipt remains the
only success authority for native create.

Unsupported empty-state actions no longer render a button. The only retained
routing exception is the typed `map_routing_destination` navigation action;
navigation failure remains in place and receives one retryable result message.

This does not claim the normal browser entry path is complete. The 4R.1
representative browser verification remains pending. Before 4R.4 can replace
manual observed-value reselection, the completed 5R.2a server contract supplies
a server-derived destination proposal and library lifecycle state to the
native-create admission command.

## Guidance Reviewed

- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  supports programmatically determinable success, waiting, and failure updates
  without moving focus when the page context has not changed. The action state
  is scoped to the action, uses one status surface, and moves focus only to the
  confirmed policy-created handoff.
- [Vue Event Handling](https://vuejs.org/guide/essentials/event-handling.html)
  supports explicit event boundaries. The modal now emits a narrow confirmed
  policy identifier for list refresh instead of exposing an implicit create
  callback as native-write authority.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends server-enforced authorization, validation, safe error handling,
  and protection against unsafe operation ordering. The browser preserves the
  server idempotency key and treats server outcomes as authoritative; it does
  not authorize native creation or display internal error detail.

## Options

### Keep Native Create Behind The Parent Save Callback

Pros: fewer component changes and list refresh remains adjacent to the write.

Cons: a missing callback becomes a silent no-op, native creation has no
independent API contract, and confirmation depends on caller behavior.

Decision: rejected.

### Call HTTP Directly From The Modal

Pros: the button has a direct mutation path.

Cons: mixes transport with modal rendering, makes injection and retry behavior
harder to test, and breaks the named API leaf convention.

Decision: rejected.

### Named API Leaf Through A Native-Create Action Composable

Pros: one action-local pending state, stable retry identity, confirmed success
receipt, safe error classification, direct focused tests, and a bounded parent
refresh event.

Cons: introduces a focused composable and a small action-feedback vocabulary.

Decision: selected.

### Render Server Error Text In Action Alerts

Pros: can expose more detail during development.

Cons: leaks implementation details, produces unstable user copy, and can
contradict the authoritative projection after a rejected request.

Decision: rejected.

## Final Recommendation Stack

1. Keep native policy creation in `usePolicyNativeCreateAction` and use only
   the named `createPolicy` API leaf for its transport.
2. Retain an idempotency key only for the unchanged native request. On
   retryable or unconfirmed outcomes, repeat the same request identity so the
   server can safely replay or reject it.
3. Treat a valid `native_intent_establishment` receipt as the sole create
   success signal. A 2xx-shaped response without that receipt is unconfirmed,
   never a successful handoff.
4. Map status classes and explicit safe outcome codes to static operator copy;
   never render raw response errors.
5. Render only allow-listed local navigation actions. Keep unsupported actions
   non-interactive until a dedicated server or local typed contract exists.
6. Keep the completed 5R.2a proposal contract as the only source of default
   destination meaning, then let 4R.4 use that proposal rather than requiring
   reselection of observed values.

## Security And Verification

- The server remains the authority for authentication, authorization,
  validation, transactionality, idempotency replay, and conflict handling.
- The client holds the idempotency key only in component memory and never
  derives policy meaning or authorization from it.
- `usePolicyNativeCreateAction` blocks requests when secure idempotency-key
  generation is unavailable or produces no usable key, and prevents a second
  local submit while pending.
- The modal requires a confirmed establishment receipt before rendering the
  success handoff or emitting a created-policy event.
- Focused verification covers successful confirmation, duplicate-submit
  suppression, admitted rejection, stale conflict, retryable and unconfirmed
  result, unavailable secure capability, safe custom-validation failure, safe
  mapping-navigation failure, and unsupported action removal.

## Next Task

**4R.4a Library Lifecycle Entry**. Render the completed server-owned lifecycle
and use its prepare/admit commands as the one normal authoring entry, without
recreating readiness or intent decisions in the browser.
