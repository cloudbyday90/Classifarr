# Policy Authoring Readiness Module Cutover

Status: implemented.

## Scope

This cutover removes phase-coded naming from the policy authoring readiness
contract without changing behavior. The work keeps the same readiness states,
next-action mapping, diagnostic-surface exclusion, and focused test coverage
while making the module suitable for long-lived production code.

## Official Guidance Reviewed

- W3C WCAG Status Messages:
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- WAI-ARIA Authoring Practices Guide:
  https://www.w3.org/WAI/ARIA/apg/
- OWASP Input Validation Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Recommendation

Keep readiness as a durable policy-authoring service with allowlisted state,
issue, action, diagnostic-surface, visibility, and risk vocabularies. Normal UI
readiness should receive a compact projection with one primary next action and
must not receive raw provider, replay, TMDB, scoring, or parity diagnostics.

## Pros And Cons

Pros:

- Removes migration-phase naming from production services and tests.
- Keeps readiness behavior deterministic and side-effect free.
- Preserves accessibility-oriented status roles and one-action guidance.
- Maintains a secure allowlist boundary for readiness issues and diagnostics.

Cons:

- Requires dependent roadmap and completion-audit references to move at the
  same time as the module rename.

## Final Stack

- Service: `server/src/services/policyAuthoringReadiness.mjs`
- Test: `server/src/__tests__/services/policyAuthoringReadiness.test.mjs`
- Design: `docs/architecture/policy-authoring-readiness.md`
- Completion gate:
  `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`

## Outcome

The readiness service now exports `POLICY_AUTHORING_READINESS_*`,
`POLICY_AUTHORING_DIAGNOSTIC_SURFACE_IDS`, and
`policyAuthoringReadiness*` helpers. The completion audit now tracks the
contract as `policy_authoring_readiness`, and the roadmap points to the durable
readiness design.

## Next Step

Cut over the starter-template role reset contract to durable policy-authoring
names.
