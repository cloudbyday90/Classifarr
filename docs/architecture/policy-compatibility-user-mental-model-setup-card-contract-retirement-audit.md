# Policy Compatibility User-Mental-Model Setup-Card Contract Retirement Audit

## Status

Implemented on 2026-07-31 as Phase 6R.5 operator-workflow maintenance.

## Decision

Delete the unreachable four-step setup-card model from
`server/src/services/policyUserMentalModel.mjs`. Retain only the stable UX term
IDs, operator-workflow control-kind IDs, and internal-diagnostic language
guard that active server services import.

The five-section destination-first workflow remains
`policyOperatorWorkflow.mjs`'s server-owned projection. It does not consume the
deleted steps, cards, journeys, field groups, answer shapes, or copy audits.

## Scope Proof

| Contract | Production consumer | Decision |
| --- | --- | --- |
| UX term IDs | Draft, evidence, operator-workflow, and learning vocabulary services | Keep. |
| Field control-kind IDs | Operator-workflow service | Keep. |
| Internal diagnostic-language guard | Accessibility, evidence, and operator-workflow services | Keep. |
| Four setup questions and ordered steps | No production consumer | Delete. |
| Setup cards, surface roles, and journeys | No production consumer | Delete. |
| Setup copy, field groups, answer shapes, and self-audits | No production consumer | Delete. |

## Official Guidance Reviewed

Research was reviewed on 2026-07-31 against official guidance current through
June 2026:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-owned workflow state rather than client-controlled step
  order or hidden state. The live operator workflow is server-owned; duplicate
  card metadata cannot govern policy state.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  requires server-side syntactic and semantic validation. UI vocabulary and
  card sequencing must not become write authorization.
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) requires programmatically
  determinable component state and status messages. One current server-derived
  workflow/readiness projection is more accessible than duplicate inactive
  card states.
- [W3C guidance for Predictable behavior](https://www.w3.org/WAI/WCAG22/Understanding/predictable.html)
  calls for predictable interaction. A single authoritative workflow avoids
  conflicting sequences and labels.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Keep all setup metadata | Avoids deletion now | Leaves dead workflow authority, duplicated concepts, and misleading future reuse. |
| Reconnect the four-step model | Reuses existing records | Conflicts with the current five-section workflow and rebuilds a second product path. |
| Move the legacy records to a separate module | Narrows the file | Preserves code with no caller or valid product owner. |
| Delete unconsumed records; keep active primitives | One workflow authority and a compact shared vocabulary | Removes speculative APIs and requires focused consumer tests. |

## Final Recommendation Stack

1. Keep a single server-owned operator-workflow projection for normal policy
   authoring.
2. Retain only shared identifiers and non-authorizing language checks with
   active callers.
3. Keep server-side semantic validation as the authority for every policy
   mutation; never infer it from UI sequence or copy.
4. Delete unused workflow-shaped metadata instead of relocating it as a future
   compatibility layer.

## Implementation Outcome

- Replaced the 2,000-line self-referential setup-card contract with its three
  active ESM primitives.
- Removed the obsolete tests and added focused coverage that fixes the retained
  API boundary in place.
- Rewrote the user-mental-model design record to document its actual role.
- Preserved live policy workflow, evidence, intent, readiness, routing,
  migration, provider, quota, learning, and persistence behavior.

## Next Item

Proceed with **Phase 6R.6, Task 6R.6.1: Migration Preview Contract**. Start by
auditing the creation-only browser evidence-refresh path as a replace-or-delete
target while preserving the bounded server-owned migration comparison and
rollback evidence.
