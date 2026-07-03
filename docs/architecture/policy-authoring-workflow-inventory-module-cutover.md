# Policy Authoring Workflow Inventory Module Cutover

Status: implemented.

## Scope

This cutover removes phase-specific naming from the policy-authoring workflow
inventory service and focused test while preserving the existing deterministic
classification behavior.

## Official Guidance Reviewed

- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final
- OWASP Logging Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OpenTelemetry semantic convention naming:
  https://opentelemetry.io/docs/specs/semconv/general/naming/

## Recommendations

1. Use durable product-domain names for production modules and exported
   contracts.
2. Keep deterministic classification contracts side-effect-free and easy to
   test.
3. Keep audit evidence paths aligned with live repository artifacts.
4. Avoid carrying temporary roadmap phase terms into runtime-facing names,
   messages, or completion-audit records.

## Pros And Cons

Pros:

- Reduces phase-coded production naming debt.
- Keeps downstream authoring contracts on a stable shared vocabulary.
- Preserves behavior while making the artifact suitable for post-roadmap
  maintenance.

Cons:

- Leaves dependent authoring workflow modules with their own phase-coded names
  until their individual cutover slices are completed.

## Final Recommendation Stack

- `server/src/services/policyAuthoringWorkflowInventory.mjs`
- `server/src/__tests__/services/policyAuthoringWorkflowInventory.test.mjs`
- `docs/architecture/policy-authoring-workflow-inventory.md`
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`

## Outcome

The cutover renamed the workflow inventory module and focused test, replaced
phase-coded exported constants and helpers with `POLICY_AUTHORING_WORKFLOW_*`
and `policyAuthoringWorkflow*` names, updated dependent authoring contracts to
consume the durable vocabulary, and moved completion-audit evidence to durable
artifact paths.

## Next Step

Cut over the destination-first flow contract to durable policy-authoring naming
because it is the next direct consumer of the workflow inventory vocabulary.
