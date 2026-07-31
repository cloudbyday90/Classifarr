# Policy Compatibility Save-Footer Admission Audit

## Status

Implemented on 2026-07-31 as Phase 6R.5 compatibility maintenance work.

## Decision

Keep `PolicyBuilderFooterActions.vue` as an action surface, not a readiness
surface. It now shows only:

- a direct unmet prerequisite while the save control is disabled;
- the save and defer controls; and
- a returned server error.

The footer no longer renders a persistent `Ready to save` or `Ready to create`
message, status tone, starter-template explanation, or locally inferred routing
warning. These browser-derived conclusions neither authorize a request nor
remain current after the server validates the submitted payload.

## Scope Classification

| Surface | Decision | Reason |
| --- | --- | --- |
| Disabled-save prerequisite | Keep | It explains the immediate local input needed to enable the control. |
| Save and defer buttons | Keep | They are the direct user commands for the modal. |
| Returned server error | Keep | It communicates the actual failed save outcome. |
| Permanent ready/complete status | Delete | A browser draft cannot establish saved policy validity or automation state. |
| Compatibility routing warning | Delete | It was a local inference unrelated to write authorization. |
| Local routing helper | Delete | It existed only to feed the footer after the routing card was unmounted. |
| Server validation and post-create handoff | Keep | The write endpoint and server response remain authoritative. |

## Official Guidance Reviewed

Research was reviewed on 2026-07-31 against official guidance current through
June 2026:

- [W3C WAI: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires dynamic outcomes, progress, and errors to be programmatically
  determinable. The retained prerequisite and returned error use live status
  semantics only when those messages exist.
- [W3C WAI-ARIA Authoring Practices: Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
  requires accessible button names and describes associating a button with a
  description. The disabled save control references its visible prerequisite;
  the deferred action has no misleading status description.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  requires server-side semantic validation because client checks can be
  bypassed. The local prerequisite is a usability hint, not a security control.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  says workflow state must be enforced on the server rather than gated by the
  UI. The footer no longer presents client-side save or routing state as a
  workflow result.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Retain ready and routing messages | Gives immediate local narration | Duplicates workflow state and makes client inference look authoritative. |
| Add a server readiness request before save | Could return persisted state | Is stale for unsaved changes and adds request churn without changing write validation. |
| Keep only direct prerequisites and server errors | One clear action path and accurate outcome feedback | No global pre-save success recap, by design. |

## Final Recommendation Stack

1. Use local checks only to explain an immediately missing input.
2. Treat server validation and response handling as write authority.
3. Reserve live status and alert semantics for dynamic prerequisites and actual
   save failures.
4. Do not infer routing, policy validity, or automation readiness in the footer.
5. Do not add a pre-save readiness API or a compatibility routing workflow.

## Implementation Outcome

- Simplified `PolicyBuilderFooterActions.vue` to prerequisite, command, and
  returned-error feedback.
- Reduced native and compatibility save-boundary models to action labels,
  `canSave`, and a direct disabled reason.
- Removed the modal's compatibility routing calculation and deleted its
  dedicated utility and test.
- Updated presentation and boundary inventories to stop classifying the footer
  as a readiness surface.
- Preserved all existing server validation, authorization, serialization, and
  post-create handoff behavior.

## Security And Accessibility Outcome

- Client state cannot claim that a policy is valid, saved, routable, or ready
  for automation.
- No request, permission, persistence, routing, provider, or quota behavior was
  added or broadened.
- The disabled save control has a visible, programmatically associated reason.
- Actual failed saves retain an assertive error announcement; a successful
  client-side preflight produces no competing status message.

## Verification

Focused footer, modal, and save-boundary tests cover direct prerequisites,
absence of browser-ready/routing messages, command emission, duplicate-save
prevention, and returned errors. Server inventory tests, full client tests,
coverage, build, lint, type checking, documentation lint, and ESM checks are
release gates.

## Next Item

Perform the **compatibility routing-readiness card retirement audit** for
`client/src/components/policies/PolicyBuilderRoutingReadinessCard.vue`.
It is unmounted after this change. Confirm it has no server-owned read contract
or production caller, then remove the component and focused test rather than
preserve a dormant client readiness surface.
