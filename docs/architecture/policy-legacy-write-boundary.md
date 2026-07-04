# Policy Legacy Write Boundary

Status: implemented as the durable policy legacy write-boundary contract.

## Problem

Once a policy has active native intent, legacy preset/custom-signal writes must
stop being a behavior authority. Otherwise a converted policy can silently drift
back into the compatibility model through ordinary policy edits, preset attach
routes, preset delete routes, auto-learning writers, or reset flows.

## Official Guidance Reviewed

- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for testing application security controls and secure
  development requirements. This boundary applies that guidance by making write
  authority a server-side decision rather than relying on client UI state.
- [OWASP API Security API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  warns that APIs are vulnerable when clients can change object properties they
  should not be allowed to manipulate. This boundary treats legacy behavior
  fields on converted policies as blocked object properties.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends risk-based secure development, tracking security requirements and
  design decisions, and integrating security practices into the SDLC. This
  boundary records the shutdown contract and keeps a deletion checklist before
  route mutation is introduced.
- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)
  recommends high-impact action previews, audit trails, exact-action approval,
  expiry, replay protection, and fail-closed execution. This boundary separates
  the write-boundary decision from execution and fails closed when converted
  policies receive legacy behavior writes.

## Recommendations

1. **Block converted legacy behavior writes.**
   Converted policies must reject writes that mutate preset attachments,
   preset-level `customSignals`, legacy scoring weights, legacy trust flags,
   decision thresholds, or legacy combination mode.

2. **Allow converted metadata-only edits.**
   Operators still need to update names, descriptions, enabled state, priority,
   and sort order without touching behavior storage.

3. **Keep unconverted compatibility writes explicit and time-bounded.**
   Unconverted policies can keep using existing preset/custom-signal writes
   during migration, but responses should carry warnings and deletion checklist
   context so compatibility does not expand.

4. **Require native write readiness for native intent payloads.**
   A converted policy receiving a native intent payload should route to native
   storage only after native write persistence is marked ready.

5. **Delay native defaults until gates pass.**
   New policy creation can keep compatibility defaults until conversion,
   rollback, and native write gates are ready. Once ready, legacy new-policy
   defaults should be blocked.

## Pros And Cons

Pros:

- Converted policies cannot drift back into legacy behavior by ordinary saves.
- Metadata-only maintenance remains possible for converted policies.
- The contract names the exact route and writer guards needed before live route
  integration.
- Native default behavior is gated instead of switched prematurely.
- The service is deterministic and side-effect-free, so it can be tested before
  SQL migration and route mutation.

Cons:

- This slice does not yet wire the guard into live routes because native intent
  write persistence is not present in the current database schema.
- Auto-learning writers still need later integration to call this boundary for
  converted policies.
- Native create/update payload execution remains a later native storage task.

## Final Recommendation Stack

- Server write-boundary service:
  `server/src/services/policyLegacyWriteBoundary.mjs`
- Test coverage:
  `server/src/__tests__/services/policyLegacyWriteBoundary.test.mjs`
- Existing route surfaces to guard later:
  `server/src/routes/policiesRoutePolicyWrite.mjs`
  and `server/src/routes/policiesRoutePolicyPresets.mjs`
- Existing legacy writers to guard later:
  `server/src/services/autoLearningPreferenceWriters.mjs`
  and `server/src/services/autoLearningQueries.mjs`

## Implemented Contract

The write-boundary service exports:

- write operation IDs,
- shutdown status IDs,
- reason IDs,
- risk IDs,
- field group IDs,
- a write-boundary builder,
- a validator,
- an audit helper.

Write-boundary output includes:

```text
version
operationId
statusId
allowed
convertedPolicy
nativeWriteReady
nativeDefaultReady
detectedFields
warnings
migrationBlockers
removalChecklist
sideEffects
reasons
validation
nextStep
```

Converted policies block legacy behavior writes for:

- `presets`
- `preset_id`
- `customSignals`
- `custom_signals`
- `legacyCustomSignals`
- legacy scoring weights
- legacy trust flags
- legacy decision thresholds
- `combination_mode`
- preset attach/delete/replace operations
- preset custom-signal update operations
- reset flows that recreate legacy policy behavior

Converted policies allow metadata-only edits for:

- `name`
- `description`
- `enabled`
- `priority`
- `sort_order`

## Security Outcome

- Legacy behavior fields are treated as blocked properties once native intent is
  active.
- Native intent payloads cannot be marked allowed until native write persistence
  is explicitly ready.
- Unconverted compatibility writes remain allowed only with time-bounded
  warnings.
- New policy legacy defaults are blocked once native default gates are ready.
- The contract performs no route writes, native inserts, legacy writes, legacy
  deletes, or draft-sidecar persistence.

## Next Step

Proceed to **Legacy Code Deletion Gates**. With converted-policy legacy write
shutdown defined, the remaining compatibility code can be assigned deletion
gates instead of being preserved as a parallel policy model.
