# Policy Authoring Live Entry-Path And Action Inventory

Status: Complete for source and controlled rendered-browser verification on
2026-08-08. This is not a production deployment or per-installation cutover
claim.

## Purpose

Phase 4R.1 verifies the policy-authoring path that an operator can actually
reach. It prevents a legacy builder, a URL hash, or a maintainer surface from
becoming a second normal create path.

## Current Design

The normal path is intentionally short:

```text
/policies
  -> Review destination proposal
  -> /policies?library=:libraryId
  -> server-prepared proposal
  -> Create policy
```

The browser renders server-confirmed lifecycle and proposal data. It does not
derive destination identity, readiness, authorization, or persistence results.
The only mutation is the admitted proposal command, which sends the
server-issued proposal reference, revision, a request idempotency key, and
allow-listed adjustment commands.

## Entry And Action Inventory

| Surface | Classification | Owner | Outcome |
| --- | --- | --- | --- |
| `/policies` | Normal entry | `PolicyList.vue` | Lists one server-confirmed lifecycle state per library |
| `Review destination proposal` | Accessible navigation action | `PolicyAuthoringLifecycleEntry.vue` | Selects `/policies?library=:libraryId` and moves focus to the selected destination |
| Selected library route | Normal proposal state | `PolicyList.vue` and `usePolicyAuthoringDestinationProposal.js` | Reads workflow context and requests a server-prepared proposal |
| `Create policy` | Server-admitted mutation | `PolicyDestinationProposalCard.vue` | Sends only opaque proposal admission data; reports the server result |
| Adjustment disclosure | Optional local draft command | `PolicyDestinationProposalAdjustmentDisclosure.vue` | Emits allow-listed narrowing commands for the current proposal revision |
| Existing, blocked, and recovery states | Read-only or recovery state | Lifecycle presentation | Do not expose a create action |
| `#policy-builder-advanced-settings` | Retired path | Router and `PolicyList.vue` | Does not expose a normal policy-authoring target |
| Native reconciliation route | Administrator maintenance | Dedicated router entry | Outside normal authoring |

## Recommendations

1. Use browser tests that locate controls by accessible role and name, exercise
   keyboard activation, and assert visible outcomes. Vue directs interaction
   behavior to end-to-end tests, and Playwright recommends user-facing
   locators with automatic waiting. [Vue testing guide](https://vuejs.org/guide/scaling-up/testing.html)
   and [Playwright locators](https://playwright.dev/docs/locators).
2. Keep one visible primary action for an eligible selected library. The
   browser may navigate or hold local typed adjustments, but the server remains
   the authority for proposal validity and policy creation. This limits confused
   deputy and duplicate-write risks.
3. Treat focus placement as part of the navigation contract. The selected
   destination receives focus after keyboard activation, consistent with the
   [WAI-ARIA button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/).
4. Keep this controlled rendering evidence separate from deployment and
   installation evidence. Authorization, idempotency, and persistence retain
   their server-side verification obligations under the
   [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/).

## Alternatives

| Approach | Pros | Cons |
| --- | --- | --- |
| Selected lifecycle route plus one admitted action | Lowest decision load, accessible, server-authoritative, and testable | Requires the lifecycle and proposal APIs to remain stable |
| Legacy modal or advanced hash entry | Familiar to prior users | Creates a second path, duplicates controls, and obscures automatic behavior |
| Client-computed create form | Appears flexible | Lets the client reinterpret evidence and expands the security boundary |

## Recommendation Stack

1. Keep `/policies` and the selected-library query route as the only normal
   authoring flow.
2. Keep one server-admitted `Create policy` action and make adjustments
   optional, typed, and revision-bound.
3. Keep maintenance and migration controls outside this flow.
4. Preserve the browser specification as a regression guard; run production
   and per-installation evidence separately when those phases require it.

## Verification

- `policyAuthoringLiveEntryPathInventory.mjs` classifies the current sources
  and refuses unknown browser-evidence states.
- `policyAuthoringLiveEntryPathInventory.test.mjs` verifies the inventory,
  next-task handoff, and invalid evidence rejection.
- `policy-authoring-live-entry-path.spec.js` runs the rendered flow with
  contract-shaped mocked server responses. It verifies keyboard route entry,
  focus placement, one create action, opaque admission payload, success
  feedback, and the retired hash behavior.
- The spec is registered in `policyAuthoringE2eWorkflowTests.mjs` as eligible
  create coverage. It complements, rather than replaces, server authorization
  and persistence tests.

## Outcome And Next Task

4R.1 no longer asserts that a native create trigger is absent. The verified
normal path is lifecycle-first and proposal-backed; legacy advanced-settings
navigation is not a valid authoring entry.

Next dependency-gated task: **5R.3 AI Provider Capability And Authority
Modes**. It must bound provider output before later runtime questions,
material exceptions, or persisted-policy maintenance can rely on it.
