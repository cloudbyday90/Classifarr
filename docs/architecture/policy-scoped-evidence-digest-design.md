# Policy-Scoped Evidence Digest Design

## Status

Implemented on 2026-08-31. This is a read-only policy-maintenance surface; it
does not change routing, policy scoring, learning, RAG retrieval, or AI
provider behavior.

## Problem

The policy-maintenance handoff identified aggregate route-safety conditions,
but it did not give an administrator selected-policy evidence. That made a
maintenance action feel generic: an operator could see that a policy needed
review without seeing whether its declared intent, stored library profile, and
policy-authorized history were present or current.

## Decision

Add an explicitly selected, administrator-only evidence digest at:

```text
GET /api/policies/:id/evidence-digest
```

The Policies view opens the reconciliation page with the policy ID and focuses
the digest. The aggregate purpose-coverage review also offers a per-row
**Review evidence** action. These paths only select a policy and load its
digest; they do not start a scan, invoke an AI provider, or change a policy.

## Returned evidence

The response has a small versioned contract with these categories:

| Category | Returned | Explicitly excluded |
| --- | --- | --- |
| Declared native intent | authority state, purpose-rule count, signal categories | rule values and preset content |
| Observed library profile | capture state, freshness, source ID, timestamps, redaction state | profile payload and fingerprint |
| Policy-authorized history | fixed 90-day count grouped by signal category | media titles, item/classification IDs, evidence keys, actors, and source-event IDs |
| Uncertainty | stable reason IDs | inferred conclusion or automatic remedy |

The history query is constrained by the requested policy ID, the policy's
current library ID, and a fixed 90-day start time. It has at most four signal
categories in the response. An unavailable or stale source is reported as
uncertainty, not silently treated as positive evidence.

## Security boundary

The API is protected by the existing policy-router authentication and an
explicit in-route administrator check. A validated positive integer is the
only accepted policy identifier, missing policies return 404, and the response
has `Cache-Control: no-store`.

The contract whitelists fields rather than serializing database rows. This
keeps information exposure minimal and prevents profile payloads, raw media,
rule configuration, fingerprints, and model text from becoming part of a new
API surface. The design follows OWASP's guidance to apply authorization for
each object ID and to return only explicitly chosen properties.

## Accessibility and interaction

Selecting a policy automatically loads the digest. It does not redirect,
mutate a control, or open a modal. A deliberate `focus=evidence-digest` handoff
sets focus on a labelled section after its data is ready. Loading uses a polite
status message so assistive technology receives the state change without an
unnecessary interruption.

## Alternatives considered

| Option | Pros | Cons |
| --- | --- | --- |
| Aggregate evidence card only | Smallest UI change | Cannot explain an individual policy; encourages unsupported inference |
| Full raw policy/profile/history viewer | Maximum detail | Exposes unnecessary media/configuration data and weakens the evidence boundary |
| AI/RAG-generated explanation | Natural-language summary | Probabilistic, can overstate certainty, and risks influencing routing |
| Selected-policy metadata digest | Bounded, auditable, secure, and actionable | Does not answer semantic questions by itself |

## Recommendation stack

1. Keep deterministic policy evidence and routing as the authority.
2. Use this selected-policy digest before editing a policy.
3. Keep AI/RAG advisory and candidate-bound; present any future result as a
   separate source with its uncertainty and no authority to route.
4. Add candidate-level evidence explanation next, only after it can preserve
   the same scoped, redacted contract.

## Sources

- [W3C WCAG 2.2: Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [W3C WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/)
- [OWASP API1:2023 — Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [OWASP API3:2023 — Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
- [NIST AI Risk Management Framework 1.0](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf)

These sources were checked on 2026-08-31. The W3C material supports concise,
programmatically exposed status updates without taking focus; OWASP supports
per-object authorization and explicit response shaping; NIST supports clear
human/AI responsibility boundaries and oversight.
