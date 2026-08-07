# Policy Material Exception Presentation

## Status

Implemented as Phase 4R Task 4R.6 on August 6, 2026.

## Decision

A persisted or proposed native policy surfaces constraint, routing, and
review controls only when they materially change the automatic outcome. The
material exception projection composes the existing constraint decision model
(3R.5), automation readiness engine (6R.4), and routing availability into a
single bounded view that answers one question:

```text
Is there a concrete condition right now that blocks or redirects the
automatic outcome, and if so, what is the one admitted resolution?
```

When the answer is "no conditions," the projection is empty and the operator
sees nothing — no stacked warnings, no optional empty controls, no generic
"missing avoid values" notices. This follows the progressive disclosure
principle: show only what matters right now; defer optional controls inside
the adjustment disclosure.

## Materiality Filter

A condition is **material** when it meets one of these criteria:

| Condition | Effect | Why it is material |
| --- | --- | --- |
| Hard-limit conflict | `block_automatic_application` | Prevents routing |
| Routing gap (no Arr mapping) | `needs_routing` | Automation cannot complete |
| Review-required from server | `request_review` | Server declares a review condition |
| Active evidence recovery | `stale_profile` | Profile is being refreshed; status is informational |

A condition is **not material** when:

- An optional control (avoid, review trigger, helpful match) has no value
  but no conflict exists.
- The destination is ready and no hard-limit conflict is declared.
- Evidence recovery is not active.

The projection uses the existing `POLICY_CONSTRAINT_DECISION_EFFECT_IDS` and
`POLICY_AUTOMATION_READINESS_STATE_IDS` to classify each condition. It does
not invent new effect categories.

## Projection Shape

```text
{
  version: 'policy.material_exception_presentation.v1',
  hasMaterialException: boolean,
  exceptions: [
    {
      exceptionId: 'hard_limit_conflict' | 'routing_gap' | 'review_required' | 'recovery_in_progress',
      effectId: 'block_automatic_application' | 'needs_routing' | 'request_review' | 'informational',
      summary: string,
      resolution: {
        actionId: string,
        ownerId: string,
        sectionId: string | null,
        automated: boolean,
      },
    },
  ],
  optionalControlsHidden: boolean,
  sideEffects: { ... all false },
}
```

- At most **one primary exception** is marked as the highest-priority
  resolution target. Lower-priority exceptions remain in the list but are
  not the primary action.
- `optionalControlsHidden` is `true` when avoid, review-trigger, or
  helpful-match controls have no declared value and no material conflict.
  This tells the UI to keep those controls inside the adjustment disclosure.

## Official Guidance Reviewed

- [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
  recommends showing only the most important options initially and deferring
  secondary features upon request. The material exception projection enforces
  this by defaulting to empty and only surfacing controls when there is a
  concrete blocker.
- [Interaction Design Foundation: Progressive Disclosure](https://ixdf.org/literature/topics/progressive-disclosure)
  emphasizes keeping important information visible, limiting layers of
  information, and avoiding multiple access paths. The projection produces
  one primary action per state.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default authorization. The projection defaults to
  `hasMaterialException: false` — no exception is claimed unless the server
  explicitly declares one.
- [WAI-ARIA status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  recommends polite status announcements for dynamic content. Recovery status
  is `informational` and does not steal focus or create a maintainer workflow.

## Options Considered

### 1. Keep the always-visible constraint control surface

Pros:

- No new projection needed.
- All controls are always discoverable.

Cons:

- Violates the 4R.6 acceptance criterion: "A ready destination is never
  described as incomplete merely because optional controls have no value."
- Creates decision load on every policy, even ready ones.
- The live-entry-path inventory already flags this as a known defect
  (`OPTIONAL_BOUNDARIES_DEFAULT_VISIBLE`).

### 2. Move all controls into the adjustment disclosure and never surface them as exceptions

Pros:

- Simplest possible change: hide the constraint surface by default.

Cons:

- A real hard-limit conflict or routing gap would be buried inside an
  optional disclosure, making it hard to discover when it actually matters.
- Violates: "A real constraint or routing gap has one visible owner and one
  admitted resolution path."

### 3. Build a dedicated material exception projection

Pros:

- Surfaces only material conditions (blocked, routing gap, review, recovery).
- Defaults to empty for ready destinations.
- Produces one primary action per state.
- Composes existing server-owned contracts without inventing new authority.
- Keeps optional controls inside the adjustment disclosure.
- Is testable without a database, route, or Vue component.

Cons:

- Adds one more projection to the workflow read response.
- Requires the caller to supply readiness, constraint, and routing state.

## Final Recommendation Stack

1. Build a pure, side-effect-free projection that composes constraint decision
   model, readiness state, and routing availability into a bounded material
   exception list.
2. Default to empty (`hasMaterialException: false`) when no material
   condition exists.
3. Surface at most one primary exception with its exact resolution action.
4. Mark `optionalControlsHidden: true` when optional controls have no value
   and no material conflict, so the UI keeps them in the adjustment
   disclosure.
5. Keep recovery status `informational` — no browser refresh, retry, reset,
   or quota operations.
6. Reject side effects, version mismatch, and ready-with-exceptions
   inconsistency in self-validation.
7. Wire into the operator workflow read response alongside the existing
   `readinessPresentation` and `presentation` fields.

## Implementation Outcome

`server/src/services/policyMaterialExceptionPresentation.mjs` owns the
projection. It defines four exception IDs, four effect IDs, a materiality
filter that consumes readiness state and constraint decision model, a
priority resolver that selects the primary exception, and a self-validating
result envelope.

The projection is pure: it takes readiness state, constraint decision model,
routing availability, and optional-control presence as inputs and returns a
bounded projection. It performs no database query, route mutation, policy
persistence, routing execution, learning write, or provider call.

Focused regression tests cover:
- empty projection for a ready destination with no conflicts
- hard-limit conflict as the primary exception
- routing gap as the primary exception
- review-required condition
- recovery-in-progress informational status
- optional controls hidden when no material conflict
- highest-priority exception selection when multiple conditions exist
- side-effect rejection and self-validation

## Security Outcome

- No optional control or generic warning clutters a ready destination.
- A real constraint or routing gap has one visible owner and one admitted
  resolution path.
- Automatic recovery remains informational and does not create a maintainer
  workflow.
- The projection is display-only: no automation decision, policy persistence,
  routing execution, or provider access.
- No raw payloads, request bodies, or persistence internals are disclosed.

## Next Task

The next task is **4R.7 Persisted Policy Summary And Intentional Maintenance
Entry**, which depends on 5R.10 (now complete) to expose persisted native
policy editing through the revision-checked change admission contract.
