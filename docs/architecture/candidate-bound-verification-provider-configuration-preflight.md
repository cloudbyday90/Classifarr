# Candidate-Bound Verification Provider Configuration Preflight

## Status

11R.6 was completed on 2026-08-13 as an administrator-only, save-time
preflight for a proposed AI provider configuration. Its server-side,
privacy-bounded capability projection remains available for diagnostics, but
its former client-side confirmation gate was superseded on 2026-08-29 by the
[one-step save-and-auto-test design](ollama-verification-save-and-auto-test-design.md).

It is not a provider health check, model-discovery request, policy action,
configuration command, or routing decision. It never calls an AI provider,
tests availability, persists settings, changes fallback selection, or exposes
provider, model, endpoint, credential, prompt, or model-output data.

## Problem

Strict candidate-bound verification is intentionally narrower than ordinary AI
classification assistance. It requires a server-enforced structured-output
provider and the runtime `verification` authority mode. Administrators need to
know when a proposed provider or budget-exhaustion fallback cannot meet that
contract before saving settings, without turning a warning into a hidden
provider rewrite or preventing valid general AI configuration.

## Official Research Basis

This design was reviewed against official guidance available in August 2026:

- OWASP recommends validating untrusted input as early as possible and on the
  server. The endpoint accepts only the five non-secret fields that affect this
  capability decision and derives every status server-side. [OWASP Input
  Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- OWASP REST guidance recommends strict request validation and constrained
  inputs. The endpoint rejects keys unrelated to the capability calculation,
  including API keys and endpoints, and rejects wrong JSON value types. [OWASP REST Security Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- OWASP secret-management guidance emphasizes minimizing secret exposure. The
  preflight reads only a minimal non-secret stored projection and returns fixed
  statuses and guidance rather than configuration values. [OWASP Secrets
  Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- Provider-structured-output documentation supports treating enforcement as a
  provider capability, not a browser assertion. Classifarr continues to admit
  strict verification only through the existing authority and candidate-bound
  contracts. [OpenAI Structured
  Outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/),
  [Gemini Structured Output](https://ai.google.dev/gemini-api/docs/structured-output)

## Decision

Add `POST /api/settings/ai/verification-preflight`. Existing authentication and
administrator authorization on `/api/settings` apply before the route runs.
The browser submits only this allowlisted proposal:

```json
{
  "primary_provider": "...",
  "model": "...",
  "ollama_fallback_enabled": false,
  "ollama_for_budget_exhausted": true,
  "ollama_model": "..."
}
```

The service merges a partial proposal with the same five fields from the
current stored configuration. It then builds primary and budget-fallback
authority profiles with the existing `aiProviderAuthority` contract and passes
them through `resolveCandidateBoundVerificationAdmission`. No router is
invoked because normal router selection can inspect current budget state and
emit operational log events; a configuration preflight must remain pure.

The public response contains only:

- versioned fixed `statusId`, label, message, and guidance;
- whether explicit continuation is required;
- anonymous primary and budget-fallback capability statuses; and
- explicit false side-effect flags.

Responses use `Cache-Control: no-store`. They contain neither the submitted
values nor the persisted values.

The former AI Settings advisory gate is no longer used. A valid configuration
save is one administrator action; when its primary Ollama target changes, the
existing saved-configuration test follows automatically and its server-owned
result remains fail-closed for strict verification. This removes an
unnecessary second confirmation while retaining the preflight's bounded,
diagnostic-only server behavior for callers that need it.

## Status Model

The overall status is one of:

- `verification_ready`
- `primary_path_ineligible`
- `budget_fallback_advisory`
- `primary_and_fallback_ineligible`

The primary path is reduced to `verification_capable`, `not_configured`, or
`capability_unavailable`. The budget fallback is reduced to `advisory_only` or
`not_applicable`. These labels are capability facts, not provider identities or
runtime health claims.

## Alternatives

### Browser-Only Capability Inference

Pros: no server endpoint.

Cons: bypassable, duplicates provider rules, and drifts from runtime
admission.

Decision: rejected.

### Probe the Provider During Save

Pros: may show current connectivity.

Cons: incurs provider calls, can disclose operational failure details, is
rate- and outage-sensitive, and does not establish structured-output authority.

Decision: rejected. Existing explicit Test Connection and model-discovery
actions remain separate.

### Silently Replace the Provider or Fallback

Pros: could make strict verification available without an extra operator step.

Cons: changes cost, routing, model, and authority semantics without an
administrator decision.

Decision: rejected.

### Block Every General AI Save

Pros: prevents configuration that cannot support strict verification.

Cons: ordinary AI assistance is valid outside the strict verification path and
should remain an administrator choice.

Decision: rejected. The warning requires explicit continuation but does not
make strict-verification capability a global configuration prerequisite.

## Final Recommendation Stack

1. Keep strict-verification admission server-owned and reuse the runtime
   authority and candidate-bound contracts.
2. Accept and query only the minimum non-secret configuration fields.
3. Return fixed, no-store capability facts and guidance without provider probes
   or provider/model identity.
4. Preserve general AI configuration authority and use a single save action;
   auto-test only the resulting saved primary Ollama target.
5. Never render raw transport errors.
6. Keep provider testing, model discovery, budget handling, policy mutation,
   and routing as separate explicit operations.

## Implementation Evidence

- Pure authority/admission projection:
  `server/src/services/classificationCandidateBoundVerificationProviderPreflight.mjs`.
- Minimum stored configuration reader:
  `server/src/services/classificationCandidateBoundVerificationProviderPreflightRepository.mjs`.
- Read-only orchestration service:
  `server/src/services/classificationCandidateBoundVerificationProviderPreflightService.mjs`.
- Administrator-protected settings endpoint and strict key allowlist:
  `server/src/routes/helpers/aiSettingsHandlers.mjs` and
  `server/src/routes/helpers/aiSettingsHelpers.mjs`.
- Server diagnostic endpoint and strict key allowlist:
  `server/src/routes/helpers/aiSettingsHandlers.mjs` and
  `server/src/routes/helpers/aiSettingsHelpers.mjs`.
- One-step client save and authoritative saved-target test:
  `client/src/views/settings/AI.vue`.
- Focused service, settings-route, API-layer, and UI tests prove privacy
  bounds, one-step persistence, and authoritative post-save test behavior.

## Next Task

**11R.7 Verification Capability Current-State Summary** is complete. It
reuses this privacy-bounded status contract to show saved strict-verification
capability in AI Settings, supports bounded freshness after a settings save or
explicit refresh, and links operators to aggregate Verification monitoring
without introducing a provider probe, browser-owned decision, or second save
path.
