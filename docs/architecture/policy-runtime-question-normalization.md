# Runtime Question Normalization

## Status

Phase 5R.4 is complete. This document defines the server-owned boundary that
turns uncertain runtime classification state into a safe, bounded operator
question.

## Problem

Older paths allowed AI `CLARIFY` text and legacy deterministic prompts to reach
the pending queue unchanged. A schema-valid question could therefore ask an
operator to prioritize a genre, interpret provider output, or make a broad
policy decision. Those are not safe runtime decisions and must not cause
routing or learning.

## Official Research Basis

The June 2026 design baseline uses the following current official guidance:

- [OWASP LLM05: Improper Output Handling](https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/)
  requires generated output to be validated and handled as untrusted data
  before a downstream system uses it.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends allow-list validation for structured inputs.
- [NIST AI RMF Playbook](https://www.nist.gov/itl/ai-risk-management-framework/nist-ai-rmf-playbook)
  and [NIST AI RMF Secure guidance](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  call for documented validation, human oversight, and bounded system
  behavior.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Display AI questions after JSON/schema validation | Minimal code change; retains a detailed explanation | Schema validity does not establish semantic safety; permits prompt-shaped operator decisions and unsafe learning. |
| Rewrite only known bad phrases | Smaller change than a full contract | New unsafe wording bypasses the deny-list; does not prove option IDs came from the server. |
| Server-owned normalization contract | Fixed question frames, server-known destination IDs, bounded metadata, and one fail-closed stale posture | Removes rich model prose and requires retries for legacy persisted questions. |

## Decision

Use the server-owned normalization contract.

`policyRuntimeQuestionNormalizer.mjs` is a pure service boundary. It discards
the source question text and raw AI rationale, derives an allow-listed
uncertainty type from deterministic runtime facts, and rebuilds candidate
destinations from the current server-supplied library list. Each option uses
`library:<id>` with a positive server-known library ID. The normalizer limits a
question to four candidate destinations, which remains within Discord's
component constraints while keeping the operator decision bounded.

At read and resolution time, the version marker alone is insufficient. The
service also validates fixed frame wording, bounded metadata keys, unique
server-ID options, option labels matching their server names, and the four-
destination maximum. A current-version tag around unsafe wording or metadata
therefore remains non-actionable.

The contract version is `policy.runtime_question_normalization.v1`. It emits
only these uncertainty types:

- `missing_identity_evidence`
- `hard_constraint_conflict`
- `weak_overlap`
- `rag_only_support`
- `profile_only_support`
- `language_conflict`
- `routing_gap`
- `stale_profile`
- `manual_selection_needed`
- `contract_violation`

Each normalizer-generated question includes `learning.eligible: false`,
`learning.tier: blocked`, and `requires_learning_guard: true`. This does not
define answer actions; Phase 5R.5 owns the unified UI/Discord answer contract.

The pre-existing native persistence envelope remains valid because it is
already a server-owned, versioned contract.

## Stale Question Cleanup

Persisted questions without the current normalization version are marked stale
with `normalization_required`. Resolution fails closed with
`policy_question_normalization_required`; legacy rule generation and durable
learning cannot run. The pending queue presents retry-only behavior for those
items. A persistence fallback writes a bounded cleanup message rather than
preserving unsafe content when an unnormalized question reaches the durable
boundary directly.

Phase 5R.7 will own the operational dry-run and bulk cleanup tooling. This
phase provides the safety boundary now: no legacy question can be answered or
learned from while it waits for refresh.

## Outcome

- Questions ask about destination fit, an explicit hard limit, routing
  readiness, or profile freshness, never genre priority.
- AI output is a diagnostic signal only. The persisted question contains a
  boolean that such a signal existed, not raw AI text.
- Only current server-known library IDs may appear in newly normalized
  destination options.
- Unnormalized persisted questions are visible as stale and cannot be resolved
  until classification is retried.

## Recommendation Stack

1. Keep model output outside the runtime-question contract and validate at the
   service boundary.
2. Keep destination options server-derived and use immutable IDs rather than
   labels as identifiers.
3. Fail closed on old or malformed persisted questions, with retry as the only
   immediate action.
4. Complete Phase 5R.5 before adding new UI or Discord answer affordances.
