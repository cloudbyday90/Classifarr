# Policy Request-Time Terminal-Route Integration Audit

## Status

Implemented as the Phase 7R.5 request-time terminal-route integration audit.

The audit inventories every current server-side terminal routing caller that can
produce a request-time outcome. It verifies that each caller has a guarded proof
path or an explicit outcome-only fallback. It is read-only: it reads only
server-owned source files and reports compact caller summaries.

## Problem

The request-time reducer, request/import destination admission, native pending
route outcome, and queue question-reduction adapter are intentionally separate
components. Without an integration audit, a caller can drift by bypassing its
proof handoff, removing its fallback, or claiming that queue-bound proof is
live when no queue producer supplies it.

The audit found two current terminal routing callers:

| Caller | Current proof mode | Fallback | Result |
| --- | --- | --- | --- |
| Request/import classification queue | Current queue question-reduction envelope | Outcome-only | Guarded through queue-only request/import admission |
| Native pending terminal routing | Outcome-only | Outcome-only | Never turns route completion into learning |

`policyRuntimeQueueQuestionReductionProducer.mjs` now emits the queue-bound
envelope during queue-owned classification. The audit reports the proof as
`active` only when the queue-specific classification entry point, producer, and
queue-envelope request/import handoff remain present. It no longer treats the
former direct generic plan as terminal proof.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-enforced workflow state, server-derived security values,
  replay resistance, and tests for skipped or reordered transitions. The audit
  verifies each terminal caller's server-owned handoff and fallback rather than
  relying on UI behavior or a caller claim.
- [OWASP API3: Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  recommends allowlisting fields and avoiding automatic binding. Audit output
  returns caller ids, source paths, proof-mode ids, and boolean safety states;
  it never exposes source content, queue payloads, or provider data.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  identifies workflow integrity and state validation as review priorities. The
  focused suite deliberately removes required source handoffs, caller records,
  fallback modes, and proof vocabulary entries.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends repeatable secure-development practices. The audit converts a
  manual integration finding into an executable check included in the runtime
  completion record.

## Options Considered

### Rely On Documentation Review

Pros:

- No production code.
- Simple one-time review.

Cons:

- Cannot detect removed guarded handoffs or fallback behavior.
- Becomes stale as queue and pending-route code changes.

### Route Every Terminal Outcome Through One New Service

Pros:

- One apparent entry point.

Cons:

- Would conflate request/import and native pending workflows.
- Risks changing already-correct persistence and outcome-only behavior.
- Would force queue provenance into a workflow that does not currently produce
  queue-bound evidence.

### Use A Source-Backed Integration Audit

Pros:

- Preserves the existing modular contracts.
- Fails when registered callers lose their guarded handoff or fallback.
- Requires the live queue producer and queue-only terminal proof handoff.
- Adds no queue, provider, routing, profile, or learning side effects.

Cons:

- The registry must be updated deliberately when a new terminal caller is
  introduced.
- It detects declared integration drift, not every arbitrary unregistered
  service someone could add without also updating the runtime inventory.

## Final Recommendation Stack

1. Maintain a server-owned registry of current terminal request-time callers.
2. Require each caller to declare only approved proof modes:
   `direct_question_reduction_plan`, `queue_question_reduction`, or
   `outcome_only`.
3. Require every caller to retain `outcome_only` for missing, invalid, stale,
   or ambiguous proof.
4. Reject any caller that directly authorizes durable learning.
5. Check server-owned caller and contract paths plus exact guarded-handoff
   fragments without exposing their source content.
6. Report queue proof as active only when an audited live producer supplies an
   evidence-bound envelope through the queue-specific classification call.
7. Require the runtime completion audit to include this component before native
   storage or legacy-removal gates can rely on request-time coverage.

## Implemented Design

`server/src/services/policyRequestTimeTerminalRouteIntegrationAudit.mjs`
exports:

- `buildPolicyRequestTimeTerminalRouteIntegrationAudit`
- `listPolicyRequestTimeTerminalRouteCallers`
- `POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS`
- `POLICY_REQUEST_TIME_PROOF_MODE_IDS`
- `POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS`

It verifies the queue processor calls the queue-specific classification method,
passes only `runtimeQueueQuestionReduction` to request/import admission, and
retains outcome-only fallback. It also verifies the native handoff invokes the
queue producer and native pending route persistence still builds an outcome-only
terminal route record and stops on invalid audit output.

The audit is registered in `policyRuntimeDecisionInventory.mjs` and is executed
inside the request-time component check of `policyRuntimeCompletionAudit.mjs`.

## Security And Outcome

- No terminal route can become a direct durable-learning authorization.
- Missing or invalid proof always has an explicit outcome-only path.
- The audit reads fixed repository-owned paths only and returns no source,
  queue, provider, media, identity, or prompt content.
- The active queue-bound proof has no hidden direct-plan terminal fallback.
- Every test is ES Module-based and covers absent callers, duplicate callers,
  altered caller configuration, missing source handoffs, and unsupported proof
  modes.

## Next Item

Proceed with **Phase 7R.5 request-time learning provenance cutover**. Audit
the remaining request-time event producers, remove obsolete direct-proof
compatibility inputs, and preserve outcome-only handling where no independent
validated evidence chain exists.
