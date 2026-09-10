# Library Purpose Bootstrap Design

Status: implemented, unreleased. Research was checked on 10 September 2026
against primary sources that were available by August 2026.

## Problem

Classifarr already has a safe, revision-checked native-purpose writer. Its
default profile-derived path, however, opens a dense editor with five controls
per rule. That presentation blurs a critical distinction: terms observed in a
library may be useful suggestions, but they do not define the library's intent.

The local Compose audit found active policies whose purpose rules were all
profile-derived. For example, a library named `Comedy and Standup` could show
documentary and drama terms because its contents contain them. Treating that
observation as the library's purpose creates circular policy evidence and makes
AI/RAG comparisons less precise.

## Selected design

The change adds a compact, client-side bootstrap over the established native
purpose writer. It appears only when all stored profile-derived rules can be
represented safely as advisory identity rules for genres, keywords, or studios.

```text
server-owned current purpose command
  -> compact observed-term suggestions
  -> operator selects terms that define the library
  -> existing revision-checked purpose command
  -> server validation, idempotency, transaction, durable revision
  -> passive re-audit of aggregate readiness

advanced or unsupported rules
  -> existing detailed native-purpose editor unchanged
```

`policyNativeIntentPurposeBootstrap.js` owns pure transformation and selection
logic. `PolicyNativeIntentPurposeBootstrap.vue` owns accessible presentation.
The existing `PolicyNativeIntentPurposeChangeSurface.vue` remains the sole
orchestrator of loading, preflight, save, stale-revision recovery, and feedback.

The bootstrap is deliberately unavailable for exclusions, strict constraints,
compatibility semantics, media-type rules, or malformed commands. Those cases
continue through the advanced editor; the compact surface never weakens or
reinterprets a rule.

## Interaction model

1. The administrator opens **Set library purpose** for a profile-derived
   policy.
2. Classifarr presents observed terms as toggleable suggestions and plainly
   states that they are not semantic proof or declared policy by themselves.
3. The administrator keeps only terms that truly define the destination and
   may add a bounded term to an existing signal group.
4. **Save library purpose** creates one reversible native revision through the
   existing server-authorized command. It does not route media, change AI/RAG
   settings, or alter learning.
5. **Edit advanced rules** reveals the existing complete editor when the simple
   identity-purpose representation is insufficient.

The visible choices and single save action are the review and confirmation for
a reversible policy revision. There is no separate acknowledgement checkbox or
second approval step.

## Security boundaries

- The browser only edits a local typed draft; the server continues to validate
  the command, current revision, authority, idempotency key, and transaction.
- Profile observations remain suggestions until a successful native revision is
  recorded. Selecting all suggested terms does not bypass any server check.
- The bootstrap exposes no AI prompt, retrieval result, embedding, history,
  policy fingerprint, receipt identifier, or routing decision.
- It cannot initiate provider access, RAG retrieval, learning, cohort capture,
  or a media move.
- Unsupported rule shapes are not flattened into simple terms, preventing an
  accidental loss of exclusions or strict constraints.

## Accessibility and usability basis

[W3C's Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/) recommends
short forms, visible labels, grouped related controls, clear instructions, and
feedback. The bootstrap uses a fieldset and legend for each signal group,
visible input labels, and a concise explanation before controls.

[W3C's form-validation guidance](https://www.w3.org/WAI/tutorials/forms/validation/)
notes that client validation improves usability but cannot provide security;
server validation remains necessary. Local term parsing only improves feedback;
the established server writer remains authoritative.

[W3C's Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
supports hiding detail until it is needed. Advanced controls and explanatory
detail are therefore progressive disclosure, while the primary purpose decision
remains visible.

[NIST AI RMF 1.0](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10)
calls for clear roles and responsibilities in human-AI configurations. The
operator declares collection intent; deterministic policy logic owns routing;
AI/RAG remains advisory and bounded.

[OWASP LLM08:2025](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
describes data-leakage, poisoning, and retrieval-integrity risks in RAG systems.
The bootstrap creates a minimal, owner-reviewed policy baseline without
expanding what can be retrieved or granting a model any write authority.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep the five-control rule editor as the only path | No implementation work | Makes basic library intent hard to understand and encourages accidental acceptance of profile terms | Reject |
| Automatically promote all profile terms to declared purpose | Fastest path to readiness | Converts past placements into policy authority and amplifies bad classifications | Reject |
| Let AI write a free-text library description | Conversational | Not deterministic, not directly evaluable, and creates prompt/retrieval trust issues | Reject |
| Compact identity-term bootstrap over the existing writer | Clear intent, preserves safe writes, supports a real RAG baseline | Does not simplify genuinely advanced policy cases | Adopt |

## Recommendation stack

1. Make owner-reviewed declared purpose the source of truth for what belongs in
   a collection.
2. Treat profiles, library names, historical placements, and RAG results as
   evidence or suggestions—not policy authority.
3. Use the compact bootstrap for ordinary identity purposes; keep advanced
   rules in progressive disclosure.
4. Preserve revision checks, idempotency, server validation, and audit receipts
   for every policy change.
5. Use future declared-purpose revisions as a high-quality, bounded input to
   semantic evaluation, while retaining deterministic routing safeguards.

## Non-goals

This work does not enable automatic policy writes, automatic routing, provider
calls, RAG retrieval, corpus capture, learning changes, migrations, or a
release. It does not claim that current library contents or any selected term
is independently semantic proof.
