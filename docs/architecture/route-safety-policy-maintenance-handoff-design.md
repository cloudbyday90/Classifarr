# Route-safety policy-maintenance handoff design

## Context

AI Settings already exposes a safe, fixed-window summary of deterministic
route-safety gates. It tells an administrator that safeguards were observed,
but it deliberately cannot identify a policy, library, item, provider, or
operator. The next useful action is therefore not an automatic policy change;
it is a clear, optional handoff to the existing policy-review surface when a
single policy-owned safeguard has been repeatedly representative.

Research was completed on 2026-08-31 using official sources discovered through
the web MCP service. W3C recommends descriptive link text so people can
understand a destination before following it, and programmatically
determinable, non-disruptive status updates for changes that do not move focus.
NIST AI RMF calls for defined human oversight and ongoing monitoring. OWASP
recommends fixed request limits and server-side bounds for resource-consuming
API reads.

- [W3C G91: descriptive link text](https://www.w3.org/WAI/WCAG22/Techniques/general/G91.html)
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)
- [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)

## Decision

Add a read-only `route-safety-maintenance-handoff` aggregate endpoint and a
small AI Settings card that is absent unless all of the following are true:

1. Two adjacent, completed seven-day UTC windows are available.
2. Each window has at least six retained primary-gate observations.
3. The same allow-listed policy-owned gate is the deterministic top gate in
   both windows.
4. That gate has at least four observations and at least 60% of each window.

The policy-owned allow-list is fixed in source. Provider recovery, AI advisory,
fallback, clarification, and administrative gates are intentionally excluded:
they belong to other operator workflows and must not be redirected as a policy
configuration problem.

When eligible, the card links by the fixed Vue route name `Policies` with the
descriptive action **Review policy configuration**. It does not auto-navigate,
select a policy, prefill edits, or make a recommendation about a specific
policy. A user must still inspect current policy evidence and make an explicit
decision.

## Architecture

```text
classification_history (existing route-safety projection)
  -> static, parameterized two-window aggregate query
  -> pure handoff assessment
  -> admin-only / no-store / rate-limited stats route
  -> client allow-list presentation
  -> optional link to existing Policies view
```

The implementation is split into four server modules: assessment,
repository, service, and route. The browser has a separate fixed-vocabulary
presentation utility and a focused Vue component. No AI/RAG/provider service is
an input or dependency.

## Security and privacy boundaries

- The endpoint has no query parameters and uses only server-built time windows
  plus a fixed gate vocabulary.
- SQL selects a window marker, gate identifier, and aggregate count only. It
  never selects media, library, policy, destination, provider, prompt,
  response, or actor data.
- The route requires existing authentication plus administrator authorization,
  sends `Cache-Control: no-store`, and has a 30-per-15-minute limiter.
- The server emits identifiers and integer counts only. The client independently
  maps a fixed allow-list to fixed copy and drops unknown values.
- The card uses a normal `RouterLink` and announces only a transition between
  no recommendation and review recommended; refresh timestamps are not sent to
  the live region.

## Alternatives

| Option | Benefits | Costs and rejection reason |
| --- | --- | --- |
| Auto-edit policy thresholds | Low operator effort | Unsafe, lacks policy-specific evidence, and would give an aggregate monitor write authority. Rejected. |
| AI/RAG chooses a policy to edit | Can synthesize more context | Probabilistic, can leak inappropriate context, and conflicts with deterministic policy authority. Rejected. |
| Show every gate on every refresh | Maximum visibility | Makes AI Settings noisy and does not give a clear next action. Rejected. |
| Fixed stable-pattern handoff | Bounded, comprehensible, human-controlled, and privacy-preserving | General link is intentionally non-specific; an operator still reviews the policy. Selected. |

## Recommended stack

1. Keep the existing aggregate Route Safety Readiness card as the passive
   monitor.
2. Add this stable-pattern handoff as an optional, read-only path to Policies.
3. For a future iteration, provide a bounded, policy-scoped evidence digest
   only after an operator explicitly opens an individual policy; do not infer a
   target policy from the aggregate signal.
