# Policy Builder Modal Orchestration Boundary

Status: implemented and hardened with modal touchpoint, event, and notification
handoff audits.

## Scope

This document records the durable orchestration contract for
`PolicyBuilderModal.vue`. The modal may coordinate policy-builder flow, but it
must not become the place where Classifarr infers policy meaning, generates
evidence, decides learning, decides routing readiness, mutates raw legacy
payloads, or interprets migration parity.

This slice narrows one concrete behavior: save-failure presentation no longer
uses a blocking browser `alert()`. It delegates to the app toast pattern and
keeps save payload authority in the draft-state boundary and server validation.

## Official Guidance Reviewed

Official sources reviewed as of June 2026:

- Vue Component Events:
  <https://vuejs.org/guide/components/events.html>
  - Component events should be explicit communication channels from child to
    parent.
- Vue Component `v-model`:
  <https://vuejs.org/guide/components/v-model>
  - Component two-way binding should use explicit model props and update events.
- Vue Composables:
  <https://vuejs.org/guide/reusability/composables>
  - Stateful logic belongs in focused composables when it needs reuse or
    isolation from presentation.
- WAI-ARIA Authoring Practices, Modal Dialog Pattern:
  <https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/>
  - Modal dialogs should bound user interaction to the active dialog and avoid
    surprising workflow interruptions.
- OWASP Application Security Verification Standard:
  <https://owasp.org/www-project-application-security-verification-standard/>
  - Client-side UI behavior is not a substitute for server-side validation,
    authorization, and trusted write boundaries.

## Recommendations

1. Keep `PolicyBuilderModal.vue` as orchestration only:
   - open/close lifecycle,
   - high-level save/cancel actions,
   - child component composition,
   - loading/error presentation,
   - command routing to owned composables.
2. Explicitly prohibit modal ownership of:
   - evidence generation,
   - intent inference,
   - learning decisions,
   - readiness decisions,
   - migration/parity decisions,
   - raw legacy payload mutation.
3. Keep public modal events narrow:
   - `update:modelValue` carries boolean visibility only,
   - `save` carries only the delegated save payload,
   - `close` carries no policy payload.
4. Use durable extraction handoffs:
   - `targetBoundaryId`, not `targetPhase`,
   - engine-cutline and compatibility-bridge handoffs are named by ownership,
     not roadmap labels.
5. Use app-level non-blocking presentation for save failures:
   - no browser `alert()` in the modal,
   - toast or future notification components own visible failure presentation.

## Pros And Cons

Pros:

- Prevents the modal from becoming an accidental policy engine.
- Makes event payload authority explicit and testable.
- Keeps future engine results pass-through friendly: server-owned results can be
  rendered without the modal calculating them.
- Removes a blocking browser dialog from save failure flow.
- Keeps only still-present modal responsibilities as explicit extraction
  targets.

Cons:

- Summary projection and starter-template command adaptation still need later
  ownership refactors.
- Toast presentation is a client-side UX improvement only; saved policies still
  require server-side validation.

## Final Stack

- Boundary inventory dependency:
  `server/src/services/policyBuilderBoundaryInventory.mjs`
- Modal orchestration contract:
  `server/src/services/policyBuilderModalOrchestrationContract.mjs`
- Vue modal:
  `client/src/components/policies/PolicyBuilderModal.vue`
- Unit coverage:
  `server/src/__tests__/services/policyBuilderModalOrchestrationContract.test.mjs`
- Client coverage:
  `client/src/__tests__/PolicyBuilderModal.test.js`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Outcome

The modal orchestration contract defines allowed responsibilities:

| Allowed Responsibility | Modal May Own |
| --- | --- |
| Open and close lifecycle | Bind modal visibility to `modelValue` and emit update events. |
| High-level save and cancel actions | Trigger save/cancel flow without owning payload authority. |
| Child component composition | Compose child components and pass derived state through props. |
| Loading and error presentation | Render states returned by composables. |
| Command routing to owned composables | Translate child events into explicit commands. |

It also defines prohibited responsibilities:

| Prohibited Responsibility | Reason |
| --- | --- |
| Evidence generation | Evidence belongs behind server-owned engine/readiness contracts or bounded adapters. |
| Intent inference | The modal may edit declared intent but cannot infer destination meaning. |
| Learning decisions | Learning eligibility requires a server learning guard. |
| Readiness decisions | The modal can display readiness but cannot decide automation safety. |
| Migration or parity decisions | Migration verification and replay interpretation are not normal modal workflow. |
| Raw legacy payload mutation | Preset/custom-signal mutation must stay inside compatibility bridge and serializer modules. |

Current extraction targets:

| Target | Boundary Handoff |
| --- | --- |
| Advanced scoring controls | Operator surface plus engine cutline. |
| Summary view projection | Modal orchestration/view-model boundary. |
| Legacy command adapters | Legacy bridge boundary. |
| Save failure notification | Modal orchestration presentation handoff. |

Current modal touchpoints:

| Touchpoint | Boundary Decision |
| --- | --- |
| Model value binding | Keep in modal as open/close lifecycle. |
| Save payload delegation | Keep in modal only as high-level save action; payload authority remains delegated. |
| Draft signal command routing | Keep in modal as command routing to composables. |
| Profile refresh command routing | Keep in modal as command routing to reference data. |
| Advanced scoring composition | Reclassify or delete after operator/engine cutline. |
| Summary view projection | Move to focused composable/view-model. |
| Legacy template command adapters | Move to bridge ownership. |
| Save failure notification | Use app toast presentation; no blocking browser alert. |

The contract exposes:

- `listModalTouchpoints()`
- `getModalTouchpoint(id)`
- `listModalPublicEvents()`
- `getModalPublicEvent(id)`
- `validateModalPublicEvent(event)`
- `buildPolicyBuilderModalPublicEventAudit(events)`
- `buildPolicyBuilderModalOrchestrationAudit(touchpoints)`

The audits fail on unknown touchpoints, prohibited modal responsibilities,
unmapped extraction targets, invalid event responsibility, non-delegated save
payload authority, and missing event validator expectations.

## Follow-Up

The next high-value task is the draft-state boundary cutover: keep the client
draft as an editable projection with allow-listed commands and save
serialization, not durable policy authority.
