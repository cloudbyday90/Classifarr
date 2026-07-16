# Native Intent Manual Apply Retirement

## Status

Implemented on 2026-07-16 as Task 8R.3.2.6.4 of the policy-builder intent
model roadmap.

## Decision

Native intent conversion is a scheduler-owned reconciliation responsibility,
not a normal administrator workflow. The former client preview, policy
selection, exact-phrase confirmation dialog, and manual apply API are removed.

The replacement administrator surface is
`/policies/native-intent-reconciliation`. It reads the bounded status contract
from `GET /api/policies/native-intent-reconciliation/status` and exposes no
conversion mutation controls. Protected server recovery controls, rollback, and
per-policy re-entry remain lifecycle exceptions; they do not restore manual
batch conversion.

## Official-Source Research

- [Express routing](https://expressjs.com/en/guide/routing.html) specifies that
  route handlers run only when both the registered method and path match. The
  old preview and apply routes are therefore removed from registration instead
  of retained as a deprecated response shim.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends enforcing authorization at every endpoint. Removing a privileged
  mutation endpoint reduces the authorization surface that must be maintained.
- [OWASP API9:2023 Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  identifies outdated or unmanaged API exposure as a security risk. Removing
  the obsolete endpoint, client API, and route together keeps the exposed API
  inventory coherent.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends reducing risk through secure design and maintaining traceable
  implementation evidence. The retirement is covered by focused route,
  workflow-authority, API, composable, and view tests.

## Recommendations

1. **Remove the obsolete mutation surface instead of deprecating it.**
   Delete the registered preview/apply routes, client API methods, confirmation
   dialog, candidate-selection composable, mutation limiter, operator action
   service, and its now-unreachable runtime observation helper.
2. **Keep observability, not manual conversion.**
   Provide a read-only administrator status view containing scheduler health,
   last-run outcome, unresolved counts, next scheduled attempt, and bounded
   blocker groups.
3. **Defend conversion authority in the service layer.**
   Reject `manual_operator` from the conversion workflow and apply-gate audit
   context. Retain only reconciliation, post-upgrade, test-fixture, and
   maintainer migration sources for conversion.
4. **Preserve separately protected recovery actions.**
   Emergency stop, circuit reset, rollback, and reconciliation re-entry remain
   attributable administrator actions because they recover lifecycle state;
   they do not choose normal conversion batches.

## Pros And Cons

### Pros

- Removes a privileged write endpoint and confirmation workflow that conflicted
  with automatic reconciliation.
- Prevents stale client-side candidate selection from becoming a competing
  conversion path.
- Gives operators one clear status location without asking them to operate a
  normal batch process.
- Preserves rollback, re-entry, and circuit-recovery safeguards.

### Cons

- Existing direct callers of the old preview or apply URLs receive `404` and
  must use the reconciliation status route instead.
- Conversion cannot be forced from the browser. Exceptional state must follow
  protected recovery or maintainer processes.

## Final Recommendation Stack

1. Scheduler execution: `nativeIntentReconciliationService.mjs`.
2. Read-only contract and route:
   `nativeIntentReconciliationStatusService.mjs` and
   `policiesRouteNativeIntentReconciliation.mjs`.
3. Client status surface:
   `PolicyNativeIntentReconciliation.vue` and
   `usePolicyNativeIntentReconciliationStatus.js`.
4. Conversion authority guard:
   `policyIntentConversionWorkflow.mjs` and
   `policyPostUpgradeApplyGate.mjs`.
5. Retirement test:
   `policies-native-intent-conversion-retirement.test.mjs`.

## Implementation Outcome

- Removed the old `/policies/native-intent-migration` client route and the
  `GET /api/policies/native-intent-conversions/preview` and
  `POST /api/policies/native-intent-conversions/apply` server endpoints.
- Deleted the manual conversion service, dialog, client composable, client API
  calls, mutation limiter, and isolated post-conversion observation code.
- Added `/policies/native-intent-reconciliation`, a read-only administrator
  status view with safe scheduler, control, inventory, latest-run, and grouped
  blocker evidence.
- Preserved the scheduler, reconciliation status API, circuit controls,
  rollback, and administrator-approved re-entry paths.
- Added tests proving legacy mutation routes are unregistered, manual actor
  source is blocked for conversion, and the client view has no selection,
  confirmation, or apply controls.

## Security Outcome

- No raw policy, legacy JSON, credentials, or stack traces are exposed by the
  replacement status view.
- The legacy mutation path is absent rather than hidden behind a deprecated
  endpoint or client feature flag.
- Normal conversion authority is server-owned and independently validated.
