# Policy Builder Intent Model Roadmap

Status: active roadmap. Phase 0, the first Phase 1 state extraction slice, Phase 5 read-only intent contract, and the runtime clarification alignment plan are tracked for the next release line.

## Goal

Move Classifarr from a preset-centric policy builder to an intent-centric policy builder without making the platform feel like an expert-system editor.

The user-facing model should be:

```text
Tell Classifarr what belongs here, what must not go here, and what evidence helps.
```

The technical model can remain more detailed internally:

```text
identity signals + compatibility signals + strict constraints + boosters + exclusions
```

## Current Problem

Presets are currently doing two jobs:

1. They act as reusable starter shortcuts.
2. They also carry hidden policy logic through bundled signals.

That muddles the policy builder because users are asked to reason about presets, custom signal overrides, runtime behavior, weights, and scoring all at once.

The better product model is:

```text
Libraries have policy intent.
Presets help draft that intent.
```

## Design Principle

Presets should become starter templates, not the primary policy object.

Current:

```text
Library Policy -> selected presets -> hidden/custom signals -> scoring behavior
```

Target:

```text
Library Policy -> purpose + hard limits + helpful hints + review behavior
              -> optionally seeded by starter templates
```

## Compatibility Contract

Existing preset-backed policies must continue to work.

In this document, **legacy presets** means existing `content_presets` and `policy_presets` records that already define policy behavior through bundled `signals` plus optional policy-specific `customSignals`.

The compatibility rules are:

- Opening an existing policy must not rewrite it.
- Saving unrelated fields such as name, thresholds, weights, or enabled state must preserve preset attachments and `customSignals`.
- Intent edits may serialize into `customSignals`, but they must not silently remove preset attachments.
- Removing a starter template in the UI is the only action that should remove the underlying preset attachment.
- Existing backup/restore behavior must remain valid until a later explicit storage migration exists.
- The server remains the validation authority for signal semantics, strict/advisory behavior, and unsupported aliases.

## Legacy Preset Bridge

The next architecture step should be a bridge, not a replacement.

```text
legacy presets + customSignals + configuration_view
        ↓
policy intent draft
        ↓
intent-first UI
        ↓
legacy-compatible save payload
```

This bridge lets the UI become intent-centric while storage and scoring remain compatible.

The draft should record provenance:

```js
{
  source: 'legacy_presets',
  migration_state: 'inferred',
  purpose: [],
  hard_limits: [],
  helpful_hints: [],
  avoid: [],
  review_behavior: {},
  template_links: []
}
```

Suggested source states:

- `legacy_presets`: intent inferred from existing preset attachments.
- `intent_draft`: intent edited directly in the builder but saved through compatibility payloads.
- `mixed`: policy has both inferred legacy preset behavior and direct intent edits.
- `native_intent`: future state after explicit storage migration.
- `unknown`: policy contains unsupported or ambiguous signal shapes.

Suggested inference states:

- `exact`: the signal maps cleanly to one intent role.
- `inferred`: the signal maps to intent but came from legacy preset semantics.
- `partial`: only some signals could be represented clearly.
- `ambiguous`: the signal could fit more than one product concept.

Important rule:

```text
Do not automatically convert legacy presets into native intent storage on read or ordinary save.
```

Explicit conversion can come later after preview/replay tooling proves behavior is stable.

## User-Facing Concepts

Use plain language first:

- **What belongs here?**
  - Internal role: identity signals.
  - Examples: Family, Anime, Stand-up, Documentary.

- **What should never go here?**
  - Internal role: strict constraints and hard exclusions.
  - Examples: max PG-13 for Family, exclude R and NC-17.

- **What helps but should not decide alone?**
  - Internal role: compatibility signals and boosters.
  - Examples: Comedy can help Family slightly, but does not define Family.

- **When should Classifarr ask?**
  - Internal role: thresholds, weak-evidence prompts, policy conflict prompts.
  - Examples: only RAG supports this destination, rating conflicts with Family.

## Refactor Plan

`PolicyBuilderModal.vue` currently owns too many responsibilities:

- library loading,
- preset/template loading,
- suggestion loading,
- migration notice loading,
- selected preset state,
- custom signal mutation,
- intent editing,
- advanced scoring fields,
- save payload construction,
- validation state,
- large sections of presentation markup.

Before expanding policy behavior, split the builder into smaller units.

Target structure:

```text
PolicyBuilderModal.vue
  Orchestrates modal layout, save/cancel, and high-level sections.

composables/usePolicyBuilderState.js
  Owns form state, loading, selected templates, notices, validation, and save payload.

composables/usePolicyIntentDraft.js
  Converts legacy presets/configuration_view/customSignals into intent draft.
  Converts intent draft back into legacy-compatible preset/customSignals payloads.

components/policies/PolicyIntentSummary.vue
  Shows purpose, hard limits, hints, avoid rules, review behavior, and warnings.

components/policies/PolicyIntentEditor.vue
  Edits the intent draft.

components/policies/PolicyTemplatePicker.vue
  Searches and applies starter templates.

components/policies/AppliedTemplateList.vue
  Shows starter-template provenance and advanced template details.
```

Refactor rule:

```text
Extract behavior without changing policy save semantics first.
```

This keeps later UX changes safer.

## Phase 0: Stabilize Current Additive UI

Intent: make the current intent editor less technical while preserving behavior.

Changes:

- Keep the current intent editor as an additive layer.
- Rename technical labels to plain-language labels.
- Avoid adding more signal controls until the state model is extracted.
- Add tests proving existing preset-backed policies save without shape loss.

Why this fits next:

- It protects current users while the design is still evolving.
- It prevents the large modal from becoming more complex before refactoring.

## Phase 1: Extract Policy Builder State

Intent: reduce modal complexity without changing user behavior.

Implementation status: first deterministic state slice implemented in `client/src/composables/usePolicyBuilderState.js`.

Changes:

- Create `client/src/composables/usePolicyBuilderState.js`.
- Move form defaults, selected template state, custom signal mutation, intent signal mutation, validation state, and save payload construction out of `PolicyBuilderModal.vue`.
- Keep library loading, preset loading, suggestions, and migration notices in `PolicyBuilderModal.vue` until a later side-effect extraction pass.
- Keep API payload shape unchanged.
- Preserve current tests, then add composable tests for save payload construction and legacy preset round-trips.

Why this fits next:

- Creates a safer foundation for intent-specific behavior.
- Makes future changes testable without mounting the full modal.
- Reduces risk of regressions in policy save behavior.

## Phase 2: Introduce Intent Draft Bridge

Intent: stop making the UI manipulate raw `customSignals` directly.

Changes:

- Create `client/src/composables/usePolicyIntentDraft.js`.
- Build draft state from:
  - policy `configuration_view` when present,
  - existing preset attachments,
  - preset base `signals`,
  - policy-specific `customSignals`.
- Record source and inference metadata:
  - `source`,
  - `migration_state`,
  - `template_links`,
  - warnings for ambiguous or partial inference.
- Convert draft edits back to legacy-compatible `customSignals` on save.

Why this fits next:

- Gives the UI a clean product model.
- Keeps legacy presets intact.
- Avoids premature database migration.
- Makes interpretation and round-trip behavior independently testable.

## Phase 3: Clarify Existing UI

Intent: reduce confusion without changing storage or scoring.

Changes:

- Rename `Selected Presets` to `Applied Starter Templates`.
- Rename `Customize` to `Advanced Template Details`.
- Make the intent editor visually primary.
- Move old per-preset signal customization behind an advanced disclosure.
- Rename visible sections:
  - `Identity Signals` -> `What belongs here`
  - `Strict Constraints` -> `Hard limits`
  - `Boosters` -> `Helpful hints`
  - `Compatibility Signals` -> `Soft matches`
  - `Exclusions` -> `Avoid or down-rank`

Why this fits next:

- Low risk.
- No API or database change.
- Makes the current implementation easier to understand immediately.

## Phase 4: Add Intent Summary And Warnings

Intent: users should see policy behavior, not preset mechanics.

Changes:

- Add an intent summary card near the top of the builder:
  - Purpose
  - Hard limits
  - Helpful hints
  - Review triggers
- Show starter template provenance:
  - `Seeded from Family template`
  - `Modified from Comedy template`
- Add warnings:
  - `This policy has no hard rating limit.`
  - `This policy relies only on soft matches.`
  - `Generic Comedy is a hint, not a destination rule.`

Why this fits next:

- Helps diagnose weak or ambiguous policies before classification.
- Supports the recent Family, Comedy, and RAG failure modes.
- Keeps the UI focused on decisions users understand.

## Phase 5: Add Server-Side Intent Schema

Intent: make the intent model authoritative on the server, not only a UI projection.

Candidate files:

- `server/src/services/policyIntentContract.mjs`
- `server/src/services/policyIntentSchema.mjs`
- `server/src/services/policyIntentMapper.mjs`

Initial implementation:

- `policyIntentContract.mjs` derives a read-only `policy_intent_contract` from legacy preset-backed policies.
- The contract is attached to policy read/create/update responses.
- No database migration is required.
- Unsupported legacy preset signals produce warnings and `partial` inference instead of breaking policy loading.

Validation rules:

- Purpose can only use identity-capable fields.
- Hard limits must map to strict constraints.
- Helpful hints cannot become strict.
- Avoid rules must clearly identify advisory versus strict behavior.
- Unknown operators should be rejected or normalized before persistence.

Why this fits next:

- Prevents client/server semantic drift.
- Keeps validation centralized.
- Prepares the platform for eventual storage modernization.

## Phase 5B: Align Runtime Clarification With Policy Intent

Intent: make classification-time questions follow the same intent model as policy authoring.

Recent runtime failures show that the platform can still ask operators vague genre-priority questions even though policy authoring now distinguishes:

- identity evidence,
- compatibility evidence,
- hard constraints,
- helpful hints,
- exclusions.

Bad runtime frame:

```text
Genre conflict -> Which genre should be prioritized?
```

Better runtime frame:

```text
Library intent conflict -> Does this item actually satisfy the identity and constraints for this destination?
```

Examples:

- `Comedy` and `Romance` are broad compatibility evidence. They should not decide whether a movie belongs in `Animated Movies`.
- `Action` and `Sci-Fi` can support a general `Movies` library, but they should not compete against animation identity evidence unless animation evidence exists.
- `R`, `TV-MA`, or other maturity ratings are hard-limit evidence only when a policy defines them as constraints; they are not library identity by themselves.

Official source research, June 2026:

- [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf) frames transparent human-AI interaction as necessary when an AI output can lead to a consequential or adverse outcome. Classifarr should explain why an item needs operator input and what the operator choice affects.
- [NIST AI RMF Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) extends the AI RMF for generative AI risk management. The runtime clarification path should treat generated text as risk-bearing output that needs deterministic policy controls.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) identifies prompt injection and insecure/improper output handling as core LLM application risks. AI-authored clarification text should not be trusted as the final downstream command or learning instruction.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) recommends allow-list validation for structured inputs. Clarification output should be reduced to known uncertainty types, known library options, bounded reasons, and explicit learning eligibility.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) recommends strong types, fixed ranges, constrained strings, and rejecting unexpected content. The policy question contract should reject unexpected operators, free-form command-like output, and unknown learning categories.
- [NCSC Guidelines for Secure AI System Development](https://www.ncsc.gov.uk/collection/guidelines-secure-ai-system-development) recommend secure-by-design AI systems that function as intended, remain available, and avoid unintended data exposure. The normalizer should be fail-closed, observable, and free of secrets, prompts, embeddings, and raw provider payloads.
- [NCSC Prompt Injection Is Not SQL Injection](https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection) argues that LLMs should be treated as inherently confusable deputies. Classifarr should minimize the authority of AI clarification text instead of relying on prompt wording to make it safe.
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) describes constraining model responses to JSON Schema. Structured output is useful for shape validation, but Classifarr still needs semantic validation because a schema-valid question can still be the wrong question.

Design conclusion:

```text
Prompt contract -> parser shape validation -> runtime clarification normalizer -> deterministic policy question -> gated learning
```

The normalizer is the semantic trust boundary between model output and product behavior. It should not depend on a single prompt instruction being followed.

Changes:

- Treat AI clarification text as diagnostic input, not the final operator question.
- Add a deterministic clarification intent normalizer that rewrites or rejects vague AI-generated questions such as:
  - `Genre conflict`
  - `Which genre should be prioritized?`
  - `Which genre is most prominent?`
  - genre-vs-genre questions that do not explain library intent.
- In policy-driven classification paths, use AI in verification mode when deterministic policy scoring already selected a candidate.
- Keep the server as the authority for final `policy_question` shape:
  - problem summary,
  - why the destination is uncertain,
  - library options,
  - learning eligibility,
  - question anchor metadata.
- Use an allow-listed uncertainty taxonomy:
  - `missing_identity_evidence`
  - `hard_constraint_conflict`
  - `weak_overlap`
  - `rag_only_support`
  - `profile_only_support`
  - `language_conflict`
  - `ai_disagreement`
  - `contract_violation`
  - `manual_selection_needed`
- Classify broad genre conflict as `weak_overlap` or `missing_identity_evidence`, not as a durable genre-priority decision.
- Add `learning` metadata to policy questions:

```js
{
  learning: {
    eligible: false,
    reason: 'broad_genre_ambiguity',
    allowed_types: []
  }
}
```

- Gate policy-question resolution so broad genre ambiguity records an outcome but does not reinforce durable genre patterns.
- Preserve durable learning for stable evidence:
  - exact title/TMDB resolution,
  - animation identity evidence,
  - stand-up identity evidence,
  - anime identity evidence,
  - explicit hard constraints such as rating exclusions.
- Add a one-time stale-question cleanup path for existing pending items whose generated question uses obsolete genre-priority wording and lacks learning metadata.

Runtime clarification normalizer design:

Candidate file:

- `server/src/services/runtimeClarificationNormalizer.mjs`

Inputs:

```js
{
  metadata,
  aiClarification,
  policyResult,
  signalContext,
  libraries,
  ragContext,
  source: 'ai_clarify' | 'policy_builder' | 'contract_violation'
}
```

Output:

```js
{
  accepted: true,
  normalized_question: {
    type: 'policy',
    problem_summary,
    why_uncertain,
    question,
    options,
    meta: {
      uncertainty_type,
      ai_problem_summary,
      ai_why_uncertain,
      ai_question,
      normalized_from_ai: true,
      normalization_reason,
      primary_candidate_library_id,
      question_anchor_library_id,
      tags,
      learning: {
        eligible,
        reason,
        allowed_types
      }
    }
  }
}
```

Rejection/fallback output:

```js
{
  accepted: false,
  reason: 'vague_genre_priority' | 'unknown_library_option' | 'unsafe_output' | 'unsupported_uncertainty',
  fallback: 'deterministic_policy_question'
}
```

Normalizer rules:

- Preserve AI evidence text only as metadata, not as the final question.
- Prefer deterministic policy candidates and library names over AI phrasing.
- If the AI question asks about genre priority, rewrite to a library-fit question.
- If a specialized library lacks identity evidence, state that directly:
  - `No animation identity evidence was found for Animated Movies.`
  - `Comedy/Romance are compatibility signals only.`
- If a hard constraint conflicts, make the constraint explicit:
  - `R rating conflicts with Family hard limits.`
- If only weak overlap or profile-only support exists, default `learning.eligible = false`.
- If exact identity evidence exists, allow bounded learning types:
  - `exact_title`
  - `identity_genre`
  - `identity_keyword`
  - `hard_constraint`
- Never allow AI text to create new learning types, new operators, SQL fragments, routes, file paths, URLs, mentions, or provider commands.
- Normalize question and reason text to bounded lengths before persistence.
- Store a machine-readable `normalization_reason` for audit and tests.

Refactor plan:

1. Add `runtimeClarificationNormalizer.mjs` as a pure service with injected dependencies for metadata normalization and candidate inspection.
2. Call it from `aiResponseParser` for parsed `CLARIFY` outputs before returning `policy_question`.
3. Call it from `aiResponseParserResults` for verify disagreement and contract-violation clarification payloads.
4. Update `classificationRoutingServiceShared.ensureDecisionQuestion` so existing AI questions can be replaced when the normalizer marks them unsafe or vague.
5. Update `policyQuestionBuilderUtils.buildQuestionPayload` to support optional `meta.learning` and `meta.uncertainty_type`.
6. Update `clarificationPolicyResolution` so durable rule generation checks `policy_question.meta.learning.eligible`.
7. Add post-upgrade stale-question cleanup for older persisted genre-priority questions.

Pros:

- Keeps AI useful for spotting semantic concerns.
- Prevents prompt wording from becoming the trust boundary.
- Produces clearer operator questions.
- Gives learning a deterministic safety gate.
- Makes stale/bad questions identifiable and repairable.

Cons:

- Adds another runtime service in the classification path.
- Some AI nuance will be discarded when it does not map to the taxonomy.
- Requires careful tests so normalizer rewrites do not hide legitimate uncertainty.
- Existing pending questions still need cleanup or retry before operators see better wording.

Policy path AI verification model:

The policy path currently has a role mismatch risk: deterministic policy scoring can produce a ranked candidate and signal context, but AI may still be asked to run in classification mode. That lets AI behave like a second classifier instead of a bounded verifier.

Target model:

```text
Policy engine -> ranked candidate + evidence contract
             -> AI verifier, if enabled and useful
             -> verifier outcome
             -> deterministic adoption/question logic
```

AI verifier responsibilities:

- Confirm that the deterministic candidate is semantically plausible.
- Identify specific missing identity evidence or hard-constraint conflicts.
- Report whether the candidate needs operator review.
- Return only allow-listed verifier outcomes.

AI verifier non-responsibilities:

- It should not select a different final library directly.
- It should not author the final operator-facing question directly.
- It should not create durable learning instructions.
- It should not create new policy signals, operators, exclusions, templates, or routes.
- It should not turn broad genres into identity evidence.

Recommended verifier outcome contract:

```js
{
  decision: 'CONFIRM' | 'REVIEW',
  candidate_library_id: 14,
  confidence_fit: 'strong' | 'partial' | 'weak',
  uncertainty_type: 'missing_identity_evidence' | 'hard_constraint_conflict' | 'weak_overlap' | 'language_conflict' | 'ai_disagreement',
  evidence_summary: 'Animation identity evidence is missing.',
  review_recommended: true,
  alternative_library_ids: [15]
}
```

Shape validation should reject unknown enum values, unknown library IDs, overlong text, unexpected object keys, and missing candidate IDs. Semantic validation should then verify that `candidate_library_id` matches the deterministic policy candidate and that alternatives are drawn from the ranked policy/library set.

Decision mapping:

- `CONFIRM` + deterministic score above route threshold + no hard conflict:
  - keep deterministic route candidate,
  - do not create a pending question.
- `CONFIRM` + deterministic score below route threshold:
  - use deterministic `policyQuestionBuilder` to ask for confirmation.
- `REVIEW` + known uncertainty type:
  - pass verifier diagnostics to `runtimeClarificationNormalizer`,
  - generate deterministic operator question.
- malformed, unsupported, or unsafe verifier output:
  - ignore AI diagnostic text,
  - fall back to deterministic policy question or signal-calculation result,
  - record parse diagnostics.

Implementation slices:

1. Change `classificationPolicyPathService` to call AI with verification semantics when `policySignalContext.suggestedLibrary` exists.
2. Add a verifier-specific parse path or extend the existing parser with a bounded `REVIEW` result that does not become a final `policy_question`.
3. Feed `REVIEW` diagnostics into `runtimeClarificationNormalizer`.
4. Keep the RAG second-pass verifier behavior aligned with the same contract.
5. Add metrics for:
   - AI confirmed deterministic candidate,
   - AI requested review,
   - AI verifier output rejected,
   - deterministic fallback used.

Pros:

- Keeps policy engine as the primary decision authority.
- Uses AI where it is strongest: semantic plausibility checks and natural-language evidence summaries.
- Reduces excessive model agency.
- Makes AI disagreement auditable without letting it rewrite policy behavior.
- Gives operators clearer review prompts without trusting free-form AI text.

Cons:

- Requires parser and prompt changes.
- Some current classify-mode AI behavior may become less influential.
- Needs migration/cleanup for old pending questions generated under classify-mode semantics.
- Requires careful threshold handling so AI confirmation does not route weak deterministic candidates too aggressively.

Security and reliability boundaries:

- AI verifier output is advisory until normalized and validated.
- Deterministic policy evidence remains the source of truth for candidate ordering.
- The verifier receives only bounded classification context; no secrets, API keys, raw provider payloads, embeddings, or operator mention targets.
- The verifier cannot trigger routing, learning, notifications, web search, file operations, or database writes directly.
- All verifier decisions should be represented in decision trace context for audit.

Policy question learning eligibility:

Manual resolution is not the same thing as policy learning. An operator may resolve an item because the item belongs somewhere, but that does not mean the evidence that led to the question is reusable as a durable policy rule.

Current risk:

```text
Operator resolves vague question -> genre patterns reinforced -> broad genre becomes accidental routing rule
```

Target model:

```text
Every resolution records outcome.
Only eligible evidence creates durable learning.
```

Official source research, June 2026:

- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) frames AI risk management as an ongoing govern/map/measure/manage process. Classification feedback should be governed and measured, not blindly converted into new behavior.
- [NIST AI RMF Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) highlights provenance and feedback as useful for risk management when context and origin are preserved. Policy-question learning should store why feedback was eligible or ineligible.
- [NIST AI RMF Playbook](https://airc.nist.gov/airmf-resources/playbook/) provides suggested actions for operationalizing AI risk management. Classifarr should make learning decisions inspectable and testable rather than hidden side effects of manual resolution.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) identifies data/training poisoning and insecure output handling as LLM application risks. User or AI-generated feedback should be validated before it influences future decisions.
- [OWASP Machine Learning Security Top 10: Data Poisoning](https://owasp.org/www-project-machine-learning-security-top-10/docs/ML02_2023-Data_Poisoning_Attack) describes manipulated training data causing undesirable model behavior. Classifarr's learned patterns and policy reinforcements are not model training, but they are still feedback data that changes future classification behavior.
- [W3C PROV Overview](https://www.w3.org/TR/prov-overview/) defines provenance as information about entities, activities, and people involved in producing data, useful for assessing quality, reliability, and trustworthiness. Policy learning should record source, actor, question type, evidence class, and decision path.
- [Open Policy Agent documentation](https://openpolicyagent.org/docs) notes that policy decisions can return arbitrary structured data. Classifarr should express learning eligibility as structured policy-question metadata, not as implicit behavior in resolution code.
- [NCSC Guidelines for Secure AI System Development](https://www.ncsc.gov.uk/collection/guidelines-secure-ai-system-development) recommend secure operation practices including monitoring and maintenance. Learning eligibility should be auditable, bounded, and reversible.

Design conclusion:

```text
resolution outcome != learning instruction
```

Policy questions need explicit learning metadata so the resolution layer can decide whether to:

- only record the outcome,
- reinforce an exact-match memory,
- reinforce bounded identity evidence,
- update hard constraints,
- or require a future explicit policy edit.

Recommended metadata:

```js
{
  meta: {
    uncertainty_type: 'missing_identity_evidence',
    evidence_class: 'identity' | 'compatibility' | 'constraint' | 'exact_match' | 'unknown',
    learning: {
      eligible: false,
      reason: 'broad_genre_ambiguity',
      confidence: 'blocked' | 'low' | 'medium' | 'high',
      allowed_types: [],
      blocked_types: ['genre_prefer'],
      provenance: {
        source: 'runtime_clarification_normalizer',
        actor_required: true,
        ai_generated_question: true,
        deterministic_evidence_required: true
      }
    }
  }
}
```

Eligibility tiers:

- `blocked`
  - No durable learning.
  - Always record outcome.
  - Use for broad genre ambiguity, profile-only support, weak RAG-only support, unsafe AI wording, stale questions, or unsupported uncertainty types.
- `exact_only`
  - May remember the specific title/TMDB/media-type outcome.
  - Must not reinforce genre, keyword, or policy-level signals.
  - Use when the operator corrected a one-off item but reusable evidence is weak.
- `identity_evidence`
  - May reinforce allow-listed identity evidence such as animation, anime, stand-up, documentary, holiday, or other policy-defined purpose evidence.
  - Requires deterministic metadata evidence and a selected library whose intent contract supports that evidence type.
- `constraint_evidence`
  - May reinforce or propose hard constraints such as rating exclusions.
  - Should prefer policy-edit proposals or warnings over automatic mutation when the constraint affects many future items.
- `policy_edit_required`
  - No automatic learning.
  - Surface a recommended policy edit or impact preview when the resolution suggests a broader policy change.

Default learning decisions:

- Broad genres (`Comedy`, `Romance`, `Action`, `Drama`, `Adventure`) default to `blocked` or `exact_only`.
- Specialized identity genres (`Animation`, `Documentary`) can be `identity_evidence` only when the selected library's intent contract treats that evidence as purpose-defining.
- Ratings default to `constraint_evidence` only when the destination policy already defines rating constraints or the question was explicitly a hard-limit conflict.
- RAG-only or profile-only support defaults to `exact_only` at most.
- AI-authored questions without normalizer metadata default to `blocked`.
- Stale policy questions default to `blocked`.

Resolution behavior:

- Always call `classificationOutcomeService.recordOutcome`.
- Only call `classificationEvidenceService.rememberExactMatch` when learning tier is `exact_only` or higher.
- Only call `classificationEvidenceService.reinforceGenrePatterns` when learning tier is `identity_evidence` and `identity_genre` is allowed.
- Never reinforce patterns from `learning.eligible = false`.
- Store learning decision metadata in the outcome payload so future audits can explain why a resolution did or did not change future behavior.

Resolution learning guard:

The eligibility metadata above should not be treated as self-enforcing. The resolution path needs a dedicated guard that is the last authority before any durable learning side effect. That guard should make resolution idempotent, auditable, transactional, and fail-closed.

Official source research, June 2026:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) recommends validating permission on every request, regardless of client path. Resolution learning should not trust the UI, Discord interaction payload, or previously persisted question text to authorize a learning write.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) recommends server-side workflow state validation and explicit workflow modeling. The resolver should validate that a question is pending, current, actor-authorized, and in a learning-eligible state before applying side effects.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) and [OWASP A09 Security Logging and Monitoring Failures](https://owasp.org/Top10/2021/A09_2021-Security_Logging_and_Monitoring_Failures/) recommend auditable records for high-value transactions. Learning writes are high-value because they affect future classifications.
- [PostgreSQL transaction documentation](https://www.postgresql.org/docs/current/tutorial-transactions.html) describes grouping related changes so they commit or roll back together. Outcome recording, learning decision recording, and any allowed evidence update should be atomic from the application perspective.
- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) defines provenance relations between entities, activities, and agents. The guard should persist the question, actor, selected outcome, eligibility decision, and side effects as linked provenance.
- [NCSC Guidelines for Secure AI System Development](https://www.ncsc.gov.uk/collection/guidelines-secure-ai-system-development) emphasize secure operation and maintenance, including logging and monitoring. Guard decisions should be observable enough to support later diagnosis and cleanup.

Guard responsibilities:

- Load the current persisted question and classification row from the database inside the resolution transaction.
- Recompute or validate learning eligibility server-side from the current question metadata, selected option, destination policy intent, media metadata, and actor context.
- Reject or downgrade learning when metadata is missing, stale, malformed, or inconsistent with the selected destination.
- Convert broad or ambiguous resolution evidence to `blocked` or `exact_only`.
- Allow durable learning only through allow-listed side effects.
- Write a structured learning-decision audit record before executing any learning side effect.
- Return an explicit `learning_result` to the caller so the UI and Discord responses can distinguish `resolved`, `learned`, `not_learned`, and `policy_edit_required`.

Recommended guard contract:

```js
{
  accepted: true,
  resolution_result: 'resolved',
  learning_result: 'blocked' | 'exact_recorded' | 'identity_reinforced' | 'constraint_proposed' | 'policy_edit_required',
  learning_decision: {
    tier: 'blocked',
    reason: 'broad_genre_ambiguity',
    evidence_class: 'compatibility',
    allowed_side_effects: [],
    blocked_side_effects: ['genre_reinforcement'],
    actor: {
      type: 'user' | 'discord' | 'system',
      id_hash: 'bounded-non-secret-actor-reference'
    },
    provenance: {
      classification_id,
      question_id,
      selected_library_id,
      selected_option,
      source: 'policy_question_resolution',
      trace_id
    }
  }
}
```

Fail-closed behavior:

- Missing `policy_question.meta.learning` -> record outcome only, no durable learning.
- Unknown learning tier -> record outcome only, no durable learning.
- Selected option not present in persisted question options -> reject resolution.
- Selected library no longer exists or no longer matches media type -> reject resolution.
- Question no longer pending or already resolved -> return idempotent existing outcome, do not re-run learning.
- Actor lacks permission or Discord target is not authorized -> reject resolution.
- Destination policy intent changed after the question was generated -> record outcome only unless a fresh eligibility check still passes.
- Learning side effect fails after outcome write starts -> roll back the transaction or record a failed learning side effect without changing future behavior.

Recommended side-effect allow list:

- `record_outcome`
  - Always allowed for valid resolution.
- `remember_exact_match`
  - Allowed for `exact_only`, `identity_evidence`, and `constraint_evidence`.
- `reinforce_identity_evidence`
  - Allowed only for allow-listed identity signals and matching destination intent.
- `propose_constraint_change`
  - Allowed for hard constraints, but should create a proposal or audit entry instead of silently mutating broad policy behavior.
- `reinforce_broad_genre`
  - Disabled by default.
  - Only possible through explicit future policy edit flow, never from a generic runtime clarification.

Data model implications:

- Add a small append-only `classification_learning_decisions` table or equivalent JSON outcome block.
- Store:
  - `classification_id`,
  - `question_id` or correlation id,
  - `actor_type`,
  - `actor_reference`,
  - `selected_library_id`,
  - `learning_tier`,
  - `learning_reason`,
  - `allowed_side_effects`,
  - `blocked_side_effects`,
  - `side_effect_results`,
  - `created_at`.
- Keep actor references bounded and non-secret. Do not persist raw Discord mention text, tokens, API keys, prompts, embeddings, or provider payloads.
- Prefer append-only records over mutating prior learning decisions so audits can explain historical behavior.

Refactor target:

```text
clarificationPolicyResolution
  -> policyQuestionResolutionGuard
      -> policyQuestionLearningEligibility
      -> learningDecisionAudit
      -> allowed evidence side-effect adapters
```

The guard should be the only service allowed to invoke durable learning side effects from a policy-question resolution. Existing direct calls to exact-match memory or genre-pattern reinforcement should move behind this boundary.

Pros:

- Makes the learning boundary enforceable instead of advisory.
- Prevents stale or malformed questions from changing future routing.
- Makes retries and duplicate Discord/UI submissions safe.
- Creates an audit trail that explains why an operator correction did or did not teach the system.
- Gives future analytics a clean source for measuring useful versus blocked learning attempts.

Cons:

- Adds a transactional service and likely a small audit table.
- Requires moving existing learning side effects behind a new boundary.
- May expose existing ambiguous learning behavior that needs cleanup or migration.
- Requires careful idempotency tests for UI retry, Discord retry, and browser double-submit paths.

Stale question cleanup:

Stale questions are not just old pending rows. They are pending workflow states created under an older policy contract, older AI prompt, older runtime normalizer, older library mapping, or older classification evidence. A stale question can be misleading even if the underlying item still needs operator attention.

Current risk:

```text
Old question shape -> operator answers outdated prompt -> resolver applies modern learning side effects from obsolete evidence
```

Target model:

```text
Detect stale question -> preserve history -> block learning -> repair, regenerate, or retire pending state
```

Official source research, June 2026:

- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) recommends explicit workflow state modeling and server-side validation for every transition. Stale policy questions should be modeled as a state transition, not cleaned up by ad hoc deletion.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) calls out explicit server-side workflow state machines, atomic check-then-act operations, and idempotency for non-idempotent actions. Cleanup should use conditional updates and be safe to run repeatedly.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) notes that logs and temporary/debug data should respect retention periods and not be kept beyond required duration. Stale prompt text and AI diagnostics should be bounded, retained only as needed, and separated from durable learning.
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) emphasizes lifecycle risk management. Runtime questions generated by AI-assisted paths should be reviewed as system behavior evolves, especially when prompts, policies, or model roles change.
- [NCSC Guidelines for Secure AI System Development](https://www.ncsc.gov.uk/collection/guidelines-secure-ai-system-development) recommend secure operation and maintenance practices such as logging, monitoring, update management, and information sharing. Cleanup should be observable and part of upgrade/maintenance, not a silent destructive job.
- [W3C PROV Overview](https://www.w3.org/TR/prov-overview/) frames provenance as useful for assessing quality, reliability, and trustworthiness. Cleanup should preserve why a question was stale and what replaced it.

Staleness signals:

- Question lacks `meta.uncertainty_type`.
- Question lacks `meta.learning`.
- Question was generated by a deprecated AI `CLARIFY` shape or vague genre-priority wording.
- Question references a library id, option label, policy id, or media type that no longer exists or no longer matches the current item.
- Question was generated before the current runtime clarification contract version.
- Question was generated before the current policy intent contract version for the selected library.
- Classification metadata, normalized rating, library mapping, or policy configuration changed after question creation.
- Question has been pending longer than the configured stale threshold.
- Question has no trace/correlation id linking it to current policy evidence.

Cleanup actions:

- `mark_stale`
  - Preserve the original question and outcome history.
  - Set status metadata so UI and Discord cannot present it as current.
  - Force `learning.eligible = false`.
- `regenerate`
  - Re-run deterministic policy question construction from current metadata, current policy intent, and current library mappings.
  - Preserve the stale question as provenance.
  - Use only normalized verifier diagnostics, not the stale free-form AI question text.
- `retry_required`
  - Mark the item as requiring classification retry when current evidence is insufficient to produce a safe replacement question.
- `retire`
  - Close the pending question without replacement when the item no longer exists, the destination library was removed, or the classification has already been resolved by a newer outcome.
- `audit_only`
  - Record that the question would be stale without mutating state. Useful for dry-run upgrade reports.

Recommended stale-question state:

```js
{
  question_state: 'pending' | 'stale' | 'regenerated' | 'retired' | 'resolved',
  stale_reason: 'missing_learning_metadata' | 'deprecated_question_shape' | 'policy_contract_changed' | 'library_mapping_changed' | 'metadata_changed' | 'expired' | 'superseded',
  stale_detected_at: '2026-06-25T00:00:00.000Z',
  replacement_question_id: null,
  learning: {
    eligible: false,
    reason: 'stale_question'
  }
}
```

Runtime behavior:

- UI should hide or visually separate stale questions from active pending questions.
- Discord should not notify on stale questions unless the notification is explicitly a cleanup/admin digest.
- Resolving a stale question should fail closed:
  - return a clear stale-question response,
  - recommend retry/regenerate,
  - never write durable learning.
- If a stale question is superseded by a regenerated question, only the regenerated question can be resolved.
- Cleanup should be idempotent and safe to run on startup, post-upgrade, and scheduled maintenance.
- Cleanup should never delete classification history or manual outcome history.

Post-upgrade strategy:

1. Add a cleanup function that supports dry-run and apply modes.
2. In dry-run mode, count stale questions by reason, age, and source.
3. In apply mode, mark stale questions and regenerate only when current deterministic evidence can produce a safe replacement.
4. Store summary counts in post-upgrade results and logs.
5. Run once for releases that introduce a new question contract version.
6. Also expose scheduled cleanup for questions that age out naturally.

Data model implications:

- Prefer adding state metadata to the existing policy question payload if the table shape already supports it.
- If analytics are needed, add a small append-only `classification_question_cleanup_events` table later.
- Store cleanup reason, action, actor/source (`post_upgrade`, `scheduler`, `manual_admin`), original question id, replacement question id, and timestamps.
- Do not persist raw model prompts, embeddings, provider payloads, Discord tokens, or API keys in cleanup records.

Pros:

- Prevents outdated questions from teaching new policy behavior.
- Makes post-upgrade repair repeatable and auditable.
- Preserves operator history while keeping active queues trustworthy.
- Reduces confusion from old AI-generated genre-priority prompts.
- Gives the UI and Discord notifier a clean active-versus-stale distinction.

Cons:

- Requires careful migration logic around existing pending rows.
- Some pending items may move from answerable to retry-required.
- Regeneration can surface new questions that differ from what users saw before upgrade.
- Adds another lifecycle state that routes, UI, Discord, and tests need to understand.

Refactor plan:

1. Add `policyQuestionLearningEligibility.mjs` as a pure service.
2. Let `runtimeClarificationNormalizer` assign initial learning metadata.
3. Let `policyQuestionBuilderUtils.buildQuestionPayload` merge and preserve learning metadata.
4. Add `policyQuestionResolutionGuard.mjs` as the only service allowed to authorize durable learning side effects from policy-question resolution.
5. Update `clarificationPolicyResolution` to call the guard before any evidence write.
6. Move direct exact-match and pattern-reinforcement writes behind guard-approved side-effect adapters.
7. Add `policyQuestionStalenessService.mjs` to detect stale questions from contract version, metadata age, deprecated wording, missing learning metadata, and changed library/policy references.
8. Add `policyQuestionCleanupService.mjs` to support dry-run, mark-stale, regenerate, retire, and retry-required actions.
9. Add outcome payload fields for:
   - learning tier,
   - learning reason,
   - allowed learning types,
   - blocked learning types,
   - evidence class.
10. Add tests for blocked broad genre questions, exact-only corrections, identity-eligible animation questions, rating hard-limit conflicts, stale questions, duplicate resolution submissions, changed policy intent, AI-authored questions without normalizer metadata, dry-run cleanup counts, and idempotent cleanup apply mode.

Pros:

- Prevents accidental policy drift from one-off manual corrections.
- Makes learning behavior explainable and auditable.
- Keeps useful feedback without overfitting broad genres.
- Gives future UI surfaces a clean way to show "this answer will/won't teach Classifarr."
- Supports safer impact-preview and policy-edit recommendation flows later.

Cons:

- Adds another decision layer to clarification resolution.
- Some existing automatic genre reinforcement will become intentionally less aggressive.
- Requires migration or fallback behavior for older questions that lack learning metadata.
- Needs careful UI language so users understand that "resolved" and "learned" are different outcomes.

Security and data-quality boundaries:

- Learning eligibility is computed server-side only.
- AI text, user-selected labels, Discord interaction values, and raw question strings cannot directly authorize learning.
- Eligibility uses allow-listed evidence classes and learning types.
- Learning writes must preserve provenance and actor/source metadata.
- Ineligible resolutions must remain useful as outcome history and future diagnostics.

Why this fits next:

- It connects the intent-first policy builder to actual runtime behavior.
- It prevents broad genres such as `Comedy`, `Romance`, `Action`, or `Drama` from becoming accidental routing rules.
- It makes operator prompts explain the real decision: library fit, not genre preference.
- It gives the learning system a clear boundary between outcome feedback and durable policy generation.

Candidate files:

- `server/src/services/classificationPolicyPathService.mjs`
- `server/src/services/aiResponseParser.mjs`
- `server/src/services/aiResponseParserResults.mjs`
- `server/src/services/policyQuestionBuilder.mjs`
- `server/src/services/policyQuestionBuilderQuestions.mjs`
- `server/src/services/policyQuestionBuilderUtils.mjs`
- `server/src/services/clarificationPolicyResolution.mjs`
- `server/src/services/postUpgradeService.mjs`

Required tests:

- AI `CLARIFY` responses using vague genre-priority wording are normalized or rejected.
- Policy-path AI calls run in verification mode when deterministic policy context exists.
- Broad genre ambiguity produces `learning.eligible = false`.
- Resolving a non-learning-eligible question records the outcome but does not reinforce genre patterns.
- Strong identity evidence can still produce learning-eligible policy questions.
- Stale generated genre questions are cleared or marked stale once, without affecting manually resolved history.

## Phase 6: Convert Presets Into Starter Templates

Intent: demote presets from hidden rule containers to reusable recipes.

Changes:

- Rename UI concepts:
  - `Presets` -> `Starter Templates`
  - `Content Presets` -> `Template Library`
- Add template preview:
  - `Applying this adds purpose X, hard limits Y, helpful hints Z.`
- Applying a template mutates the intent draft instead of making users edit preset internals.
- Preserve existing preset records for compatibility.

Why this fits next:

- Simplifies the mental model.
- Keeps templates useful without making them the policy source of truth.
- Reduces confusion around broad signals such as generic Comedy.

## Phase 7: Add Policy Impact Preview

Intent: make policy edits safer.

Changes:

- Add a bounded preview endpoint that evaluates a proposed policy draft against recent items.
- Show:
  - likely destination changes,
  - newly blocked items,
  - newly prompted items,
  - confidence or evidence changes.
- Keep it admin-only and avoid sending provider prompts or embeddings to the client.

Why this fits next:

- Reduces trial-and-error tuning.
- Prevents accidental routing churn.
- Makes policy behavior more predictable before save.

## Phase 8: Consider Storage Migration Later

Do not migrate storage until the product model is proven.

Possible future tables:

```text
library_policy_intent
policy_intent_rules
policy_template_applications
```

Why not now:

- Current `customSignals` compatibility path works.
- The UX still needs refinement.
- A premature schema migration would add risk before the model stabilizes.

## Migration Strategy

No automatic destructive migration.

Migration should be explicit and reversible until the intent model is proven:

1. Existing policies load as preset-backed policies.
2. The builder shows inferred intent and template provenance.
3. Direct intent edits save through compatibility payloads.
4. A future `Convert to intent policy` action may write native intent storage.
5. Conversion should require impact preview or replay before becoming default.

Legacy preset compatibility should remain until:

- native intent storage exists,
- policy replay verifies equivalent behavior,
- backup/restore includes intent records,
- users can inspect and reverse converted policy behavior.

## Testing Strategy

Required coverage before each phase:

- Legacy preset round-trip tests:
  - load preset-backed policy,
  - save unrelated fields,
  - verify preset attachments and `customSignals` remain unchanged.
- Intent edit serialization tests:
  - edit purpose,
  - edit hard limits,
  - edit helpful hints,
  - verify legacy-compatible save payload.
- Draft inference tests:
  - exact mappings,
  - inferred mappings,
  - partial mappings,
  - ambiguous mappings.
- UI tests:
  - plain-language labels,
  - warning visibility,
  - template provenance,
  - advanced template details still accessible.
- Server tests once schema exists:
  - allowed intent roles,
  - rejected unsupported operators,
  - strict/advisory normalization,
  - no destructive conversion on ordinary save.

## Risks

- Dual-model drift: client draft semantics diverge from server policy semantics.
- Silent migration: opening or saving a policy unexpectedly changes preset-backed behavior.
- Overexposed internals: users see too many policy mechanics and lose the simple mental model.
- Template ambiguity: a legacy preset may contain mixed signals that do not map cleanly to one product concept.
- UI bloat: continuing to add controls to `PolicyBuilderModal.vue` without extracting state/components.
- Trust loss: users cannot tell whether a policy is template-backed, modified, inferred, or natively intent-backed.
- Runtime drift: classification-time clarification can still use vague AI-generated questions that do not match policy intent.
- Bad learning feedback: manual resolution of broad genre ambiguity can accidentally reinforce durable genre rules.
- AI authority creep: AI-generated `CLARIFY` text can become the final operator question unless normalized by the server.

## Recommended Next Work

Continue with runtime clarification alignment before adding more policy-builder controls:

1. Implement Phase 5B runtime clarification alignment.
2. Add learning eligibility metadata to policy questions.
3. Harden policy-question resolution so only eligible evidence generates durable learning.
4. Introduce stale-question cleanup for obsolete genre-priority prompts.
5. Continue the intent draft bridge and server-provided editor schema exploration after runtime behavior matches the intent model.

The builder now has a tested state boundary, so the next highest-value step is making the UI edit an intent draft instead of directly manipulating legacy `customSignals`.

The runtime now needs the same boundary: AI may identify uncertainty, but deterministic server logic should decide the final operator question and whether the answer is allowed to become durable policy.

## Open Questions

- Should `Soft matches` be visible by default, or only in advanced mode?
- Should `Helpful hints` and `Soft matches` be combined in the first simplified UI?
- Should Family-like libraries get guided hard-limit defaults?
- Should starter templates be editable globally, or should applying a template copy its intent into the policy?
- How should we show that a policy was seeded from a template but later modified?
- Should conversion from legacy presets to native intent storage ever be automatic, or always explicit?
- What should the UI display when legacy preset inference is partial or ambiguous?
- How long should legacy preset-backed policies remain first-class after native intent storage exists?
- Should all AI-authored clarification text be normalized, or only questions that are learning-eligible?
- Should stale pending questions be regenerated immediately after upgrade or only when the operator retries classification?
- Which evidence types should be allowed to produce durable learning from policy-question resolution?
