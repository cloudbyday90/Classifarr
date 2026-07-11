# Policy Authoring Workflow Behavior Cutover

## Status

Implemented July 11, 2026.

## Intent

Completion-audit evidence should explain the policy-authoring behavior it
verifies. Two server-contract records instead described the temporary delivery
naming convention that had guided the rebuild. That wording does not help an
operator or maintainer understand the current product boundary.

## Boundary Audit

The affected strings are diagnostic evidence in
`policyAuthoringWorkflowCompletionAudit.mjs`. Record IDs, labels, paths,
artifact validation, risk IDs, and workflow behavior do not depend on their
text. The cutover therefore changes only the evidence wording and adds an
exact regression assertion.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends precise and unambiguous stable terminology. Diagnostic evidence
  should identify product behavior, not the delivery sequence that created it.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports traceable secure development. The test fixes the intended evidence
  language without altering the validation controls it describes.

## Options Considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Retain the delivery wording | No code change | Current audit remains self-referential and stale | Rejected |
| Remove the evidence strings | Less text | Reduces diagnostic context | Rejected |
| Describe the verified product behavior | Durable, useful audit output | Requires a focused wording test | Selected |

## Final Recommendation Stack

1. Describe durable policy ownership in workflow-inventory evidence.
2. Describe the destination-first operator flow in workflow evidence.
3. Preserve all existing record identity and validation behavior.
4. Assert exact wording in the focused audit test.

## Implementation

- Replaced phase-specific wording with durable product ownership language.
- Replaced generic operator-flow wording with destination-first workflow
  language.
- Added regression coverage for the two evidence records.
- Reduced the naming baseline from `10/11` to `8/9`.

## Security Outcome

- No authorization, persistence, route, process, or network behavior changed.
- Audit diagnostics remain explicit and traceable.
- The change cannot weaken artifact-path or workflow-boundary validation.

## Verification

- The focused workflow-completion audit test passes.
- The production naming inventory validates with no unclassified references.
- The regression audit uses the reduced baseline.

## Next Step

Replace the policy-builder modal orchestration reason that refers to later
phases with direct engine-cutline language.
