# Policy Native Readiness Summary Contract

## Decision

Persisted native policies use a dedicated read-only readiness contract rather
than the library-first setup workflow. The contract evaluates three stored
facts on the server:

1. The one authoritative active native intent and its validation state.
2. Cached library-profile freshness. Profile distributions remain supporting
   evidence and never establish destination identity.
3. Stored library-to-Arr routing configuration.

The result contains one bounded readiness state and one next action. It is an
advisory display projection. It cannot authorize automation, persist a policy,
refresh a profile, invoke a provider, consume quota, classify media, or route
media.

## Official Guidance Reviewed

Research was reviewed in July 2026 against official guidance current through
June 2026:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  requires authorization decisions to remain server-side. The browser validates
  that the response is display-only and treats any write or execution claim as
  invalid.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends allowlist and semantic validation at the server boundary. The
  route accepts only a positive policy identifier, and the contract exposes
  fixed state/action identifiers plus bounded text.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  advises validating workflow state on the server instead of trusting client
  sequencing. Current policy state is recomputed from stored native intent,
  profile freshness, and routing on every read.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side recomputation of security-relevant values. The client
  receives no raw rules, provider data, database errors, quota information, or
  caller-supplied readiness booleans.
- [WAI-ARIA `status` role](https://www.w3.org/TR/wai-aria-1.3/)
  defines a polite advisory live region that must not move focus. The summary
  announces the single readiness state without opening setup controls or
  changing focus.

## Options Considered

### Reuse The Library Workflow For Persisted Native Policies

Pros: no server endpoint or additional read model.

Cons: evaluates a draft derived from library evidence instead of the active
native intent, reopens creation questions, and can make a library-only status
look like a policy decision. Rejected.

### Calculate Native Readiness In The Browser

Pros: avoids another API call.

Cons: duplicates server policy semantics, risks stale or tampered decisions,
and could drift from the runtime authority. Rejected.

### Dedicated Server Read Contract

Pros: removes setup noise, evaluates persisted native authority rather than a
creation draft, retains one server-provided next action, and adds no mutation
path. Selected.

Cons: adds a narrow endpoint and client composable; a returned next action is
still advisory until its own server-owned command path is implemented.

## Contract Design

`GET /api/policies/:id/native-intent/readiness-summary` returns
`policy.native_readiness_summary.v1`.

The available result includes only:

- `policyId`.
- Native authority state, intent version, declared-purpose rule count, and
  validation state.
- A readiness `stateId`, label, boolean, reason codes, and exactly one next
  action.
- Fixed display-only authority flags.
- A side-effect declaration proving the read used stored policy/native-intent,
  cached-profile, and routing-configuration data only.

The endpoint returns explicit bounded outcomes for policy-not-found,
non-authoritative native intent, and temporary read failure. It never falls
back to a compatibility draft or library-first workflow after native authority
is unavailable.

## Implementation Outcome

- `policyNativeReadinessSummaryService.mjs` orchestrates the stored policy,
  active native intent, cached profile, and routing reads.
- `policyNativeReadinessIntent.mjs` adapts stored native intent only for the
  existing readiness engine. Stored purpose remains identity; profile evidence
  can affect freshness but cannot manufacture identity.
- `policyNativeReadinessSummaryContract.mjs` bounds the public result, strips
  engine inputs/issues, and audits authority, raw-payload, and side-effect
  invariants.
- `policiesRouteNativeIntentReadinessSummary.mjs` validates the policy ID and
  maps unavailable storage to a retry-safe `503` without exposing internals.
- `usePolicyNativeReadinessSummary.js` rejects a response that does not match
  the expected policy, version, read-only authority, or side-effect contract.
- `PolicyBuilderModal.vue` loads this contract only for persisted native
  policies. Native views no longer request the generic operator-workflow
  endpoint.
- `PolicyNativePolicySummary.vue` now calls the status **Current policy
  readiness** to accurately describe the server inputs.

## Security And Operational Boundaries

- The endpoint has no live media-server, provider, TMDB, AI, or quota lookup.
- It does not create a profile refresh, perform an Arr write, classify media,
  modify policy storage, or run a routing operation.
- A missing or invalid cached profile becomes `stale_profile` with the existing
  bounded `refresh_profile` next action, rather than an automation-ready
  result.
- A policy-level read has no media item, so it does not infer a hard-limit
  conflict. Item-level constraint evaluation remains runtime work.
- Raw database/provider/engine error details never enter the response or UI.

## Verification

- Server service tests cover ready, stale-profile, non-authoritative-native,
  not-found, and unavailable-read outcomes.
- Route tests cover valid, invalid-ID, not-found, and retry-safe responses.
- Client composable tests reject mismatched IDs and accidental execution/write
  authority.
- Modal coverage proves persisted native policies display the compact summary
  and do not request the generic operator workflow.

## Final Recommendation Stack

1. Treat active native intent as the only identity authority for a persisted
   native policy.
2. Use the cached library profile only for freshness and supporting context.
3. Keep routing configuration as a readiness input, never a browser action.
4. Return one server-owned readiness state and one advisory next action.
5. Fail closed to an unavailable state; never substitute a legacy or draft
   workflow.

## Next Item

Implement the server-owned automatic profile-refresh response for a
`refresh_profile` readiness state. It should be scheduler/outbox driven,
deduplicated per library, lease-protected, bounded by retry policy, and remain
independent of browser interaction or policy writes.
