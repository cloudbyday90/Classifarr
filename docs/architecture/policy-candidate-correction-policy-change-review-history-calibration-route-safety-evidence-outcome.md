# Route-Safety Calibration Evidence Outcome

## Status

Implemented on the unreleased branch. No release, tag, version bump, live
policy read, AI/RAG request, provider request, policy write, retry, or routing
action was created.

## Delivered

- A fixed ten-case route-safety corpus under `scripts/fixtures/`.
- A strict ESM contract that permits only declared synthetic controls and a
  coherent bounded expected gate projection.
- A modular synthetic-input builder and aggregate-only offline evaluator that
  call the existing production route-safety resolver rather than duplicating
  its logic.
- One added `verify_route_safety_gates` protocol procedure. The human-only
  packet now requires the admission, fixed-band, and route-safety evaluators
  to pass.
- Focused contract, evaluator, committed-document, and packet tests.

## Evidence Produced

The fixed command reports aggregate pass/fail data only. On the committed
corpus, all 10 of 10 expected outcomes match:

- One current deterministic `policy_auto` result is allowed.
- A 90 score against an 85 automatic threshold is blocked by each individual
  recovery, evidence, AI-advisory, provenance, confirmation, fallback,
  low-confidence, and clarification safeguard.
- In the compound case, provider recovery is the primary explanation, followed
  by AI advisory and installation confirmation. This pins the documented,
  actionable ordering.

The resulting packet remains `human_approval_required`. Passing this matrix
does not authorize a live route or an AI/RAG or policy change.

## Open Pull Request Evaluation

GitHub MCP search on 2026-08-31 found no currently open pull requests for
`cloudbyday90/Classifarr`. Consequently, there was no random open pull request
that could be implemented locally in this change. No closed pull request was
substituted, and no pull request was merged or modified.

## Deliberate Non-Outcomes

- No live current-library, policy, configuration, database, provider, model,
  prompt, response, RAG, or media data enters the fixture or report.
- No endpoint, migration, persistence path, queue, scheduler, workflow action,
  or UI was added.
- No policy threshold, policy decision, approval, learning setting, provider
  capability, or route has been changed.

## Next Item

Build an aggregate, auto-refreshing **Route Safety Readiness** read model for
the AI Settings / diagnostics area. It should show the saved provider state and
bounded counts of the current primary safety-gate categories, with a concise
server-owned explanation and a visible last-refresh status. That is the
highest-value next component because it makes the reason automation is held
observable without sending media to AI, changing a policy, or exposing media,
library, provider, prompt, response, or route identity. The UI should use the
existing persisted gate projection and W3C-conformant status messages rather
than calculate a parallel client-side route decision.
