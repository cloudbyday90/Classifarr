# Policy Starter Template Intent Boundary

Status: implemented.

## Goal

Make optional starter-template knowledge useful without giving it policy
authority. The connected media-server library remains the source of observed
application; declared intent remains the only operator-controlled policy
meaning. A template may contribute a bounded suggestion only after server-side
projection and only after explicit acceptance into a typed intent command.

## Design

```text
library profile
  -> policyStarterTemplateSuggestions (server-internal)
  -> policyIntentSignalOptionProjection (canonical candidate + provenance)
  -> IntentSignalPicker (explicit acceptance)
  -> policy.intent_signal_command_plan.v1
  -> server validation and native policy creation
```

The candidate projection may identify
`suggested_from_starter_template`, but it contains no raw template record,
attachment operation, scoring weight, custom signal payload, or persistence
authority. The client can only accept a canonical candidate into a supported
signal type and bucket. The server remains the authority for candidate
allowlisting and for all policy writes.

Existing policies are different: their attached preset data is read as
compatibility context and may be round-tripped unchanged by the legacy draft
bridge. Editing an existing policy cannot add, remove, or replace an attachment
through a template picker. Static preset labels and values are option-only
reference data, never observed evidence or intent.

## Research

Official guidance reviewed in July 2026:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  requires enforcing business rules at the authoritative boundary rather than
  trusting a client workflow.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  supports allowlisted, semantic server-side validation of values and state.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  emphasizes reviewing trust boundaries and data flow, including indirect
  state transitions.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports integrated verification of secure design and implementation
  practices.

## Options

| Approach | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Raw template browser and attachment endpoint | Familiar legacy interaction | Makes a template a second, client-controlled policy authority and exposes a parallel write path | Reject |
| Client-side template translation | Small initial UI change | Duplicates policy semantics at an untrusted boundary and can drift from server validation | Reject |
| Server projection plus explicit typed command | One auditable authority boundary; templates remain useful; no implicit policy mutation | Requires maintaining canonical candidate projection | Adopt |

## Recommendation Stack

1. Keep `policyStarterTemplateSuggestions.mjs` internal to server workflow
   context; it may generate candidates but not attachment payloads.
2. Use `policyIntentSignalOptionProjection.mjs` to emit only canonical,
   provenance-labelled, allowlisted candidate options.
3. Use `IntentSignalPicker.vue` and `policyIntentSignalDraft.js` to construct
   an explicit `policy.intent_signal_command_plan.v1` command plan.
4. Keep raw preset attachments bridge-only for existing policies until native
   storage migration, and preserve them without treating them as current
   intent.
5. Do not expose a raw suggestion route, template selector, template browser,
   or template-attachment operation in normal authoring.

## Outcome

- Removed the raw `/policies/presets/suggest/:libraryId` endpoint.
- Removed the starter-template accelerator, browser, and orphaned preset
  selection modal.
- Removed the duplicate raw-template command service.
- Kept all code in ES modules and preserved the existing policy draft bridge
  only for compatibility round-tripping.
- Added inventory and regression coverage that rejects deleted raw-selection
  surfaces while retaining the bounded projection primitives.

## Verification

Focused tests prove that normal compatibility editing does not render raw
template controls or request raw template suggestions; that canonical template
candidates require explicit typed acceptance; and that reference data remains
option-only. Server completion and artifact inventories also fail if a deleted
raw-selection artifact is recorded as an active path.

The live route and projection enforcement audit is documented in [Policy
Starter-Template Live Candidate Projection
Audit](policy-starter-template-live-candidate-projection-audit.md). It verifies
the final response before it is sent and rejects template provenance that does
not belong in a canonical candidate.
