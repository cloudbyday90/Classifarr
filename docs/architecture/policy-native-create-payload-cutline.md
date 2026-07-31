# Policy Native Create Payload Cutline

Status: implemented

## Outcome

Native policy creation has a dedicated request boundary. The browser now sends
only:

```text
library_id
name
native_intent_establishment
```

The server rejects any other field before legacy preflight, compatibility
validation, transaction start, or persistence. Thresholds, scoring weights,
trust flags, preset attachments, descriptions, and compatibility drafts are
not accepted as native-create input. The server applies its owned legacy-column
defaults internally while the atomic native establishment creates the durable
native authority.

This removes the previous mismatch where the native-first UI hid compatibility
controls but the shared form serializer still transmitted their values.

## Research And Recommendation

The review used current official guidance relevant to June 2026:

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side syntactic and semantic validation, with fixed option
  sets validated by allowlists rather than client-side assumptions.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  calls for validation of workflow state transitions and input combinations,
  not only field shape.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  treats request input as untrusted and recommends validating type, range, and
  expected values at the endpoint boundary.

| Option | Advantages | Costs |
| --- | --- | --- |
| Keep one generic create serializer | Lowest short-term code change | Native creation silently retains obsolete compatibility controls and accepts altered hidden values. |
| Filter only in the browser | Simplifies the normal UI payload | A stale client or direct request can still send legacy fields. |
| Selected: exact client and server allowlists | Aligns visible controls, request contract, and persistence; rejects stale or forged fields before writes | Adding an intentional native-create field requires an explicit contract update and tests. |

Final recommendation stack:

1. Use a dedicated client builder for native creation, separate from the
   compatibility-edit serializer.
2. Enforce the same exact field allowlist in the server native-create contract.
3. Reject, rather than silently ignore, unexpected fields so stale clients and
   integration mistakes are visible.
4. Keep native creation administrator-authorized and validate declared intent
   before its single establishment transaction.
5. Keep legacy serializers and controls bounded to persisted compatibility
   policies until their separately gated removal path is complete.

## Design

`client/src/utils/policyNativeCreatePayload.js` is a pure ES module that builds
the native request from the selected library, a generated or explicit policy
name, and the typed native-intent draft. It intentionally does not receive the
legacy save payload, selected presets, advanced settings, or compatibility
draft.

`server/src/services/policyNativeIntentCreateContract.mjs` owns the matching
allowlist. When `native_intent_establishment` is present, the policy write route
runs this contract before generic legacy preflight and validation. A rejected
request starts no database transaction. An accepted request uses the server's
existing default values only because the legacy policy row remains a temporary
storage compatibility requirement, not an operator-controlled native setting.

Existing compatibility-policy edits still use the generic serializer and
legacy validation branch. This change does not broaden compatibility behavior
or add a second authoring route.

## Security Outcome

- A manipulated browser request cannot set hidden thresholds, scoring weights,
  trust flags, presets, or compatibility drafts while creating native intent.
- Unknown native-create fields fail before a transaction begins; they are not
  silently persisted or normalized.
- The established declared intent remains server-validated, administrator-only,
  and transactionally coupled to the policy row and its authority records.
- No provider call, profile refresh, routing execution, quota consumption, or
  learning action is introduced by this request boundary.

## Verification

- `client/src/__tests__/utils/policyNativeCreatePayload.test.js`
- `client/src/__tests__/PolicyBuilderModal.test.js`
- `server/src/__tests__/services/policyNativeIntentCreateContract.test.mjs`
- `server/src/__tests__/policies-routes.coverage.test.mjs`

Focused client and server tests verify that native create emits exactly the
three approved fields, uses server-owned defaults, and rejects an injected
legacy threshold before transaction start.

## Follow-Up

Proceed with Phase 6R.5 compatibility-editor isolation: retained legacy edit
controls must become a clearly bounded maintenance path rather than continuing
to share the normal destination-first workflow presentation.
