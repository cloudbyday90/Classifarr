# Confirmed-Outcome Purpose Suggestion Design

Status: implemented on 2026-09-10. Research was checked against the linked
official sources on 2026-09-10 and applies to the requested August 2026
baseline.

## Problem

Classifarr already retained useful learning signals, but the active native
purpose editor could only show the declared rules or a legacy
library-profile-derived draft. The latter is contextual inventory information,
not proof of why a destination exists. Consequently, a policy could not offer a
useful maintenance suggestion after repeated operator choices without making
the administrator visit a dense reconciliation surface or infer the source of a
score.

The previous replay-observation work solved an aggregate source-identity
retention defect. It did not make current declared policy purpose more precise,
did not use outcome learning, and did not alter RAG or AI routing. This design
keeps those concerns separate.

## Decision

Add a small, automatically loaded, read-only suggestion to the existing native
purpose editor.

1. Read the current policy's authoritative native intent and revision.
2. Read at most five active `genre` evidence rows belonging to the same library
   and media type.
3. Accept a row only when it came from the existing
   `policy_authorized_compatibility` writer, identifies the `manual_outcome`
   authority source, and represents at least three confirmations.
4. Remove terms already present in the declared purpose. Project the remaining
   terms as one advisory `genres / require_any / identity` draft rule.
5. Load the read automatically after the current native-purpose read succeeds.
   The compact card is absent when there is no eligible suggestion; it does not
   show a loading spinner or an error panel.
6. Let the administrator use one explicit **Add learned terms to this draft**
   action. The terms are still subject to the existing coverage review,
   revision check, idempotency key, and native-purpose change endpoint.

```text
repeated manual outcomes
  -> bounded existing evidence row
  -> read-only, policy-scoped suggestion
  -> optional review draft addition
  -> existing revision-checked purpose change
  -> passive lifecycle re-audit

No provider call, semantic retrieval, profile read, raw media projection,
automatic policy write, automatic route, or classification retry occurs here.
```

This is deliberate learning from outcomes, not circular learning from a
policy's own successful route. The query rejects profile-derived evidence,
generic `policy_confirmed` genre reinforcement, raw AI output, and raw RAG
material. A suggestion is not authority; it simply shortens the path from
observed confirmed decisions to an owner-reviewed declared purpose.

## Research and design basis

[OWASP's RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
calls for provenance, access control, output validation, bounded retrieval, and
fail-closed behavior. The component therefore selects a fixed, provenance-gated
aggregate source, projects no source rows, performs no provider call, and does
not let the browser turn a suggestion into a route or write.

[NIST AI RMF's Measure playbook](https://airc.nist.gov/airmf-resources/playbook/measure/)
calls for significant-risk metrics and documented test/evaluation methods. The
minimum three-confirmation rule is intentionally a documented, testable
admission metric rather than a model confidence claim. It should be calibrated
against future held-out evaluation, not silently promoted to route authority.

[W3C PROV-DM](https://www.w3.org/TR/prov-dm/) and [W3C Data on the Web Best
Practices](https://www.w3.org/TR/dwbp/) support retaining a clear derivation
while limiting what is disclosed. The response keeps a fixed source identifier
and aggregate confirmation count but omits evidence rows, outcome IDs, media
items, library contents, and actor identity.

[WCAG 2.2](https://www.w3.org/TR/WCAG22/#status-messages) requires status
messages to be programmatically determinable without focus movement, and its
[Change on Request criterion](https://www.w3.org/TR/WCAG22/#change-on-request)
supports keeping a change under an explicit user action. The UI uses a compact
polite status after adding the draft and never changes purpose or routing on
load.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Promote a library profile into native purpose | Immediate, no outcome history needed | Inventory is contextual, can encode previous mistakes, and makes profile data authority | Reject |
| Treat every policy-confirmed genre pattern as proof | More suggestions sooner | Creates a policy self-reinforcement loop | Reject |
| Call AI/RAG to rewrite purpose every time an editor opens | Rich explanations | Cost, nondeterminism, prompt-injection surface, and no measured calibration | Reject |
| Repeated manual-outcome suggestion plus existing explicit purpose change | Uses real outcome learning, bounded and explainable, preserves user intent and current safeguards | Requires three confirmations and may have no suggestion for a new library | Adopt |

## Security and data boundary

- The endpoint is administrator-only, policy-ID validated, and `Cache-Control:
  no-store`.
- SQL parameters bind library ID, media type, source system, authority-source
  marker, threshold, and limit. It reads neither `classification_history` nor
  `media_server_items`.
- Only up to five terms and their aggregate repeated-confirmation total are
  projected. The browser receives no raw evidence key, evidence JSON, outcome,
  actor, title, description, profile, prompt, response, embedding, provider,
  model, or similarity.
- Client validation rejects unexpected contract versions, flags, source IDs,
  command shapes, and side effects. It fails quietly rather than displaying
  untrusted fallback data.
- The read cannot mutate policy, routing, learning, or storage. Any later
  purpose change remains server-authorized, revision-bound, and idempotent.

## Recommendation stack

1. Use this outcome-backed purpose draft for low-friction learning from repeated
   operator decisions.
2. Keep declared purpose—not AI, profiles, or learned evidence—as the routing
   authority.
3. Measure the suggestion's acceptance, correction, and disagreement rates in
   a bounded, privacy-preserving evaluation before changing any threshold.
4. Next, implement a **calibrated semantic library-fingerprint study**: use
   existing text embeddings and descriptions only in a read-only, candidate
   scoped evaluation, compare against independently confirmed outcomes, and
   surface semantic disagreement for review rather than auto-routing.
5. Only after that study shows a conservative error profile, consider
   candidate-bound semantic counter-evidence for ambiguous classification
   review. Keep automatic routing deterministic and fail closed.
