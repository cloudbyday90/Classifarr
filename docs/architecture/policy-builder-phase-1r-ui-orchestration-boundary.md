# Policy Builder Phase 1R UI Orchestration Boundary

Status: implemented as the second Phase 1R client-boundary contract and
hardened with a modal touchpoint audit.

## Scope

Phase 1R.2 defines what `PolicyBuilderModal.vue` may own and what it must not
own while Classifarr re-imagines the policy builder around declared intent,
observed application, server-owned evidence, and guarded learning.

This slice does not change modal behavior, component layout, save payloads,
preview execution, policy scoring, routing, database schema, API contracts, or
client-visible copy. It adds a server-owned ESM contract that future modal
refactors must satisfy.

## Research Inputs

Official sources reviewed as of June 2026:

- Vue Component Basics:
  <https://vuejs.org/guide/essentials/component-basics.html>
  - Components should compose smaller units through props and events; parent
    components coordinate flow instead of owning all implementation details.
- Vue `v-model` On Components:
  <https://vuejs.org/guide/components/v-model.html>
  - Two-way component binding should be explicit through model props and update
    events.
- Vue Composables:
  <https://vuejs.org/guide/reusability/composables.html>
  - Stateful logic can move into focused composables, but returned state and
    commands still need clear ownership.
- Vue Testing:
  <https://vuejs.org/guide/scaling-up/testing.html>
  - Component tests should focus on behavior, events, and integration boundaries
    rather than freezing private implementation details.
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
  - Client validation and presentation are not authoritative; server-side
    allow-list validation remains required.
- OWASP Mass Assignment Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html>
  - Broad client state should not be trusted as write payload authority.
- NIST Secure Software Development Framework, SP 800-218:
  <https://csrc.nist.gov/publications/detail/sp/800-218/final>
  - Implementation work should have defined responsibilities and verification
    criteria before behavior changes.

## Recommendations

1. Keep `PolicyBuilderModal.vue` as orchestration only:
   - open/close lifecycle,
   - high-level save/cancel actions,
   - child component composition,
   - loading and error presentation,
   - command routing to owned composables.
2. Explicitly prohibit modal ownership of:
   - evidence generation,
   - intent inference,
   - learning decisions,
   - readiness decisions,
   - migration/parity decisions,
   - raw legacy payload mutation.
3. Treat current diagnostic panels as temporary composition:
   - impact preview and replay preview need Phase 6R classification as engine
     primitives, maintainer verifiers, or deletion candidates.
4. Move display projection and notification behavior out of the modal when
   refactoring begins:
   - intent summary projection should move behind a focused view-model or
     composable,
   - save failure notification should use the app notification pattern instead
     of direct browser alerting.
5. Keep legacy command adapters narrow until Phase 1R.5:
   - the modal may route starter-template events temporarily,
   - raw preset/custom-signal mutation must stay in bridge/serializer modules.
6. Track current modal touchpoints explicitly:
   - each touchpoint must map to an allowed responsibility,
   - transitional touchpoints must map to an extraction target,
   - prohibited responsibilities must fail the audit.
7. Treat public modal events as a contract:
   - `update:modelValue` may carry visibility state only,
   - `save` may carry only the delegated save payload from the draft-state
     boundary,
   - `close` must not carry policy, evidence, learning, readiness, migration,
     or legacy payload data,
   - all public events should have runtime emit validators.

## Pros And Cons

### Pros

- Prevents `PolicyBuilderModal.vue` from becoming the accidental policy engine.
- Gives future modal edits a deterministic allow/deny contract.
- Keeps Phase 6R engine output pass-through friendly: the modal can receive
  server-owned evidence/readiness data as props without computing it.
- Identifies concrete extraction targets without changing user behavior yet.
- Keeps tests focused on visible behavior and command routing.
- Makes current transitional behavior traceable instead of implicit in the
  modal implementation.
- Makes emitted event payloads explicit so parent components cannot treat the
  modal as a policy authority source.

### Cons

- The modal still composes diagnostic preview panels until Phase 6R decides
  their final role.
- This task defines the boundary but does not yet move summary projection or
  notification behavior.
- Existing test coverage still reflects some transitional UI shape until Phase
  1R.6 resets test ownership.
- Future work still needs client-level refactors after the contract is in place.
- The touchpoint audit is manually maintained, so new modal behavior must update
  the contract at the same time as the component change.
- Runtime emit validators are client-side guardrails only; server validation and
  draft-state allow-lists remain authoritative for saved policy data.

## Final Stack

- Phase 1R.1 dependency:
  `server/src/services/policyBuilderBoundaryInventory.mjs`
- Modal orchestration contract:
  `server/src/services/policyBuilderModalOrchestrationContract.mjs`
- Unit coverage:
  `server/src/__tests__/services/policyBuilderModalOrchestrationContract.test.mjs`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- This implementation record:
  `docs/architecture/policy-builder-phase-1r-ui-orchestration-boundary.md`

## Implemented Outcome

Phase 1R.2 defines allowed modal responsibilities:

| Allowed Responsibility | Modal May Own |
| --- | --- |
| Open and close lifecycle | Bind modal visibility to `modelValue` and emit update events. |
| High-level save and cancel actions | Trigger save/cancel flow without owning payload authority. |
| Child component composition | Compose child components and pass derived state through props. |
| Loading and error presentation | Render states returned by composables. |
| Command routing to owned composables | Translate child events into explicit commands. |

It also defines prohibited modal responsibilities:

| Prohibited Responsibility | Reason |
| --- | --- |
| Evidence generation | Evidence belongs behind server-owned engine/readiness contracts or bounded adapters. |
| Intent inference | The modal may edit declared intent but cannot infer destination meaning. |
| Learning decisions | Learning eligibility requires the future server learning guard. |
| Readiness decisions | The modal can display readiness but cannot decide automation safety. |
| Migration or parity decisions | Migration verification and replay interpretation are not normal modal workflow. |
| Raw legacy payload mutation | Preset/custom-signal mutation must stay inside compatibility bridge and serializer modules. |

Current extraction targets:

| Target | Decision |
| --- | --- |
| Diagnostic preview surfaces | Reclassify or delete after Phase 6R. |
| Advanced scoring controls | Reclassify or delete after Phase 3R/6R. |
| Summary view projection | Move to focused composable/view-model. |
| Legacy command adapters | Move to legacy bridge ownership in Phase 1R.5. |
| Save failure notification | Move to app notification presentation pattern. |

Current modal touchpoints:

| Touchpoint | Boundary Decision |
| --- | --- |
| Model value binding | Keep in modal as open/close lifecycle. |
| Save payload delegation | Keep in modal only as high-level save action; payload authority remains delegated. |
| Draft signal command routing | Keep in modal as command routing to composables. |
| Profile refresh command routing | Keep in modal as command routing to reference data. |
| Diagnostic preview composition | Reclassify or delete after Phase 6R. |
| Advanced scoring composition | Reclassify or delete after Phase 3R/6R. |
| Summary view projection | Move to focused composable/view-model. |
| Legacy template command adapters | Move to bridge ownership. |
| Save failure browser alert | Move to app notification presentation pattern. |

Public modal events:

| Event | Payload Authority | Boundary |
| --- | --- | --- |
| `update:modelValue` | View state | Boolean visibility only. |
| `save` | Delegated save payload | Payload must come from `buildSavePayload()`; server validation remains authoritative. |
| `close` | No payload | Operator cancellation only. |

The contract now exposes:

- `listModalTouchpoints()`
- `getModalTouchpoint(id)`
- `listModalPublicEvents()`
- `getModalPublicEvent(id)`
- `validateModalPublicEvent(event)`
- `buildPolicyBuilderModalPublicEventAudit(events)`
- `buildPolicyBuilderModalOrchestrationAudit(touchpoints)`

The audit fails on unknown touchpoints, prohibited modal responsibilities, and
unmapped extraction targets. It also checks public event ownership and validator
expectations. This keeps future modal edits from quietly adding evidence,
learning, readiness, migration, or raw legacy mutation logic.

## Phase 1R.2 Checklist Result

| Phase 0R Checklist Item | Result |
| --- | --- |
| Source of truth identified | The modal is not source of truth; it is UI orchestration only. |
| Authority level identified | The modal has no durable policy, evidence, learning, readiness, or migration authority. |
| Learning side effect identified | No learning side effects are added by this task. |
| Rollback or migration impact identified | Diagnostic and legacy command surfaces are marked for later Phase 6R/8R cutlines. |
| Operator-facing language validated | No product copy changes were introduced; this task constrains future modal behavior. |

## Follow-Up

The next Phase 1R task is **1R.3 Draft State Boundary**. It should make the
client draft an editable projection with allow-listed commands and save
serialization, not durable policy authority.
