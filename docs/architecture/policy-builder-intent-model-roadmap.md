# Policy Builder Intent Model Roadmap

Status: active roadmap. Phase 0 through Phase 3 builder presentation are
implemented and checkpointed. Phase 5 is implemented and checkpointed for the
non-persistent server intent bridge: contract validation, write preflight,
impact preview, and representative replay preview. Phase 6 has started as the
replay-safe enrichment preview lane, with the blocked-by-default adapter
contract, TMDB dry-run adapter preview, and quota-aware TMDB execution switch
implemented. Native intent storage, conversion, and runtime authority remain
planned Phase 8 work after parity and rollback safety are proven.

## Goal

Move Classifarr from a preset-centric policy builder to an intent-and-application
model without making the platform feel like an expert-system editor.

At its core, classification is reconciling two things:

```text
declared intent + observed media-server application
```

The media server is the source of truth for existing application. A Plex, Emby,
or Jellyfin library shows how the operator has already organized content in the
real world. Classifarr should treat that as observed intent, while still letting
the operator declare explicit rules when the existing collection is incomplete,
noisy, or intentionally changing.

The user-facing model should be:

```text
This is what I meant this library to contain.
This is what the library currently contains.
Use both, but do not let noisy examples override clear rules.
```

The technical model can remain more detailed internally:

```text
declared intent + observed profile + routing target + review behavior
```

## Current Problem

Presets are currently doing two jobs:

1. They act as reusable starter shortcuts.
2. They also carry hidden policy logic through bundled signals.

That muddles the policy builder because users are asked to reason about presets, custom signal overrides, runtime behavior, weights, and scoring all at once.

The better product model is:

```text
Libraries express intent through both configuration and current contents.
Starter templates help draft configuration.
Media-server contents provide observed application.
```

## Design Principle

Presets should become starter templates, not the primary policy object.
Connected media-server libraries should become understandable destinations and
observed examples, not opaque sources of hidden scoring behavior.

Current:

```text
Library Policy -> selected presets -> hidden/custom signals -> scoring behavior
```

Target:

```text
Library Policy -> declared intent + observed application + routing target + review behavior
              -> optionally seeded by starter templates
```

The policy builder should make four library roles explicit over time:

- **Destination**: this is a library Classifarr can classify into.
- **Observed examples**: current library contents can help describe what belongs.
- **Classification scope**: items can be evaluated against this policy.
- **Routing target**: matching items can be sent to an Arr root folder/profile.

Those roles should not be treated as one implied switch. A connected library can
be a destination without immediately learning from every current item, and a
library profile can explain intent without silently overriding declared hard
limits.

Core rule:

```text
Observed library contents can explain intent, but they must not silently override declared intent.
```

## Target Mechanism

Classifarr meets the intent-and-application goal through a staged pipeline, not
through one policy screen.

```text
media server libraries
  -> observed library profiles
  -> declared policy intent
  -> normalized evidence model
  -> decision engine
  -> route/apply/review
  -> outcome + guarded learning
```

### 1. Library Ingestion

The media server sync provides the current application:

```text
library id
library name
media type
items
metadata
current location
```

This answers:

```text
What exists today?
Where has the operator already applied it?
```

### 2. Observed Profile Builder

Classifarr computes a profile for each connected library:

```text
ratings distribution
genre distribution
keyword distribution
media type
outliers
exclusions
profile quality
```

This answers:

```text
What does this library appear to mean based on real contents?
```

Observed profiles provide evidence. They do not become final rules by
themselves.

### 3. Declared Intent Model

The policy builder captures what the operator explicitly means:

```text
Belongs Here
Helpful Matches
Hard Limits
Boosts
Avoid
Ask When Unsure
```

This answers:

```text
What does the operator explicitly want this library to contain or reject?
```

Declared hard limits and explicit operator intent take precedence over noisy
observed examples.

### 4. Evidence Normalization

Before scoring, Classifarr should normalize all inputs into known evidence
buckets:

```text
identity evidence
compatibility evidence
constraint evidence
profile evidence
RAG evidence
history evidence
routing evidence
```

This answers:

```text
What kind of evidence is this, and how much authority should it have?
```

This is the trust boundary that prevents broad or low-quality evidence from
acting like identity:

- Generic `Comedy` can be helpful, but it should not define a specialized
  destination by itself.
- RAG neighbors with unknown or untrusted libraries should not dominate.
- Profile evidence should support declared intent, not override hard limits.
- One manual correction should not become a durable broad rule.

### 5. Decision Engine

Each item is evaluated against candidate libraries:

```text
candidate score =
  declared intent match
+ observed profile support
+ calibrated RAG support
+ history support
+ boosts
- conflicts
- hard limit violations
```

The decision engine should produce one of a few clear outcomes:

```text
confident match -> route/apply
hard limit conflict -> do not route
weak or conflicting evidence -> ask operator
no safe destination -> leave pending/review
```

Core decision rules:

- Hard limits can veto.
- Identity evidence should dominate.
- Helpful evidence should support, not decide alone.
- Observed profile should explain, not override declared intent.
- Routing availability must be explicit; a correct classification without an
  Arr mapping is `classified but not routed`, not a silent success.

### 6. Review Question Generator

When Classifarr needs operator input, it should generate a structured question
from deterministic uncertainty metadata.

Bad pattern:

```text
Genre conflict -> Which genre should be prioritized?
```

Target pattern:

```text
Uncertainty type + candidate libraries + evidence summary + allowed outcomes + learning eligibility
```

Example:

```text
Uncertainty: missing identity evidence
Question: Does this item actually belong in Animated Movies?
Reason: Existing library examples support animation, but this item lacks animation identity evidence.
Options: Animated Movies, Movies, Retry
Learning: not eligible for durable rule
```

AI can help identify uncertainty, but deterministic server logic should decide
the final operator question and whether the answer can teach Classifarr.

### 7. Apply And Route

When the decision is confident, Classifarr applies the outcome through the
configured route:

```text
final library
Arr root folder/profile
status
reason
trace
```

The route result should be part of the final outcome. Classification and routing
are related but distinct.

### 8. Outcome And Guarded Learning

Every classification should produce a final outcome record. Durable learning is
separate:

```text
final outcome = what happened
learning = what Classifarr is allowed to generalize
```

Examples:

```js
{
  outcome: 'resolved',
  final_library: 'Movies',
  learning: {
    eligible: false,
    reason: 'broad_genre_ambiguity'
  }
}
```

```js
{
  outcome: 'resolved',
  final_library: 'Animated Movies',
  learning: {
    eligible: true,
    reason: 'stable_animation_identity'
  }
}
```

The core internal policy context should eventually resemble:

```js
{
  library: {
    id,
    name,
    media_type,
    roles: {
      destination: true,
      observed_examples: true,
      classification_scope: true,
      routing_target: true
    }
  },
  declared_intent: {
    belongs_here: [],
    hard_limits: [],
    helpful_matches: [],
    boosts: [],
    avoid: [],
    review_behavior: {}
  },
  observed_application: {
    profile_quality,
    ratings,
    genres,
    keywords,
    outliers,
    exclusions
  },
  routing: {
    arr_type,
    root_folder,
    quality_profile,
    available
  }
}
```

Each item evaluation should eventually produce:

```js
{
  item,
  candidates: [
    {
      library_id,
      score,
      evidence: {
        identity: [],
        helpful: [],
        profile: [],
        rag: [],
        constraints: [],
        routing: []
      },
      blockers: [],
      warnings: [],
      decision: 'route' | 'ask' | 'skip'
    }
  ],
  final_decision,
  learning_eligibility
}
```

Phase 0 does not build this full mechanism. Phase 0 aligns the visible language
with it so later phases can add state, toggles, routing diagnostics, and guarded
learning without changing the mental model again.

## Library-Derived Policy Generation

The cleanest long-term methodology is for Classifarr to generate policy intent
from the media server's existing application, then let the operator review and
accept that proposed intent.

This should be framed as:

```text
Rebuild Policy From Library
```

not:

```text
Drop all policies automatically.
```

The media server is the source of truth for how libraries are currently used,
but existing Classifarr policies may contain explicit operator intent that is
not obvious from current contents. The migration path should therefore generate
proposals, not perform destructive replacement.

Target flow:

```text
connected media-server library
  -> observed profile
  -> generated policy proposal
  -> operator review
  -> archive existing policy
  -> activate accepted policy
  -> optional impact preview/replay
```

Generated policy proposals should distinguish:

```text
observed pattern
inferred rule
operator-confirmed rule
```

Example proposal:

```js
{
  source: 'observed_library',
  generated_from_library_id: 14,
  generated_from_library_name: 'Family',
  confidence: 'high',
  declared_intent_draft: {
    belongs_here: ['Family', 'Animation', 'Adventure'],
    helpful_matches: ['Comedy'],
    hard_limits: ['max PG-13'],
    boosts: [],
    avoid: ['R', 'NC-17'],
    review_behavior: {
      ask_when: ['hard_limit_conflict', 'weak_identity']
    }
  },
  assumptions: [
    'No R-rated items observed in Family',
    'Animation appears frequently enough to be identity evidence',
    'Comedy appears but is too broad to define the destination'
  ],
  warnings: [
    'Observed profile may reflect missing content, not intentional exclusions'
  ]
}
```

Generation rules:

- Strong repeated identity evidence can become `Belongs Here` in a proposal.
- Broad genres such as `Comedy`, `Drama`, `Action`, and `Romance` should default
  to `Helpful Matches` unless they clearly define the library's purpose.
- Rating absence can suggest a `Hard Limit`, but it should be shown as an
  assumption until confirmed.
- Existing outliers should be surfaced as warnings, not silently folded into the
  policy.
- Existing explicit policy constraints should be carried forward as declared
  intent unless the operator chooses to discard them.
- Generated policies should include confidence, assumptions, and warnings.
- Generated policies are inactive until accepted.

Migration modes:

```text
Keep existing policy
Generate policy preview
Replace after review
```

Bulk regeneration should be available as an admin workflow only after preview
and replay tooling exists. It should start in dry-run mode and report:

- proposed policy changes,
- hard-limit assumptions,
- observed outliers,
- route readiness,
- affected pending/existing classifications,
- rollback/archive references.

Archival rule:

```text
Existing policies are archived, not destroyed.
```

The archive should preserve the prior preset attachments, weights,
`customSignals`, thresholds, and metadata required for rollback and audit.

## Authority Boundaries: Builder, Questions, AI, Learning

The next system needs a strict authority model. The current failure mode is not
only that questions are worded poorly; it is that AI text, policy evidence,
manual answers, and learning side effects can blur together.

Core rule:

```text
AI may propose evidence and uncertainty.
The server decides question shape, answer semantics, policy mutation, and learning eligibility.
```

Authority boundaries:

| Component | Can Suggest | Can Decide | Can Persist Policy | Notes |
| --- | --- | --- | --- | --- |
| Policy builder | Policy intent edits | Only through operator save | Yes | Primary UI for declared intent |
| Runtime questions | Item-level resolution options | Final item outcome after operator answer | No | Questions resolve uncertainty; they do not rewrite policy directly |
| AI | Evidence summaries, uncertainty candidates, policy proposals | No | No | AI output is diagnostic input only |
| Decision engine | Candidate ranking and review requirement | Classification route/review decision | No | Uses normalized evidence and declared intent |
| Learning guard | Whether an answer may become durable learning | Learning eligibility | Bounded learning/audit only | Must fail closed on ambiguity |
| Operator | Explicit choices and confirmations | Yes | Yes, through explicit policy UI action | Human confirmation is required for policy changes |

This creates two separate loops:

```text
Classification loop:
item -> evidence -> decision -> question if needed -> final outcome

Policy loop:
observed application -> proposal -> operator review -> explicit policy change
```

Questions may produce policy suggestions, but those suggestions must enter the
policy loop. They should not mutate policy during item resolution.

## AI Response Normalization And Question Contract

AI responses should be treated as untrusted structured observations. Even when
the model returns valid JSON, the response still needs semantic validation.

Current best-practice guidance, June 2026:

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
  and [Microsoft Azure OpenAI Structured Outputs](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs)
  support schema-constrained model responses. Classifarr should use structured
  shape validation where possible, but still apply product-owned semantic
  validation before showing a question or storing an answer.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  identifies prompt injection, insecure output handling, excessive agency, and
  overreliance as core LLM application risks. Classifarr should treat model
  output as advisory evidence, not as an instruction to route, mutate policy, or
  create durable learning.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  and [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommend allow-listed values, constrained strings, fixed ranges, and
  rejection of unexpected content. The question and answer contracts should use
  product-owned enums for uncertainty types, option actions, policy suggestion
  types, learning outcomes, and side effects.
- [NCSC Prompt Injection Is Not SQL Injection](https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection)
  describes LLMs as inherently confusable deputies. Classifarr should reduce the
  authority of AI output instead of relying on prompt wording to keep it safe.
- [Microsoft Human-AI Experience Guidelines](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/)
  and the [Google People + AI Guidebook](https://pair.withgoogle.com/guidebook/)
  emphasize user control, clear uncertainty, correction paths, and understandable
  explanations. Runtime questions should explain destination fit and consequence,
  not ask operators to resolve abstract model uncertainty.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  and the [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  emphasize governance, traceability, measurement, and risk controls. Classifarr
  should persist normalized evidence, question contract version, answer, final
  outcome, and learning decision separately.

Ollama and local-LLM guidance:

- [Ollama Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs)
  supports JSON mode and JSON Schema through the `format` field. Ollama also
  recommends passing the schema in the prompt and validating the parsed response.
  Classifarr should prefer schema-constrained output for local models that can
  follow it reliably, but still run the same semantic normalizer as cloud
  providers.
- The same Ollama structured-output guidance recommends defining schemas from
  reusable type systems and lowering temperature, for example to `0`, for more
  deterministic completions. Classifarr already moves structured requests toward
  deterministic generation; the roadmap should preserve that as a requirement
  for policy questions and answer contracts.
- [Ollama Generate API](https://docs.ollama.com/api/generate) documents that
  `format` accepts `"json"` or a JSON Schema object, and that supported models
  can emit a separate `thinking` field. Classifarr should parse only final
  answer content into product contracts and treat thinking traces as diagnostic
  data that is not persisted into policy, questions, answers, or learning.
- [Ollama Thinking](https://docs.ollama.com/capabilities/thinking) documents
  thinking-capable models, separate reasoning traces, and API controls for
  `think`. For classification contracts, Classifarr should disable thinking
  where the model supports it. If a model cannot fully disable thinking or
  emits reasoning text anyway, that model should run in a lower-authority mode.
- [Ollama OpenAI Compatibility](https://docs.ollama.com/api/openai-compatibility)
  supports OpenAI-compatible chat/completion flows, JSON mode, streaming,
  reproducible outputs, tools, and thinking controls. Classifarr should not
  assume OpenAI-compatible syntax has identical semantics across providers; the
  provider adapter must normalize capabilities into Classifarr-owned modes.

Design conclusion:

```text
schema validity is necessary, but not sufficient
```

The product must validate both:

```text
shape: does the response match the expected schema?
meaning: does the response map to allowed product behavior?
```

Local model conclusion:

```text
local execution improves privacy and cost control, but it does not reduce the
need for output validation, authority limits, or learning guards
```

Ollama provider modes should be explicit:

| Mode | Intended Use | Output Contract | Authority |
| --- | --- | --- | --- |
| `structured_contract` | Policy questions, answer normalization, final classification contract | JSON Schema through `format`, temperature `0`, parser validation, semantic validation | May feed deterministic decision logic after validation |
| `verification` | Check a deterministic candidate or summarize uncertainty | Structured if reliable; otherwise parsed advisory text | Advisory only |
| `explanation` | Human-readable reason text for an already-decided outcome | Bounded text, no action fields | Display only |
| `proposal` | Draft future policy improvements for review | Structured proposal schema | Must enter policy review loop |
| `fallback_advisory` | Unknown, weak, or reasoning-heavy local model behavior | Parsed evidence summary only | Cannot create questions, actions, learning, or policy suggestions |

Model capability should be measured, not assumed. Classifarr should track per
provider/model:

- structured parse success rate,
- semantic contract violation rate,
- repair attempt and repair success rate,
- hallucinated library IDs or option actions,
- malformed question rate,
- broad genre-priority question rate,
- thinking trace detected in final content,
- timeout, abort, and incomplete-stream rates.

Those metrics should decide whether a local model is allowed to run in
`structured_contract` mode. A model that repeatedly leaks reasoning text,
hallucinates actions, or needs frequent repair should be downgraded to
`verification` or `fallback_advisory`.

Ollama-specific hardening rules:

- Prefer non-thinking or thinking-disabled local models for question and answer
  contracts.
- If using a thinking-capable model, read only the final answer field for
  contracts and discard the thinking trace from durable records.
- Do not put raw thinking traces, raw prompts, raw web payloads, secrets, API
  keys, or full RAG dumps into policy questions or learning records.
- Keep prompt input bounded to normalized evidence summaries, known candidate
  libraries, and explicit policy intent.
- Require a done/completion signal for contract-critical streaming paths, or
  treat the result as incomplete and non-learning-eligible.
- Store provider, model, provider mode, schema version, contract version, and
  normalization result with the decision trace.
- Keep local and cloud providers behind the same semantic contract so switching
  providers does not change policy behavior.

Target pipeline:

```text
AI raw output
-> schema parser
-> semantic normalizer
-> deterministic question builder
-> answer contract
-> learning guard
```

The AI contract should allow only these normalized output families:

| Normalized Type | Purpose | Durable Side Effects |
| --- | --- | --- |
| `classification_candidate` | Suggest a possible destination with evidence | None |
| `uncertainty` | Explain why deterministic evidence is insufficient | None |
| `evidence_summary` | Summarize item facts, profile overlap, constraints, and gaps | None |
| `policy_proposal` | Suggest a future policy improvement | None until reviewed in policy UI |
| `explanation` | Human-readable explanation for an already-normalized decision | None |

The normalizer should reject or downgrade:

- unknown libraries,
- unknown option actions,
- unknown learning categories,
- free-form commands,
- SQL-like text,
- URLs, file paths, secrets, API keys, or mentions,
- raw provider payloads,
- broad genre-priority questions such as `Which genre should be prioritized?`,
- any AI output that asks to write policy, delete records, trigger routing, or
  create durable learning directly.

Example normalized uncertainty:

```js
{
  accepted: true,
  source: 'ai',
  normalized_type: 'uncertainty',
  uncertainty_type: 'missing_identity_evidence',
  candidate_libraries: [
    {
      library_id: 6,
      reason_code: 'profile_support'
    }
  ],
  evidence_summary: {
    identity: [],
    helpful: ['Comedy'],
    constraints: [],
    profile: ['Family profile match']
  },
  prohibited_actions: ['policy_write', 'durable_learning'],
  requires_question: true,
  learning: {
    eligible: false,
    reason: 'weak_or_broad_evidence'
  }
}
```

Example rejected output:

```js
{
  accepted: false,
  reason: 'vague_genre_priority',
  fallback: 'deterministic_policy_question'
}
```

This keeps the AI useful without giving it authority. The model can say
`Comedy and Romance appear in the metadata`; it cannot decide that the operator
should create a durable `Comedy beats Romance` rule.

## Runtime Question Shape

Questions should be generated from deterministic metadata after AI output is
normalized. AI can contribute evidence and explanation, but it should not author
the final question contract.

Required question fields:

```js
{
  question_id: 'policy-question-id',
  classification_id: 123,
  contract_version: 1,
  question_type: 'classification_resolution',
  uncertainty_type: 'missing_identity_evidence',
  problem_summary: 'Destination identity is weak',
  why_uncertain: 'Comedy and Romance are helpful metadata, but neither proves this belongs in Animated Movies.',
  item: {
    media_type: 'movie',
    title: 'Example',
    year: 2026,
    tmdb_id: 12345
  },
  candidate_libraries: [
    {
      library_id: 6,
      label: 'Animated Movies',
      evidence: ['profile_support']
    },
    {
      library_id: 7,
      label: 'Movies',
      evidence: ['general_movie_destination']
    }
  ],
  options: [],
  evidence: {},
  learning: {
    eligible: false,
    reason: 'broad_genre_ambiguity'
  }
}
```

Allowed `uncertainty_type` values should be narrow and product-owned:

- `missing_identity_evidence`
- `hard_constraint_conflict`
- `weak_overlap`
- `rag_only_support`
- `profile_only_support`
- `routing_missing`
- `ai_disagreement`
- `manual_selection_needed`
- `contract_violation`

Question options should use stable action IDs rather than free-form labels:

```js
[
  {
    id: 'select_library_6',
    action: 'select_library',
    library_id: 6,
    label: 'Animated Movies',
    learning_allowed: false
  },
  {
    id: 'select_library_7',
    action: 'select_library',
    library_id: 7,
    label: 'Movies',
    learning_allowed: false
  },
  {
    id: 'retry_classification',
    action: 'retry',
    label: 'Retry Classification'
  },
  {
    id: 'leave_pending',
    action: 'leave_pending',
    label: 'Leave Pending'
  }
]
```

Bad question:

```text
Which genre should be prioritized?
```

Better question:

```text
Does this item match the destination identity and constraints for Animated Movies,
or should it route to a general Movies library?
```

This framing makes the operator answer the real product question: destination
fit, not abstract genre priority.

## Runtime Answer Shape

Answers should resolve a classification outcome first. Any policy change should
be a separate suggestion that requires explicit review.

Required answer fields:

```js
{
  question_id: 'policy-question-id',
  selected_option_id: 'select_library_7',
  actor: 'operator',
  outcome: 'resolved',
  final_library_id: 7,
  reason: 'Operator selected general Movies destination',
  learning_decision: {
    eligible: false,
    reason: 'broad_genre_ambiguity',
    allowed_side_effects: []
  },
  policy_suggestion: {
    suggested: true,
    type: 'review_identity_threshold',
    requires_review: true
  }
}
```

Answer rules:

- Selecting a library may update the item outcome.
- Selecting a library must not automatically rewrite policy intent.
- Learning must be denied by default when the uncertainty is broad, ambiguous,
  AI-authored, or based on missing evidence.
- Learning can be eligible only when the answer maps to a known policy concept,
  a known evidence anchor, and a non-ambiguous operator choice.
- Policy suggestions should be queued for the policy builder or admin review,
  not applied inline from the pending-item card.

This preserves the user benefit of quick pending-item resolution while keeping
policy evolution auditable and reversible.

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

## Canonical Implementation Sequence

The roadmap now spans three connected tracks:

```text
policy builder UX
runtime clarification and learning
legacy-to-intent migration
```

The phases should be read in this order. Later sections may contain deeper
design detail, but this table is the authoritative sequence.

| Phase | Name | Primary Outcome | Storage Impact | Runtime Impact |
| --- | --- | --- | --- | --- |
| 0 | Stabilize current additive UI | Plain-language labels and compatibility tests | None | None |
| 1 | Extract policy builder state | Smaller tested builder state boundary | None | None |
| 2 | Introduce intent draft bridge | UI edits intent draft instead of raw `customSignals` | Legacy-compatible save only | None |
| 3 | Simplify builder around intent draft | Starter-template terminology and advanced details separated | None | None |
| 4 | Add intent summary and warnings | Operators can see behavior before saving | None | None |
| 5 | Add server-side intent contract | Server returns validated policy intent projection | None initially | Classification can consume a stable contract |
| 5A | AI provider capability baseline | Local/cloud models mapped to explicit authority modes | None | AI output authority becomes measurable |
| 5B | Runtime clarification normalizer | AI text becomes normalized uncertainty, not final question text | Optional metadata only | Vague genre questions are rewritten/rejected |
| 5C | Question and answer contract | Stable question/answer schemas with allowed actions | Additive if persisted | Answers resolve items without mutating policy |
| 5D | Learning guard and stale cleanup | Durable learning requires explicit eligibility | Additive audit/cleanup tables if needed | Old unsafe questions are retired or regenerated |
| 6 | Convert presets into starter templates | Presets become recipes, not the policy mental model | Legacy records retained | None |
| 7 | Add policy impact preview | Policy edits can be replayed before save | Read-only evaluation data | Safer tuning |
| 7B | Generate policies from library application | Existing media-server contents can propose policy replacements | Archive accepted replacements | Proposed changes remain review-gated |
| 8 | Migrate to native intent storage after parity | Planned explicit storage migration after parity proof | New intent tables after replay, backup, restore, and rollback proof | Runtime reads native intent when available |

Non-negotiable sequencing rules:

- Do not add new policy controls before Phase 1 separates builder state.
- Do not let AI-authored clarification text drive learning before Phases 5A-5D.
- Do not generate replacement policies from libraries before impact preview can
  explain the blast radius.
- Do not drop legacy preset/custom-signal storage until Phase 8 parity, backup,
  restore, replay, and rollback are proven.
- Do not treat local Ollama execution as lower risk; local models still go
  through the same semantic normalizer and authority limits.

Phase 5 is intentionally split into subphases because runtime clarification,
answer resolution, learning, stale cleanup, and local-model capability are
separate failure domains. They should not ship as one large hidden refactor.

## Phase 0: Stabilize Current Additive UI

Intent: make the current intent editor less technical while preserving behavior.

Implementation status: first UI-language and regression-protection slice
implemented. This phase changes visible language and tests only; it does not
change scoring, storage, or API contracts.

Problem to solve:

The current builder exposes the right emerging concepts, but it still uses
engineering language:

- `Identity Signals`
- `Compatibility Signals`
- `Strict Constraints`
- `Boosters`
- `Selected Presets`
- `Customize`

That language asks users to understand scoring internals before they can express
what they actually mean. Phase 0 should make the current additive UI easier to
read without pretending the legacy preset model has already been replaced.

It should also introduce the simpler mental model:

```text
The media server shows how this library is used today.
The policy explains what should belong going forward.
Classifarr reconciles both.
```

Accessible copy principle:

Use short labels for scanning and helper text for precision. Do not turn section
headers into long questions.

User-facing label changes:

| Current label | Phase 0 label | Helper copy |
| --- | --- | --- |
| `Identity Signals` | `Belongs Here` | Signals that define what this library is for. |
| `Compatibility Signals` | `Helpful Matches` | Signals that can help, but should not decide alone. |
| `Strict Constraints` | `Hard Limits` | Rules that can block a match, like rating limits. |
| `Boosters` | `Boosts` | Signals that raise confidence when other evidence already fits. |
| `Exclusions` | `Avoid` | Signals that lower confidence or block this library. |
| `Selected Presets` | `Starter Templates` | Templates currently helping shape this policy. |
| `Customize` | `Details` | View or adjust advanced template signals. |

Library-context copy to introduce:

```text
Classifarr uses this library in two ways:
1. As a destination for matching items.
2. As examples of how this library is already used.
```

Phase 0 should not add toggles yet, but it should make room for future toggles
such as:

- `Use current library contents as examples`
- `Apply this policy to new items`
- `Apply this policy to existing items`
- `Use this library only as a destination`

Allowed changes:

- Keep the current intent editor as an additive layer.
- Rename visible labels and helper copy to plain-language labels.
- Add explanatory static copy that distinguishes declared policy intent from
  observed library application.
- Keep existing preset attachments, weights, and `customSignals` semantics
  unchanged.
- Keep the advanced template detail panel available.
- Add tests proving existing preset-backed policies save without shape loss.
- Add tests proving the new labels render in the modal.
- Update existing tests that assert old technical labels.

Non-goals:

- Do not add new signal controls.
- Do not change policy scoring.
- Do not change policy save payload shape.
- Do not add a database migration.
- Do not convert legacy presets to native intent storage.
- Do not add library role toggles yet; Phase 0 can introduce the language, but
  not the behavior split.
- Do not remove the advanced preset/template detail UI.
- Do not make AI-generated policy questions part of this phase.

Compatibility rules:

- Opening an existing preset-backed policy must not rewrite it.
- Saving unrelated fields must preserve preset attachments and `customSignals`.
- Intent helper changes may still serialize through the existing
  legacy-compatible `customSignals` path.
- Template/preset terminology may change in the UI, but the API payload should
  keep using the current server contract.
- Media-server profile and library mapping behavior should remain unchanged.
- Avoid adding more signal controls until the state model is extracted.

Test requirements:

- Update `PolicyBuilderModal.test.js` to assert the plain-language section
  labels.
- Add or update a render test that the builder explains the media-server library
  as current examples/application, not only as a destination.
- Keep or add a regression test that saving a legacy preset-backed policy
  preserves:
  - preset id,
  - weight,
  - existing `customSignals`,
  - unrelated form values.
- Keep or add a regression test that intent helper edits serialize to the same
  legacy-compatible payload as before.
- Run client lint and targeted policy-builder tests at minimum.

Suggested implementation order:

1. Add static copy that explains the library as destination plus observed
   examples.
2. Rename labels in `PolicyIntentEditor.vue`.
3. Rename selected preset/template copy in `PolicyBuilderModal.vue`.
4. Update affected tests.
5. Run targeted client tests.
6. Run client lint.
7. If any behavior diff appears in payload tests, stop and fix before expanding
   the UI.

Why this fits next:

- It protects current users while the design is still evolving.
- It prevents the large modal from becoming more complex before refactoring.
- It makes the intent model more understandable before deeper extraction work.
- It keeps Phase 1 focused on state extraction instead of mixing refactor work
  with product-copy cleanup.

Definition of done:

- The builder uses plain-language policy intent labels.
- The builder explains that library contents are observed examples/application.
- The builder does not imply that observed examples override declared hard
  limits.
- The advanced template details remain accessible.
- Existing preset-backed policy payloads are unchanged.
- No server, migration, or scoring changes are required.
- Client policy-builder tests and lint pass.

Implementation record:

- See [Policy Builder Phase 0 Implementation](policy-builder-phase-0-implementation.md).
- Visible copy now says `Belongs Here`, `Helpful Matches`, `Hard Limits`,
  `Boosts`, `Avoid`, and `Starter Templates`.
- The existing preset-backed `customSignals` payload remains the compatibility
  contract for this slice.

## Phase 1: Extract Policy Builder State

Intent: reduce modal complexity without changing user behavior.

Implementation status: form/save state slice implemented in
`client/src/composables/usePolicyBuilderState.js`; reference-data and async
side-effect slice implemented in
`client/src/composables/usePolicyBuilderReferenceData.js`; advanced template
signal helper slice implemented in
`client/src/composables/usePolicyBuilderTemplateSignals.js`; combined-signal
presentation slice implemented in
`client/src/composables/usePolicyBuilderCombinedSignals.js`. Phase 1 is
complete for the current modal decomposition target.

Changes:

- Create `client/src/composables/usePolicyBuilderState.js`.
- Move form defaults, selected template state, custom signal mutation, intent signal mutation, validation state, and save payload construction out of `PolicyBuilderModal.vue`.
- Create `client/src/composables/usePolicyBuilderReferenceData.js`.
- Move library loading, preset loading, suggestions, migration notice handling,
  starter-template filtering, available rating/genre derivation, and usage
  labels out of `PolicyBuilderModal.vue`.
- Move base signal lookup, language/runtime template presentation, strict
  toggles, removed-signal markers, and keyword addition out of
  `PolicyBuilderModal.vue`.
- Move combined signal presentation and source attribution out of
  `PolicyBuilderModal.vue`.
- Keep API payload shape unchanged.
- Preserve current tests, then add composable tests for save payload construction and legacy preset round-trips.
- Add composable tests for reference-data loading, migration notice parsing,
  filtering, suggestion fallback, and derived option lists.
- Add composable tests for advanced template signal helpers.
- Add composable tests for combined signal presentation.

Why this fits next:

- Creates a safer foundation for intent-specific behavior.
- Makes future changes testable without mounting the full modal.
- Reduces risk of regressions in policy save behavior.

Implementation record:

- See [Policy Builder Phase 1 Implementation](policy-builder-phase-1-implementation.md).
- Next work should move to Phase 2 and introduce the intent draft bridge without
  changing the save contract yet.

## Phase 2: Introduce Intent Draft Bridge

Intent: stop making the UI manipulate raw `customSignals` directly.

Status:

- First slice implemented: a pure intent draft bridge now projects selected
  legacy presets and `customSignals` into intent buckets and can serialize the
  draft back to the same legacy-compatible save payload.
- Second slice implemented: `usePolicyIntentDraft` now keeps draft state
  synchronized with selected presets, routes intent helper changes through draft
  commands, and applies the draft before policy save payload construction.
- Third slice implemented: `PolicyIntentEditor.vue` now renders from the
  `intentDraft` read model through a tested draft-view adapter while preserving
  its legacy fallback projection.
- Fourth slice implemented: `PolicyIntentEditor.vue` now emits validated
  draft-command events (`draft-add-signal`, `draft-set-signal-config`, and
  `draft-clear-signal-config`) so its public write boundary no longer exposes
  legacy custom-signal terminology.
- Fifth slice implemented: modal-level no-op save tests now prove unchanged
  legacy `customSignals` and API-shaped `custom_signals` payloads survive draft
  bridge serialization without losing metadata-only fields, removed markers,
  unsupported custom blocks, or preset weights.
- Sixth slice implemented: the language strict/advisory advanced control now
  writes through draft-owned signal metadata overrides, clearing stale strict
  metadata when the operator returns to the base template behavior while
  preserving unrelated legacy fields and signal values.
- Seventh slice implemented: base-signal removal markers now write through
  draft-owned `signalRemovalOverrides`, with the template helper reduced to
  read-only removal state and restored signals clearing stale
  `customSignals.removed` markers.
- Eighth slice implemented: advanced-template custom additions and removals for
  ratings, genres, languages, and keywords now flow through draft add/remove
  commands instead of direct `customSignals` mutation. Keyword input remains
  UI-local transient state, and removing the final draft-managed value clears
  stale compatibility payload fields.
- Ninth slice implemented: advanced starter-template details now live in
  `PolicyStarterTemplateDetails.vue`, which renders the ratings, genre,
  keyword, language, removal-marker, and strict-mode controls and emits narrow
  event payloads back to the modal.
- Tenth slice implemented: selected starter-template rows now live in
  `PolicySelectedStarterTemplates.vue`, including runtime badges, expansion,
  remove actions, bounded weight updates, and detail-event pass-through.
- Eleventh slice implemented: combined signal presentation now lives in
  `PolicyCombinedSignalsSummary.vue`, keeping the modal on orchestration while
  the read-only summary renders already-normalized combined signal props.
- Twelfth slice implemented: advanced scoring settings now live in
  `PolicyBuilderAdvancedSettings.vue`, while form updates pass through bounded
  `setFormField` state commands for weights, thresholds, and combination mode.
- Thirteenth slice implemented: suggested templates, category tabs, search, and
  available starter-template rows now live in `PolicyStarterTemplateBrowser.vue`
  with explicit browser events for add-all, category/search changes, and
  template toggles.
- Fourteenth slice implemented: the legacy preset migration notice now lives in
  `PolicyPresetMigrationNotice.vue`, with dismissal persistence still owned by
  the reference-data composable and the modal reduced to presence/orchestration.
- Fifteenth slice implemented: advanced settings control metadata now lives in
  `policyBuilderAdvancedControls.js`, giving the advanced settings component
  and policy-builder state normalization one shared source for labels, allowed
  fields, ranges, display formatting, and combination modes.
- Sixteenth slice implemented: read-only selected-library context now lives in
  `PolicyBuilderLibraryContext.vue`, keeping source-of-truth copy out of the
  modal and preserving current-library lookup in the parent.
- See [Policy Builder Phase 2 Implementation](policy-builder-phase-2-implementation.md).
- The intent editor is now on draft read and draft-command write paths with
  modal-level save parity coverage, and the language strict/advisory plus
  base-signal removal and custom-added signal controls are draft-owned. The
  starter-template detail, selected-template shell, combined-signal summary,
  advanced scoring settings, starter-template browser UI, and migration notice
  are now extracted into focused components. The selected-library context is
  now a read-only component, and advanced settings now share one
  rendering/validation contract. Phase 2 now has the draft, state, validation,
  and component boundaries needed for Phase 3 presentation work. New work
  should avoid adding direct `customSignals` mutation paths.

Changes:

- Use `client/src/composables/usePolicyIntentDraft.js` around the pure bridge.
- Continue building draft state from:
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
- Keep the serializer allow-list based so draft metadata cannot become an
  accidental mass-assignment path into policy payloads.

Why this fits next:

- Gives the UI a clean product model.
- Keeps legacy presets intact.
- Avoids premature database migration.
- Makes interpretation and round-trip behavior independently testable.

## Phase 3: Simplify Builder Around Intent Draft

Intent: make the builder feel intent-first after the draft bridge exists.

Phase 0 handles low-risk copy changes on the current additive UI. Phase 3 should
not repeat that work. Phase 3 should use the Phase 2 intent draft as the primary
editing model and push legacy preset mechanics behind advanced disclosure.

Changes:

- Make the intent draft editor the primary body of the modal.
- Move legacy template attachments and raw signal details behind advanced
  disclosure.
- Show template provenance as context, not as the main editable object.
- Preserve legacy template removal semantics.
- Keep the save payload legacy-compatible.
- Keep advanced details available for power users and debugging.

Checkpoint outcome:

Phase 3 is complete for the builder-presentation scope. The intent editor is now
the primary work surface, starter-template mechanics are supporting context, and
the visible controls edit the draft model through legacy-compatible commands.
Further client extraction should be defect-driven or tied to a specific
server/runtime phase.

Implemented:

- Added a read-only policy behavior summary above starter-template mechanics.
- Added `policyIntentSummary.js` to derive Purpose, Hard Limits, Helpful Hints,
  and Review Triggers from the existing draft view.
- Added deterministic weak-intent triggers for empty starter-template selection,
  missing belongs-here signals, missing hard limits/avoid rules, and
  helpful-only policies.
- Added `PolicyIntentSummaryCard.vue` as a prop-only component with no mutation
  or save-path authority.
- Added `PolicyStarterTemplateMechanics.vue` to move template selection,
  selected-template details, and combined signals behind an intent-first
  disclosure. The disclosure stays open for new policies with no templates, but
  collapses by default when templates already exist.
- Moved `PolicyIntentEditor.vue` directly below the policy behavior summary so
  the first editable surface is policy intent, while starter-template mechanics
  remain supporting compatibility context.
- Added `policyIntentEditorSections.js` as the shared contract for intent
  editor labels, option sources, badge styles, and allow-listed draft command
  generation.
- Added `PolicyIntentSectionCard.vue` so each operator-facing intent section is
  rendered by a focused prop-driven component while command generation remains
  in the shared section contract.
- Added intent-specific add-control labels and help copy so each section explains
  the policy effect before the operator chooses a value.
- Added operator-facing intent entry formatting so configured chips read as
  policy behavior (`Belongs here`, `Maximum rating`, `Avoid rating`) instead of
  raw signal keys.
- Added editable remove affordances for draft-managed intent chips, routed
  through the allow-listed section command contract and existing draft remove
  boundary instead of raw preset JSON mutation.
- Split multi-value certification chips into value-specific rows so avoid
  ratings can be removed one at a time without clearing unrelated hard-limit or
  legacy certification settings.
- Added section-specific certification controls so max-rating and avoid-rating
  edits use explicit action buttons instead of the same immediate generic
  selector used for genre signals.
- Added section-specific genre intent controls so belongs-here, helpful-match,
  and confidence-boost edits use distinct operator-facing actions while keeping
  the same draft command contract.
- Added inline chip provenance labels so configured signals show whether they
  came from an intent edit, policy override, starter template, or compatibility
  fallback without opening advanced template mechanics.
- Added compact per-section behavior summaries derived from configured chips so
  users can read the effective policy intent before scanning individual signals.
- Added deterministic per-section weak intent warnings so missing identity,
  helpful-only structure, boost-without-identity, and absent rating-boundary
  cases are visible where operators edit the affected section.
- Added compact warning consequence text so each section warning explains why
  the missing structure can affect review frequency, confidence, or routing
  safety.
- Added a non-blocking Policy Readiness summary above section editing so
  operators can see `Ready`, `Ready with notes`, or `Needs review` before
  scanning individual intent sections.
- Added readiness issue navigation so each readiness row can move focus to the
  affected intent section without mutating draft data or changing save/scoring
  behavior.
- Added compact section completion badges so each intent section shows whether
  it is configured, advisory, optional, or missing required identity evidence.
- Added passive section next-action guidance so each section suggests the
  smallest useful edit based on its current completion state.
- Extracted section visual-state helpers into a focused utility module while
  preserving the existing section contract import surface.
- Extracted intent chip projection, behavior summaries, and draft-command
  construction into a focused utility while preserving the existing section
  contract import surface.
- Added deterministic option availability guardrails so intent controls disable
  and explain already-configured values before duplicate draft commands can be
  emitted.
- Added section-level option diagnostics so controls distinguish missing
  reference options, partially available choices, and fully configured sections.
- Added shared control readiness so disabled add buttons expose a deterministic
  reason through title and accessible label text.
- Extracted shared option rendering, action rendering, secondary actions,
  option/action orchestration, control-view projection, and option/action shell
  layout into focused modules.
- Added editor-to-draft parity coverage proving representative intent controls
  still serialize through the legacy-compatible `customSignals` contract.
- See [Policy Builder Phase 3 Implementation](policy-builder-phase-3-implementation.md)
  for the completion audit.

Why this fits next:

- Low risk.
- No API or database change.
- Builds on the state and draft boundaries from Phases 1 and 2.
- Avoids making users reason about presets before they express intent.

## Phase 4: Add Intent Summary And Warnings

Status: folded into Phase 3 and complete.

Intent: users should see policy behavior, not preset mechanics.

This phase is no longer a separate implementation target. Its original scope was
delivered during Phase 3 because the intent-first presentation work needed the
summary, warnings, provenance, readiness, and section diagnostics before the
builder could be considered usable.

Changes:

- Added an intent summary card near the top of the builder:
  - Purpose
  - Hard limits
  - Helpful hints
  - Review triggers
- Showed starter template provenance:
  - `Seeded from Family template`
  - `Modified from Comedy template`
- Added warnings and diagnostics:
  - `This policy has no hard rating limit.`
  - `This policy relies only on soft matches.`
  - `Generic Comedy is a hint, not a destination rule.`

Why this was folded into Phase 3:

- Helps diagnose weak or ambiguous policies before classification.
- Supports the recent Family, Comedy, and RAG failure modes.
- Keeps the UI focused on decisions users understand.

Planning consequence:

```text
Do not start new Phase 4 client-presentation work unless it fixes a concrete
bug or supports a later server/runtime phase.
```

## Phase 5: Add Server-Side Intent Schema

Intent: make the intent model authoritative on the server, not only a UI projection.

Candidate files:

- `server/src/services/policyIntentContract.mjs`
- `server/src/services/policyIntentSchema.mjs`
- `server/src/services/policyIntentMapper.mjs`
- `server/src/services/policyIntentRequestValidator.mjs`

Initial implementation:

- `policyIntentContract.mjs` derives a read-only `policy_intent_contract` from legacy preset-backed policies.
- The contract is attached to policy read/create/update responses.
- No database migration is required.
- Unsupported legacy preset signals produce warnings and `partial` inference instead of breaking policy loading.

First slice implemented:

- Added `policyIntentSchema.mjs` as the server-owned schema validation boundary
  for policy intent contract metadata, roles, collections, signal types,
  operators, constraint modes, and semantics.
- Added validation metadata to generated `policy_intent_contract` responses so
  future clients and runtime services can distinguish valid contracts from
  warning-only or invalid shapes.
- Enforced server-side semantic boundaries for purpose, hard limits, helpful
  hints, and avoid evidence while preserving legacy policy loading.
- See [Policy Builder Phase 5 Implementation](policy-builder-phase-5-implementation.md).

Second slice implemented:

- Added `policyIntentMapper.mjs` as the route-facing projection boundary for
  detailed policy responses.
- Moved read/create/update route projection through the mapper so route handlers
  no longer compose `configuration_view` and `policy_intent_contract` inline.
- Kept list responses intentionally lightweight while preserving detailed
  policy read/create/update payloads.
- Added focused mapper coverage for non-mutating projection, precomputed
  projection reuse, and generated configuration-view to contract handoff.

Third slice implemented:

- Added route response contract parity coverage for policy read/create/update
  responses so detailed policy payloads consistently include
  `configuration_view` and `policy_intent_contract`.
- Added an explicit policy-list boundary test so list responses remain
  lightweight and do not accidentally expand to full intent projections.
- Kept this slice as API contract hardening only. No storage, scoring, or
  classification behavior changed.

Fourth slice implemented:

- Added `policyIntentRequestValidator.mjs` as the write-side DTO validation
  boundary for future native intent draft input.
- Supports both `policy_intent_draft` and client-style `policyIntentDraft`
  candidates while explicitly returning
  `persistence_enabled: false`.
- Rejects unknown fields and enforces bounded schema version, bucket names,
  signal types, value operators, strings, arrays, payload size, strict
  constraints, avoid entries, and summary preset counts.
- Kept route behavior unchanged. The helper is ready for later preflight
  integration but does not persist native intent or affect classification.

Fifth slice implemented:

- Wired the write-side DTO validator into policy create/update routes as a
  preflight before any database mutation.
- Valid native drafts now return a sanitized
  `policy_intent_write_preflight` diagnostic with schema version, source,
  migration state, preset count, validation status, and explicit
  non-persistence reason.
- Invalid native drafts now fail with a bounded `400` response before policy
  insert/update or preset replacement can run.
- The route still saves through the legacy preset/custom-signal path only; no
  native draft body is persisted, echoed, or used for classification scoring.

Sixth slice implemented:

- The policy builder now sends a cloned `policyIntentDraft` sidecar with the
  existing legacy-compatible save payload.
- `PolicyList` consumes the sanitized `policy_intent_write_preflight`
  diagnostic from create/update responses and surfaces whether the save ran in
  compatibility mode.
- The client normalizes the diagnostic before rendering, does not expose raw
  draft content, and does not treat non-persistence as a save failure.
- Native draft persistence remains disabled until explicit storage migration
  and impact-preview parity work are complete.

Seventh slice implemented:

- Added a side-effect-free `POST /api/policies/intent/impact-preview` endpoint
  that validates native intent drafts before preset lookup and never mutates
  policy storage.
- Added `policyIntentImpactPreview.mjs` as the comparison boundary between the
  legacy `configuration_view` interpretation and the validated native draft.
- Compares identity, compatibility, strict-constraint, booster, and exclusion
  buckets using bounded counts and behavior-relevant fingerprints.
- Returns sanitized parity, impact level, changed buckets, bucket deltas,
  validation status, warning codes, and non-persistence mode without returning
  raw draft bodies, raw preset JSON, prompts, examples, credentials, or traces.
- Added the client API wrapper needed for the next modal-facing preview slice.
- Native draft persistence remains disabled until explicit storage migration
  and impact-preview UX/replay controls are complete.

Eighth slice implemented:

- Added browser-side preview normalization, notice copy, and changed-bucket
  summaries so components do not render raw preview payloads.
- Added a focused preview composable that owns `preview`, `loading`, and
  bounded error state with injected API and payload-builder dependencies.
- Added the modal impact preview card and wired it to the existing
  `buildSavePayload()` path, so preview compares the same legacy-compatible
  payload and native `policyIntentDraft` sidecar that save submits.
- Kept preview refresh separate from create/update. The preview action is
  read-only, user-triggered, non-persistent, and does not block the existing
  save event contract.
- Native draft persistence remains disabled until explicit storage migration,
  stale-preview handling, and representative replay controls are complete.

Ninth slice implemented:

- Added deterministic preview payload fingerprinting in the client preview
  composable using sorted JSON serialization.
- The modal now provides a reactive `buildSavePayload()` projection to the
  preview composable, allowing the UI to compare the latest previewed payload
  against the current draft.
- `PolicyIntentImpactPreviewCard` keeps the last preview visible but marks it
  stale when operators edit intent after preview.
- Stale tracking is client-only, non-persistent, and does not block save or
  change server preview output.
- Native draft persistence remains disabled until explicit storage migration
  and representative replay controls are complete.

Tenth slice implemented:

- Added a side-effect-free `POST /api/policies/intent/replay-preview` endpoint
  that validates the native draft, reuses structural impact preview, and then
  reads a capped representative sample from `classification_history`.
- Added `policyIntentReplayPreview.mjs` as the sampling and sanitization
  boundary. It clamps sample limits, builds parameterized queries, and returns
  explicit no-execution flags for classification, AI, provider, and arr writes.
- Added a client API wrapper for replay preview so the next browser-facing
  panel can consume the route without raw HTTP calls.
- Replay readiness returns only bounded sample context and excludes raw IDs,
  TMDB IDs, metadata, reasons, traces, prompts, draft bodies, provider payloads,
  and persistence commands.
- Native draft persistence remains disabled until browser replay preview,
  actual scoring replay, backup/restore, and rollback proof are complete.

Eleventh slice implemented:

- Added browser-side replay preview normalization, notice copy, sample
  projection, and no-execution messaging.
- Added a focused replay preview composable that owns `preview`, `loading`,
  bounded error, sample, and stale state with injected API and payload-builder
  dependencies.
- Added the modal replay preview card and wired it to the same
  `buildSavePayload()` path as impact preview, with a bounded default
  `replay_limit`.
- Kept replay preview separate from save and structural impact preview. It is
  user-triggered, read-only, non-persistent, and does not run classification,
  AI, providers, or arr writes.
- Native draft persistence remains disabled until explicit Phase 8 storage
  migration, backup/restore, and rollback proof are complete.

Twelfth through nineteenth slices implemented:

- Added deterministic dry-run signal-fit replay for representative samples
  without calling profile, RAG, AI, providers, Arr, classification, queue, or
  persistence paths.
- Added an explicit replay execution context that blocks side effects by
  default and serializes bounded execution summaries.
- Added a replay item adapter so `classification_history` rows become a stable
  policy-engine item contract before deterministic scoring.
- Added policy-engine preview comparison and parity delta summaries so
  operators can see whether representative items would remain, become
  candidates, need review, become blocked, or lack evidence.
- Added sample-selection diagnostics, evidence completeness, and enrichment
  eligibility so empty or weak replay output explains whether the issue is
  missing history, sparse evidence, or a future enrichment opportunity.
- Kept all browser-facing replay payloads sanitized: no raw metadata, IDs,
  prompts, traces, provider payloads, credentials, SQL, or persistence details.

Phase 5 checkpoint status:

- Complete for the non-persistent server-owned intent bridge.
- Complete for preflight and preview safety boundaries needed before native
  storage.
- Not complete for native intent storage, conversion, runtime authority, or
  destructive migration. Those remain Phase 8 or later work by design.

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

## Phase 5A: AI Provider Capability Baseline

Intent: make local and cloud model authority explicit before runtime questions
depend on model output.

Changes:

- Add product-owned provider modes:
  - `structured_contract`,
  - `verification`,
  - `explanation`,
  - `proposal`,
  - `fallback_advisory`.
- Normalize cloud and Ollama/local providers into those modes.
- Track model capability metrics:
  - structured parse success,
  - semantic contract violations,
  - repair attempts and repair success,
  - thinking trace leakage,
  - hallucinated library IDs or option actions,
  - timeout and incomplete-stream rates.
- Downgrade weak or reasoning-heavy local models out of `structured_contract`.
- Require the same semantic normalizer for local and cloud providers.

Why this fits before Phase 5B:

- Runtime clarification should know whether model output is contract-grade or
  advisory before it tries to build operator questions.
- Ollama/local LLM privacy does not remove the need for authority controls.
- Provider capability metrics give operators a way to diagnose bad local-model
  behavior without guessing.

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

Migration and table-change plan:

The database work should be additive first. The current schema already carries a lot of classification state through `classification_history`, `rag_summary`, `rag_trace`, `outcome_path`, `policy_question`, and related JSON payloads. Those fields are useful for compatibility, but they are too overloaded to be the only source of truth for question lifecycle, learning decisions, and cleanup audit.

Official source research, June 2026:

- [PostgreSQL ALTER TABLE documentation](https://www.postgresql.org/docs/current/sql-altertable.html) supports incremental schema changes such as adding columns, constraints, and indexes. This fits an additive migration approach that does not force legacy rows to be rewritten immediately.
- [PostgreSQL transaction documentation](https://www.postgresql.org/docs/current/tutorial-transactions.html) describes committing related updates together or rolling them back together. Cleanup, learning-decision audit, and outcome writes should be transactionally grouped when they are part of one resolution.
- [PostgreSQL constraint documentation](https://www.postgresql.org/docs/current/ddl-constraints.html) emphasizes using constraints to control valid data. New structured tables should constrain state enums, source enums, and required references instead of relying only on JSON conventions.
- [PostgreSQL data definition documentation](https://www.postgresql.org/docs/current/ddl.html) frames tables, constraints, indexes, and privileges as the core tools for controlling stored data. The intent model should move durable lifecycle facts into tables where they can be queried and validated.
- [OWASP Database Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html) recommends secure database configuration and careful handling of database access. New tables should avoid storing secrets and should keep sensitive/free-form AI artifacts out of audit records.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) recommends retaining logs for the required period and not keeping them beyond that time. Cleanup and learning audit rows should have explicit retention expectations.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) recommends audit logs around security-relevant events. Learning and stale-question transitions affect future classification behavior, so they should be auditable.

Recommended migration files:

1. `add_classification_question_state.sql`
   - Add structured lifecycle columns if the existing table supports them:
     - `question_state`,
     - `question_contract_version`,
     - `learning_contract_version`,
     - `stale_reason`,
     - `stale_detected_at`,
     - `replacement_question_id`,
     - `resolved_question_id` or equivalent correlation id.
   - If no dedicated question table exists, keep these values in `policy_question.meta` first and add a generated/reporting table later.
   - Add partial indexes for active pending questions and stale questions.
2. `add_classification_learning_decisions.sql`
   - Create append-only `classification_learning_decisions`.
   - Persist the guard decision that authorized or blocked learning.
   - Include:
     - `classification_id`,
     - `question_id` or `question_correlation_id`,
     - `actor_type`,
     - bounded `actor_reference`,
     - `selected_library_id`,
     - `learning_tier`,
     - `learning_reason`,
     - `evidence_class`,
     - `allowed_side_effects` JSONB,
     - `blocked_side_effects` JSONB,
     - `side_effect_results` JSONB,
     - `created_at`.
   - Add check constraints for known actor types, learning tiers, and evidence classes.
3. `add_classification_question_cleanup_events.sql`
   - Create append-only cleanup events for post-upgrade, scheduled, and manual cleanup.
   - Include:
     - `classification_id`,
     - `question_id` or correlation id,
     - `cleanup_source`,
     - `cleanup_action`,
     - `stale_reason`,
     - `replacement_question_id`,
     - dry-run/apply flag,
     - `created_at`.
   - Add indexes on `classification_id`, `cleanup_source`, `cleanup_action`, and `created_at`.
4. `backfill_policy_question_contract_metadata.sql`
   - Backfill safe defaults only:
     - missing learning metadata -> `eligible: false`, `reason: "legacy_question"`,
     - missing question state -> infer `pending`, `resolved`, or `stale` from existing status/outcome fields,
     - deprecated genre-priority wording -> `stale_reason: "deprecated_question_shape"`.
   - Do not infer durable learning eligibility from old AI text.
5. `reconcile_policy_question_seed_data.sql`
   - Seed or reconcile contract version constants, known cleanup actions, and allowed learning tiers if the app uses DB-backed settings.
   - Make this idempotent with `INSERT ... ON CONFLICT` or equivalent existing migration conventions.

Tables/fields to retain for compatibility:

- Retain `classification_history.policy_question` until all resolution paths read from structured question state.
- Retain `rag_summary`, `rag_trace`, `ranked_candidates`, `decision_diagnostics`, and `outcome_path`; they remain valuable provenance and diagnostics.
- Retain legacy preset/custom-signal storage until native intent storage is fully implemented and impact-preview parity exists.
- Retain outcome history even when stale questions are retired.

Tables/fields to avoid or defer dropping:

- Do not drop legacy policy question JSON in the same release that introduces structured learning decisions.
- Do not drop old RAG or policy diagnostics while the UI still renders classification details from them.
- Do not drop preset/custom-signal JSON until starter-template migration is complete and reversible.
- Do not remove old outcome payload fields until the release notes and post-upgrade bridge prove all existing installs are migrated.

Fields to avoid adding:

- Raw prompts.
- Raw provider payloads.
- Embeddings.
- Discord tokens or mention strings.
- API keys.
- Full user identifiers when a bounded actor reference is enough.
- Free-form AI instructions that could later be interpreted as policy commands.

Migration safety rules:

- Prefer additive migrations over destructive migrations.
- Make backfills idempotent.
- Make post-upgrade cleanup separately runnable in dry-run mode.
- Use explicit state and reason enums where practical.
- Use JSONB for side-effect details only when the shape is diagnostic and not part of routing logic.
- Keep routing-critical state queryable through typed columns or constrained values.
- Add indexes for active operational queries, not every diagnostic field.
- Update `database/schema/current.sql` only from a fresh schema dump after migrations are proven.

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
9. Add additive migrations for structured question lifecycle, learning-decision audit, cleanup events, and legacy metadata backfill.
10. Add outcome payload fields for:
   - learning tier,
   - learning reason,
   - allowed learning types,
   - blocked learning types,
   - evidence class.
11. Add tests for blocked broad genre questions, exact-only corrections, identity-eligible animation questions, rating hard-limit conflicts, stale questions, duplicate resolution submissions, changed policy intent, AI-authored questions without normalizer metadata, migration backfill defaults, dry-run cleanup counts, and idempotent cleanup apply mode.

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

## Phase 5C: Question And Answer Contract

Intent: make pending-item questions and answers stable product contracts instead
of ad hoc AI text or UI labels.

Changes:

- Add a server-owned question contract with:
  - contract version,
  - uncertainty type,
  - candidate libraries,
  - evidence summary,
  - stable option actions,
  - learning metadata.
- Add a server-owned answer contract with:
  - selected option id,
  - final outcome,
  - final library id when applicable,
  - learning decision,
  - optional policy suggestion.
- Ensure answers can resolve a classification without mutating policy.
- Route policy suggestions into a later policy-review path.

Why this fits after Phase 5B:

- The normalizer decides what uncertainty exists.
- The question contract decides what the operator can safely answer.
- The answer contract prevents UI labels, Discord values, or AI text from
  becoming hidden policy commands.

## Phase 5D: Learning Guard And Stale Cleanup

Intent: separate final outcomes from durable learning and clean up obsolete
runtime questions.

Changes:

- Add a learning guard as the only service that authorizes durable learning
  side effects from question resolution.
- Default broad, ambiguous, AI-authored, or missing-evidence questions to
  `learning.eligible = false`.
- Preserve ineligible answers as outcome history and diagnostics.
- Detect stale pending questions caused by:
  - old question contract versions,
  - deprecated genre-priority wording,
  - missing learning metadata,
  - changed candidate library references,
  - changed policy intent.
- Support dry-run cleanup before apply mode.
- Prefer additive audit/cleanup storage when persistence is needed.

Why this fits before Phase 6B:

- Starter-template improvements are less useful if runtime learning can still
  reinforce bad genre-priority questions.
- Cleanup prevents old pending cards from teaching behavior that the new intent
  model explicitly rejects.
- It preserves user trust by making "resolved" and "learned" different
  auditable outcomes.

## Phase 6: Replay-Safe Enrichment Preview

Intent: prove sparse representative replay samples can be improved through
explicit read-only enrichment adapters without changing policy storage,
classification history, queues, provider caches, Arr state, or runtime
classification behavior.

Changes:

- Add a replay enrichment adapter contract that is blocked by default.
- Separate provider readiness from adapter enablement.
- Enable one adapter source at a time only through explicit replay execution
  context flags.
- Start with TMDB metadata because it has stable IDs and deterministic field
  mapping.
- Return sanitized before/after field availability instead of raw provider
  payloads.
- Preserve the no-AI, no-Arr-write, no-persistence replay guarantee until a
  later component explicitly opts into more behavior.
- Implemented: the default replay route shows a TMDB dry-run adapter preview
  while keeping it blocked unless a server-side execution context explicitly
  enables `tmdb_metadata` and live provider calls.
- Implemented: the TMDB adapter is injectable and testable with fixture
  payloads, returns only field names, field counts, status, and reason codes,
  and does not expose TMDB IDs, titles, overviews, keywords, studio names,
  URLs, API keys, cache keys, or raw provider payloads.
- Implemented: a quota-aware TMDB execution switch requires both server env
  opt-in and explicit request opt-in, checks provider readiness, quota, and
  cooldown state, and keeps the standard replay route blocked by default.
- Next: add replay outcome comparison for TMDB metadata coverage so operators
  can see which sparse fields would become usable before any enrichment result
  is persisted or classification behavior changes.

Why this fits next:

- Phase 5 can now say which samples are sparse and which providers appear
  ready; Phase 6 defines whether replay is allowed to use any enrichment source
  at all.
- A blocked adapter contract prevents provider readiness from being mistaken for
  provider execution.
- Adapter-specific opt-in keeps replay parity testable before full classifier
  replay or native storage migration.

Implementation:

- See [Policy Builder Phase 6 Implementation](policy-builder-phase-6-implementation.md).

## Phase 6B: Convert Presets Into Starter Templates

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

## Phase 7B: Generate Policies From Library Application

Intent: let operators rebuild policies from how their media server libraries are
already organized, without destructive automatic replacement.

Changes:

- Add a read-only `Generate Policy From Library` or `Rebuild Policy From
  Library` preview action.
- Use observed library profiles, rating normalization, outlier detection, and
  existing explicit policy constraints to produce a proposed intent draft.
- Show:
  - proposed `Belongs Here` rules,
  - proposed `Helpful Matches`,
  - proposed `Hard Limits`,
  - proposed `Avoid` rules,
  - confidence,
  - assumptions,
  - warnings,
  - route readiness.
- Require explicit operator acceptance before activation.
- Archive the previous policy before replacement.
- Keep rollback metadata and prior preset/custom-signal payloads.
- Support dry-run bulk preview before any bulk replacement workflow exists.

Why this fits after impact preview:

- Impact preview gives operators a way to understand what a generated policy
  would change before accepting it.
- Library-derived generation aligns with the core model that the media server is
  the source of truth for existing application.
- It moves Classifarr away from manually assembling policies from presets while
  still protecting existing installs.

Non-goals:

- Do not delete existing policies automatically.
- Do not treat observed absence as confirmed exclusion without operator review.
- Do not let broad genres become destination identity without profile confidence
  and supporting evidence.
- Do not write native intent storage until Phase 8 or later.

## Phase 8: Migrate To Native Intent Storage After Parity

Intent: move policy intent out of legacy preset/custom-signal compatibility
storage after the intent model has proven parity and rollback safety.

This is part of the plan, but it is deliberately gated. Native storage should
not be the mechanism used to discover the product model; it should be the
mechanism used to preserve the proven product model.

Entry gates:

- Phase 2 intent draft bridge can round-trip legacy policies without behavior
  loss.
- Phase 5 server-side intent contract validates policy intent consistently.
- Phase 7 impact preview can compare legacy behavior and native-intent behavior
  against representative classifications.
- Backup and restore include native intent records.
- Rollback can restore the previous preset/custom-signal policy state.
- Generated/rebuilt policies from Phase 7B can be archived, compared, accepted,
  and reverted.
- Post-upgrade can run in dry-run mode and report conversion candidates before
  applying changes.

Planned tables:

```text
library_policy_intent
policy_intent_rules
policy_template_applications
policy_intent_archives
policy_intent_migration_events
```

Migration shape:

1. Add native intent tables while keeping legacy preset/custom-signal storage.
2. Backfill native drafts from existing policies in dry-run/report mode first.
3. Show conversion readiness and parity warnings in the UI.
4. Let the operator explicitly convert a policy after preview/replay.
5. Read native intent first only for converted policies.
6. Keep the legacy payload archived for rollback.
7. Leave unconverted policies on the compatibility path.
8. Only consider defaulting new policies to native storage after converted
   policies prove stable across releases.

Non-goals:

- Do not automatically convert all policies on upgrade.
- Do not drop legacy preset/custom-signal storage in Phase 8.
- Do not infer hard limits from observed absence without operator confirmation.
- Do not let native storage bypass the same server-side intent validation.

Why not earlier:

- Current `customSignals` compatibility path works.
- The UX still needs refinement.
- A premature schema migration would add risk before the model stabilizes.
- Runtime questions and learning need authority boundaries before native storage
  becomes the policy source of truth.

## Migration Strategy

No automatic destructive migration.

Native intent migration is planned for Phase 8, but it should remain explicit,
reversible, and parity-gated:

1. Existing policies load as preset-backed policies.
2. The builder shows inferred intent and template provenance.
3. Direct intent edits save through compatibility payloads.
4. Library-derived policy generation can propose replacement policies from
   observed media-server application.
5. Generated policies remain inactive until the operator accepts them.
6. Accepting a generated policy archives the previous policy for rollback and
   audit instead of deleting it.
7. A Phase 8 `Convert to native intent storage` action writes native intent
   records for explicitly selected policies.
8. Conversion requires impact preview or replay before it can be applied.
9. Converted policies keep archived legacy payloads for rollback.
10. Unconverted policies continue using the compatibility path.

Replacement safety rules:

- Existing policies are archived, not destroyed.
- Generated policies must carry confidence, assumptions, and warnings.
- Generated hard limits must identify whether they came from explicit policy
  intent, observed absence, or confirmed operator review.
- Bulk regeneration starts as dry-run only.
- Rollback should restore prior preset attachments, weights, thresholds, and
  `customSignals`.

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
- Runtime question contract tests:
  - broad genre-priority AI output is rejected or rewritten,
  - unknown library IDs are rejected before options are shown,
  - question options use stable allow-listed actions,
  - AI output cannot create policy-write or durable-learning actions,
  - answer resolution can set a final library without mutating policy,
  - policy suggestions require a separate review path.
- Learning guard tests:
  - broad genre ambiguity is not learning-eligible,
  - hard-constraint conflicts require explicit policy anchors,
  - AI disagreement alone cannot become durable learning,
  - stale questions cannot apply answers against obsolete candidate libraries.
- Ollama/local-LLM contract tests:
  - schema-constrained local output still runs through semantic validation,
  - thinking traces are stripped or ignored before persistence,
  - thinking-capable models are not allowed to create policy mutations or durable
    learning,
  - malformed local output downgrades model authority instead of expanding
    parser tolerance,
  - incomplete streaming responses cannot become learning-eligible answers,
  - provider/model/mode/schema/contract metadata is preserved in the decision
    trace.

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

Work should move in two coordinated lanes after the Phase 5 checkpoint.

Builder lane:

1. Treat Phase 3 client presentation and Phase 5 non-persistent server intent
   bridge work as checkpoint complete.
2. Avoid more client-only extraction unless it fixes a defect, removes a known
   blocker, or prepares a specific server-side intent contract.
3. Use the existing draft bridge, intent contract, write preflight, impact
   preview, and replay preview tests as the compatibility guard for future
   policy-builder edits.
4. The next practical builder UX item is profile refresh result feedback in the
   library context card: after refresh, show whether the profile was rebuilt,
   how many usable genres/signals are now available, or why no profile evidence
   exists.
5. The next Phase 5 follow-up, if continuing replay parity, is replay-safe
   provider readiness projection: show whether eligible source categories are
   configured and quota-safe without exposing API keys or making live provider
   calls.

Runtime lane:

1. Implement Phase 5A provider capability baseline:
   - explicit local/cloud provider modes,
   - Ollama thinking/structured-output handling,
   - model capability metrics,
   - downgrade behavior for weak local models.
2. Implement Phase 5B runtime clarification normalizer:
   - reject or rewrite genre-priority prompts,
   - normalize AI uncertainty into server-owned enums,
   - keep deterministic server logic as the final question author.
3. Implement Phase 5C question and answer contracts:
   - stable option actions,
   - final outcome separate from policy suggestion,
   - no inline policy mutation from pending-item answers.
4. Implement Phase 5D learning guard and stale cleanup:
   - learning eligibility metadata,
   - durable-learning allow lists,
   - stale legacy question detection,
   - dry-run cleanup before apply mode.

The builder now has the start of a tested state boundary. The runtime needs the
same boundary: AI may identify uncertainty, but deterministic server logic
decides the final operator question, answer semantics, and whether the answer is
allowed to become durable learning.

Do not advance to library-derived policy generation until impact preview can
show what a generated policy would change.

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
- Should AI be allowed to emit policy proposals directly, or should it only emit evidence that deterministic services convert into proposals?
- Which runtime answer options should be allowed to create policy suggestions for later review?
- Should pending-item cards show policy suggestions inline, or should they route operators to the policy builder?
