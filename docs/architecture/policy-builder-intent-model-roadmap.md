# Policy Builder Intent Model Roadmap

Status: active roadmap under re-imagination. Earlier Phase 0 through Phase 3
builder presentation work was implemented and checkpointed, but Phases 0, 1, 2,
3, 5, and 6 have been reset into source-of-truth, boundary, server-authority,
and engine-roadmap phases. Prior Phase 5 work remains useful as raw server
authority material: contract validation, write preflight, impact preview, and
representative replay preview must now be classified as keep, rewrite, replace,
or delete. Existing Phase 6 replay/TMDB enrichment work is scheduled for
deconstruction: reusable engine pieces should be extracted, redundant
operator-facing surfaces should be removed, and the replacement workflow should
center on media requests, manual decisions, guarded learning, and library
profile updates. Native intent storage, conversion, and runtime authority remain
planned Phase 8R work after the re-imagined contracts and rollback safety are
proven.

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

## June 2026 Design Reset

The roadmap must optimize for automation, not for exposing every internal
diagnostic surface.

Recent Phase 5 and early Phase 6 work proved valuable service boundaries:
server-owned intent contracts, preview safety, deterministic replay, provider
readiness projection, and sanitized TMDB metadata comparison. Those pieces are
useful for testing and debugging, but they should not define the normal product
workflow.

The default operator experience should be:

```text
connect media server -> understand each library -> classify automatically -> ask only when necessary
```

The default policy-builder experience should not be:

```text
inspect impact preview -> inspect replay preview -> inspect provider gates -> reason about TMDB coverage -> decide internal behavior
```

Design reset decisions:

- Media-server library contents are the primary source of observed application.
- Policy builder should start from "what already belongs here" and let the
  operator correct or constrain it.
- TMDB and other metadata providers should support background enrichment,
  profile freshness, and cache quality. They should not become a manual
  policy-building workflow.
- Impact/replay/provider diagnostics should be deconstructed into reusable
  engine checks, migration verifiers, or removed from the product path.
- Runtime questions should ask about destination fit, not genre priority.
- Durable learning must be guarded separately from final outcome resolution.
- New work should reduce operator decisions unless it is a maintainer-only
  migration verifier with explicit ownership and removal criteria.

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

Phase 0R does not build this full mechanism. Phase 0R defines the authority
model and visible language so later phases can add state, routing, readiness,
and guarded learning without changing the mental model again.

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
  -> create rollback snapshot of existing policy
  -> activate accepted policy
  -> Phase 7R migration verification when replacing legacy behavior
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
- rollback snapshot references.

Archival rule:

```text
Existing policies are snapshotted for rollback, not destroyed.
```

The rollback snapshot should preserve the prior preset attachments, weights,
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

Explicit conversion can come later after Phase 7R migration verification proves
behavior is stable.

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
| 0R | Source of truth and vocabulary reset | Shared authority model and product language | None | Later phases use one vocabulary |
| 1R | Builder state and engine boundary reset | UI orchestration, draft state, reference data, and engine contracts have clear ownership | None | Prevents UI state from becoming policy authority |
| 2R | Intent draft bridge as compatibility boundary | Draft edits are typed commands over declared intent, while legacy serialization stays isolated | Legacy-compatible save only | None directly |
| 3R | Operator workflow rebuild | Policy authoring becomes destination-oriented and evidence-backed, not modal-internals-driven | None | Reduces manual policy decisions |
| 4R | Folded presentation checkpoint | Prior summary/warning work is reclassified under Phase 3R workflow ownership | None | None |
| 5R | Server authority, runtime questions, and learning guard | Server owns intent validation, question contracts, model authority, and learning decisions | Additive audit/cleanup only when needed | Runtime decisions use guarded server contracts |
| 6R | Re-imagined policy engine roadmap | Existing Phase 6 artifacts are classified as keep/rewrite/replace/delete | None directly | Engine contracts replace diagnostic product flow |
| 7R | Runtime automation and library rebuild | Runtime decisions use the new engine, and library-derived rebuild is explicit, guarded, and reversible | Rollback snapshots only until Phase 8R | Fewer questions and safer policy replacement |
| 8R | Native intent storage and legacy removal | Native intent becomes the durable policy model after 0R-7R contracts prove stable | New intent tables plus bounded rollback snapshots | Runtime reads native intent and legacy paths are removed after gates |
| 9R | Production naming and contract stabilization | Phase-coded implementation names are replaced with durable product names | No schema behavior change unless rename migrations are explicitly required | Runtime keeps native behavior while public/internal code names stop referencing roadmap phases |

Non-negotiable sequencing rules:

- Do not add new policy controls before Phase 0R vocabulary and Phase 1R state
  boundaries are clear.
- Do not let AI-authored clarification text drive learning before Phase 5R
  model authority, question normalization, answer contracts, and learning guard
  boundaries are in place.
- Do not generate replacement policies from libraries before Phase 6R defines
  evidence, intent, learning, readiness, and migration contracts.
- Do not drop legacy preset/custom-signal storage until Phase 8R parity, backup,
  restore, replay, and rollback are proven.
- Do not treat phase-coded service, route, contract, event, or test names as
  permanent production architecture. Phase names are planning language; durable
  product code must be renamed after the replacement model is proven.
- Do not treat local Ollama execution as lower risk; local models still go
  through the same semantic normalizer and authority limits.

Phase 5R is intentionally split into components because runtime clarification,
answer resolution, learning, stale cleanup, model capability, and verifier
cutlines are separate failure domains. They should not ship as one large hidden
refactor.

## Phase 0R: Source Of Truth And Vocabulary Reset

Intent: establish the product language and authority model before any further
builder or engine work. Phase 0R does not add controls for the sake of controls;
it defines the concepts every later phase must use.

This replaces the old copy-cleanup framing. That work was useful, but the
re-imagined system needs a stronger foundation: Classifarr is not asking users
to build scoring rules. Classifarr is learning what each destination means from
media-server application, explicit operator intent, and guarded outcomes.

The Phase 0R product statement is:

```text
The media server shows what is already true.
The operator states what should remain true.
Classifarr reconciles both and automates the routine decisions.
```

Non-negotiable vocabulary:

- **Library**: a connected media-server collection with real current contents.
- **Destination**: a library Classifarr may classify or route items into.
- **Observed application**: what the current library contents demonstrate.
- **Declared intent**: what the operator explicitly says should belong or not
  belong.
- **Evidence**: normalized facts that may support intent or a decision.
- **Learning**: a guarded durable update derived from outcomes, not every answer
  or AI explanation.
- **Readiness**: whether Classifarr has enough intent, evidence, and routing
  context to automate safely.
- **Starter template**: optional shortcut for drafting intent, not a policy
  authority model.
- **Legacy policy**: existing preset/custom-signal compatibility shape that must
  be bridged and eventually replaced after parity.

Terms to avoid in product-facing policy authoring:

- `scoring weights` as the primary explanation,
- `identity signals` without plain-language context,
- `compatibility signals` without plain-language context,
- `replay parity`,
- `provider gate`,
- `TMDB coverage`,
- `internal diagnostic panels`,
- broad `genre priority` questions.

## Phase 0R Component Map

### 0R.1 Authority Vocabulary

Intent: define which source is allowed to mean what.

Tasks:

- Document source authority levels:
  - media-server contents show observed application,
  - operator edits declare intent,
  - manual outcomes may become learning only through the learning guard,
  - AI text can explain or propose but cannot directly authorize learning,
  - metadata providers enrich evidence but do not own policy meaning,
  - legacy presets/templates seed drafts but do not remain the final authority.
- Add a glossary table for user-facing and internal terms.
- Replace roadmap language that implies presets or provider diagnostics are the
  core model.
- Identify current UI labels that still teach the wrong model.

Acceptance criteria:

- Every later phase can point to one vocabulary source.
- Authority boundaries are clear enough to design tests against.
- The roadmap no longer treats templates, replay, or providers as policy
  authority.

Implementation record:

- Phase 0R.1 authority vocabulary is documented in
  [Policy Builder Phase 0R Authority Vocabulary](policy-builder-phase-0r-authority-vocabulary.md).
- The server-side vocabulary contract lives in
  `server/src/services/policyAuthorityVocabulary.mjs`.

### 0R.2 User Mental Model

Intent: make the default explanation simple enough for normal setup.

Tasks:

- Standardize the primary explanation around:

  ```text
  What already belongs here?
  What should always or never belong here?
  When should Classifarr ask?
  Can this destination route?
  ```

- Define the short labels used by policy UX:
  - `Belongs Here`,
  - `Helpful Matches`,
  - `Hard Limits`,
  - `Avoid`,
  - `Ask When Unsure`,
  - `Routing Target`,
  - `Readiness`.
- Define when helper copy must mention observed evidence versus declared intent.
- Remove language that asks operators to manage internals before destination
  meaning is established.
- Define the approved interaction pattern for each term so Phase 3R can choose
  simple controls without re-opening the authority model.
- Define the approved field-group contract for each term so future controls can
  distinguish observed multi-selects, declared multi-selects, declared
  checklists, status summaries, and next-action statuses without turning every
  setup card into an editor.
- Provide a default setup-copy audit that later UI phases can run before
  rendering or changing policy-builder copy.

Acceptance criteria:

- Product copy can explain policy setup without mentioning scoring internals.
- Labels map cleanly to engine concepts from Phase 6R.
- Broad genres are framed as evidence, not automatic destination identity.
- Setup-copy changes can be audited for approved labels, helper text,
  observed-evidence context, declared-intent context, internal diagnostic
  language, and broad-genre authority wording.
- Default setup-copy and policy-term audits verify labels, helper text,
  interaction pattern, Phase 6R concept mapping, and authority-source
  alignment.
- Default setup-card audits verify that each setup section has one plain
  question, one primary action, one empty-state explanation, one completion
  signal, approved Phase 0R terms only, and no diagnostic or broad-genre
  authority language.
- Default setup-field-group audits verify that multi-select and checklist
  controls are explicitly editable where allowed, observed suggestions require
  operator acceptance before becoming intent, status surfaces remain read-only,
  and no field group persists policy intent directly.

Implementation record:

- Phase 0R.2 user mental model is documented in
  [Policy Builder Phase 0R User Mental Model](policy-builder-phase-0r-user-mental-model.md).
- The server-side user mental model contract lives in
  `server/src/services/policyUserMentalModel.mjs`.
- The contract now exposes setup-copy validation helpers so later UI phases can
  verify product language before adding or changing controls.
- The contract now exposes default setup copy, approved interaction patterns,
  and a full mental-model audit so Phase 3R can build multi-select and
  readiness surfaces from a bounded vocabulary instead of raw presets or
  diagnostics.
- The contract now exposes an approved four-step setup sequence and setup-step
  audit so Phase 3R can simplify the UI around observed application, declared
  destination rules, review behavior, and routing readiness without exposing
  internal diagnostics as normal controls.
- The contract now exposes default setup cards and setup-card audits so Phase
  3R can render the normal policy setup path as four simple operator-facing
  cards before adding detailed controls behind each action.
- The contract now exposes first-run setup journey stages and a journey audit
  so later UI work must preserve one operator goal, one primary action, one
  completion signal, one system boundary, and one avoided failure mode per
  setup stage.
- The contract now exposes setup-surface roles and audits so later UI work can
  distinguish observed suggestion review, declared-intent editing,
  review-trigger editing, and readiness status without allowing any setup
  surface to persist policy intent or execute routing directly.
- The contract now exposes setup field groups and audits so later UI work can
  render simple multi-select, checklist, status, and next-action surfaces
  without blurring observed suggestions, declared intent, readiness, or the
  explicit save path.
- The contract now exposes setup answer shapes and audits so later UI and
  runtime work can distinguish explicit observed-suggestion acceptance, draft
  intent edits, review-trigger edits, and readiness status without hiding
  policy persistence, learning, or routing side effects inside a setup answer.

### 0R.3 Legacy Compatibility Vocabulary

Intent: keep existing installs working without presenting the old shape as the
future model.

Tasks:

- Define how the UI should refer to legacy preset/custom-signal policy data.
- Rename presets as starter templates in product language.
- State that starter templates mutate an intent draft and are not durable policy
  authority after native intent storage exists.
- Document rollback snapshots as bounded safety records, not parallel copies of
  the old experience.
- Identify legacy terms that should remain only in API/storage/migration docs.

Acceptance criteria:

- Existing policy payloads can remain compatible without leaking old vocabulary
  into the main product flow.
- Migration language distinguishes bridge, rollback snapshot, and final native
  intent storage.
- No roadmap section implies the legacy shape is permanent.

Implementation record:

- Phase 0R.3 legacy compatibility vocabulary is documented in
  [Policy Builder Phase 0R Legacy Compatibility Vocabulary](policy-builder-phase-0r-legacy-compatibility-vocabulary.md).
- The server-side legacy compatibility vocabulary contract lives in
  `server/src/services/policyLegacyCompatibilityVocabulary.mjs`.

### 0R.4 Question And Learning Vocabulary

Intent: stop vague runtime questions from shaping the policy model.

Tasks:

- Define acceptable question framing:
  - destination fit,
  - missing evidence,
  - hard-limit conflict,
  - routing gap,
  - stale profile,
  - outlier review.
- Define unacceptable question framing:
  - broad genre priority,
  - AI-authored open-ended policy edits,
  - provider-specific diagnostics,
  - replay/parity interpretation by the operator.
- Define answer outcomes separately from learning side effects:
  - resolve this item,
  - remember exact item,
  - add compatibility evidence,
  - add identity evidence,
  - add hard-limit evidence,
  - do not learn.

Acceptance criteria:

- Phase 5R question and learning components can use Phase 0R vocabulary
  directly.
- Discord/UI questions can be normalized to the same terms.
- Manual resolution does not imply durable learning by default.

Implementation record:

- Phase 0R.4 question and learning vocabulary is documented in
  [Policy Builder Phase 0R Question And Learning Vocabulary](policy-builder-phase-0r-question-learning-vocabulary.md).
- The server-side question and learning vocabulary contract lives in
  `server/src/services/policyQuestionLearningVocabulary.mjs`.

### 0R.5 Documentation And Test Alignment

Intent: make the roadmap actionable before implementation resumes.

Tasks:

- Update implementation docs to use Phase 0R vocabulary.
- Identify client tests that assert old labels or old product assumptions.
- Identify server tests that should assert authority separation.
- Add a checklist that future implementation tasks must satisfy before changing
  UI or runtime behavior:
  - source of truth identified,
  - authority level identified,
  - learning side effect identified or explicitly absent,
  - rollback/migration impact identified,
  - operator-facing language validated.

Acceptance criteria:

- Phase 0R produces a vocabulary checklist for future PRs.
- Old terminology is either replaced or explicitly marked as legacy/internal.
- Implementation can move into Phase 1R without debating product meaning again.

Implementation record:

- Phase 0R.5 documentation and test alignment is documented in
  [Policy Builder Phase 0R Documentation And Test Alignment](policy-builder-phase-0r-documentation-test-alignment.md).
- The server-side checklist contract lives in
  `server/src/services/policyPhase0RChecklist.mjs`.

## Phase 0R Work Sequence

Implement Phase 0R in this order:

1. **0R.1 Authority Vocabulary**
   Establishes source-of-truth rules.
2. **0R.2 User Mental Model**
   Defines what operators should see and understand.
3. **0R.3 Legacy Compatibility Vocabulary**
   Keeps existing installs safe without making legacy permanent.
4. **0R.4 Question And Learning Vocabulary**
   Aligns runtime questions with policy intent.
5. **0R.5 Documentation And Test Alignment**
   Converts the reset into implementation guardrails.

Current starting point:

- Re-evaluate existing Phase 0 implementation artifacts against Phase 0R.
- Do not add more policy-builder controls until old labels and assumptions are
  classified as current, legacy/internal, or delete/replace.
- Use Phase 0R as the vocabulary contract for Phase 1R through Phase 6R.

Implementation record:

- Existing implementation details are documented in
  [Policy Builder Phase 0 Implementation](policy-builder-phase-0-implementation.md).
- Phase 0R.1 authority vocabulary is documented in
  [Policy Builder Phase 0R Authority Vocabulary](policy-builder-phase-0r-authority-vocabulary.md).
- Phase 0R.2 user mental model is documented in
  [Policy Builder Phase 0R User Mental Model](policy-builder-phase-0r-user-mental-model.md).
- Phase 0R.3 legacy compatibility vocabulary is documented in
  [Policy Builder Phase 0R Legacy Compatibility Vocabulary](policy-builder-phase-0r-legacy-compatibility-vocabulary.md).
- Phase 0R.4 question and learning vocabulary is documented in
  [Policy Builder Phase 0R Question And Learning Vocabulary](policy-builder-phase-0r-question-learning-vocabulary.md).
- Phase 0R.5 documentation and test alignment is documented in
  [Policy Builder Phase 0R Documentation And Test Alignment](policy-builder-phase-0r-documentation-test-alignment.md).
- Phase 0R now produces a vocabulary, authority, compatibility, question,
  learning, documentation, and test-alignment contract. Phase 1R should start
  with a builder state and engine boundary inventory rather than new UI
  controls.

## Phase 1R: Builder State And Engine Boundary Reset

Intent: re-evaluate the existing policy-builder state extraction so UI
orchestration, draft editing, reference data, and future engine contracts have
clear ownership. Phase 1R is not another modal-cleanup phase; it prevents the UI
from becoming the accidental policy engine.

The earlier Phase 1 implementation extracted useful composables:

- `usePolicyBuilderState.js`
- `usePolicyBuilderReferenceData.js`
- `usePolicyBuilderTemplateSignals.js`
- `usePolicyBuilderCombinedSignals.js`

Those boundaries were good for reducing modal size, but the re-imagined system
needs stronger separation:

```text
UI orchestration
  != intent authority
  != evidence generation
  != learning side effects
  != migration verification
```

Phase 1R must classify each current client-side boundary as presentation,
draft orchestration, compatibility bridge, or delete/rewrite candidate.

## Phase 1R Component Map

### 1R.1 Existing Boundary Inventory

Intent: determine which current builder modules still make sense under the
Phase 0R and Phase 6R model.

Tasks:

- Inventory current policy-builder files:
  - modal orchestration,
  - state composables,
  - reference-data composables,
  - starter-template helpers,
  - combined-signal summaries,
  - intent editor components,
  - advanced settings components,
  - tests tied to old UI behavior.
- Classify each file as:
  - **Presentation only**,
  - **UI orchestration**,
  - **Draft state**,
  - **Legacy compatibility bridge**,
  - **Reference data adapter**,
  - **Engine candidate**,
  - **Delete/replace after Phase 6R**.
- Identify any module that currently mixes more than one authority boundary.
- Record the cutline in the Phase 1 implementation doc.

Acceptance criteria:

- Every policy-builder client module has an ownership classification.
- Mixed-boundary modules have a rewrite or extraction target.
- No module is allowed to become engine authority just because it already has
  convenient state.
- The inventory exposes a freshness audit that fails on unclassified modules or
  required boundary rules with no current client-tree coverage.
- Boundary rule definitions expose owner IDs and fail when a rule allows client
  engine authority, omits a Phase 6R cutline, or uses an invalid engine/delete
  action.

Implementation record:

- Phase 1R.1 boundary inventory is documented in
  [Policy Builder Phase 1R Boundary Inventory](policy-builder-phase-1r-boundary-inventory.md).
- The server-side inventory contract lives in
  `server/src/services/policyBuilderPhase1BoundaryInventory.mjs`.
- The inventory now includes `PolicyCombined*` policy-builder paths and
  classifies combined-signal legacy product surfaces as Phase 6R delete/replace
  candidates.
- The inventory now includes a rule-owner and cutline audit so future
  classifications cannot silently make client modules authoritative.

### 1R.2 UI Orchestration Boundary

Intent: keep the modal responsible for flow coordination only.

Tasks:

- Define what `PolicyBuilderModal.vue` may own:
  - open/close lifecycle,
  - high-level save/cancel actions,
  - child component composition,
  - loading and error presentation,
  - command routing to owned composables.
- Define what it must not own:
  - evidence generation,
  - intent inference,
  - learning decisions,
  - readiness decisions,
  - migration/parity decisions,
  - raw legacy payload mutation.
- Identify remaining modal responsibilities that should move to focused
  components or composables.

Acceptance criteria:

- The modal reads as orchestration, not policy logic.
- New Phase 6R engine results can be passed in as data without embedding engine
  calculations in the modal.
- Tests assert visible behavior and command routing, not internal scoring.
- Current modal touchpoints are explicitly mapped to allowed responsibilities or
  extraction targets, and prohibited responsibilities fail the orchestration
  audit.
- Public modal events are explicitly bounded to visibility, close, and delegated
  save payloads with runtime emit validators and no policy-authority payloads.

Implementation record:

- Phase 1R.2 UI orchestration boundary is documented in
  [Policy Builder Phase 1R UI Orchestration Boundary](policy-builder-phase-1r-ui-orchestration-boundary.md).
- The server-side modal orchestration contract lives in
  `server/src/services/policyBuilderModalOrchestrationContract.mjs`.
- The contract now includes a modal touchpoint audit for current save,
  composition, preview, profile refresh, legacy-adapter, summary-projection, and
  save-failure behavior.
- The contract now includes a public event audit for `update:modelValue`,
  `save`, and `close`, and the Vue modal declares runtime emit validators for
  those events.

### 1R.3 Draft State Boundary

Intent: make client draft state an editable projection, not the source of truth.

Tasks:

- Define draft state as a client-side editing model derived from server or
  compatibility data.
- Keep draft commands allow-listed and narrow.
- Prevent draft metadata from becoming mass-assignment into save payloads.
- Separate draft fields into:
  - declared intent edits,
  - compatibility payload metadata,
  - UI-only transient state,
  - future server-owned evidence/readiness projections.
- Identify any current draft command that still exposes legacy `customSignals`
  concepts to product components.

Acceptance criteria:

- Draft state can represent operator intent without claiming durable authority.
- Save serialization remains explicitly allow-listed.
- UI-only fields cannot leak into policy payloads.
- Future evidence/readiness data can be displayed without being saved as intent.
- Public draft-state operations are audited so they cannot claim durable
  authority, persist UI-only state, persist server projections, reference
  unknown commands, or build unsafe save payloads.

Implementation record:

- Phase 1R.3 draft state boundary is documented in
  [Policy Builder Phase 1R Draft State Boundary](policy-builder-phase-1r-draft-state-boundary.md).
- The server-side draft boundary contract lives in
  `server/src/services/policyBuilderDraftStateBoundary.mjs`.
- The contract now includes a draft-operation audit for form updates,
  starter-template selection, preset weights, UI expansion state, signal
  commands, legacy custom-signal aliases, and save payload building.

### 1R.4 Reference Data Boundary

Intent: stop treating static dropdown data as equivalent to observed library
evidence.

Tasks:

- Split reference data into categories:
  - static options,
  - configured libraries,
  - starter templates,
  - observed profile suggestions,
  - routing/mapping status,
  - migration notices.
- Ensure observed profile suggestions are labeled as evidence-backed options,
  not generic dropdown choices.
- Keep provider-derived options behind server-owned projections; the client
  should not infer policy meaning from raw provider data.
- Identify reference-data calls that should eventually move behind Phase 6R
  evidence/readiness endpoints.

Acceptance criteria:

- The client can distinguish "available option" from "observed evidence."
- Library-profile suggestions can be shown without giving the client authority
  to compute learning or readiness.
- Existing reference-data tests cover category separation.
- Reference-data records and merged option lists can be audited for provenance,
  authority drift, readiness computation, policy persistence, routing-status
  leakage, and migration-notice intent leakage.

Implementation record:

- Phase 1R.4 reference data boundary is documented in
  [Policy Builder Phase 1R Reference Data Boundary](policy-builder-phase-1r-reference-data-boundary.md).
- The server-side reference-data boundary contract lives in
  `server/src/services/policyBuilderReferenceDataBoundary.mjs`.
- The contract now includes record and option provenance audits for
  `library_profile` observed evidence and `preset_reference` static options.

### 1R.5 Legacy Compatibility Boundary

Intent: keep legacy preset/custom-signal behavior working while preventing it
from shaping the new product model.

Tasks:

- Identify all client code that reads or writes:
  - preset attachments,
  - starter-template weights,
  - `customSignals`,
  - removed markers,
  - strict/advisory metadata,
  - compatibility fallback projections.
- Move product-facing components away from legacy terminology.
- Keep legacy mutation inside bridge/serializer functions.
- Mark old helper modules as bridge code, not engine code.
- Define when bridge modules should be deleted or replaced after Phase 8R native
  intent storage.

Acceptance criteria:

- Product components do not mutate raw legacy payloads directly.
- Legacy compatibility remains regression-tested.
- Bridge ownership is explicit enough to delete later.
- Compatibility modules, artifact ownership, raw mutation, product-facing raw
  access, and Phase 8R deletion gates can be audited before legacy bridge code
  is changed or removed.

Implementation record:

- Phase 1R.5 legacy compatibility boundary is documented in
  [Policy Builder Phase 1R Legacy Compatibility Boundary](policy-builder-phase-1r-legacy-compatibility-boundary.md).
- The server-side legacy compatibility boundary contract lives in
  `server/src/services/policyBuilderLegacyCompatibilityBoundary.mjs`.
- The contract now includes a compatibility ownership audit and Phase 8R
  deletion-readiness evaluator.

### 1R.6 Test Boundary Reset

Intent: make tests protect the new architecture instead of freezing old UI
internals.

Tasks:

- Categorize existing tests as:
  - keep as behavior regression,
  - rewrite around Phase 0R vocabulary,
  - rewrite around draft/bridge boundaries,
  - rewrite around future evidence/readiness contracts,
  - delete when abandoned diagnostic UI is removed.
- Add tests for boundary rules:
  - modal does not generate evidence,
  - draft commands are allow-listed,
  - reference options and observed evidence are distinct,
  - legacy payload mutation stays in bridge code,
  - legacy compatibility ownership audits remain clean,
  - legacy deletion remains blocked until all Phase 8R gates are complete,
  - UI-only state is not serialized.
- Avoid adding snapshot-style tests that freeze transitional layout.

Acceptance criteria:

- Tests fail when authority boundaries are violated.
- Tests do not require preserving old diagnostic or legacy-first UI shape.
- Phase 2R can proceed with confidence that draft ownership is clear.

Implementation record:

- Phase 1R.6 test boundary reset is documented in
  [Policy Builder Phase 1R Test Boundary Reset](policy-builder-phase-1r-test-boundary-reset.md).
- The server-side test boundary reset contract lives in
  `server/src/services/policyBuilderTestBoundaryReset.mjs`.

## Phase 1R Work Sequence

Implement Phase 1R in this order:

1. **1R.1 Existing Boundary Inventory**
   Establishes what the current code actually owns.
2. **1R.2 UI Orchestration Boundary**
   Keeps the modal from becoming policy logic.
3. **1R.3 Draft State Boundary**
   Keeps editable intent separate from durable authority.
4. **1R.4 Reference Data Boundary**
   Separates available options from observed evidence.
5. **1R.5 Legacy Compatibility Boundary**
   Contains old preset/custom-signal behavior.
6. **1R.6 Test Boundary Reset**
   Ensures future work does not regress the architecture.

Current starting point:

- Re-evaluate existing Phase 1 implementation artifacts against Phase 1R.
- Do not add new policy-builder state to the modal until the module inventory is
  complete.
- Do not let client reference data become evidence or learning authority.
- Use Phase 1R as the client boundary contract for Phase 2R through Phase 6R.

Implementation record:

- Existing implementation details are documented in
  [Policy Builder Phase 1 Implementation](policy-builder-phase-1-implementation.md).
- Phase 1R.1 boundary inventory is documented in
  [Policy Builder Phase 1R Boundary Inventory](policy-builder-phase-1r-boundary-inventory.md).
- Phase 1R.2 UI orchestration boundary is documented in
  [Policy Builder Phase 1R UI Orchestration Boundary](policy-builder-phase-1r-ui-orchestration-boundary.md).
- Phase 1R.3 draft state boundary is documented in
  [Policy Builder Phase 1R Draft State Boundary](policy-builder-phase-1r-draft-state-boundary.md).
- Phase 1R.4 reference data boundary is documented in
  [Policy Builder Phase 1R Reference Data Boundary](policy-builder-phase-1r-reference-data-boundary.md).
- Phase 1R.5 legacy compatibility boundary is documented in
  [Policy Builder Phase 1R Legacy Compatibility Boundary](policy-builder-phase-1r-legacy-compatibility-boundary.md).
- Phase 1R.6 test boundary reset is documented in
  [Policy Builder Phase 1R Test Boundary Reset](policy-builder-phase-1r-test-boundary-reset.md).
- Phase 1R is complete when the implementation records above and their
  boundary tests pass together.

## Phase 2R: Intent Draft Bridge As Compatibility Boundary

Intent: define the intent draft as a typed editing projection, not durable policy
authority. The draft bridge should let the UI edit declared intent safely while
legacy preset/custom-signal serialization remains isolated and replaceable.

The earlier Phase 2 implementation proved valuable pieces:

- pure projection from legacy presets and `customSignals` into intent buckets,
- `usePolicyIntentDraft` state synchronization,
- draft-command events from product components,
- legacy-compatible save serialization,
- parity tests proving no-op saves preserve legacy payloads,
- focused components for starter-template details, selected templates, combined
  signal summaries, advanced settings, browser rows, migration notice, and
  library context.

Phase 2R reclassifies that work:

```text
intent draft = editable declared-intent projection
legacy bridge = serializer/deserializer for current storage
engine contract = future server authority, not client draft state
```

The draft may help operators edit intent, but it must not become the evidence
engine, learning engine, readiness engine, or final native storage model.

## Phase 2R Component Map

### 2R.1 Draft Contract Definition

Intent: define what an intent draft is allowed to represent.

Tasks:

- Define draft fields around Phase 0R vocabulary:
  - `belongs_here`,
  - `helpful_matches`,
  - `hard_limits`,
  - `avoid`,
  - `ask_when`,
  - `routing_target`,
  - `assumptions`,
  - `warnings`,
  - `source_metadata`.
- Separate draft fields by authority:
  - operator-declared intent,
  - inferred compatibility projection,
  - UI-only transient state,
  - server-provided read-only evidence/readiness projections,
  - legacy bridge metadata.
- Explicitly forbid draft state from owning:
  - observed evidence generation,
  - learning decisions,
  - provider-readiness decisions,
  - routing side effects,
  - migration acceptance.
- Document which fields can eventually map to native intent storage and which
  are compatibility-only.

Acceptance criteria:

- The draft contract can be read without understanding `customSignals`.
- Every draft field has an authority classification.
- UI-only and compatibility-only fields are marked so they do not become native
  intent by accident.
- The draft contract has an executable audit that fails unknown fields, missing
  authority or native mapping, unsafe persistence flags, observed evidence
  inside declared intent, and raw legacy terminology in product-facing fields.

Implementation record:

- Phase 2R.1 draft contract definition is documented in
  [Policy Builder Phase 2R Draft Contract Definition](policy-builder-phase-2r-draft-contract.md).
- The server-side Phase 2R draft contract lives in
  `server/src/services/policyBuilderPhase2DraftContract.mjs`.

### 2R.2 Legacy Bridge Isolation

Intent: keep legacy compatibility working while preventing legacy shape from
owning the product model.

Tasks:

- Keep all preset/custom-signal projection logic inside bridge modules.
- Keep all save serialization allow-listed.
- Preserve unsupported legacy payload blocks on no-op saves.
- Preserve preset weights, removed markers, strict/advisory metadata, and
  compatibility fallback fields only through bridge ownership.
- Add a bridge inventory that identifies:
  - deserializer responsibilities,
  - serializer responsibilities,
  - no-op preservation responsibilities,
  - migration-only metadata,
  - deletion conditions after native storage.

Acceptance criteria:

- Product components never read or write raw `customSignals` directly.
- Legacy payload preservation is tested independently of UI layout.
- Bridge code has explicit deletion/replacement criteria for Phase 8R.
- The bridge isolation contract has an executable audit that fails unsafe
  responsibility ownership, serializer key drift, unsupported preservation
  overlap, raw mutation outside the bridge, and missing Phase 8R deletion gates.

Implementation record:

- Phase 2R.2 legacy bridge isolation is documented in
  [Policy Builder Phase 2R Legacy Bridge Isolation](policy-builder-phase-2r-legacy-bridge-isolation.md).
- The server-side Phase 2R bridge isolation contract lives in
  `server/src/services/policyBuilderPhase2LegacyBridgeIsolation.mjs`.

### 2R.3 Draft Command Boundary

Intent: make every operator edit a narrow, typed command.

Tasks:

- Keep draft writes behind allow-listed commands such as:
  - add signal,
  - remove signal,
  - configure signal,
  - clear configuration,
  - set routing target when supported,
  - acknowledge warning when supported.
- Ensure commands use product terms rather than legacy storage terms.
- Validate command payloads before they touch draft state.
- Prevent commands from mutating read-only evidence/readiness projections.
- Identify current commands that should be renamed or split for Phase 6R.

Acceptance criteria:

- Invalid draft commands fail before serialization.
- Commands cannot create arbitrary compatibility payload fields.
- Future multi-select controls can emit batched typed commands without changing
  legacy bridge internals.
- The command boundary has an executable audit that fails unsafe command
  categories, payload authority drift, implemented future commands,
  operator-facing bridge adapters, read-only projection mutation, raw legacy
  terminology, and missing Phase 6R rename or split targets.

Implementation record:

- Phase 2R.3 draft command boundary is documented in
  [Policy Builder Phase 2R Draft Command Boundary](policy-builder-phase-2r-draft-command-boundary.md).
- The server-side Phase 2R draft command boundary contract lives in
  `server/src/services/policyBuilderPhase2DraftCommandBoundary.mjs`.
- Current bridge-adapter commands that need Phase 6R rename or split work are:
  `set_signal_config`, `set_signal_metadata`, and `set_signal_removal`.

### 2R.4 Draft View Projection

Intent: give product components a stable read model that does not expose bridge
internals.

Tasks:

- Define a draft-view projection for:
  - configured intent chips,
  - candidate options,
  - provenance labels,
  - section summaries,
  - warnings,
  - readiness placeholders,
  - observed-evidence placeholders.
- Keep presentation formatting out of bridge modules.
- Keep provenance clear:
  - operator edit,
  - starter template,
  - compatibility fallback,
  - observed evidence suggestion,
  - server projection.
- Identify any current view fields that combine presentation formatting with
  policy meaning.

Acceptance criteria:

- Components consume draft-view data, not bridge payloads.
- Provenance is visible without exposing raw legacy storage.
- Future server evidence/readiness projections can be added as read-only view
  data without changing save semantics.
- The draft-view contract has an executable audit that fails unknown fields,
  unsafe command hints, raw legacy storage exposure, view mutation, save
  serialization, invalid server placeholders, compatibility-adapter command
  leakage, provenance alias collisions, and raw legacy terms in view labels.

Implementation record:

- Phase 2R.4 draft view projection is documented in
  [Policy Builder Phase 2R Draft View Projection](policy-builder-phase-2r-draft-view-projection.md).
- The server-side Phase 2R draft view projection contract lives in
  `server/src/services/policyBuilderPhase2DraftViewProjection.mjs`.
- The client draft-view projection now exposes product-facing provenance,
  provenance counts, and read-only readiness/observed-evidence placeholders in
  `client/src/utils/policyIntentDraftView.js`.

### 2R.5 Server Authority Preparation

Intent: prepare the draft bridge to defer authority to server-owned contracts.

Tasks:

- Identify where client draft validation should remain client-side UX guardrail
  versus where Phase 5R server validation must be authoritative.
- Ensure save payloads can include explicit draft intent without trusting client
  inference.
- Align draft warnings with server-side intent contract names where possible.
- Prepare for server-provided profile-to-intent suggestions from Phase 6R.
- Document how the draft bridge will behave when native intent storage exists:
  - create from native intent,
  - edit native intent projection,
  - serialize to native intent,
  - retain legacy bridge only for unconverted policies.

Acceptance criteria:

- The client draft bridge is clearly subordinate to server validation.
- Native intent storage can replace legacy serialization without rewriting the
  product components.
- Phase 5R server contract and Phase 6R engine contracts have a clear insertion
  point.
- The server authority contract has an executable audit that fails client
  authority confusion, server authority loss, raw draft echo, missing insertion
  points, warning reason-code drift, missing native-storage replacement steps,
  and premature native storage activation.

Implementation record:

- Phase 2R.5 server authority preparation is documented in
  [Policy Builder Phase 2R Server Authority Preparation](policy-builder-phase-2r-server-authority-preparation.md).
- The server-side Phase 2R authority preparation contract lives in
  `server/src/services/policyBuilderPhase2ServerAuthorityPreparation.mjs`.
- The current write path accepts explicit `policyIntentDraft` input only through
  server request validation and sanitized preflight diagnostics; native intent
  persistence remains disabled until Phase 8R storage gates pass.

### 2R.6 Draft Parity And Regression Tests

Intent: protect compatibility while avoiding tests that freeze the wrong model.

Tasks:

- Keep tests that prove no-op legacy saves preserve payloads.
- Add or update tests that assert:
  - product components emit typed draft commands,
  - commands cannot mutate read-only projections,
  - bridge serialization is allow-listed,
  - draft view hides raw legacy storage,
  - provenance is preserved across projection and serialization,
  - UI-only transient fields do not serialize.
- Mark tests tied only to old diagnostic or advanced legacy UI as rewrite/delete
  candidates for Phase 6R and Phase 8R.

Acceptance criteria:

- Tests protect the draft as an editing projection.
- Tests do not imply the client draft is durable authority.
- Tests preserve legacy compatibility until native storage replaces it.

Implementation status:

- Phase 2R.6 draft parity and regression tests are documented in
  [Policy Builder Phase 2R Draft Parity And Regression Tests](policy-builder-phase-2r-draft-parity-regression-tests.md).
- The server-side Phase 2R parity audit contract lives in
  `server/src/services/policyBuilderPhase2DraftParityRegression.mjs`.
- The client save payload builder now uses an explicit policy form field
  allow-list so UI-only state, read-only projections, and raw legacy placeholders
  cannot serialize before server validation.
- Phase 6R and Phase 8R rewrite/delete candidates are tracked explicitly rather
  than treated as permanent policy-builder contracts.

## Phase 2R Work Sequence

Implement Phase 2R in this order:

1. **2R.1 Draft Contract Definition**
   Defines what the draft is and is not.
2. **2R.2 Legacy Bridge Isolation**
   Contains current storage compatibility.
3. **2R.3 Draft Command Boundary**
   Makes operator edits safe and typed.
4. **2R.4 Draft View Projection**
   Keeps components away from bridge internals.
5. **2R.5 Server Authority Preparation**
   Makes room for Phase 5R and Phase 6R server contracts.
6. **2R.6 Draft Parity And Regression Tests**
   Protects compatibility without freezing old UX.

Current starting point:

- Re-evaluate existing Phase 2 implementation artifacts against Phase 2R.
- Do not expand draft state with evidence, learning, or readiness authority.
- Do not let bridge serializer details leak into product components.
- Use Phase 2R as the draft/editing contract for Phase 3R through Phase 6R.

Implementation record:

- Existing implementation details are documented in
  [Policy Builder Phase 2 Implementation](policy-builder-phase-2-implementation.md).
- Phase 2R.1 draft contract definition is documented in
  [Policy Builder Phase 2R Draft Contract Definition](policy-builder-phase-2r-draft-contract.md).
- Phase 2R.2 legacy bridge isolation is documented in
  [Policy Builder Phase 2R Legacy Bridge Isolation](policy-builder-phase-2r-legacy-bridge-isolation.md).
- Phase 2R.3 draft command boundary is documented in
  [Policy Builder Phase 2R Draft Command Boundary](policy-builder-phase-2r-draft-command-boundary.md).
- Phase 2R.4 draft view projection is documented in
  [Policy Builder Phase 2R Draft View Projection](policy-builder-phase-2r-draft-view-projection.md).
- Phase 2R.5 server authority preparation is documented in
  [Policy Builder Phase 2R Server Authority Preparation](policy-builder-phase-2r-server-authority-preparation.md).
- Phase 2R.6 draft parity and regression tests are documented in
  [Policy Builder Phase 2R Draft Parity And Regression Tests](policy-builder-phase-2r-draft-parity-regression-tests.md).
- Phase 2R is complete. Future updates should treat the draft bridge as a
  compatibility boundary for Phase 3R, Phase 5R, Phase 6R, and Phase 8R until
  native intent storage replaces it.

## Phase 3R: Operator Workflow Rebuild

Intent: rebuild the policy-authoring surface around destination meaning and
observed library evidence. Phase 3R is not about making the existing modal more
polished; it decides which UI concepts survive the re-imagined workflow.

The earlier Phase 3 work proved useful components and patterns:

- intent summary cards,
- section cards,
- typed add/remove controls,
- provenance labels,
- weak-intent warnings,
- readiness summaries,
- option availability guardrails,
- starter-template mechanics as supporting context,
- editor-to-draft parity tests.

Phase 3R reclassifies that work around a simpler operator flow:

```text
select library
  -> see what already belongs here
  -> accept or edit a small intent draft
  -> confirm hard limits only when needed
  -> see readiness
  -> save or defer
```

The product surface should not ask operators to reason about replay, provider
readiness, TMDB coverage, raw scoring weights, or legacy preset internals.

## Phase 3R Component Map

### 3R.1 Workflow Inventory And Cutline

Intent: classify current policy-builder UI pieces before adding more controls.

Tasks:

- Inventory current policy-builder UI components and utilities:
  - modal shell,
  - policy behavior summary,
  - intent editor,
  - intent section cards,
  - genre/rating/language/keyword controls,
  - option select/action controls,
  - starter-template mechanics,
  - combined-signal summaries,
  - advanced settings,
  - readiness summaries,
  - preview/replay/diagnostic panels,
  - tests tied to those surfaces.
- Classify each artifact as:
  - **Keep**: supports destination-oriented workflow directly.
  - **Rewrite**: useful concept but too coupled to old modal or legacy payloads.
  - **Replace**: product need remains, but UI shape is wrong.
  - **Delete**: exists only to expose internals or old diagnostics.
- Record which components are allowed in the normal policy-authoring path.
- Record which components are migration/support-only and must not shape normal
  UX.

Acceptance criteria:

- Every current builder surface has a keep/rewrite/replace/delete decision.
- No new UI work starts before its target role is classified.
- Diagnostic surfaces are not preserved as a parallel policy-builder path.

Implementation status:

- Phase 3R.1 workflow inventory and cutline is documented in
  [Policy Builder Phase 3R Workflow Inventory And Cutline](policy-builder-phase-3r-workflow-inventory-cutline.md).
- The server-side Phase 3R workflow inventory contract lives in
  `server/src/services/policyBuilderPhase3WorkflowInventory.mjs`.
- The live client-tree scan currently classifies all policy-builder surfaces and
  keeps replay, impact preview, provider readiness, raw scoring weights,
  migration notices, starter-template mechanics, bridge internals, and
  presentation tests out of the normal policy-authoring path.

### 3R.2 Destination-First Flow

Intent: make the first thing users see the destination meaning, not policy
mechanics.

Tasks:

- Define the normal workflow around:
  - choose/select connected library,
  - review observed library meaning,
  - accept or edit proposed intent,
  - confirm hard limits,
  - confirm routing readiness.
- Move starter-template selection behind the destination context. Templates may
  help fill gaps, but they should not be the first object users reason about.
- Replace generic policy-builder sections with destination questions:
  - `What belongs here?`,
  - `What should not go here?`,
  - `What helps but should not decide alone?`,
  - `When should Classifarr ask?`,
  - `Can this route?`.
- Define empty states for new libraries, sparse libraries, and unmapped
  libraries.

Acceptance criteria:

- A user can understand the policy without opening starter-template mechanics.
- Library context appears before advanced policy mechanics.
- Empty/sparse/unmapped states tell the operator the next action, not internals.

Implementation status:

- Phase 3R.2 destination-first flow is documented in
  [Policy Builder Phase 3R Destination-First Flow](policy-builder-phase-3r-destination-first-flow.md).
- The server-side Phase 3R destination-first flow contract lives in
  `server/src/services/policyBuilderPhase3DestinationFirstFlow.mjs`.
- The normal workflow is now explicitly ordered as select library, review
  observed destination meaning, accept or edit declared intent, confirm hard
  limits, confirm routing readiness, and save or defer.
- Starter templates are allowed only after destination context is visible, and
  new/sparse/unmapped libraries each map to one operator next action.

### 3R.3 UI Component System And Interaction Reset

Intent: define the reusable policy-builder UI primitives before rebuilding
screens, so the product does not keep accumulating one-off cards, dropdowns,
warnings, preview boxes, and action buttons.

Tasks:

- Inventory current policy-builder UI primitives:
  - modal and section containers,
  - summary/readiness cards,
  - warning and next-action messages,
  - option selects,
  - multi-select/chip controls,
  - action buttons,
  - observed-profile suggestion rows,
  - empty/loading/error states,
  - template detail/mechanics surfaces.
- Define the target component set around Phase 0R vocabulary:
  - `DestinationContextCard`,
  - `ObservedProfileSummary`,
  - `IntentSignalPicker`,
  - `IntentSignalChipList`,
  - `HardLimitControl`,
  - `AvoidControl`,
  - `ReviewTriggerControl`,
  - `ReadinessNextActionCard`,
  - `StarterTemplateSuggestion`,
  - `MigrationVerifierPanel` for maintainer/verifier-only flows.
- Prefer multi-select and chip-based editing for simple belongs-here,
  helpful-match, avoid, and review-trigger values.
- Clearly separate values that already exist in the library from values that
  are merely available:
  - observed in library,
  - suggested from observed profile,
  - suggested from starter template,
  - common static option,
  - already declared,
  - unavailable because of conflicting intent.
- Define how observed library evidence can prefill UI suggestions without
  silently becoming declared intent.
- Define consistent interaction rules:
  - add values through typed draft commands,
  - remove values through typed draft commands,
  - disabled choices explain the reason,
  - destructive or blocking controls require explicit confirmation,
  - readiness cards link to the exact component that can resolve the issue.
- Define the deletion/replacement decision for old UI primitives that only
  expose internal diagnostics or legacy preset mechanics.

Acceptance criteria:

- New policy-builder UI work uses a small documented component vocabulary.
- Multi-select controls are the default for simple grouped signal editing.
- Observed library values can be surfaced as suggestions without becoming
  rules until the operator accepts them.
- Old modal-specific controls have keep/rewrite/replace/delete decisions before
  new screens are built.
- Accessibility and keyboard behavior are specified at the component level, not
  only in page-level tests.

Implementation status:

- Phase 3R.3 UI component system and interaction reset is documented in
  [Policy Builder Phase 3R UI Component System And Interaction Reset](policy-builder-phase-3r-component-system-reset.md).
- The server-side Phase 3R component-system contract lives in
  `server/src/services/policyBuilderPhase3ComponentSystem.mjs`.
- The target component vocabulary now includes destination context, observed
  profile, signal picker, chip list, hard-limit, avoid, review-trigger,
  readiness next-action, starter-template suggestion, and migration verifier
  components.
- Option source semantics, typed-command interaction rules, explicit observed
  evidence acceptance, disabled-state explanations, and component-level
  accessibility requirements are pinned before Vue screen rebuild work starts.

### 3R.4 Evidence-Backed Option Selection

Intent: options should communicate whether they are generic choices or observed
library evidence.

Tasks:

- Support multi-select controls where users add several simple intent signals at
  once.
- Split option sources visually and structurally:
  - observed in this library,
  - common/static option,
  - starter-template suggestion,
  - operator-added custom value,
  - unavailable/already configured.
- Show evidence counts or confidence when available from server projections.
- Keep observed evidence read-only until the operator explicitly accepts it into
  declared intent.
- Avoid presenting broad genres as identity without supporting evidence.

Acceptance criteria:

- The UI distinguishes `available option` from `observed evidence`.
- Multi-select emits typed draft commands, not raw bridge mutations.
- Suggested options explain why they are suggested.
- Already configured values are disabled or clearly marked.

Implementation status:

- Phase 3R.4 evidence-backed option selection is documented in
  [Policy Builder Phase 3R Evidence-Backed Option Selection](policy-builder-phase-3r-evidence-backed-option-selection.md).
- The server-side Phase 3R option-selection contract lives in
  `server/src/services/policyBuilderPhase3EvidenceBackedOptionSelection.mjs`.
- Option candidates now normalize source label, selection state, evidence
  count, confidence, explanation, disabled reason, and command identity before
  any UI control can treat them as selectable.
- Observed library evidence is read-only until explicit operator acceptance;
  selectable suggestions and custom values emit typed draft commands only.
- Broad common/static or custom genre values are blocked from becoming
  destination identity without supporting evidence.

### 3R.5 Hard Limits And Avoid UX

Intent: make constraints simple, explicit, and hard to confuse with hints.

Tasks:

- Separate hard limits from helpful/boosting evidence visually and structurally.
- Require explicit operator action for constraints that can block routing or
  classification.
- Keep absence-based suggestions as review warnings, not automatic exclusions.
- Show examples of what a hard limit would block when available.
- Ensure rating/certification controls support clear max-rating and avoid-rating
  semantics without conflating them.

Acceptance criteria:

- Operators can tell the difference between a hint and a blocker.
- Hard limits require explicit declared intent.
- Avoid controls do not silently learn from observed absence.

Implementation status:

- Phase 3R.5 hard limits and avoid UX is documented in
  [Policy Builder Phase 3R Hard Limits And Avoid UX](policy-builder-phase-3r-hard-limit-avoid-ux.md).
- The server-side Phase 3R constraint UX contract lives in
  `server/src/services/policyBuilderPhase3HardLimitAvoidUx.mjs`.
- Constraint controls are split into hard limit, avoid, and review warning
  records with explicit blocking/advisory intent semantics.
- Hard limits and avoid controls require explicit operator action and typed
  draft commands; observed absence can create only review warnings.
- Certification controls now separate max allowed rating from avoid rating so
  future UI work cannot conflate blocker and advisory behavior.

### 3R.6 Readiness And Next Action Surface

Intent: replace dense diagnostics with a small action-oriented readiness summary.

Tasks:

- Define the visible readiness states from Phase 6R:
  - `Ready`,
  - `Needs examples`,
  - `Needs review`,
  - `Needs routing`,
  - `Blocked by hard limit`,
  - `Stale profile`.
- Show one next action per readiness issue.
- Link readiness issues to the relevant destination section or setting.
- Remove raw replay, parity, provider, TMDB, and scoring explanations from the
  normal workflow.
- Keep old preview/replay panels only as migration verifier candidates pending
  Phase 6R cutline decisions.

Acceptance criteria:

- Readiness answers what to do next.
- Readiness does not require understanding internal scoring or provider state.
- Diagnostic panel tests are rewritten around readiness or marked for deletion.

Implementation status:

- Phase 3R.6 readiness and next action surface is documented in
  [Policy Builder Phase 3R Readiness And Next Action Surface](policy-builder-phase-3r-readiness-next-action-surface.md).
- The server-side Phase 3R readiness contract lives in
  `server/src/services/policyBuilderPhase3ReadinessNextActionSurface.mjs`.
- The normal readiness model now has six visible states and six issue records,
  each mapped to exactly one next action and one resolving destination workflow
  step/component.
- The readiness projection selects the highest-priority issue while preserving
  the full issue list for secondary display.
- Impact preview, replay preview, provider readiness, TMDB live preview,
  scoring details, and parity delta are classified as migration verifier-only
  surfaces outside the normal authoring workflow.

### 3R.7 Starter Template Role Reset

Intent: keep templates useful without letting them remain the policy mental
model.

Tasks:

- Present starter templates as optional accelerators after destination context.
- Show what a template would add in Phase 0R vocabulary:
  - belongs-here suggestions,
  - helpful suggestions,
  - hard-limit suggestions,
  - avoid suggestions.
- Prevent templates from obscuring observed library evidence.
- Make template provenance visible but secondary.
- Identify template mechanics components that become bridge-only or delete-after
  native storage.

Acceptance criteria:

- Users can build a policy without selecting a template.
- Applying a template mutates the intent draft through typed commands.
- Template internals are not the normal editing surface.

Implementation status:

- Phase 3R.7 starter template role reset is documented in
  [Policy Builder Phase 3R Starter Template Role Reset](policy-builder-phase-3r-starter-template-role-reset.md).
- The server-side Phase 3R starter-template role contract lives in
  `server/src/services/policyBuilderPhase3StarterTemplateRoleReset.mjs`.
- Starter templates are now modeled as optional post-destination accelerators
  with secondary provenance, not required policy authority.
- Template suggestions map into Phase 0R vocabulary buckets: Belongs Here,
  Helpful Matches, Hard Limits, and Avoid.
- Applying a template suggestion emits existing Phase 2R `add_signal` draft
  commands instead of mutating raw template mechanics.
- Template mechanics, weights, raw custom signals, removed markers, and
  strict/advisory metadata are classified as bridge-only or Phase 8R
  delete-after-native-storage targets.

### 3R.8 Accessibility And Decision Load

Intent: keep the new surface simple, keyboard-accessible, and lower decision
load than the current builder.

Tasks:

- Audit labels, helper text, disabled-state explanations, focus movement, and
  action button names.
- Ensure multi-select and chip removal controls have clear accessible names.
- Reduce repeated warnings and avoid showing the same concept in multiple
  panels.
- Prefer one clear next action over multiple simultaneous advisory cards.
- Identify UI copy that still sounds like engineering diagnostics.

Acceptance criteria:

- The normal workflow can be completed with keyboard navigation.
- Disabled actions explain why they are unavailable.
- The UI has fewer decision points than the current policy builder.

Implementation status:

- Phase 3R.8 accessibility and decision load is documented in
  [Policy Builder Phase 3R Accessibility And Decision Load](policy-builder-phase-3r-accessibility-decision-load.md).
- The server-side Phase 3R accessibility and decision-load contract lives in
  `server/src/services/policyBuilderPhase3AccessibilityDecisionLoad.mjs`.
- Every Phase 3R target component now maps to an accessibility and
  decision-load surface before Vue screens are rebuilt.
- Normal workflow surfaces require labels, helper text, keyboard operation,
  visible focus, no internal diagnostic language, and at most one primary
  action.
- Multi-select, chip removal, disabled reason, destructive confirmation, and
  readiness next-action requirements are pinned as executable audit rules.

### 3R.9 Presentation Test Reset

Intent: make tests protect the simplified workflow instead of freezing the old
modal shape.

Tasks:

- Categorize Phase 3 tests as:
  - keep as workflow regression,
  - rewrite around destination-first flow,
  - rewrite around evidence-backed options,
  - rewrite around readiness next actions,
  - delete with abandoned diagnostic surfaces.
- Add tests for:
  - starter templates are secondary to destination context,
  - observed evidence suggestions are distinct from declared intent,
  - multi-select emits typed draft commands,
  - component primitives expose accessible names and disabled reasons,
  - hard limits require explicit action,
  - readiness links to next action,
  - old internal diagnostic panels are absent from normal workflow once replaced.

Acceptance criteria:

- Tests preserve the simplified workflow, not the old layout.
- Product-facing tests use Phase 0R vocabulary.
- Draft/bridge behavior remains covered by Phase 2R tests rather than duplicated
  in presentation tests.

Implementation status:

- Phase 3R.9 presentation test reset is documented in
  [Policy Builder Phase 3R Presentation Test Reset](policy-builder-phase-3r-presentation-test-reset.md).
- The server-side Phase 3R presentation test reset contract lives in
  `server/src/services/policyBuilderPhase3PresentationTestReset.mjs`.
- Current policy-builder presentation tests are categorized as keep, rewrite,
  delete, or Phase 2R-owned draft bridge coverage before client test rewrites
  continue.
- Required presentation behaviors now cover starter-template ordering,
  observed evidence versus declared intent, typed multi-select commands,
  accessible names and disabled reasons, explicit hard-limit action, readiness
  next-action links, and absence of normal-path diagnostic panels.
- Replay, impact preview, and raw starter-template mechanics tests are marked
  as abandoned normal-path diagnostics instead of simplified workflow
  requirements.
- The first Vue-facing Phase 3R rewrite is documented in
  [Policy Builder Phase 3R Vue Setup Cards](policy-builder-phase-3r-vue-setup-cards.md).
  The modal now renders four setup cards after library context and keeps impact
  and replay verifier panels out of the default workflow unless explicitly
  enabled.

## Phase 3R Work Sequence

Implement Phase 3R in this order:

1. **3R.1 Workflow Inventory And Cutline**
   Prevents more UI polish on surfaces that should be deleted.
2. **3R.2 Destination-First Flow**
   Establishes the primary product path.
3. **3R.3 UI Component System And Interaction Reset**
   Defines the reusable controls before screens are rebuilt.
4. **3R.4 Evidence-Backed Option Selection**
   Makes library evidence usable without making it automatic authority.
5. **3R.5 Hard Limits And Avoid UX**
   Keeps blockers explicit and safe.
6. **3R.6 Readiness And Next Action Surface**
   Replaces diagnostics with action-oriented status.
7. **3R.7 Starter Template Role Reset**
   Keeps templates as accelerators, not the model.
8. **3R.8 Accessibility And Decision Load**
   Ensures the new workflow is actually simpler.
9. **3R.9 Presentation Test Reset**
   Protects the new product shape.

Current starting point:

- Re-evaluate existing Phase 3 implementation artifacts against Phase 3R.
- Do not add more warnings, readiness cards, or option controls until the
  workflow cutline and component-system reset are complete.
- Do not preserve old preview/replay/provider panels in the normal workflow.
- Use Phase 3R as the operator-surface contract for Phase 6R.

Implementation record:

- Existing implementation details are documented in
  [Policy Builder Phase 3 Implementation](policy-builder-phase-3-implementation.md).
- Phase 3R.1 workflow inventory and cutline is documented in
  [Policy Builder Phase 3R Workflow Inventory And Cutline](policy-builder-phase-3r-workflow-inventory-cutline.md).
- Phase 3R.2 destination-first flow is documented in
  [Policy Builder Phase 3R Destination-First Flow](policy-builder-phase-3r-destination-first-flow.md).
- Phase 3R.3 UI component system and interaction reset is documented in
  [Policy Builder Phase 3R UI Component System And Interaction Reset](policy-builder-phase-3r-component-system-reset.md).
- Phase 3R.4 evidence-backed option selection is documented in
  [Policy Builder Phase 3R Evidence-Backed Option Selection](policy-builder-phase-3r-evidence-backed-option-selection.md).
- Phase 3R.5 hard limits and avoid UX is documented in
  [Policy Builder Phase 3R Hard Limits And Avoid UX](policy-builder-phase-3r-hard-limit-avoid-ux.md).
- Phase 3R.6 readiness and next action surface is documented in
  [Policy Builder Phase 3R Readiness And Next Action Surface](policy-builder-phase-3r-readiness-next-action-surface.md).
- Phase 3R.7 starter template role reset is documented in
  [Policy Builder Phase 3R Starter Template Role Reset](policy-builder-phase-3r-starter-template-role-reset.md).
- Phase 3R.8 accessibility and decision load is documented in
  [Policy Builder Phase 3R Accessibility And Decision Load](policy-builder-phase-3r-accessibility-decision-load.md).
- Phase 3R.9 presentation test reset is documented in
  [Policy Builder Phase 3R Presentation Test Reset](policy-builder-phase-3r-presentation-test-reset.md).
- Phase 3R contract checkpoints are now defined through 3R.9. Future Phase 3R
  work should apply these contracts to the Vue components and client tests.
- The first Vue-facing rewrite slice is documented in
  [Policy Builder Phase 3R Vue Setup Cards](policy-builder-phase-3r-vue-setup-cards.md).
- The second Vue-facing rewrite slice is documented in
  [Policy Builder Phase 3R Vue Destination Section Split](policy-builder-phase-3r-vue-destination-section-split.md).
  The current intent editor now has distinct review behavior, destination
  identity, destination rules, and confidence-support anchors so setup-card
  actions no longer collapse into one monolithic editor target.
- The third Vue-facing rewrite slice is documented in
  [Policy Builder Phase 3R Vue Review Trigger Control](policy-builder-phase-3r-vue-review-trigger-control.md).
  The review behavior group now has an **Ask When Unsure** checkbox control
  backed by `review_triggers.when_any` draft serialization, readable summaries,
  duplicate disabled reasons, and compatibility bridge coverage.
- The fourth Vue-facing rewrite slice is documented in
  [Policy Builder Phase 3R Vue Routing Readiness Surface](policy-builder-phase-3r-vue-routing-readiness-surface.md).
  The routing setup card now targets a dedicated read-only readiness surface
  that projects selected-library routing context into one visible status and one
  next action without executing routing, calling providers, or saving policy
  intent.
- The fifth Vue-facing rewrite slice is documented in
  [Policy Builder Phase 3R Vue Setup Card State Binding](policy-builder-phase-3r-vue-setup-card-state-binding.md).
  The setup cards now derive complete, needs-setup, optional, and checking
  states from existing modal projections so the workflow shows progress without
  adding new API calls, persistence, routing execution, or diagnostic panels.
- The sixth Vue-facing rewrite slice is documented in
  [Policy Builder Phase 3R Vue Save And Defer Action Boundary](policy-builder-phase-3r-vue-save-defer-action-boundary.md).
  The modal footer now exposes save readiness, disabled reasons, and a
  defer-without-saving action while preserving the existing close and save event
  contracts.
- The seventh Vue-facing rewrite slice is documented in
  [Policy Builder Phase 3R Vue Starter Template Accelerator](policy-builder-phase-3r-vue-starter-template-accelerator.md).
  Starter templates are now optional accelerators: save readiness no longer
  requires a selected template, no-template warnings are removed from the normal
  summary path, and the template browser/details surface is collapsed behind an
  accessible disclosure.
- The eighth Vue-facing rewrite slice is documented in
  [Policy Builder Phase 3R Vue Accessibility Decision Load Audit](policy-builder-phase-3r-vue-accessibility-decision-load-audit.md).
  Setup cards now expose one recommended next action, mark it with
  `aria-current="step"`, describe action links with status and completion
  context, and route no-template setup actions to an available intent-editor
  target instead of missing anchors.
- The ninth Vue-facing rewrite slice is documented in
  [Policy Builder Phase 3R Vue Presentation Test Reset](policy-builder-phase-3r-vue-presentation-test-reset.md).
  The highest-risk modal, impact preview, and replay preview tests now protect
  the destination-first workflow and verifier-only safety contract without
  freezing old provider, TMDB, scoring, parity, or sample-selection diagnostics
  as normal product UI.
- The Phase 3R completion gate is documented in
  [Policy Builder Phase 3R Completion Audit](policy-builder-phase-3r-completion-audit.md).
  The server-owned completion audit now verifies the Phase 3R server contracts,
  Vue rewrite slices, normal workflow rules, normal-path exclusions, and
  referenced artifact paths before Phase 6R runtime work consumes the
  operator-intent surface.

## Phase 4R: Folded Presentation Checkpoint

Status: not an active standalone implementation phase. Prior implementation is
folded into Phase 3R. Under the re-imagined roadmap, this scope should be
treated as part of workflow inventory and readiness surface decisions, not as a
separate client-presentation phase.

Intent: users should see policy behavior, not preset mechanics.

This checkpoint is no longer a separate implementation target. Its original scope
was delivered during the earlier presentation work because the intent-first
surface needed summary, warnings, provenance, readiness, and section diagnostics
before the builder could be considered usable. Phase 3R must now reclassify
those surfaces as keep, rewrite, replace, or delete.

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

Why this remains folded into Phase 3R:

- Helps diagnose weak or ambiguous policies before classification.
- Supports the recent Family, Comedy, and RAG failure modes.
- Keeps the UI focused on decisions users understand.

Planning consequence:

```text
Do not start new Phase 4R client-presentation work. Route presentation changes
through Phase 3R unless they fix a concrete defect or support a named
server/runtime phase.
```

## Phase 5R: Server Authority, Runtime Questions, And Learning Guard

Intent: make the server the authority for policy intent contracts, runtime
question shape, AI/model authority, and durable learning decisions. Phase 5R is
not just schema validation for a client draft sidecar; it is the runtime trust
boundary between operator intent, AI output, classification decisions, and
future learning.

The earlier Phase 5 implementation proved valuable pieces:

- server-owned policy intent contract projection,
- schema validation boundaries,
- route response mapping,
- write-side preflight validation,
- side-effect-free impact and replay preview services,
- sanitized preview/replay payloads,
- deterministic replay execution context,
- representative sample adapters,
- evidence completeness and enrichment eligibility checks.

Phase 5R reclassifies that work around server authority:

```text
client draft -> server validation -> server intent contract
classification result -> server question contract -> operator answer
operator answer -> learning guard -> allowed side effects only
AI output -> capability gate -> semantic normalizer -> bounded diagnostics
```

The server must own these decisions because client UI, Discord payloads, model
responses, and legacy policy storage are all inputs, not authorities.

## Phase 5R Component Map

### 5R.1 Server Intent Contract Authority

Intent: define the server-owned policy intent contract that all clients and
runtime services must obey.

Tasks:

- Inventory current server intent files:
  - `policyIntentContract.mjs`,
  - `policyIntentSchema.mjs`,
  - `policyIntentMapper.mjs`,
  - `policyIntentRequestValidator.mjs`,
  - policy route read/write projections,
  - intent preflight diagnostics,
  - tests around those boundaries.
- Classify each file as:
  - **Keep**: still server authority,
  - **Rewrite**: useful but too coupled to draft/preflight wording,
  - **Replace**: contract need remains but shape must change,
  - **Delete after migration**: only exists for legacy sidecar compatibility.
- Define the server contract around Phase 0R vocabulary:
  - declared intent,
  - observed evidence reference,
  - hard limits,
  - avoid rules,
  - ask rules,
  - routing target,
  - warnings,
  - validation status.
- Keep legacy policy projection read-only and compatibility-scoped until Phase 8R
  native storage replaces it.

Acceptance criteria:

- Server contract names match Phase 0R vocabulary.
- The server contract is independent of client draft implementation details.
- Legacy projection is explicitly a bridge, not the final authority model.

### 5R.2 Write Preflight And Persistence Boundary

Intent: validate incoming intent-like payloads without accidentally persisting
or trusting client-owned projections.

Tasks:

- Keep write preflight fail-closed and allow-listed.
- Ensure preflight validates shape, bounds, and semantics before policy writes.
- Distinguish:
  - valid but non-persistent draft sidecar,
  - invalid draft sidecar,
  - legacy-compatible save payload,
  - future native intent payload.
- Ensure raw draft bodies, raw preset JSON, prompts, traces, and provider data
  are never echoed in diagnostics.
- Define deletion criteria for draft-sidecar preflight once native intent storage
  exists.

Acceptance criteria:

- Preflight protects routes but does not become storage migration by accident.
- Diagnostics are sanitized and bounded.
- Future native intent persistence has a clear insertion point.

### 5R.3 AI Provider Capability And Authority Modes

Intent: make local and cloud model output explicitly bounded before runtime
questions or verification use it.

Tasks:

- Define provider authority modes:
  - `structured_contract`,
  - `verification`,
  - `proposal`,
  - `explanation`,
  - `fallback_advisory`,
  - `disabled`.
- Measure or record capability signals:
  - structured parse success,
  - semantic contract violations,
  - repair attempts and success,
  - timeout/incomplete-stream rates,
  - hallucinated library IDs or actions,
  - thinking trace leakage.
- Downgrade weak local/Ollama models out of contract-authority roles.
- Apply the same semantic normalizer to local and cloud models.
- Ensure AI output cannot directly trigger routing, learning, policy mutation,
  notifications, provider calls, or database writes.

Acceptance criteria:

- Model output authority is explicit and inspectable.
- Local execution is not treated as automatically safe.
- Runtime code can distinguish advisory text from contract-grade output.

### 5R.4 Runtime Clarification Normalizer

Intent: convert AI or runtime uncertainty into deterministic server-owned
question contracts.

Tasks:

- Treat AI clarification text as diagnostic input, not final operator wording.
- Normalize uncertainty into allow-listed types:
  - `missing_identity_evidence`,
  - `hard_constraint_conflict`,
  - `weak_overlap`,
  - `rag_only_support`,
  - `profile_only_support`,
  - `language_conflict`,
  - `routing_gap`,
  - `stale_profile`,
  - `manual_selection_needed`,
  - `contract_violation`.
- Rewrite or reject vague questions such as:
  - `Which genre should be prioritized?`,
  - `Which genre is most prominent?`,
  - broad genre-vs-genre conflicts without destination context.
- Preserve AI explanation only as bounded metadata.
- Prefer deterministic candidate libraries and server-known option IDs over AI
  phrasing.
- Add stale-question cleanup for persisted questions that predate the normalized
  contract.

Acceptance criteria:

- Operator questions ask about destination fit, not genre priority.
- Schema-valid but semantically wrong AI output is rejected or rewritten.
- Normalized questions include learning eligibility metadata.

### 5R.5 Question And Answer Contract

Intent: make UI and Discord answers stable, narrow, and safe to resolve.

Tasks:

- Define one server-owned question contract for UI and Discord:
  - question type,
  - uncertainty type,
  - candidate item,
  - candidate destinations,
  - allowed actions,
  - selected option requirements,
  - learning eligibility metadata,
  - version and freshness metadata.
- Define allowed answer actions:
  - confirm destination,
  - change destination,
  - route not applicable,
  - retry classification,
  - mark exact-item memory only,
  - request policy edit when broader learning is needed.
- Reject answers that reference unknown libraries, stale options, old question
  versions, or unauthorized Discord targets.
- Make answer resolution idempotent.

Acceptance criteria:

- UI and Discord answer the same server contract.
- Free-form labels do not become commands.
- Stale or malformed answers cannot authorize learning.

### 5R.6 Learning Guard And Outcome Separation

Intent: separate item resolution from durable learning.

Tasks:

- Record final outcome for every resolved question.
- Route all possible learning side effects through one server guard.
- Define learning tiers:
  - `blocked`,
  - `exact_only`,
  - `compatibility_evidence`,
  - `identity_evidence`,
  - `constraint_evidence`,
  - `policy_edit_required`.
- Default broad genre ambiguity, weak overlap, RAG-only support, profile-only
  support, unsafe AI wording, missing metadata, and stale questions to blocked
  or exact-only learning.
- Allow durable evidence updates only through allow-listed side effects.
- Store learning-decision reason codes and provenance.

Acceptance criteria:

- `resolved` does not imply `learned`.
- Every learning side effect has a reason and provenance trail.
- The guard is the last authority before durable learning writes.

### 5R.7 Stale Question Cleanup And Migration Safety

Intent: retire old pending question shapes before they can teach the new system
bad behavior.

Tasks:

- Identify persisted pending questions with:
  - missing contract version,
  - vague genre-priority wording,
  - missing learning metadata,
  - stale candidate library references,
  - policy intent changed after question creation.
- Support dry-run and apply cleanup modes.
- Decide per question whether to:
  - regenerate under the new contract,
  - mark stale and require retry,
  - resolve outcome-only if already answered,
  - block learning permanently.
- Log cleanup actions with bounded metadata.

Acceptance criteria:

- Old unsafe questions cannot create durable learning.
- Cleanup can be previewed before apply.
- Post-upgrade cleanup behavior is deterministic and auditable.

### 5R.8 Preview, Replay, And Migration Verifier Cutline

Intent: decide which preview/replay services remain as internal verifiers and
which product surfaces are removed.

Tasks:

- Classify current impact/replay services as:
  - server contract verifier,
  - migration parity verifier,
  - evidence reducer candidate,
  - delete with old UI surface.
- Keep side-effect-free replay guarantees where they support migration safety.
- Remove or replace product-facing preview/replay panels in Phase 3R/6R unless
  they are explicitly classified as migration verifier UI.
- Ensure verifier payloads remain sanitized and bounded.
- Define deletion criteria after Phase 8R migration parity is proven.

Acceptance criteria:

- Preview/replay work has a clear purpose outside normal policy authoring.
- Migration safety does not preserve old diagnostic UX as a permanent product
  path.
- Verifier tests are retained only where the verifier remains part of the plan.

### 5R.9 Server Authority Test Reset

Intent: make tests protect server trust boundaries rather than old preview
behavior.

Tasks:

- Categorize Phase 5 tests as:
  - keep as server contract regression,
  - rewrite around question/answer contract,
  - rewrite around learning guard,
  - rewrite around provider authority modes,
  - rewrite around migration verifier role,
  - delete when product diagnostic surfaces are removed.
- Add tests for:
  - client drafts do not bypass server validation,
  - AI output cannot become final question text without normalization,
  - stale questions cannot learn,
  - answers are idempotent,
  - learning side effects are allow-listed,
  - preview/replay routes remain side-effect-free if retained.

Acceptance criteria:

- Tests fail when server authority is bypassed.
- Tests do not freeze old diagnostic response shapes unless those shapes remain
  migration verifier contracts.
- Phase 6R can consume server contracts without inheriting old UI assumptions.

## Phase 5R Work Sequence

Implement Phase 5R in this order:

1. **5R.1 Server Intent Contract Authority**
   Establishes server-owned meaning.
2. **5R.2 Write Preflight And Persistence Boundary**
   Keeps compatibility saves safe while native storage is pending.
3. **5R.3 AI Provider Capability And Authority Modes**
   Bounds model agency before runtime question work.
4. **5R.4 Runtime Clarification Normalizer**
   Replaces vague AI/operator questions with deterministic contracts.
5. **5R.5 Question And Answer Contract**
   Gives UI and Discord one answer model.
6. **5R.6 Learning Guard And Outcome Separation**
   Prevents resolved items from becoming accidental policy learning.
7. **5R.7 Stale Question Cleanup And Migration Safety**
   Retires unsafe old questions.
8. **5R.8 Preview, Replay, And Migration Verifier Cutline**
   Keeps only verifier pieces that support migration or engine safety.
9. **5R.9 Server Authority Test Reset**
   Protects the new trust boundaries.

Current starting point:

- Re-evaluate existing Phase 5 implementation artifacts against Phase 5R.
- Do not add new preview/replay product UI before the verifier cutline is done.
- Do not let AI clarification text, UI answers, or Discord payloads authorize
  learning directly.
- Use Phase 5R as the server authority contract for Phase 6R.

Implementation record:

- Existing implementation details are documented in
  [Policy Builder Phase 5 Implementation](policy-builder-phase-5-implementation.md).
- Future updates should turn that document into a server-authority inventory,
  including which services are kept, rewritten, replaced, or deleted.

## Phase 6R: Re-Imagined Policy Engine Roadmap

Intent: rebuild Phase 6 around the underlying engine Classifarr actually needs:
turn observed media-server application, operator outcomes, routing results, and
metadata evidence into durable policy intent with minimal operator work.

This replaces the previous Phase 6 direction. Replay, TMDB preview, provider
readiness, impact preview, and parity tooling are not the operator workflow.
They are implementation material to classify, extract, rewrite, or delete.

The product question Phase 6R must answer is:

```text
Given this library and the decisions already made around it, what does
Classifarr understand this destination is for, and what is the smallest safe
operator confirmation needed before automation continues?
```

The target flow is:

```text
media-server library contents
  -> observed application profile
  -> evidence engine normalizes signals
  -> intent engine proposes destination meaning
  -> operator confirms or corrects only meaningful uncertainty
  -> learning guard decides what can be remembered
  -> readiness engine decides whether automation can proceed
  -> migration engine removes legacy policy paths after parity
```

Non-negotiable design rules:

- The media server is the source of observed application.
- Existing policies, presets, replay previews, provider gates, and scoring
  panels are not the final product model.
- Operator UX must be about destination meaning, not internal diagnostics.
- Broad genres cannot become identity by themselves.
- Absence of evidence cannot become exclusion by itself.
- Manual outcomes are not automatically learning events.
- Learning must be explicit, guarded, inspectable, and reversible.
- Anything that does not become an engine primitive, migration verifier, or
  necessary product workflow must be deleted after replacement.
- No parallel advanced policy-builder surface should preserve the old model.

## Phase 6R Component Map

Phase 6R is intentionally component-scoped. Each component must finish with a
clear decision about existing artifacts: keep, rewrite, replace, or delete.

### 6R.0 Artifact Inventory And Cutline

Intent: stop implementation drift by classifying what already exists before
adding more behavior.

Tasks:

- Inventory client components, composables, server services, routes, tests, and
  docs related to:
  - impact preview,
  - representative replay preview,
  - TMDB live preview,
  - provider readiness gates,
  - parity/delta panels,
  - policy-builder scoring/internal summary panels,
  - starter-template compatibility helpers.
- Classify every artifact as one of:
  - **Keep as engine primitive**: deterministic reducer or validator with a
    product-independent purpose.
  - **Rewrite**: useful concept but coupled to replay/provider/policy-builder UI.
  - **Replace**: product need remains, but the current implementation is the
    wrong abstraction.
  - **Delete**: exists only to expose old diagnostics or preserve old UX.
- Record the cutline in the Phase 6 implementation doc before changing code.
- Identify tests that must be rewritten around engine contracts versus deleted
  with abandoned UI surfaces.

Acceptance criteria:

- No Phase 6R implementation starts without a checked-in artifact inventory.
- Every old Phase 6 surface has an owner decision.
- The roadmap and implementation doc agree on what will be removed.

### 6R.1 Evidence Engine

Intent: normalize what Classifarr knows about a destination without deciding the
policy too early.

Inputs:

- Media-server library profile distributions.
- Classification history and final outcomes.
- Manual corrections.
- Pending-item answers from UI or Discord.
- Successful and blocked Arr routing outcomes.
- Provider metadata already available through configured enrichment.
- Profile freshness and outlier signals.

Tasks:

- Create or identify one server-owned evidence projection that can describe a
  library destination without UI-specific replay payloads.
- Normalize evidence into stable buckets:
  - identity evidence,
  - compatibility evidence,
  - hard-limit evidence,
  - avoid evidence,
  - outlier evidence,
  - routing evidence,
  - freshness evidence,
  - insufficient evidence.
- Extract useful reducers from replay/impact work only if they support those
  buckets.
- Remove raw provider payloads, transient quota state, and UI chip language from
  evidence contracts.
- Ensure provider data supports evidence quality, not policy authoring controls.

Acceptance criteria:

- Evidence can be generated without live TMDB calls.
- Evidence is deterministic and testable from fixtures.
- Evidence contract does not expose replay/provider UI concepts.
- Existing replay reducers are either renamed and reused or marked for deletion.

Implementation status:

- Phase 6R.1 evidence engine is documented in
  [Policy Builder Phase 6R Evidence Engine](policy-builder-phase-6r-evidence-engine.md).
- The server-owned evidence contract lives in
  `server/src/services/policyBuilderPhase6EvidenceEngine.mjs`.
- The focused evidence-engine test suite lives in
  `server/src/__tests__/services/policyBuilderPhase6EvidenceEngine.test.mjs`.
- Current implementation defines stable evidence buckets, source-authority
  rules, prohibited payload classes, deterministic offline projection, and an
  audit that blocks live provider lookups, raw provider payloads, UI chip
  language, provider quota/cooldown state, metadata-owned identity, and direct
  learning from final outcomes.
- Phase 6R.1 evidence input gate hardening is documented in
  [Policy Builder Phase 6R Evidence Input Gate](policy-builder-phase-6r-evidence-input-gate.md).
- The evidence input gate lives in
  `server/src/services/policyBuilderPhase6EvidenceInputGate.mjs`.
- Phase 6R.1 evidence boundary hardening is documented in
  [Policy Builder Phase 6R Evidence Boundary](policy-builder-phase-6r-evidence-boundary.md).
- The evidence boundary lives in
  `server/src/services/policyBuilderPhase6EvidenceBoundary.mjs`.
- The evidence input gate defines the allowed input envelope before projection:
  library profile, operator intent, final outcomes, manual corrections,
  pending-item answers, Arr routing outcomes, metadata evidence, and profile
  freshness.
- The evidence boundary validates the public evidence input envelope, adapts
  public section names into the projection shape, builds the evidence
  projection, and runs the projection audit before downstream engines consume
  evidence.
- The boundary emits a sanitized SHA-256 projection fingerprint with source IDs,
  authority-source IDs, bucket counts, and trace attribute names so later
  engines can correlate the bounded evidence they consumed without exposing raw
  evidence labels, media titles, provider payloads, quota state, or UI
  diagnostic strings.
- The boundary now audits the generated projection fingerprint, trace
  attributes, and sanitized provenance against the returned projection before
  downstream engines can consume the Phase 6R.1 handoff.
- The boundary maps `classificationOutcomes` to
  `classificationFinalOutcomes` and `arrRoutingOutcomes` to `routingOutcomes`
  so the public gate envelope and internal projection contract cannot drift.
- The evidence input gate rejects unknown sections, raw provider payload
  markers, live lookup markers, provider quota/cooldown state, UI diagnostic
  labels, and replay/impact preview payloads before evidence projection.
- The evidence engine now includes a projection-instance audit that validates
  generated or tampered evidence projections after construction, blocking
  unknown buckets/sources, unsafe source-to-bucket ownership, raw payloads, live
  lookup markers, UI diagnostic language, metadata-owned identity, and
  non-operator hard-limit or avoid evidence.
- The evidence projection now includes a generated summary with bucket counts,
  source IDs, authority-source IDs, blocking bucket IDs, and review bucket IDs
  so later engines can consume deterministic evidence state without reusing
  replay, impact, provider, or UI diagnostic payloads.
- Replay and impact reducer artifacts are explicitly classified as delete,
  rewrite-as-evidence-reducer, or maintainer-only migration material; all are
  blocked from normal operator flow until rewritten into Phase 6R evidence
  contracts or deleted.
- Existing replay/impact reducers are not wired into the normal product flow in
  this slice; future Phase 6R migration work must either extract deterministic
  reducers into the evidence engine or delete the abandoned diagnostic surfaces.

### 6R.2 Intent Engine

Intent: convert evidence into the policy meaning Classifarr should use.

Tasks:

- Define the destination intent contract around:
  - `belongs_here`,
  - `helpful_matches`,
  - `hard_limits`,
  - `avoid`,
  - `ask_when`,
  - `routing_target`,
  - `confidence`,
  - `assumptions`,
  - `warnings`.
- Build deterministic profile-to-intent suggestion rules.
- Require supporting evidence before broad genres can become identity.
- Treat observed absence as a warning or review suggestion, never automatic
  exclusion.
- Keep starter templates as optional accelerators that mutate an intent draft,
  not as hidden policy containers.
- Preserve legacy preset/custom-signal compatibility only as a bridge until
  native intent storage is ready.

Acceptance criteria:

- A library profile can produce a proposed intent draft.
- The draft explains why each suggested signal exists.
- The draft separates declared operator constraints from inferred evidence.
- Legacy policies can still round-trip through the compatibility bridge.

Implementation status:

- Phase 6R.2 intent engine is documented in
  [Policy Builder Phase 6R Intent Engine](policy-builder-phase-6r-intent-engine.md).
- The server-owned intent contract lives in
  `server/src/services/policyBuilderPhase6IntentEngine.mjs`.
- The focused intent-engine test suite lives in
  `server/src/__tests__/services/policyBuilderPhase6IntentEngine.test.mjs`.
- Current implementation consumes Phase 6R.1 evidence projection and produces
  proposed destination intent for `belongs_here`, `helpful_matches`,
  `hard_limits`, `avoid`, `ask_when`, `routing_target`, confidence,
  assumptions, and warnings.
- The intent engine now exposes a bounded entry point that consumes the Phase
  6R.1 evidence boundary result, requires the projection fingerprint, blocks
  failed evidence-boundary handoffs, and carries a sanitized evidence-boundary
  snapshot into the intent draft for downstream correlation.
- The bounded intent entry point now audits the evidence projection fingerprint,
  trace attributes, and sanitized provenance against the returned Phase 6R.1
  projection before producing an intent draft.
- The contract demotes unsupported broad-genre identity to helpful evidence,
  prevents metadata from owning destination identity, treats stale or missing
  evidence as review triggers instead of exclusions, keeps hard limits and avoid
  entries tied to operator-declared authority, and produces no learning side
  effects.
- Legacy preset/custom-signal behavior remains a compatibility bridge only;
  future Phase 6R/8R work must decide how bridge output maps into native intent
  storage after learning and readiness gates are stable.

### 6R.3 Learning Guard

Intent: decide whether an operator decision should become durable learning,
exact-item memory, profile evidence, or only outcome history.

Tasks:

- Route manual classification changes, confirmations, Discord answers, request
  destination choices, and routing outcomes through one learning guard.
- Store final outcome separately from learning decision.
- Add explicit learning tiers:
  - `none`,
  - `exact_item_memory`,
  - `compatibility_evidence`,
  - `identity_evidence`,
  - `hard_limit_evidence`.
- Block learning from:
  - AI explanation text,
  - broad one-off genre choices,
  - stale questions,
  - ambiguous answer labels,
  - provider quota/cooldown state,
  - replay/TMDB diagnostic state.
- Queue profile refresh when a learning decision changes destination evidence.

Acceptance criteria:

- Every learning side effect has a reason code.
- Stale or ambiguous questions resolve outcomes without teaching the system.
- Tests prove final outcome and durable learning are separate.

Implementation status:

- Phase 6R.3 learning guard is documented in
  [Policy Builder Phase 6R Learning Guard](policy-builder-phase-6r-learning-guard.md).
- The server-owned learning guard contract lives in
  `server/src/services/policyBuilderPhase6LearningGuard.mjs`.
- The focused learning-guard test suite lives in
  `server/src/__tests__/services/policyBuilderPhase6LearningGuard.test.mjs`.
- Current implementation evaluates manual classification changes, operator
  confirmations, Discord pending answers, request destination choices, and Arr
  routing outcomes into separate final-outcome and learning decisions.
- The contract supports explicit learning tiers for no learning,
  exact-item memory, compatibility evidence, identity evidence, and hard-limit
  evidence; every candidate includes reason codes and write permission is
  explicit.
- Learning is blocked from stale questions, ambiguous answers, rejected
  question frames, AI explanation text, broad one-off genre choices, provider
  quota/cooldown state, replay diagnostics, and TMDB diagnostic state.
- Compatibility and identity learning candidates queue profile refresh
  instructions; hard-limit learning requires an explicit policy edit and cannot
  write directly.
- The learning guard now exposes a bounded entry point that consumes the Phase
  6R.2 bounded intent result, requires the carried Phase 6R.1 evidence
  projection fingerprint, blocks failed or unfingerprinted intent handoffs, and
  attaches a sanitized intent/evidence boundary snapshot to the learning
  decision wrapper.
- The bounded learning entry point now requires the upstream bounded intent
  evidence-fingerprint audit to pass and rejects mismatched wrapper-versus-intent
  evidence fingerprints before evaluating learning candidates.

### 6R.4 Automation Readiness Engine

Intent: replace policy-builder diagnostic panels with a simple answer about
whether automation can proceed.

Tasks:

- Define a small readiness contract:
  - `ready`,
  - `needs_more_examples`,
  - `needs_operator_review`,
  - `needs_routing`,
  - `blocked_by_hard_limit`,
  - `stale_profile`.
- Feed readiness from evidence, intent, routing, profile freshness, and learning
  guard state.
- Remove product dependence on replay parity panels, TMDB coverage panels,
  provider gate panels, and raw scoring panels.
- Keep maintainer support tooling only if it is outside the policy-builder flow
  and has an owner, retention plan, and deletion criteria.

Acceptance criteria:

- The operator sees what action is needed, not internal mechanics.
- Readiness can be computed from cached/local state.
- Old diagnostic UI tests are rewritten around readiness behavior or removed.

Implementation status:

- Phase 6R.4 automation readiness engine is documented in
  [Policy Builder Phase 6R Automation Readiness Engine](policy-builder-phase-6r-readiness-engine.md).
- The server-owned readiness contract lives in
  `server/src/services/policyBuilderPhase6ReadinessEngine.mjs`.
- The focused readiness-engine test suite lives in
  `server/src/__tests__/services/policyBuilderPhase6ReadinessEngine.test.mjs`.
- Current implementation consumes Phase 6R evidence, intent, learning,
  routing, and profile freshness inputs into one state: `ready`,
  `needs_more_examples`, `needs_operator_review`, `needs_routing`,
  `blocked_by_hard_limit`, or `stale_profile`.
- Readiness is computed from cached/local state only, returns reason-coded
  issues with next actions, treats profile refresh as stale readiness, and
  ignores replay, impact preview, provider, TMDB, and raw scoring diagnostic
  inputs instead of allowing them to become product gates.
- Readiness now exposes a bounded entry point for new runtime/rebuild callers:
  it requires successful Phase 6R.1 bounded evidence, Phase 6R.2 bounded
  intent, and Phase 6R.3 bounded learning results, verifies their shared
  sanitized evidence projection fingerprint, and attaches a bounded context to
  the readiness input summary without exposing raw evidence labels.
- The bounded readiness entry point now also requires the upstream evidence,
  intent, evidence-fingerprint, and learning audits to pass before automation
  readiness is evaluated.

### 6R.5 Operator Workflow Rebuild

Intent: make policy setup dead simple while preserving meaningful control.

Default workflow:

1. Select a media-server library.
2. See what Classifarr believes belongs there.
3. Accept, remove, or add a small number of intent signals.
4. Confirm hard limits only when needed.
5. See whether the destination is automation-ready.

Tasks:

- Replace dense policy-builder panels with destination-oriented sections:
  - `What belongs here`,
  - `What should not go here`,
  - `What helps but should not decide alone`,
  - `When should Classifarr ask`,
  - `Can this route`.
- Support multi-select controls where users are selecting multiple simple
  signals from known library/profile options.
- Auto-fill candidate options from observed library profile evidence.
- Show existing library evidence inline so users understand why options are
  suggested.
- Remove controls that ask users to reason about replay, provider gates, parity,
  or TMDB coverage.

Acceptance criteria:

- A user can create or refresh a policy primarily from existing library contents.
- UI copy describes destination meaning, not implementation mechanics.
- The workflow reduces decisions compared with the old policy builder.

Implementation status:

- Phase 6R.5 operator workflow rebuild is documented in
  [Policy Builder Phase 6R Operator Workflow Rebuild](policy-builder-phase-6r-operator-workflow.md).
- The server-owned workflow projection lives in
  `server/src/services/policyBuilderPhase6OperatorWorkflow.mjs`.
- The focused operator-workflow test suite lives in
  `server/src/__tests__/services/policyBuilderPhase6OperatorWorkflow.test.mjs`.
- Current implementation defines the normal workflow as five destination-first
  sections: `what_belongs_here`, `what_should_not_go_here`,
  `what_helps_but_should_not_decide_alone`,
  `when_should_classifarr_ask`, and `can_this_route`.
- The workflow projection consumes Phase 6R intent and readiness, keeps routing
  readiness read-only, returns one primary action per section, blocks direct
  policy persistence or routing execution, and explicitly excludes impact
  preview, replay preview, replay parity, provider gates, provider readiness,
  TMDB coverage, raw scoring, and diagnostic panels from the normal flow.
- The workflow now exposes a bounded entry point for new runtime/rebuild
  callers: it requires successful bounded intent and bounded readiness results,
  verifies their shared sanitized evidence projection fingerprint, and attaches
  bounded provenance to the workflow without exposing raw evidence labels.

### 6R.6 Migration And Deletion Path

Intent: move from legacy preset/custom-signal policy behavior to the new engine
without carrying both systems permanently.

Tasks:

- Use old impact/replay/parity tooling only as migration verification machinery,
  not product workflow.
- Define a migration preview that compares legacy policy behavior to generated
  intent behavior using representative classifications.
- Preserve rollback data for an explicit migration window.
- After parity and rollback gates pass, delete replaced client panels, routes,
  services, tests, and docs tied only to old diagnostics.
- Update schema plans for native intent storage in Phase 8R only after engine
  contracts are stable.

Acceptance criteria:

- Migration safety does not require keeping old policy-builder UX.
- Replaced code has an explicit removal checklist.
- Phase 8R storage migration is blocked until Phase 6R engine contracts prove
  stable.

Implementation status:

- Phase 6R.6 migration and deletion path is documented in
  [Policy Builder Phase 6R Migration And Deletion Path](policy-builder-phase-6r-migration-deletion-path.md).
- The server-owned migration cutline lives in
  `server/src/services/policyBuilderPhase6MigrationDeletionPath.mjs`.
- The focused migration/deletion test suite lives in
  `server/src/__tests__/services/policyBuilderPhase6MigrationDeletionPath.test.mjs`.
- Current implementation classifies policy-builder artifacts as
  `keep_engine_primitive`, `migration_verifier`, `delete_after_migration`, or
  `phase8_storage_blocker`.
- Old impact preview, replay preview, provider readiness, TMDB coverage, raw
  scoring, and policy-write diagnostics are verifier-only or delete-after-
  migration targets, never normal operator workflow.
- Migration deletion requires stable Phase 6R contracts, representative
  comparison, rollback snapshot, rollback window, deletion checklist, and
  native storage blocked until Phase 8R.
- Migration planning now exposes a bounded entry point for new runtime/rebuild
  callers: it requires a successful bounded Phase 6R.5 operator workflow result,
  verifies sanitized workflow provenance, and attaches the bounded workflow
  context to the migration plan before the migration/deletion audit can pass.

## Phase 6R Work Sequence

Implement Phase 6R in this order:

1. **6R.0 Artifact Inventory And Cutline**
   Prevents side trails and identifies deletion targets.
2. **6R.1 Evidence Engine**
   Establishes the raw source of destination truth.
3. **6R.2 Intent Engine**
   Converts evidence into policy meaning.
4. **6R.3 Learning Guard**
   Makes manual outcomes safe to use.
5. **6R.4 Automation Readiness Engine**
   Replaces diagnostic panels with action-oriented readiness.
6. **6R.5 Operator Workflow Rebuild**
   Simplifies the product surface around destination meaning.
7. **6R.6 Migration And Deletion Path**
   Removes replaced legacy paths after parity and rollback safety.

Completion gate:

- Phase 6R completion is documented in
  [Policy Builder Phase 6R Completion Audit](policy-builder-phase-6r-completion-audit.md).
- The completion audit lives in
  `server/src/services/policyBuilderPhase6CompletionAudit.mjs`.
- The focused completion-audit test suite lives in
  `server/src/__tests__/services/policyBuilderPhase6CompletionAudit.test.mjs`.
- Current completion audit verifies seven records: 6R.0 artifact inventory and
  cutline, 6R.1 evidence engine, 6R.2 intent engine, 6R.3 learning guard,
  6R.4 readiness engine, 6R.5 operator workflow, and 6R.6 migration/deletion.
- The gate fails if any component lacks a doc, service, test, passing audit, or
  expected next-phase chain.
- The gate also builds the bounded 6R.1 through 6R.6 handoff chain and fails if
  evidence, intent, learning, readiness, workflow, or migration wrappers fail,
  drift away from the shared sanitized evidence projection fingerprint, or carry
  raw evidence labels in boundary provenance.
- The gate also fails if legacy replay, impact, provider, TMDB, scoring, or old
  Phase 6 documentation artifacts lack explicit migration/deletion decisions,
  remain allowed in the normal operator workflow, or unblock Phase 8R storage
  prematurely.

Current starting point:

- Start with **6R.0 Artifact Inventory And Cutline**.
- Do not add more controls to the existing policy builder before the cutline is
  complete.
- Do not implement new provider or replay behavior unless it is classified as an
  engine primitive or migration verifier.

## Phase 7R: Runtime Automation And Library Rebuild

Intent: make the re-imagined engine operational at runtime. Phase 7R is where
Classifarr stops treating policy intent as a builder-only concept and starts
using server-owned evidence, intent, readiness, question, and learning contracts
to classify, ask, route, and rebuild safely.

Phase 7R depends on these prior contracts:

- Phase 0R vocabulary and authority model,
- Phase 1R client boundary ownership,
- Phase 2R draft/bridge boundary,
- Phase 3R destination-first workflow,
- Phase 5R server question and learning authority,
- Phase 6R evidence, intent, readiness, and migration engine cutlines.

The runtime target is:

```text
new or existing item
  -> build candidate evidence
  -> evaluate destination intent
  -> route automatically when ready
  -> ask only when server contracts say review is needed
  -> resolve outcome
  -> learning guard decides durable side effects
  -> profile/readiness updates feed future decisions
```

The rebuild target is:

```text
library profile + guarded outcomes + explicit constraints
  -> proposed policy intent
  -> migration verifier comparison
  -> operator accepts or rejects
  -> rollback snapshot
  -> old compatibility path deleted after Phase 8R gates
```

## Phase 7R Component Map

### 7R.1 Runtime Decision Inventory And Cutline

Intent: classify current classification, routing, question, and learning paths
before wiring the new engine into runtime behavior.

Tasks:

- Inventory current runtime services related to:
  - classification policy path,
  - signal calculation,
  - AI analysis and verification,
  - RAG/RAG-loop decisions,
  - question generation,
  - manual resolution,
  - learning side effects,
  - Arr routing,
  - media-server profile refresh,
  - queues and retry paths.
- Classify each artifact as:
  - **Keep as runtime engine primitive**,
  - **Rewrite around Phase 5R/6R contracts**,
  - **Replace with readiness/question contract behavior**,
  - **Delete after migration**.
- Identify places where runtime code still asks genre-priority questions or
  treats broad genre overlap as destination authority.
- Identify places where successful classification and successful routing are
  conflated.

Acceptance criteria:

- Runtime classification and routing artifacts have keep/rewrite/replace/delete
  decisions.
- No runtime path can be changed before its authority source is identified.
- Known bad question-generation paths are explicitly listed for replacement.

Implementation status:

- Phase 7R.1 runtime decision inventory is documented in
  [Policy Builder Phase 7R Runtime Decision Inventory And Cutline](policy-builder-phase-7r-runtime-decision-inventory.md).
- The server-owned runtime inventory lives in
  `server/src/services/policyBuilderPhase7RuntimeDecisionInventory.mjs`.
- The focused runtime-inventory test suite lives in
  `server/src/__tests__/services/policyBuilderPhase7RuntimeDecisionInventory.test.mjs`.
- Current implementation classifies runtime artifacts as
  `keep_runtime_engine_primitive`, `rewrite_around_phase5_6_contracts`,
  `replace_with_readiness_question_contract`, or `delete_after_migration`.
- The inventory now requires critical runtime surface coverage for
  classification route entrypoints, pending/correction routes, second-pass
  diagnostics, metadata enrichment, Discord pending notifications,
  classification orchestration, routing, and persistence paths so new runtime
  behavior cannot bypass the cutline silently.
- Every runtime artifact identifies an authority source before behavior changes:
  media-server contents, declared operator intent, manual outcome, AI output,
  metadata provider evidence, or legacy template compatibility.
- Known bad question paths are listed for replacement: genre-priority
  questions, AI invalid-response questions, AI disagreement questions, and
  pending resolution rule-generation flags.
- Classification/routing conflation and broad-genre authority risks are
  explicit cutline risks before Phase 7R.2 evidence projection work begins.

### 7R.2 Runtime Evidence Projection

Intent: ensure runtime classification uses the same evidence buckets as policy
rebuild and readiness.

Tasks:

- Build or identify a runtime evidence projection that can evaluate an item
  against candidate destinations using Phase 6R evidence buckets:
  - identity evidence,
  - compatibility evidence,
  - hard-limit evidence,
  - avoid evidence,
  - routing evidence,
  - profile freshness evidence,
  - outlier evidence,
  - insufficient evidence.
- Keep provider/RAG/history/profile signals as evidence sources, not final
  authorities.
- Demote low-trust RAG neighbors, unknown-library evidence, stale profile
  evidence, and broad genre overlap unless supported by stronger identity
  evidence.
- Make evidence projection deterministic and traceable without exposing raw
  provider payloads.

Acceptance criteria:

- Runtime and rebuild paths use compatible evidence categories.
- Broad genres can help but cannot decide specialized destinations alone.
- Evidence projection can explain why automation was allowed or blocked.

Implementation status:

- Phase 7R.2 runtime evidence projection is documented in
  [Policy Builder Phase 7R Runtime Evidence Projection](policy-builder-phase-7r-runtime-evidence-projection.md).
- The server-owned runtime evidence projection lives in
  `server/src/services/policyBuilderPhase7RuntimeEvidenceProjection.mjs`.
- The focused runtime-evidence test suite lives in
  `server/src/__tests__/services/policyBuilderPhase7RuntimeEvidenceProjection.test.mjs`.
- Current implementation maps runtime library profile, operator intent,
  classification history, manual corrections, pending answers, RAG neighbors,
  metadata signals, Arr routing outcomes, and profile freshness into Phase 6R
  evidence buckets.
- Low-trust RAG neighbors, unknown-library evidence, stale profile state,
  failed routing, raw provider payloads, and unsupported broad genre overlap are
  demoted with bounded reason codes instead of becoming destination authority.
- The projection is deterministic, side-effect-free, does not call live
  providers, suppresses raw payloads, and emits bounded trace attributes for
  later runtime decision tracing.
- Each runtime evidence projection now includes a stable sanitized SHA-256
  fingerprint with bounded provenance counts/source ids, allowing Phase 7R.3
  automation decisions to bind to the exact evidence projection without
  carrying raw evidence labels forward.

### 7R.3 Automation Decision Contract

Intent: decide when Classifarr can classify and route automatically without
asking.

Tasks:

- Define runtime decision states:
  - `auto_route_ready`,
  - `classified_not_routed`,
  - `needs_operator_review`,
  - `blocked_by_hard_limit`,
  - `needs_routing_mapping`,
  - `stale_profile_retry`,
  - `insufficient_evidence`.
- Require automatic routing to satisfy:
  - destination identity is strong enough,
  - hard limits are satisfied,
  - avoid rules do not block,
  - routing target is mapped,
  - profile is not stale for the decision being made,
  - no high-risk evidence conflict exists.
- Treat successful classification without Arr mapping as `classified_not_routed`,
  not a silent success.
- Emit bounded decision traces for audit and debugging.
- Carry the Phase 7R.2 sanitized runtime evidence projection fingerprint through
  the decision evidence block and trace attributes.
- Reject missing, malformed, mismatched, or raw-provenance fingerprints before a
  decision can pass validation.

Acceptance criteria:

- Runtime can distinguish classify, route, ask, skip, and blocked states.
- Missing route mapping cannot look like a completed route.
- Automatic decisions are explainable from server-owned evidence and intent.

Implementation status:

- Phase 7R.3 automation decision contract is documented in
  [Policy Builder Phase 7R Automation Decision Contract](policy-builder-phase-7r-automation-decision-contract.md).
- The server-owned automation decision contract lives in
  `server/src/services/policyBuilderPhase7AutomationDecisionContract.mjs`.
- The focused automation-decision test suite lives in
  `server/src/__tests__/services/policyBuilderPhase7AutomationDecisionContract.test.mjs`.
- Current implementation defines the runtime states `auto_route_ready`,
  `classified_not_routed`, `needs_operator_review`,
  `blocked_by_hard_limit`, `needs_routing_mapping`, `stale_profile_retry`,
  and `insufficient_evidence`.
- `auto_route_ready` requires strong destination identity, concrete route
  mapping, fresh profile evidence, no hard-limit block, no avoid-rule conflict,
  and no high-risk evidence conflict.
- Successful classification without a mapped Arr route becomes
  `classified_not_routed`; it cannot claim route success or perform route
  side effects.
- The decision contract is deterministic, side-effect-free, rejects invalid
  runtime evidence, and emits bounded `classifarr.runtime.decision.*` trace
  attributes for later audit and telemetry wiring.
- The decision contract now binds each automation decision to the sanitized
  runtime evidence projection fingerprint and fails validation when a decision
  lacks that proof, carries malformed fingerprint data, exposes raw provenance,
  or reports a trace fingerprint that differs from the evidence block.

### 7R.4 Runtime Question Reduction

Intent: ask fewer, better questions only when automation cannot proceed safely.

Tasks:

- Use Phase 5R question contracts for all runtime review prompts.
- Ask only for destination-fit uncertainty, hard-limit conflicts, routing gaps,
  stale profile conditions, or insufficient identity evidence.
- Reject or rewrite genre-priority questions before persistence.
- Prefer exact item confirmation over broad policy learning when evidence is
  weak.
- Ensure old pending questions are routed through stale-question cleanup before
  they can be answered or learned from.
- Carry the automation decision evidence fingerprint into the question-reduction
  plan, planned question, and bounded trace attributes.

Acceptance criteria:

- Runtime questions match Phase 0R vocabulary.
- Questions include learning eligibility metadata.
- Manual answers resolve outcomes without automatically mutating policy.

Implementation status:

- Phase 7R.4 runtime question reduction is documented in
  [Policy Builder Phase 7R Runtime Question Reduction](policy-builder-phase-7r-runtime-question-reduction.md).
- The server-owned runtime question reducer lives in
  `server/src/services/policyBuilderPhase7RuntimeQuestionReduction.mjs`.
- The focused runtime-question test suite lives in
  `server/src/__tests__/services/policyBuilderPhase7RuntimeQuestionReduction.test.mjs`.
- Current implementation consumes `phase7r.automation_decision.v1` and returns
  a disposition instead of directly creating questions: `suppress_question`,
  `create_operator_question`, `configure_routing`, `refresh_profile`,
  `block_automation`, `gather_evidence`, or `stale_question_cleanup`.
- `auto_route_ready` suppresses questions; `classified_not_routed` and
  `needs_routing_mapping` become routing actions; stale profiles become refresh
  actions; stale or legacy pending questions must go through cleanup before
  answer or learning.
- Operator questions are limited to accepted Phase 5R frames and include
  learning eligibility metadata with durable learning disabled by default.
- Rejected legacy frames such as broad-genre priority, AI-authored policy edit,
  provider-specific diagnostic, and replay parity interpretation are rewritten
  before persistence.
- Question-reduction plans now preserve the sanitized automation decision
  evidence fingerprint across the plan, planned question, and trace attributes;
  validation rejects missing or mismatched bindings before a question can pass.

### 7R.5 Request-Time Learning And Destination Selection

Intent: treat media requests and manual destination choices as meaningful but
not automatically durable learning.

Tasks:

- Define how request/import flows provide destination intent signals.
- Record request-time destination choice separately from final routed outcome.
- Pass request-time decisions through Phase 5R learning guard before profile or
  policy evidence changes.
- Distinguish:
  - user requested this destination,
  - operator manually changed the destination,
  - item successfully routed there,
  - item could not route because configuration was missing.
- Queue profile refresh when a guarded learning decision changes destination
  evidence.
- Carry the upstream decision/question evidence fingerprint into the
  request-time decision, learning-guard context, and bounded trace attributes.

Acceptance criteria:

- Request-time choices can improve future decisions only through the learning
  guard.
- A failed route does not become positive destination evidence.
- Manual changes are auditable and reversible.

Implementation status:

- Phase 7R.5 request-time learning and destination selection is documented in
  [Policy Builder Phase 7R Request-Time Learning And Destination Selection](policy-builder-phase-7r-request-time-learning.md).
- The server-owned request-time learning contract lives in
  `server/src/services/policyBuilderPhase7RequestTimeLearning.mjs`.
- The focused request-time learning test suite lives in
  `server/src/__tests__/services/policyBuilderPhase7RequestTimeLearning.test.mjs`.
- Current implementation normalizes four runtime event types:
  `user_requested_destination`, `operator_manual_destination_change`,
  `route_succeeded`, and `route_failed_missing_mapping`.
- Destination selection is recorded separately from final outcome so request
  preference, operator change, and routed result cannot be conflated.
- Request-time and manual decisions are passed through the Phase 6R learning
  guard before they can become learning candidates or request profile refresh.
- Successful Arr routing records a routed final outcome but cannot write durable
  learning directly.
- Missing Arr mapping records a route-failure outcome and is explicitly blocked
  from becoming positive destination evidence.
- Manual destination changes are marked auditable and reversible, and all direct
  side effects remain disabled until a later runtime integration slice
  deliberately wires persistence.
- Request-time learning decisions now preserve the upstream sanitized evidence
  fingerprint through the decision, bounded learning-guard context, and trace;
  validation rejects missing or mismatched fingerprint handoffs.

### 7R.6 Library-Derived Policy Rebuild

Intent: generate policy proposals from observed library application and guarded
outcomes without destructive automatic replacement.

Tasks:

- Add or define a `Rebuild Policy From Library` workflow that consumes:
  - observed library profile,
  - guarded outcomes with sanitized upstream evidence fingerprints,
  - explicit existing constraints,
  - routing configuration,
  - outlier analysis,
  - profile freshness.
- Produce a proposed intent draft with:
  - belongs-here evidence,
  - helpful matches,
  - hard limits,
  - avoid suggestions,
  - ask rules,
  - routing target,
  - confidence,
  - assumptions,
  - warnings.
- Require explicit operator acceptance before activation.
- Treat observed absence as a warning, not automatic exclusion.
- Create rollback snapshots before replacement.
- Refuse to consume guarded outcomes that do not carry the upstream evidence
  fingerprint chain from runtime decision/question/request-learning contracts.
- Keep guarded-outcome fingerprint trace counts synchronized with bounded source
  summaries.

Acceptance criteria:

- Rebuild proposals explain evidence source and confidence.
- Rebuild proposals only consume guarded outcomes that carry sanitized SHA-256
  upstream evidence fingerprints.
- Missing guarded-outcome fingerprints and trace/source summary mismatches fail
  validation before migration comparison.
- Rebuild does not automatically delete or replace existing policies.
- Explicit operator constraints are preserved unless the operator changes them.

Implementation status:

- Phase 7R.6 library-derived policy rebuild is documented in
  [Policy Builder Phase 7R Library-Derived Policy Rebuild](policy-builder-phase-7r-library-policy-rebuild.md).
- The server-owned rebuild proposal contract lives in
  `server/src/services/policyBuilderPhase7LibraryPolicyRebuild.mjs`.
- The focused rebuild test suite lives in
  `server/src/__tests__/services/policyBuilderPhase7LibraryPolicyRebuild.test.mjs`.
- Current implementation consumes observed library profile evidence,
  fingerprint-bound guarded outcomes, explicit constraints, routing
  configuration, observed outliers, observed absences, and profile freshness.
- Rebuild output reuses Phase 6R evidence projection, intent draft, and
  readiness contracts instead of inventing a separate policy schema.
- Proposals include evidence source summaries, confidence, assumptions,
  warnings, an explicit operator acceptance gate, and a rollback snapshot gate.
- Guarded outcome source summaries now carry bounded accepted/missing
  fingerprint counts plus sanitized digest lists, and trace attributes mirror
  those counts without raw labels, prompts, or payloads.
- Guarded outcomes without upstream evidence fingerprints are not converted
  into compatibility or outlier proposal evidence and fail validation as an
  incomplete handoff.
- Observed absence is warning-only review context and cannot become avoid or
  exclusion evidence.
- Explicit hard limits and avoid rules are preserved as operator-declared
  constraints unless a later operator action changes them.
- Proposal side effects remain disabled: no activation, replacement, deletion,
  learning write, or routing write happens in this slice.

### 7R.7 Migration Verifier And Rollback Path

Intent: verify generated intent behavior before replacing legacy behavior.

Tasks:

- Use Phase 5R/6R verifier pieces to compare legacy compatibility behavior with
  generated intent behavior.
- Keep verifier output bounded and side-effect-free.
- Bind verifier output to a stable sample-set fingerprint built from normalized
  comparison samples, verifier options, and bounded rebuild proposal evidence
  metadata.
- Show only migration-relevant differences:
  - destination changes,
  - newly blocked items,
  - newly review-required items,
  - route-readiness changes,
  - evidence-confidence changes.
- Require rollback snapshots before applying accepted replacements.
- Define deletion criteria for old preset/custom-signal runtime paths after
  Phase 8R native intent migration proves stable.

Acceptance criteria:

- Operators can see meaningful migration risk before accepting rebuilds.
- Verifier reports carry a SHA-256 sample-set fingerprint and trace attribute
  for the exact sanitized comparison set.
- Missing, malformed, or mismatched verifier fingerprints fail validation.
- Verifier output does not become normal policy-authoring UI.
- Rollback path is explicit and tested.

Implementation status:

- Phase 7R.7 migration verifier and rollback path is documented in
  [Policy Builder Phase 7R Migration Verifier And Rollback Path](policy-builder-phase-7r-migration-verifier-rollback.md).
- The server-owned verifier contract lives in
  `server/src/services/policyBuilderPhase7MigrationVerifierRollback.mjs`.
- The focused verifier test suite lives in
  `server/src/__tests__/services/policyBuilderPhase7MigrationVerifierRollback.test.mjs`.
- Current implementation consumes a Phase 7R.6 rebuild proposal and sanitized
  representative legacy/proposed comparison samples.
- Verifier reports now carry a stable sample-set fingerprint with bounded
  provenance for sample count, raw-payload suppression, verifier options,
  proposal version/status, and sanitized proposal evidence digests.
- Trace attributes mirror the sample-set fingerprint, and validation rejects
  missing, malformed, or mismatched fingerprint handoffs.
- Verifier output is bounded to migration-relevant differences only:
  destination changes, newly blocked items, newly review-required items,
  route-readiness changes, and evidence-confidence changes.
- Application gates require explicit operator acceptance plus rollback snapshot
  and restore path before any later replacement can apply.
- Legacy deletion readiness is blocked until Phase 8R native intent is stable,
  the verifier passes, rollback and retention gates are active, delete checklist
  approval exists, legacy artifacts are classified, and custom-signal
  replacement is defined.
- Verifier side effects remain disabled: no activation, replacement, deletion,
  rollback creation, learning write, or routing write happens in this slice.

### 7R.8 Runtime Metrics And Decision Trace

Intent: make automation outcomes measurable without exposing noisy internals to
operators.

Tasks:

- Track bounded counters for:
  - auto-routed,
  - classified-not-routed,
  - asked-for-review,
  - blocked-by-hard-limit,
  - missing-routing,
  - stale-profile retry,
  - learning allowed/blocked/downgraded,
  - rebuild accepted/rejected/rolled back.
- Record decision traces that identify evidence categories and reason codes, not
  raw provider payloads or AI prompts.
- Preserve supported upstream source fingerprints for correlation without
  copying raw evidence into metrics traces.
- Surface user-facing summaries only where they support next action.

Acceptance criteria:

- Runtime behavior can be audited and debugged.
- Metrics traces can correlate back to supported upstream decision fingerprints
  without exposing payloads.
- Metrics do not leak secrets, raw provider payloads, prompts, or embeddings.
- Operator UI remains action-oriented.

Implementation status:

- Phase 7R.8 runtime metrics and decision trace is documented in
  [Policy Builder Phase 7R Runtime Metrics And Decision Trace](policy-builder-phase-7r-runtime-metrics-trace.md).
- The server-owned metrics/trace projection lives in
  `server/src/services/policyBuilderPhase7RuntimeMetricsTrace.mjs`.
- The focused metrics/trace test suite lives in
  `server/src/__tests__/services/policyBuilderPhase7RuntimeMetricsTrace.test.mjs`.
- Current implementation counts Phase 7R automation, question, learning,
  rebuild, migration verifier, and rebuild lifecycle outcomes into bounded
  counters for auto-routed, classified-not-routed, review, hard-limit block,
  missing routing, stale profile, learning allowed/blocked/downgraded, rebuild
  accepted/rejected, and rollback events.
- Trace records use stable `classifarr.phase7r.trace.*` attributes, bounded
  component ids, bounded reason codes, and a configurable `maxTraceRecords`
  limit.
- Trace records now carry supported upstream SHA-256 source fingerprints from
  automation decisions, question reductions, request-time learning decisions,
  and migration verifier reports, with validation rejecting malformed or
  mismatched trace fingerprint attributes.
- Raw provider payloads, raw replay/impact payloads, prompts, embeddings,
  provider payloads, and diagnostic internals are suppressed from trace output.
- Operator summaries are limited to action-oriented next steps such as configure
  routing, review pending items, refresh profile, review rebuild verifier, or no
  action required.
- Metrics persistence and OpenTelemetry export remain future integration work;
  this slice is a side-effect-free projection contract.

### 7R.9 Runtime And Rebuild Test Reset

Intent: protect the new runtime behavior instead of preserving old classification
side effects.

Tasks:

- Categorize runtime tests as:
  - keep as classification regression,
  - rewrite around evidence projection,
  - rewrite around automation decision states,
  - rewrite around question contracts,
  - rewrite around learning guard,
  - rewrite around rebuild/verifier behavior,
  - delete with abandoned diagnostic paths.
- Add tests for:
  - broad genre overlap does not auto-route specialized libraries,
  - missing routing mapping produces `classified_not_routed`,
  - stale questions cannot learn,
  - request-time choices require guarded learning,
  - rebuild proposals preserve explicit constraints,
  - rollback snapshot is required before replacement.

Acceptance criteria:

- Tests fail when runtime bypasses server authority.
- Tests distinguish classification success from routing success.
- Tests protect rebuild safety without freezing old preview UI.

Implementation status:

- Phase 7R.9 runtime and rebuild test reset is documented in
  [Policy Builder Phase 7R Runtime And Rebuild Test Reset](policy-builder-phase-7r-runtime-rebuild-test-reset.md).
- Current implementation adds a server-owned reset manifest that classifies
  runtime/rebuild tests as kept regressions, Phase 7R contract rewrites, or
  abandoned impact/replay diagnostic deletion candidates.
- Required reset coverage now explicitly includes broad genre no specialized
  auto-route, missing routing as `classified_not_routed`, stale questions unable
  to learn, guarded request-time choices, explicit constraint preservation, and
  rollback snapshot requirements.
- Validation rejects runtime/rebuild rewrites that bypass server authority,
  missing-routing coverage that conflates classification and routing success,
  missing replacement contracts, missing trace reasons, and old preview UI frozen
  as the migration contract.

## Phase 7R Work Sequence

Implement Phase 7R in this order:

1. **7R.1 Runtime Decision Inventory And Cutline**
   Prevents wiring new engine behavior into unclear runtime paths.
2. **7R.2 Runtime Evidence Projection**
   Aligns runtime evidence with rebuild/readiness evidence.
3. **7R.3 Automation Decision Contract**
   Defines when automation may proceed.
4. **7R.4 Runtime Question Reduction**
   Ensures questions are rare, bounded, and destination-focused.
5. **7R.5 Request-Time Learning And Destination Selection**
   Uses requests/manual changes as guarded evidence.
6. **7R.6 Library-Derived Policy Rebuild**
   Generates explicit, reviewable policy proposals.
7. **7R.7 Migration Verifier And Rollback Path**
   Makes replacement safe and reversible.
8. **7R.8 Runtime Metrics And Decision Trace**
   Makes runtime behavior auditable.
9. **7R.9 Runtime And Rebuild Test Reset**
   Protects the new behavior.

Current starting point:

- Do not implement rebuild or automatic replacement before Phase 5R and Phase 6R
  cutlines are complete.
- Do not treat current impact/replay preview UI as the Phase 7R migration
  surface until it is classified by Phase 5R/6R.
- Do not let runtime classification learn from manual outcomes without the
  Phase 5R learning guard.
- Use Phase 7R as the runtime/rebuild contract that Phase 8R native storage must
  preserve.

Implementation record:

- Future implementation should create or update a Phase 7R implementation doc
  with runtime/rebuild inventory, decision states, migration verifier role, and
  deletion criteria.

## Phase 8R: Native Intent Storage And Legacy Removal

Intent: make native intent storage the durable policy model after the re-imagined
contracts are stable, then remove replaced legacy preset/custom-signal paths.
Phase 8R is not a compatibility layer expansion. It is the planned storage
migration and cleanup phase that ends the dual-model period.

Native storage should preserve the proven product model from Phases 0R through
7R:

```text
source-of-truth vocabulary
  -> client boundary ownership
  -> typed draft/edit commands
  -> destination-first workflow
  -> server authority and learning guard
  -> evidence/intent/readiness engine
  -> runtime automation and rebuild verifier
  -> native durable intent storage
  -> legacy path deletion after rollback window
```

Non-negotiable storage principles:

- Native intent storage must not be used to discover the product model.
- Native intent storage must preserve already-proven server contracts.
- Legacy payloads are rollback snapshots with bounded lifetime, not a permanent
  second policy model.
- Migration must be explicit, reportable, reversible during the rollback window,
  and eventually followed by deletion of replaced paths.
- Runtime reads native intent as the authority once a policy is converted.

## Phase 8R Component Map

### 8R.1 Native Schema Contract

Intent: define storage around the final intent model, not around legacy
`customSignals` compatibility.

Tasks:

- Design native tables for:
  - policy intent header,
  - intent rules/signals,
  - routing target reference,
  - starter-template application provenance,
  - migration events,
  - rollback snapshots,
  - validation status and schema version.
- Ensure schema maps directly to Phase 5R server contract fields and Phase 6R
  intent engine output.
- Avoid storing UI-only draft state, transient readiness, provider payloads,
  prompts, traces, embeddings, or replay diagnostics as durable policy intent.
- Add indexes for policy lookup, library lookup, active intent version, and
  migration state.

Acceptance criteria:

- Native schema can represent declared intent without legacy `customSignals`.
- Schema separates durable policy intent from evidence snapshots and migration
  metadata.
- Server validation remains required before writes.

Implementation status:

- Phase 8R.1 native schema contract is documented in
  [Policy Builder Phase 8R Native Schema Contract](policy-builder-phase-8r-native-schema-contract.md).
- Current implementation defines a side-effect-free server schema contract for
  native policy intent header, intent rules, routing target reference,
  starter-template application provenance, migration events, rollback snapshots,
  and validation/schema status.
- The contract requires lookup indexes for policy, library, active intent
  version, rule lookup, rule JSONB values, routing target, migration state,
  rollback expiry, and validation status.
- Validation rejects legacy `customSignals`-style storage gaps, missing Phase 5R
  rule fields, unbounded rollback snapshots, missing server validation gates,
  missing referential boundaries, missing active-version uniqueness, and durable
  UI/provider/prompt/trace/embedding/replay diagnostic fields.
- This component does not create database tables yet; SQL migration and
  conversion are reserved for later Phase 8R components after the candidate
  report and explicit conversion workflow are defined.

### 8R.2 Migration Candidate Report

Intent: identify which policies can safely move to native intent before writing
anything.

Tasks:

- Add dry-run reporting for every policy:
  - ready to convert,
  - needs operator review,
  - partial legacy inference,
  - unsupported legacy shape,
  - missing routing target,
  - stale profile dependency,
  - blocked by server contract validation.
- Include explainable reasons and affected policy IDs/names.
- Do not mutate policy storage in report mode.
- Include estimated deletion impact for legacy-only code paths when conversion
  completes.

Acceptance criteria:

- Operators can see conversion readiness without applying migration.
- Unsupported legacy policies are explicit, not silently skipped.
- Report output is bounded and does not expose raw legacy JSON unless explicitly
  requested by maintainer tooling.

Implementation status:

- Phase 8R.2 migration candidate report is documented in
  [Policy Builder Phase 8R Migration Candidate Report](policy-builder-phase-8r-migration-candidate-report.md).
- Current implementation adds a server-owned dry-run report that classifies each
  emitted policy as ready to convert, needing operator review, partial legacy
  inference, unsupported legacy shape, missing routing target, stale profile
  dependency, or blocked by server contract validation.
- The report uses the existing policy intent compatibility contract as the
  projection authority, then adds routing-target, profile-freshness,
  unsupported-shape, validation, bounded-reason, and deletion-impact checks.
- Validation rejects reports that mutate storage, omit affected policy details,
  hide unsupported/routing/stale/validation blockers behind generic statuses,
  omit deletion-impact estimates, or expose raw legacy JSON outside explicit
  maintainer mode.

### 8R.3 Explicit Conversion Workflow

Intent: convert policies only when the operator or post-upgrade process has a
clear, auditable action.

Tasks:

- Convert selected policies from compatibility projection to native intent.
- Require Phase 5R validation before insert/update.
- Require Phase 7R migration verification for behavior-sensitive policies.
- Create a rollback snapshot before conversion.
- Record actor/source:
  - manual operator action,
  - post-upgrade apply mode,
  - test fixture,
  - maintainer migration tool.
- Keep conversion idempotent.

Acceptance criteria:

- Conversion cannot run from ordinary policy read or unrelated save.
- Converted policies have native intent records and migration events.
- Failed conversion leaves the old active policy behavior intact.

Implementation status:

- Phase 8R.3 explicit conversion workflow is documented in
  [Policy Builder Phase 8R Explicit Conversion Workflow](policy-builder-phase-8r-explicit-conversion-workflow.md).
- Current implementation adds a side-effect-free server workflow plan that
  accepts selected policy IDs, an approved actor/source, a Phase 8R.2 candidate
  report, optional Phase 7R migration verifier output, and rollback snapshot
  options.
- Conversion planning is allowed only for manual operator actions,
  post-upgrade apply mode, test fixtures, or maintainer migration tooling; it is
  rejected for ordinary policy reads and unrelated saves.
- Ready conversion steps must have a ready candidate, server validation,
  rollback snapshot plan, migration event plan, native intent record plan,
  deterministic idempotency key, and legacy behavior retained until commit.
- Behavior-sensitive policies must have passing or accepted Phase 7R migration
  verifier output before the workflow can mark them ready.

### 8R.4 Native Runtime Read Path

Intent: make converted policies use native intent as the runtime authority.

Tasks:

- Update policy read/detail routes to return native intent when present.
- Update runtime services to prefer native intent over compatibility projection
  for converted policies.
- Keep unconverted policies on compatibility projection until migration.
- Ensure server contract output is identical in shape whether sourced from
  native storage or compatibility bridge.
- Add decision trace metadata that records `source: native_intent` or
  `source: compatibility_bridge`.

Acceptance criteria:

- Converted policies do not depend on `customSignals` for runtime behavior.
- Clients can render converted and unconverted policies through the same product
  contract.
- Runtime behavior remains traceable by source.

Implementation status:

- Phase 8R.4 native runtime read path is documented in
  [Policy Builder Phase 8R Native Runtime Read Path](policy-builder-phase-8r-native-runtime-read-path.md).
- Current implementation adds a focused server read-path service that prefers an
  attached active native intent contract for converted policies and falls back
  to the compatibility bridge for unconverted policies.
- Both paths return the same `configuration_view`, `policy_intent_contract`, and
  `policy_intent_read_trace` product shape through the existing mapper.
- Active invalid native intent is surfaced as `native_intent_invalid` instead of
  silently falling back to legacy custom-signal behavior.
- Read trace metadata records `native_intent` or `compatibility_bridge` with
  bounded `classifarr.phase8r.read.*` attributes.
- Validation rejects missing or mismatched read-source trace metadata, unstable
  contract shape, native reads that depend on custom signals, and read-path
  storage side effects.

### 8R.5 Rollback Snapshot And Reversion Window

Intent: support safe reversal without preserving the legacy model permanently.

Tasks:

- Store bounded rollback snapshots before conversion or accepted rebuild.
- Snapshot enough to restore:
  - preset attachments,
  - weights,
  - thresholds,
  - `customSignals`,
  - routing/mapping references,
  - migration actor and reason.
- Define rollback window and retention policy.
- Add a revert path for converted policies during the rollback window.
- After the rollback window, retain only minimal audit metadata needed for
  support/compliance and delete bulky legacy payload snapshots.

Acceptance criteria:

- Rollback is possible during the defined window.
- Rollback snapshots are not permanent alternate policy storage.
- Retention behavior is documented and testable.

Implementation status:

- Phase 8R.5 rollback snapshot and reversion-window behavior is documented in
  [Policy Builder Phase 8R Rollback Snapshot And Reversion Window](policy-builder-phase-8r-rollback-snapshot-window.md).
- Current implementation adds a side-effect-free server service that builds a
  rollback snapshot manifest, revert eligibility contract, and post-window
  retention plan for native policy conversion/rebuild work.
- Required restore sections cover preset attachments, weights, thresholds,
  `customSignals`, routing/mapping references, migration actor, and migration
  reason.
- Rollback windows default to 14 days and validate to a one-to-thirty-day
  boundary so snapshots cannot become permanent alternate legacy storage.
- Revert is allowed only during the window and only for approved manual
  operator, post-upgrade apply, test fixture, or maintainer migration actions;
  ordinary policy reads and unrelated saves are blocked.
- Post-window retention requires bulky payload deletion and keeps only minimal
  audit metadata needed for support/compliance.
- Validation rejects missing restore sections, missing actor/reason data,
  unbounded snapshots, raw payload exposure, permanent alternate storage,
  ordinary read/write revert, missing retention policy, bulky payload retention
  after expiry, and planning side effects.

### 8R.6 Legacy Write Path Shutdown

Intent: stop writing new policy behavior through legacy preset/custom-signal
paths after native intent is active.

Tasks:

- Block legacy write paths for converted policies.
- Keep compatibility writes only for unconverted policies during migration.
- Prevent product components from adding new legacy-only behavior.
- Add warnings or migration blockers when a converted policy receives legacy-only
  update payloads.
- Remove draft-sidecar non-persistence diagnostics once native intent writes are
  supported.

Acceptance criteria:

- Converted policies cannot drift back to legacy storage accidentally.
- New policy creation can default to native intent only after conversion gates
  and rollback tools are proven.
- Legacy write support has a removal checklist.

Implementation status:

- Phase 8R.6 legacy write shutdown behavior is documented in
  [Policy Builder Phase 8R Legacy Write Path Shutdown](policy-builder-phase-8r-legacy-write-path-shutdown.md).
- Current implementation adds a side-effect-free server write-boundary service
  that classifies policy write operations before route mutation or SQL writes.
- Converted policies block legacy behavior writes for preset attachments,
  preset-level `customSignals`, legacy scoring weights, trust flags, decision
  thresholds, combination mode, preset attach/delete/replace operations, preset
  custom-signal updates, and reset flows that would recreate legacy behavior.
- Converted policies allow metadata-only maintenance such as name, description,
  enabled state, priority, and sort order.
- Unconverted policies can continue compatibility writes during migration, but
  the boundary emits time-bounded warnings and a removal checklist.
- Native intent payloads are blocked until native write persistence is marked
  ready.
- New policy legacy defaults are blocked once native default gates are ready.
- Validation rejects converted legacy writes that are marked allowed, converted
  reset-to-legacy allowance, native writes without readiness, unconverted
  compatibility writes without warnings, native-ready new-policy legacy
  defaults, missing removal checklist items, and planning side effects.

### 8R.7 Legacy Code Deletion Gates

Intent: remove replaced compatibility code after migration proves stable.

Tasks:

- Define deletion gates for:
  - client bridge-only UI surfaces,
  - legacy serializer/deserializer paths,
  - custom-signal mutation helpers,
  - preset-as-policy runtime behavior,
  - old preview/replay diagnostic UI,
  - stale compatibility tests that only preserve removed behavior.
- Require coverage before deletion:
  - native read/write tests,
  - runtime native decision tests,
  - conversion/reversion tests,
  - backup/restore tests,
  - post-upgrade dry-run/apply tests.
- Track remaining unconverted policies and block deletion until support stance is
  explicit.

Acceptance criteria:

- Replaced code is deleted after gates, not hidden or preserved permanently.
- Remaining compatibility is intentional and time-bounded.
- The repository no longer carries two full policy models after migration gates
  pass.

Implementation status:

- Phase 8R.7 legacy code deletion gates are documented in
  [Policy Builder Phase 8R Legacy Code Deletion Gates](policy-builder-phase-8r-legacy-code-deletion-gates.md).
- The side-effect-free deletion-gate contract lives in
  `server/src/services/policyBuilderPhase8LegacyCodeDeletionGates.mjs`.
- The focused deletion-gate test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8LegacyCodeDeletionGates.test.mjs`.
- Current implementation consumes the existing legacy compatibility boundary
  inventory, defines all required deletion categories and coverage gates, blocks
  deletion while unconverted policy count is unknown or non-zero, requires an
  explicit support stance, rejects permanent hiding/archiving as the cleanup
  strategy, and validates that this component performs no file, route, test, or
  storage side effects.

### 8R.8 Backup, Restore, And Post-Upgrade Safety

Intent: make native storage operationally safe before it becomes default.

Tasks:

- Include native intent tables in backup and restore flows.
- Include rollback snapshots and migration events in restore validation.
- Add post-upgrade dry-run reporting before apply mode.
- Ensure failed post-upgrade migration cannot leave mixed partial writes.
- Add versioned schema checks and clear operator-facing migration errors.

Acceptance criteria:

- Fresh install and upgraded install schemas match after migrations.
- Backup/restore proves native policy recovery.
- Post-upgrade can report and apply conversion candidates safely.

Implementation status:

- Phase 8R.8 backup, restore, and post-upgrade safety is documented in
  [Policy Builder Phase 8R Backup, Restore, And Post-Upgrade Safety](policy-builder-phase-8r-backup-restore-post-upgrade-safety.md).
- The side-effect-free operational safety contract lives in
  `server/src/services/policyBuilderPhase8BackupRestoreSafety.mjs`.
- The focused safety test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8BackupRestoreSafety.test.mjs`.
- Current implementation enumerates native intent tables from the Phase 8R.1
  schema contract, requires every native table in backup and restore coverage,
  requires restore validation for native policy recovery, rollback snapshots,
  migration events, and schema versions, and blocks readiness until
  fresh-install/upgraded-install schema parity is proven.
- Live backup/export and transactional restore now include native policy intent
  headers, rules, routing targets, starter-template provenance, migration
  events, rollback snapshots, and validation status; restore remaps old policy,
  library, and native intent IDs before restoring child rows.
- Live wiring is documented in
  [Policy Builder Phase 8R Native Backup And Restore Wiring](policy-builder-phase-8r-native-backup-restore-wiring.md).
- Post-upgrade apply mode is blocked unless dry-run reporting is current,
  conversion is atomic, failure rolls back, legacy behavior stays active until
  commit, mixed partial native/legacy writes are prevented, and clear
  operator-facing migration error IDs are present.
- Validation rejects missing backup/restore coverage, missing restore
  validations, schema mismatch, apply without dry-run, mixed partial writes,
  missing operator errors, and any planning side effects.

### 8R.9 Native Storage Test Reset

Intent: protect native intent behavior and deletion gates.

Tasks:

- Add tests for:
  - native schema migrations,
  - dry-run candidate report,
  - explicit conversion,
  - native runtime read path,
  - rollback and reversion,
  - legacy write blocking for converted policies,
  - backup/restore coverage,
  - deletion-gate checks.
- Rewrite tests that currently assert legacy payload preservation so they apply
  only to unconverted policies or rollback snapshots.
- Remove tests that only preserve abandoned diagnostic UI after its deletion
  gates pass.

Acceptance criteria:

- Tests enforce native intent as the durable model for converted policies.
- Compatibility tests are scoped to migration/rollback, not the future product
  path.
- Deletion gates are testable.

Implementation status:

- Phase 8R.9 native storage test reset is documented in
  [Policy Builder Phase 8R Native Storage Test Reset](policy-builder-phase-8r-native-storage-test-reset.md).
- The side-effect-free test reset contract lives in
  `server/src/services/policyBuilderPhase8NativeStorageTestReset.mjs`.
- The focused reset test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8NativeStorageTestReset.test.mjs`.
- Current implementation inventories Phase 8R native schema contract,
  dry-run candidate report, explicit conversion, native runtime read path,
  rollback/reversion, legacy write-blocking, backup/restore safety, and
  deletion-gate tests.
- Native SQL migration coverage is now supplied by
  `database/migrations/20260701_160000_add_policy_intent_native_storage.sql`,
  `database/schema/current.sql`, and `server/src/__tests__/migrations.test.mjs`.
- The native SQL migration coverage follow-up is documented in
  [Policy Builder Phase 8R Native SQL Migration Coverage](policy-builder-phase-8r-native-sql-migration-coverage.md).
- Legacy payload preservation tests are allowed only for unconverted policy
  compatibility, rollback snapshot restore, or maintainer migration fixtures.
- Abandoned diagnostic impact/replay tests must be deletion-scoped and cannot
  count as final native-storage product coverage.
- Validation rejects missing required coverage, unscoped legacy preservation,
  diagnostic tests not marked for deletion, diagnostic tests remaining after
  deletion gates pass, abandoned diagnostics marked as final coverage, and any
  planning side effects.

### 8R.10 Native Backup And Restore Wiring

Intent: make Phase 8R native intent recoverable through the real backup and
restore path before any post-upgrade conversion apply mode is enabled.

Tasks:

- Export every native policy intent table through `backupService`.
- Restore native policy intent rows after library and policy IDs are remapped.
- Remap native intent IDs before restoring rules, routing targets, template
  applications, migration events, rollback snapshots, and validation status.
- Keep replace-mode cleanup explicit for native intent tables.
- Return bounded native restore counts to operators without logging raw intent
  payloads.

Acceptance criteria:

- Backups contain all Phase 8R native intent tables.
- Restores attach native rows to restored policy/library IDs, not stale IDs.
- Restore remains transactional.
- Orphaned native rows are skipped fail-closed.
- Post-upgrade conversion apply remains disabled until dry-run and transaction
  gates are wired.

Implementation status:

- Phase 8R native backup/restore wiring is documented in
  [Policy Builder Phase 8R Native Backup And Restore Wiring](policy-builder-phase-8r-native-backup-restore-wiring.md).
- Backup export includes native intent headers, rules, routing targets,
  starter-template provenance, migration events, rollback snapshots, and
  validation status.
- Transactional restore now remaps old policy, library, and native intent IDs
  before restoring native child rows.
- Focused backup/export, restore-helper, and backup lifecycle integration tests
  cover the new wiring.

### 8R.11 Post-Upgrade Dry-Run Wiring

Intent: connect real policy storage to Phase 8R candidate reporting during
post-upgrade without applying native conversion.

Tasks:

- Load bounded policy, library, ARR mapping, and preset input for post-upgrade
  reporting.
- Run the Phase 8R migration candidate report against that input.
- Select ready policies for a plan-only explicit conversion workflow using the
  approved `post_upgrade_apply` actor source.
- Return operator-safe status, counts, selected policy IDs, bounded error IDs,
  and validation state.
- Keep conversion apply disabled until transaction, rollback snapshot, and
  operator failure gates are implemented.

Acceptance criteria:

- Dry-run uses the same Phase 8R candidate and explicit workflow contracts as
  manual conversion planning.
- Dry-run performs no policy, native storage, migration event, rollback
  snapshot, or legacy deletion side effects.
- No-policy and no-ready-candidate states report clearly without forcing an
  invalid empty-selection conversion workflow.
- Post-upgrade logs contain only bounded status/count/error identifiers, not raw
  policy payloads.

Implementation status:

- Phase 8R post-upgrade dry-run wiring is documented in
  [Policy Builder Phase 8R Post-Upgrade Dry-Run Wiring](policy-builder-phase-8r-post-upgrade-dry-run-wiring.md).
- The dry-run service lives in
  `server/src/services/policyBuilderPhase8PostUpgradeDryRun.mjs`.
- The `phase8r_native_intent_dry_run` action is wired into
  `postUpgradeService`.
- Focused service tests cover ready, review-required, no-policy, loader mapping,
  and orchestration paths.

### 8R.12 Post-Upgrade Apply Gate

Intent: allow native intent conversion only after a current dry-run proves ready
and a transaction boundary is available.

Tasks:

- Consume current Phase 8R.11 dry-run output.
- Block missing, invalid, stale, or no-ready-step dry-run reports.
- Require `db.withTransaction` before native apply writes.
- Write native intent header, rollback snapshot, rules, routing target,
  starter-template applications, validation status, and migration events in one
  transaction.
- Keep legacy preset/custom-signal storage and bridge code undeleted until
  runtime cutover and deletion gates pass.

Acceptance criteria:

- Apply cannot run without a valid current dry-run.
- Apply cannot run without transaction rollback semantics.
- Failed apply reports rollback-safe operator error IDs.
- Successful apply records rollback snapshot and migration events before native
  intent is treated as applied.
- Legacy behavior remains available until later cutover/deletion gates.

Implementation status:

- Phase 8R post-upgrade apply gate is documented in
  [Policy Builder Phase 8R Post-Upgrade Apply Gate](policy-builder-phase-8r-post-upgrade-apply-gate.md).
- The apply-gate service lives in
  `server/src/services/policyBuilderPhase8PostUpgradeApplyGate.mjs`.
- The `phase8r_native_intent_apply_gate` action is wired into
  `postUpgradeService` but is not registered as an automatic release-version
  task.
- Focused tests cover missing dry-run, stale dry-run, successful transaction
  apply, and rollback-safe failure reporting.

### 8R.13 Native Runtime Cutover Verification

Intent: prove converted policies read from native intent in real runtime paths
before compatibility paths are deleted.

Tasks:

- Attach active native intent rows to detailed policy read models.
- Keep unconverted policies on the compatibility bridge.
- Preserve the existing public projection shape:
  - `configuration_view`,
  - `policy_intent_contract`,
  - `policy_intent_read_trace`.
- Verify converted and unconverted read-source behavior with explicit source
  traces.
- Require rollback availability, deletion blocking, and bounded support
  diagnostics before treating cutover as ready.

Acceptance criteria:

- Converted detailed policy reads return `source: native_intent`.
- Unconverted detailed policy reads return compatibility fallback.
- Native reads do not depend on legacy `customSignals`.
- Legacy deletion remains blocked until the next deletion-readiness gate.
- Verification performs no policy, native write, rollback, or deletion side
  effects.

Implementation status:

- Phase 8R native runtime cutover verification is documented in
  [Policy Builder Phase 8R Native Runtime Cutover Verification](policy-builder-phase-8r-native-runtime-cutover-verification.md).
- The native policy read loader lives in
  `server/src/services/policyBuilderPhase8NativePolicyReadService.mjs`.
- The cutover verification contract lives in
  `server/src/services/policyBuilderPhase8NativeRuntimeCutoverVerification.mjs`.
- Detailed `GET /api/policies/:id` now attaches active native intent before
  projection.
- Focused tests cover native row contract building, converted route projection,
  converted/unconverted cutover verification, rollback blocking, and deletion
  blocking.

### 8R.14 Compatibility Path Deletion Readiness

Intent: prove compatibility paths are ready for deletion execution planning
without deleting files, removing routes, dropping tests, or mutating storage.

Tasks:

- Compose Phase 8R.7 legacy code deletion gates with Phase 8R.13 native runtime
  cutover verification.
- Block readiness when converted/native runtime cutover is not ready.
- Block readiness when deletion gates are not ready.
- Block readiness while residual compatibility references remain.
- Require backup/restore verification, rollback support, support diagnostics,
  and deletion-manifest approval.
- Keep readiness output side-effect-free.

Acceptance criteria:

- Readiness is blocked by default unless all prior gates and confirmations are
  provided.
- Readiness does not delete files, archive files, remove routes, remove tests,
  mutate storage, or write deletion manifests.
- Ready output only advances to an execution-plan phase, not immediate deletion.
- Residual compatibility references are surfaced as bounded risk records.

Implementation status:

- Phase 8R.14 compatibility path deletion readiness is documented in
  [Policy Builder Phase 8R Compatibility Path Deletion Readiness](policy-builder-phase-8r-compatibility-path-deletion-readiness.md).
- The deletion-readiness contract lives in
  `server/src/services/policyBuilderPhase8CompatibilityPathDeletionReadiness.mjs`.
- The focused deletion-readiness test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8CompatibilityPathDeletionReadiness.test.mjs`.
- Current implementation composes Phase 8R.7 deletion gates and Phase 8R.13
  cutover verification, blocks residual references and missing safety
  confirmations, and validates that no deletion side effects occur.

### 8R.15 Compatibility Path Deletion Execution Plan

Intent: convert compatibility deletion readiness into a concrete, reviewable
execution manifest without deleting code.

Tasks:

- Consume Phase 8R.14 deletion readiness.
- Consume Phase 8R.7 deletion categories and exact compatibility paths.
- Generate manifest entries with:
  - deletion category,
  - action ID,
  - exact path,
  - deletion intent,
  - replacement evidence.
- Require rollback or post-window recovery stance.
- Require support stance for converted native policies.
- Require explicit manifest approval.
- Keep the execution plan side-effect-free.

Acceptance criteria:

- Execution planning is blocked unless Phase 8R.14 readiness passed.
- Every manifest entry has an exact path and replacement evidence.
- Missing rollback/support stance or manifest approval blocks the plan.
- Output never deletes files, archives files, removes routes, removes tests,
  mutates storage, or writes a manifest.
- Ready output advances only to a final execution gate.

Implementation status:

- Phase 8R.15 compatibility path deletion execution plan is documented in
  [Policy Builder Phase 8R Compatibility Path Deletion Execution Plan](policy-builder-phase-8r-compatibility-path-deletion-execution-plan.md).
- The execution-plan contract lives in
  `server/src/services/policyBuilderPhase8CompatibilityPathDeletionExecutionPlan.mjs`.
- The focused execution-plan test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8CompatibilityPathDeletionExecutionPlan.test.mjs`.
- Current implementation builds exact manifest entries from Phase 8R.7
  categories and paths, requires replacement evidence by path or category,
  requires rollback/support/approval stances, and validates that no deletion
  side effects occur.

### 8R.16 Compatibility Path Deletion Execution Gate

Intent: verify final pre-execution conditions before compatibility path deletion
can move to a separate controlled deletion step.

Tasks:

- Consume Phase 8R.15 execution plan.
- Require a clean worktree confirmation.
- Require verified and fresh backup/restore evidence.
- Require explicit operator approval with an approving actor.
- Require final rollback or post-window recovery stance.
- Require final support stance for converted native policies.
- Require manifest freshness and confirmation that it still matches the current
  execution plan.
- Keep the gate side-effect-free.

Acceptance criteria:

- Gate is blocked unless Phase 8R.15 execution plan is ready and valid.
- Dirty worktree blocks the gate.
- Missing or stale backup/restore evidence blocks the gate.
- Missing approval, approving actor, rollback stance, or support stance blocks
  the gate.
- Stale or mismatched manifest blocks the gate.
- Gate never deletes files, archives files, removes routes, removes tests,
  mutates storage, writes manifests, or runs Git commands.

Implementation status:

- Phase 8R.16 compatibility path deletion execution gate is documented in
  [Policy Builder Phase 8R Compatibility Path Deletion Execution Gate](policy-builder-phase-8r-compatibility-path-deletion-execution-gate.md).
- The execution-gate contract lives in
  `server/src/services/policyBuilderPhase8CompatibilityPathDeletionExecutionGate.mjs`.
- The focused execution-gate test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8CompatibilityPathDeletionExecutionGate.test.mjs`.
- Current implementation verifies execution-plan readiness, worktree
  cleanliness, backup/restore freshness, operator approval, final support
  stances, manifest freshness, and validates that no deletion side effects
  occur.

### 8R.17 Controlled Compatibility Path Removal

Intent: consume a ready Phase 8R.15 execution plan and Phase 8R.16 final gate,
then produce a small, reviewable compatibility path removal batch without
performing destructive changes.

Tasks:

- Consume Phase 8R.15 approved manifest entries.
- Consume Phase 8R.16 final preflight gate output.
- Require selected paths to exist in the approved manifest.
- Require selected manifest entries to include replacement evidence.
- Require a narrow maximum batch size.
- Require removal reason and reviewing actor.
- Preserve a side-effect-free output for the later apply step.

Acceptance criteria:

- Removal batch is blocked unless the execution plan is ready and valid.
- Removal batch is blocked unless the execution gate is ready and valid.
- Empty selections and paths outside the approved manifest are blocked.
- Batches broader than the configured maximum are blocked.
- Missing review reason or reviewer blocks the batch.
- Service never deletes files, archives files, removes routes, removes tests,
  mutates storage, writes manifests, or runs Git commands.

Implementation status:

- Phase 8R.17 controlled compatibility path removal is documented in
  [Policy Builder Phase 8R Controlled Compatibility Path Removal](policy-builder-phase-8r-controlled-compatibility-path-removal.md).
- The removal-batch contract lives in
  `server/src/services/policyBuilderPhase8ControlledCompatibilityPathRemoval.mjs`.
- The focused removal-batch test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8ControlledCompatibilityPathRemoval.test.mjs`.
- Current implementation builds a side-effect-free removal review batch from
  selected manifest paths and defers destructive application to Phase 8R.18
  because candidate paths still have live imports.

### 8R.18 Controlled Compatibility Path Removal Apply

Intent: apply one reviewed Phase 8R.17 compatibility path removal batch through
an explicit adapter boundary and record structured apply evidence for
post-removal verification.

Tasks:

- Consume a ready Phase 8R.17 removal review batch.
- Require `executeApply=true`.
- Require explicit operator confirmation with confirming actor.
- Require an injected apply adapter with `applyEntry(entry)`.
- Apply only reviewed batch entries through the adapter.
- Require apply result count, path, and action parity with the reviewed batch.
- Reject archive, storage, and Git-command side effects inside the service.
- Emit apply evidence for the next runtime/import verification step.

Acceptance criteria:

- Apply is blocked unless Phase 8R.17 removal batch is ready and valid.
- Apply is blocked without explicit execute flag and named confirmation actor.
- Apply is blocked without an adapter.
- Adapter failures are captured as bounded risks.
- Mismatched paths, mismatched actions, or `applied=false` results block apply.
- Service does not run Git commands or mutate storage.
- Apply output identifies bounded removal side effects and validates that
  unexpected side effects did not occur.

Implementation status:

- Phase 8R.18 controlled compatibility path removal apply is documented in
  [Policy Builder Phase 8R Controlled Compatibility Path Removal Apply](policy-builder-phase-8r-controlled-compatibility-path-removal-apply.md).
- The apply contract lives in
  `server/src/services/policyBuilderPhase8ControlledCompatibilityPathRemovalApply.mjs`.
- The focused apply test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8ControlledCompatibilityPathRemovalApply.test.mjs`.
- Current implementation applies reviewed batches through an injected adapter,
  requires explicit confirmation, verifies result parity, rejects archive,
  storage, and Git-command side effects, and advances to post-removal runtime
  verification.

### 8R.19 Post-Removal Runtime Verification

Intent: consume Phase 8R.18 apply evidence and prove the removed compatibility
paths are no longer imported, runtime checks still pass, and focused plus full
validation evidence exists before another removal batch can proceed.

Tasks:

- Consume completed Phase 8R.18 apply evidence.
- Require apply evidence to be valid and complete.
- Require import/reference scan evidence for every applied removal path.
- Block if any removed path is still referenced.
- Require focused runtime/import checks to pass.
- Require focused and full validation evidence to pass.
- Reject storage or Git-command side effects inside the verifier.
- Emit authorization context for the next removal batch.

Acceptance criteria:

- Verification is blocked unless Phase 8R.18 apply evidence is applied and
  valid.
- Missing import scan evidence blocks verification.
- Any lingering reference to a removed path blocks verification.
- Missing or failed runtime checks block verification.
- Missing or failed focused/full validation blocks verification.
- Verifier does not run source searches, tests, Git commands, storage mutation,
  or additional removals itself.

Implementation status:

- Phase 8R.19 post-removal runtime verification is documented in
  [Policy Builder Phase 8R Post-Removal Runtime Verification](policy-builder-phase-8r-post-removal-runtime-verification.md).
- The verifier contract lives in
  `server/src/services/policyBuilderPhase8PostRemovalRuntimeVerification.mjs`.
- The focused verifier test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8PostRemovalRuntimeVerification.test.mjs`.
- Current implementation consumes apply, import scan, runtime check, and
  focused/full validation evidence; blocks lingering references or failed
  checks; rejects storage/Git side effects; and advances to next-batch
  authorization.

### 8R.20 Next Compatibility Removal Batch Authorization

Intent: consume verified Phase 8R.19 evidence and the approved compatibility
deletion manifest, calculate remaining manifest paths, prevent already removed
paths from re-entering a batch, and authorize only the next narrow removal
batch.

Tasks:

- Require Phase 8R.19 status to be verified and valid.
- Require Phase 8R.15 execution-plan evidence to be ready and valid.
- Calculate remaining manifest paths from approved entries minus applied paths.
- Block unknown requested paths.
- Block requested paths that were already removed.
- Block empty requested batches while remaining paths exist.
- Block batches wider than the configured maximum batch size.
- Require authorizing operator and reason while remaining paths exist.
- Emit a side-effect-free authorization payload for the next controlled
  removal batch.

Acceptance criteria:

- Authorization is blocked unless post-removal verification passed.
- Authorization is blocked unless the approved manifest is available and valid.
- Already removed paths cannot re-enter a removal batch.
- Unknown paths cannot enter a removal batch.
- Batch size is bounded.
- If no approved manifest paths remain, the component reports completion
  instead of requiring another batch.
- The component does not delete files, write manifests, mutate storage, run
  tests, or run Git commands.

Implementation status:

- Phase 8R.20 next compatibility removal batch authorization is documented in
  [Policy Builder Phase 8R Next Compatibility Removal Batch Authorization](policy-builder-phase-8r-next-compatibility-removal-batch-authorization.md).
- The authorization contract lives in
  `server/src/services/policyBuilderPhase8NextCompatibilityRemovalBatchAuthorization.mjs`.
- The focused authorization test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8NextCompatibilityRemovalBatchAuthorization.test.mjs`.
- Current implementation authorizes only requested remaining manifest paths,
  blocks already removed or unknown paths, caps batch size, requires operator
  context, and advances to a completion audit.

### 8R.21 Compatibility Removal Completion Audit

Intent: consume verified removal-loop evidence and prove whether all approved
compatibility manifest paths are gone, or report the bounded remaining
inventory that still needs another 8R.17 through 8R.20 loop.

Tasks:

- Require Phase 8R.20 completion authorization evidence.
- Require the approved Phase 8R.15 execution manifest.
- Require verified Phase 8R.19 removal verification evidence.
- Prove every approved manifest path is covered by verified removal evidence.
- Require final import/reference scan evidence for every approved manifest
  path.
- Block if any final scan reference remains.
- Require focused and full validation evidence to pass.
- Report remaining inventory separately from failed evidence.
- Reject file, archive, route, test, storage, manifest, or Git side effects
  inside the audit.

Acceptance criteria:

- Completion is blocked unless Phase 8R.20 reports no remaining paths.
- Completion is blocked unless the execution manifest is ready and valid.
- Completion is blocked unless verified removal evidence covers every approved
  manifest path.
- Completion is blocked if final import/reference scan evidence is missing or
  reports references.
- Completion is blocked if focused or full validation evidence is missing or
  failed.
- If remaining manifest paths exist, the audit reports `remaining_inventory`
  rather than claiming completion.
- The component does not run source searches, tests, Git commands, storage
  mutation, manifest writes, archive writes, or removals itself.

Implementation status:

- Phase 8R.21 compatibility removal completion audit is documented in
  [Policy Builder Phase 8R Compatibility Removal Completion Audit](policy-builder-phase-8r-compatibility-removal-completion-audit.md).
- The audit contract lives in
  `server/src/services/policyBuilderPhase8CompatibilityRemovalCompletionAudit.mjs`.
- The focused audit test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8CompatibilityRemovalCompletionAudit.test.mjs`.
- Current implementation consumes completion authorization, execution manifest,
  verified removal evidence, final scan evidence, and focused/full validation
  evidence; reports remaining inventory separately; blocks incomplete
  completion claims; and advances to a Phase 8R completion checkpoint.

Current removal slice:

- Starter-template mechanics removal is documented in
  [Policy Builder Phase 8R Starter Template Mechanics Removal](policy-builder-phase-8r-starter-template-mechanics-removal.md).
- The approved compatibility path
  `client/src/components/policies/PolicyStarterTemplateMechanics.vue` has been
  removed from product code and replaced by
  `client/src/components/policies/PolicyStarterTemplateAccelerator.vue`.
- The focused component test now targets
  `client/src/__tests__/PolicyStarterTemplateAccelerator.test.js`.
- The final-removal reference scanner now excludes tests and Phase control-plane
  manifest/audit services so completion is blocked by product/runtime
  references rather than deletion-manifest evidence strings.
- Impact-preview service removal is documented in
  [Policy Builder Phase 8R Impact Preview Removal](policy-builder-phase-8r-impact-preview-removal.md).
- The approved compatibility path
  `server/src/services/policyIntentImpactPreview.mjs` has been removed from
  product code and replaced by
  `server/src/services/policyBuilderPhase8ImpactMigrationVerifier.mjs`.
- The policy write route still exposes the current non-persistent verifier
  endpoint, but it no longer imports the deleted compatibility service path.
- The focused service test now targets
  `server/src/__tests__/services/policyBuilderPhase8ImpactMigrationVerifier.test.mjs`.
- Replay-preview service removal is documented in
  [Policy Builder Phase 8R Replay Preview Removal](policy-builder-phase-8r-replay-preview-removal.md).
- The approved compatibility path
  `server/src/services/policyIntentReplayPreview.mjs` has been removed from
  product/runtime code and replaced by
  `server/src/services/policyBuilderPhase8ReplayMigrationVerifier.mjs`.
- The policy write route still exposes the current replay-preview endpoint for
  the existing UI, but server composition now runs through the Phase 8R
  migration verifier.
- The focused replay service test now targets
  `server/src/__tests__/policyBuilderPhase8ReplayMigrationVerifier.test.mjs`.

### 8R.22 Phase 8R Completion Checkpoint

Intent: consume current-state evidence for the full Phase 8R sequence and prove
whether the phase can close, without relying on narrative confidence or the
latest component alone.

Tasks:

- Enumerate expected Phase 8R components from 8R.1 through 8R.21.
- Require implementation evidence for every expected component.
- Require design/outcome document evidence for every expected component.
- Require service, route, migration, or wiring contract evidence for every
  expected component.
- Require focused test evidence for every expected component.
- Require roadmap sequence and implementation-status evidence for every
  expected phase ID.
- Require a complete and valid Phase 8R.21 compatibility removal completion
  audit.
- Require focused, lint, markdown, and full validation evidence to pass.
- Require changelog coverage for every expected component.
- Reject file-write, storage, command-execution, and Git side effects inside
  the checkpoint.

Acceptance criteria:

- Checkpoint completion is blocked when any expected component lacks
  implementation, design-doc, contract, or test evidence.
- Checkpoint completion is blocked when the roadmap sequence or implementation
  status omits an expected phase ID.
- Checkpoint completion is blocked unless Phase 8R.21 removal audit evidence is
  complete and valid.
- Checkpoint completion is blocked when focused, lint, markdown, or full
  validation evidence is missing or failed.
- Checkpoint completion is blocked when changelog coverage is missing for any
  expected phase.
- The checkpoint does not scan files, run commands, mutate storage, write
  docs/changelog, or run Git itself.

Implementation status:

- Phase 8R.22 completion checkpoint is documented in
  [Policy Builder Phase 8R Completion Checkpoint](policy-builder-phase-8r-completion-checkpoint.md).
- The checkpoint contract lives in
  `server/src/services/policyBuilderPhase8CompletionCheckpoint.mjs`.
- The focused checkpoint test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8CompletionCheckpoint.test.mjs`.
- Current implementation consumes component evidence, roadmap evidence, final
  removal audit evidence, validation evidence, and changelog evidence; blocks
  incomplete coverage; and emits `8r_complete` only when all evidence passes.

### 8R.23 Completion Evidence Run

Intent: normalize explicit current-state artifact evidence and run the Phase
8R.22 completion checkpoint against that evidence before Phase 8R is closed.

Tasks:

- Accept explicit artifact inventory grouped by service, route, migration,
  test, documentation, wiring, and other paths.
- Provide a current-state evidence collector that reads the repository checkout
  and builds that artifact inventory outside the pure evaluator.
- Provide a root script that emits the current evidence run as JSON and can fail
  when Phase 8R completion is required.
- Normalize Windows and POSIX path separators before artifact matching.
- Map every Phase 8R component from 8R.1 through 8R.22 to its expected docs,
  contracts, and focused tests.
- Extract roadmap sequence/status evidence from Phase 8R headings and work
  sequence items.
- Extract changelog evidence from Phase 8R component labels.
- Treat existing production integration files as valid contract evidence when a
  component was implemented through live wiring rather than a new wrapper
  service.
- Compose the Phase 8R.22 completion checkpoint instead of duplicating closure
  rules.
- Block completion when artifact inventory is empty, mapped artifacts are
  missing, checkpoint evidence is incomplete, validation evidence fails, or any
  side effect is reported.
- Reject file writes, storage mutation, command execution, and Git execution
  inside the evidence-run service.

Acceptance criteria:

- Evidence-run completion is blocked when the artifact inventory is empty.
- Evidence-run completion is blocked when any mapped Phase 8R artifact is
  missing.
- Evidence-run completion is blocked unless the composed Phase 8R.22 checkpoint
  completes and validates.
- Windows-style and POSIX-style paths produce the same artifact matching result.
- Phase 8R.10 native backup/restore wiring is represented by the live
  backup/restore modules and lifecycle tests.
- The evidence run does not scan files, run commands, mutate storage, write
  docs/changelog, delete code, or run Git itself.
- The current-state script reports mapped artifact, roadmap, and changelog
  coverage while requiring caller-supplied final-removal-audit and validation
  evidence before closure can pass.

Implementation status:

- Phase 8R.23 completion evidence run is documented in
  [Policy Builder Phase 8R Completion Evidence Run](policy-builder-phase-8r-completion-evidence-run.md).
- The evidence-run contract lives in
  `server/src/services/policyBuilderPhase8CompletionEvidenceRun.mjs`.
- The current-state evidence collector lives in
  `server/src/services/policyBuilderPhase8CurrentEvidenceCollector.mjs`.
- The root runner lives in `scripts/run-policy-builder-phase-8r-evidence.mjs`
  and is exposed as `npm run policy:phase8r:evidence`.
- The focused evidence-run test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8CompletionEvidenceRun.test.mjs`.
- The focused current-state collector test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8CurrentEvidenceCollector.test.mjs`.
- Current implementation consumes explicit artifact inventory, converts mapped
  artifact coverage into checkpoint component evidence, composes the Phase 8R.22
  completion checkpoint, blocks incomplete evidence, and emits
  `8r_complete` only when supplied evidence satisfies the checkpoint.
- Current checkout execution reports all mapped Phase 8R artifacts present, then
  correctly blocks closure until machine-readable Phase 8R.21 final removal
  audit evidence and validation evidence are supplied.

### 8R.24 Validation Evidence Generator

Intent: generate the machine-readable validation JSON required by the Phase
8R.23 evidence run without moving validation execution into the completion
checkpoint.

Tasks:

- Define fixed validation command specs for focused Phase 8R tests, server lint,
  markdown validation, and full server validation.
- Execute those commands from a root script with array arguments and no
  user-controlled shell command construction.
- Record bounded command evidence with command string, pass/fail state, exit
  code, signal, duration, timestamps, and failure message.
- Continue running later checks after failures by default so one failure does
  not hide other broken gates.
- Emit checkpoint-compatible JSON with `focused`, `lint`, `markdown`, and
  `full` entries.
- Keep the Phase 8R.23 evidence run responsible for final closure decisions.

Acceptance criteria:

- Validation evidence is complete only when every configured check result is
  present and passed.
- Failed checks preserve bounded failure metadata without storing full logs in
  the JSON artifact.
- Unknown check IDs and reported file/storage/Git side effects are rejected.
- The generator can write JSON to `.tmp/phase8r/validation-evidence.json`.
- The generator does not mutate policy storage, run Git, or change checkpoint
  semantics.

Implementation status:

- Phase 8R.24 validation evidence generation is documented in
  [Policy Builder Phase 8R Validation Evidence Generator](policy-builder-phase-8r-validation-evidence-generator.md).
- The validation evidence contract lives in
  `server/src/services/policyBuilderPhase8ValidationEvidence.mjs`.
- The generator script lives in
  `scripts/generate-policy-builder-phase-8r-validation-evidence.mjs`.
- The root runner is exposed as `npm run policy:phase8r:validation-evidence`.
- The focused validation evidence test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8ValidationEvidence.test.mjs`.
- Current implementation generates the validation JSON input still required by
  the Phase 8R.23 evidence run.
- Current execution produced complete validation evidence and cleared validation
  blockers in the Phase 8R.23 evidence run; final-removal-audit JSON remains
  the next closure input.

### 8R.25 Final Removal Audit Exporter

Intent: generate the machine-readable Phase 8R.21 final-removal-audit JSON that
the Phase 8R.23 evidence run requires, without claiming completion while
approved manifest paths still exist.

Tasks:

- Require a Phase 8R.15 execution-plan JSON artifact as the manifest source.
- Read approved manifest paths from the execution plan.
- Inspect current checkout path existence for every manifest path.
- Build Phase 8R.20-compatible completion authorization evidence from current
  removed and remaining path state.
- Build Phase 8R.19-compatible removal verification evidence for paths that no
  longer exist.
- Scan source roots for exact manifest path references and feed that into the
  final import/reference scan evidence.
- Compose the existing Phase 8R.21 compatibility-removal completion audit.
- Emit audit JSON without deleting files, mutating storage, running Git, or
  changing checkpoint semantics.

Acceptance criteria:

- The exporter refuses to run without an explicit execution-plan JSON path.
- Existing manifest paths are reported as remaining inventory.
- Removed manifest paths are covered by bounded removal verification evidence.
- Final scan references block completion.
- The generated JSON can be passed to `npm run policy:phase8r:evidence`.
- The exporter does not delete files, archive files, mutate storage, run Git, or
  fabricate completion when current evidence says inventory remains.

Implementation status:

- Phase 8R.25 final removal audit export is documented in
  [Policy Builder Phase 8R Final Removal Audit Exporter](policy-builder-phase-8r-final-removal-audit-exporter.md).
- The final-removal audit evidence contract lives in
  `server/src/services/policyBuilderPhase8FinalRemovalAuditEvidence.mjs`.
- The exporter script lives in
  `scripts/generate-policy-builder-phase-8r-final-removal-audit.mjs`.
- The root runner is exposed as `npm run policy:phase8r:final-removal-audit`.
- The focused final-removal audit evidence test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8FinalRemovalAuditEvidence.test.mjs`.
- Current implementation can generate the final-removal-audit JSON input for
  the Phase 8R.23 evidence run; completion remains dependent on the real
  execution-plan artifact and current checkout removal state.

### 8R.26 Execution Plan Artifact Exporter

Intent: generate the machine-readable Phase 8R.15 execution-plan JSON that the
Phase 8R.25 final-removal audit exporter requires, without fabricating deletion
readiness or performing compatibility path removal.

Tasks:

- Require explicit input evidence for readiness, deletion gates, replacement
  evidence, rollback stance, support stance, manifest approval, and approving
  actor.
- Build the nested Phase 8R.15 execution plan through the existing
  execution-plan contract.
- Wrap the generated plan with bounded artifact metadata, risks, validation,
  and no-side-effect evidence.
- Write the nested execution-plan JSON for downstream Phase 8R.25 tooling.
- Optionally write the wrapper artifact for audit trails.
- Block by default when the generated execution plan is not ready.
- Avoid deleting files, archiving files, mutating storage, running Git, or
  applying compatibility-removal batches.

Acceptance criteria:

- The exporter refuses to run without explicit input evidence.
- Missing approval or blocked readiness prevents ready output.
- Ready input writes a valid Phase 8R.15 execution-plan JSON artifact.
- Blocked diagnostic output requires explicit `--allow-blocked`.
- The generated execution-plan JSON can be passed to
  `npm run policy:phase8r:final-removal-audit`.
- The exporter does not delete files, archive files, mutate storage, run Git, or
  apply removal batches.

Implementation status:

- Phase 8R.26 execution-plan artifact export is documented in
  [Policy Builder Phase 8R Execution Plan Artifact Exporter](policy-builder-phase-8r-execution-plan-artifact-exporter.md).
- The execution-plan artifact contract lives in
  `server/src/services/policyBuilderPhase8ExecutionPlanArtifact.mjs`.
- The exporter script lives in
  `scripts/generate-policy-builder-phase-8r-execution-plan.mjs`.
- The root runner is exposed as `npm run policy:phase8r:execution-plan`.
- The focused execution-plan artifact test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8ExecutionPlanArtifact.test.mjs`.
- Current implementation generates the execution-plan JSON input required by
  the Phase 8R.25 final-removal audit exporter while keeping deletion readiness
  caller-owned and explicit.

### 8R.27 Controlled Removal Batch Artifact Exporter

Intent: generate the machine-readable Phase 8R.17 controlled-removal batch JSON
from a ready Phase 8R.15 execution plan, explicit Phase 8R.16 gate evidence,
selected manifest paths, review reason, and reviewer metadata.

Tasks:

- Require a ready Phase 8R.15 execution-plan JSON artifact.
- Require explicit Phase 8R.16 gate input evidence for clean worktree,
  backup/restore freshness, operator approval, final rollback/support stance,
  and manifest freshness.
- Require selected paths to come from the approved execution-plan manifest.
- Require a narrow selected path batch with review reason and reviewer.
- Build the Phase 8R.16 execution gate through the existing gate contract.
- Build the Phase 8R.17 removal batch through the existing controlled-removal
  contract.
- Write the nested removal-batch JSON for Phase 8R.18 apply tooling.
- Avoid deleting files, archiving files, removing routes/tests, mutating
  storage, writing manifests, or running Git.

Acceptance criteria:

- The exporter refuses to run without execution-plan and gate/review input JSON.
- Blocked gate evidence prevents ready removal-batch output.
- Selected paths outside the approved manifest prevent ready output.
- Ready output is bounded to the reviewed selected paths.
- The generated removal-batch JSON can be passed to later Phase 8R.18 apply
  tooling.
- The exporter performs no deletion, archive, route, test, storage, manifest,
  or Git side effects.

Implementation status:

- Phase 8R.27 controlled removal batch artifact export is documented in
  [Policy Builder Phase 8R Controlled Removal Batch Artifact Exporter](policy-builder-phase-8r-controlled-removal-batch-artifact-exporter.md).
- The controlled-removal batch artifact contract lives in
  `server/src/services/policyBuilderPhase8ControlledRemovalBatchArtifact.mjs`.
- The exporter script lives in
  `scripts/generate-policy-builder-phase-8r-removal-batch.mjs`.
- The root runner is exposed as `npm run policy:phase8r:removal-batch`.
- The focused controlled-removal batch artifact test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8ControlledRemovalBatchArtifact.test.mjs`.
- Current implementation generates the Phase 8R.17 removal-batch JSON input for
  a later Phase 8R.18 apply artifact while keeping destructive removal out of
  this component.

### 8R.28 Controlled Removal Apply Artifact Exporter

Intent: generate the machine-readable Phase 8R.18 controlled-removal apply
artifact from a ready Phase 8R.17 removal-batch JSON, explicit apply input
evidence, operator confirmation, and a bounded apply adapter.

Tasks:

- Require a ready Phase 8R.17 removal-batch JSON artifact.
- Require explicit apply input with `executeApply: true`,
  `operatorConfirmation.confirmed: true`, and a confirming actor.
- Reuse the existing Phase 8R.18 controlled-removal apply contract.
- Keep service-level file mutation adapter-bound.
- Provide a CLI adapter that only deletes repo-relative files when
  `--apply-files` is present.
- Refuse path traversal, absolute paths, archive behavior, storage mutation,
  and Git-command side effects.
- Write the nested apply-result JSON for Phase 8R.19 runtime verification.

Acceptance criteria:

- The exporter refuses to run without removal-batch and apply-input JSON.
- Missing execute confirmation blocks apply output.
- Unsupported actions block apply output instead of being silently treated as
  file deletion.
- Repo-relative delete/remove-test entries can be applied only when
  `--apply-files` is passed.
- Archive, storage, and Git-command side effects prevent applied artifact
  status.
- The generated apply-result JSON can be passed to Phase 8R.19 verification.

Implementation status:

- Phase 8R.28 controlled removal apply artifact export is documented in
  [Policy Builder Phase 8R Controlled Removal Apply Artifact Exporter](policy-builder-phase-8r-controlled-removal-apply-artifact-exporter.md).
- The controlled-removal apply artifact contract lives in
  `server/src/services/policyBuilderPhase8ControlledRemovalApplyArtifact.mjs`.
- The exporter script lives in
  `scripts/generate-policy-builder-phase-8r-removal-apply.mjs`.
- The root runner is exposed as `npm run policy:phase8r:removal-apply`.
- The focused controlled-removal apply artifact test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8ControlledRemovalApplyArtifact.test.mjs`.
- Current implementation applies only supported file-backed deletion actions
  through an explicit CLI flag and emits apply evidence for Phase 8R.19
  runtime validation.

### 8R.29 Post-Removal Runtime Verification Artifact Exporter

Intent: generate the machine-readable Phase 8R.19 post-removal runtime
verification artifact from Phase 8R.18 apply evidence, import/reference scan
evidence, focused runtime/import checks, and focused/full validation evidence.

Tasks:

- Require Phase 8R.18 apply-result JSON.
- Require completed import/reference scan evidence that covers every applied
  removal path.
- Block verification if any removed path is still referenced.
- Require focused runtime/import check evidence.
- Require focused and full validation evidence.
- Reuse the existing Phase 8R.19 post-removal runtime verification contract.
- Avoid deleting files, mutating storage, running Git, or generating scan
  evidence implicitly.
- Write the nested verification JSON for Phase 8R.20 next-batch authorization.

Acceptance criteria:

- The exporter refuses to run without apply-result and verification-input JSON.
- Incomplete or invalid apply evidence blocks verification.
- Missing scan coverage or remaining references block verification.
- Missing or failed runtime checks block verification.
- Missing or failed focused/full validation evidence blocks verification.
- Storage and Git side effects prevent verified artifact status.
- The generated verification JSON can be passed to Phase 8R.20 authorization.

Implementation status:

- Phase 8R.29 post-removal runtime verification artifact export is documented in
  [Policy Builder Phase 8R Post-Removal Runtime Verification Artifact Exporter](policy-builder-phase-8r-post-removal-runtime-verification-artifact-exporter.md).
- The post-removal verification artifact contract lives in
  `server/src/services/policyBuilderPhase8PostRemovalRuntimeVerificationArtifact.mjs`.
- The exporter script lives in
  `scripts/generate-policy-builder-phase-8r-post-removal-verification.mjs`.
- The root runner is exposed as
  `npm run policy:phase8r:post-removal-verification`.
- The focused post-removal verification artifact test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8PostRemovalRuntimeVerificationArtifact.test.mjs`.
- Current implementation consumes explicit scan/check/validation evidence and
  emits verified Phase 8R.19 evidence for Phase 8R.20 next-batch authorization.

### 8R.30 Next Compatibility Removal Batch Authorization Artifact Exporter

Intent: generate the machine-readable Phase 8R.20 next-batch authorization
artifact from verified Phase 8R.19 evidence, a ready Phase 8R.15 execution
plan, requested remaining manifest paths, and operator authorization metadata.

Tasks:

- Require verified Phase 8R.19 post-removal runtime verification JSON.
- Require ready Phase 8R.15 execution-plan JSON with approved manifest entries.
- Compute remaining manifest inventory from verified applied paths.
- Block unknown, already removed, empty, or overly broad requested batches.
- Require authorizing operator and reason while remaining paths exist.
- Reuse the existing Phase 8R.20 next-batch authorization contract.
- Avoid deleting files, writing manifests, mutating storage, running tests,
  running scans, or running Git.
- Write the nested authorization JSON for Phase 8R.21 completion audit or the
  next 8R.17 removal-batch loop.

Acceptance criteria:

- The exporter refuses to run without post-removal verification, execution-plan,
  and authorization-input JSON.
- Invalid post-removal verification blocks authorization.
- Invalid execution-plan manifest evidence blocks authorization.
- Unknown or already removed requested paths block authorization.
- Empty requested paths block authorization while remaining inventory exists.
- No remaining manifest paths produce completion evidence, not a forced empty
  batch.
- Any reported side effect prevents ready artifact status.

Implementation status:

- Phase 8R.30 next-batch authorization artifact export is documented in
  [Policy Builder Phase 8R Next Compatibility Removal Batch Authorization Artifact Exporter](policy-builder-phase-8r-next-compatibility-removal-batch-authorization-artifact-exporter.md).
- The next-batch authorization artifact contract lives in
  `server/src/services/policyBuilderPhase8NextCompatibilityRemovalBatchAuthorizationArtifact.mjs`.
- The exporter script lives in
  `scripts/generate-policy-builder-phase-8r-next-batch-authorization.mjs`.
- The root runner is exposed as
  `npm run policy:phase8r:next-batch-authorization`.
- The focused next-batch authorization artifact test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8NextCompatibilityRemovalBatchAuthorizationArtifact.test.mjs`.
- Current implementation emits Phase 8R.20 authorization or completion evidence
  without performing removal, scan, manifest, storage, or Git side effects.

### 8R.31 Compatibility Removal Completion Audit Artifact Exporter

Intent: generate the machine-readable Phase 8R.21 compatibility-removal
completion audit artifact from Phase 8R.20 authorization/completion evidence,
Phase 8R.15 execution-plan JSON, verified Phase 8R.19 removal evidence, final
import/reference scan evidence, and focused/full validation evidence.

Tasks:

- Require Phase 8R.20 authorization or completion JSON.
- Require Phase 8R.15 execution-plan JSON with approved manifest entries.
- Require verified Phase 8R.19 removal verification evidence.
- Require final import/reference scan evidence covering every approved manifest
  path.
- Block completion when final scan references remain.
- Preserve remaining-inventory as a valid non-complete artifact state.
- Reuse the existing Phase 8R.21 compatibility-removal completion audit
  contract.
- Avoid deleting files, archiving, writing manifests, mutating storage, running
  tests/scans, or running Git.
- Write nested audit JSON for Phase 8R.22 checkpoint inputs.

Acceptance criteria:

- The exporter refuses missing completion-authorization, execution-plan, or
  input JSON.
- Complete authorization with full evidence yields a complete artifact.
- Remaining authorization yields a remaining-inventory artifact.
- Missing or failing final scan, removal, validation, or execution-plan
  evidence blocks the artifact.
- Any side effect prevents complete or remaining artifact status.
- Generated audit JSON can feed the Phase 8R.22 completion checkpoint.

Implementation status:

- Phase 8R.31 completion audit artifact export is documented in
  [Policy Builder Phase 8R Compatibility Removal Completion Audit Artifact Exporter](policy-builder-phase-8r-compatibility-removal-completion-audit-artifact-exporter.md).
- The completion-audit artifact contract lives in
  `server/src/services/policyBuilderPhase8CompatibilityRemovalCompletionAuditArtifact.mjs`.
- The exporter script lives in
  `scripts/generate-policy-builder-phase-8r-completion-audit.mjs`.
- The root runner is exposed as
  `npm run policy:phase8r:completion-audit`.
- The focused completion-audit artifact test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8CompatibilityRemovalCompletionAuditArtifact.test.mjs`.
- Current implementation emits complete, remaining-inventory, or blocked audit
  artifacts without performing removal, scan, manifest, storage, or Git side
  effects.

### 8R.32 Completion Checkpoint Artifact Exporter

Intent: generate the machine-readable Phase 8R.22 completion checkpoint artifact
from explicit component evidence, roadmap evidence, Phase 8R.31
completion-audit artifact evidence, validation evidence, and changelog
evidence.

Tasks:

- Require component evidence for the Phase 8R implementation set.
- Require roadmap sequence and implementation-status evidence.
- Require a complete and valid Phase 8R.31 completion-audit artifact.
- Require focused, lint, markdown, and full validation evidence.
- Require changelog evidence covering Phase 8R components.
- Reuse the existing Phase 8R.22 completion checkpoint contract.
- Avoid collecting evidence, writing manifests, mutating storage, running
  commands, running Git, or changing files inside the service.
- Write nested checkpoint JSON for release/operator completion proof.

Acceptance criteria:

- The exporter refuses missing component, roadmap, completion-audit, validation,
  or changelog JSON.
- A complete Phase 8R.31 artifact plus complete checkpoint evidence yields a
  complete artifact.
- Missing or incomplete Phase 8R.31 evidence blocks completion.
- Missing roadmap, component, validation, or changelog evidence blocks
  completion through the nested checkpoint.
- Any side effect prevents complete artifact status.
- Generated checkpoint JSON can feed the final Phase 8R closure readout.

Implementation status:

- Phase 8R.32 completion checkpoint artifact export is documented in
  [Policy Builder Phase 8R Completion Checkpoint Artifact Exporter](policy-builder-phase-8r-completion-checkpoint-artifact-exporter.md).
- The completion-checkpoint artifact contract lives in
  `server/src/services/policyBuilderPhase8CompletionCheckpointArtifact.mjs`.
- The exporter script lives in
  `scripts/generate-policy-builder-phase-8r-completion-checkpoint.mjs`.
- The root runner is exposed as
  `npm run policy:phase8r:completion-checkpoint`.
- The focused completion-checkpoint artifact test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8CompletionCheckpointArtifact.test.mjs`.
- Current implementation emits complete or blocked checkpoint artifacts without
  collecting evidence, running commands, mutating storage, or running Git.

### 8R.33 Final Closure Readout

Intent: generate the final operator-facing Phase 8R closure decision from the
Phase 8R.32 completion-checkpoint artifact.

Tasks:

- Require a Phase 8R.32 completion-checkpoint artifact.
- Require the artifact to be complete and valid before closure can pass.
- Require the nested Phase 8R.22 checkpoint to be complete and valid.
- Map blocked checkpoint states to component, roadmap, removal-audit,
  validation, or changelog blocker categories.
- Map invalid or missing wrapper artifacts to artifact-validation blockers.
- Reject file writes, manifest writes, storage mutation, command execution, and
  Git commands inside the readout contract.
- Emit a stable operator summary with the final decision and next action.

Acceptance criteria:

- The exporter refuses missing checkpoint-artifact JSON.
- A complete Phase 8R.32 artifact yields a complete readout.
- Missing or invalid Phase 8R.32 evidence blocks with artifact-validation
  status.
- Nested checkpoint failures preserve their blocker category.
- Any side effect prevents complete readout status.
- Generated readout JSON can be used for the final Phase 8R completion audit.

Implementation status:

- Phase 8R.33 final closure readout is documented in
  [Policy Builder Phase 8R Final Closure Readout](policy-builder-phase-8r-final-closure-readout.md).
- The final closure readout contract lives in
  `server/src/services/policyBuilderPhase8FinalClosureReadout.mjs`.
- The exporter script lives in
  `scripts/generate-policy-builder-phase-8r-final-closure-readout.mjs`.
- The root runner is exposed as
  `npm run policy:phase8r:final-closure-readout`.
- The focused final closure readout test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8FinalClosureReadout.test.mjs`.
- Current implementation emits complete or blocked final readouts without
  collecting evidence, running commands, mutating storage, or running Git.

### 8R.34 Current Repository Closure Audit

Intent: audit the current checkout against the Phase 8R closure chain by
combining current repository evidence, Phase 8R.31 completion-audit evidence,
validation evidence, the Phase 8R.32 checkpoint artifact, and the Phase 8R.33
final closure readout.

Tasks:

- Read current mapped Phase 8R artifact inventory from the checkout.
- Read current roadmap sequence and implementation-status evidence.
- Read current changelog coverage evidence.
- Require a complete and valid Phase 8R.31 completion-audit artifact.
- Require focused, lint, markdown, and full validation evidence.
- Compose the existing Phase 8R.23 current evidence run.
- Compose the Phase 8R.32 checkpoint artifact from current evidence.
- Compose the Phase 8R.33 final closure readout.
- Reject file writes, manifest writes, storage mutation, command execution, and
  Git commands inside the service.

Acceptance criteria:

- The exporter refuses missing completion-audit-artifact or validation-evidence
  JSON.
- Complete current repository evidence yields a complete audit.
- Missing mapped artifacts block current evidence.
- Missing validation or incomplete completion-audit evidence blocks closure.
- Any side effect other than repository file reads prevents complete status.
- Generated audit JSON can feed the final requirement-by-requirement Phase 8R
  completion audit.

Implementation status:

- Phase 8R.34 current repository closure audit is documented in
  [Policy Builder Phase 8R Current Repository Closure Audit](policy-builder-phase-8r-current-repository-closure-audit.md).
- The current repository closure audit contract lives in
  `server/src/services/policyBuilderPhase8CurrentRepositoryClosureAudit.mjs`.
- The exporter script lives in
  `scripts/run-policy-builder-phase-8r-current-closure-audit.mjs`.
- The root runner is exposed as
  `npm run policy:phase8r:current-closure-audit`.
- The focused current repository closure audit test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8CurrentRepositoryClosureAudit.test.mjs`.
- Current implementation reads mapped repository evidence and emits complete or
  blocked closure audits without writing files, mutating storage, running
  commands, or running Git.

### 8R.35 Final Requirement Completion Audit

Intent: prove the full current Phase 8R sequence requirement by requirement
before Phase 8R is treated as complete.

Tasks:

- Require a complete and valid Phase 8R.34 current repository closure audit.
- Inventory mapped current checkout artifacts for every Phase 8R component from
  8R.1 through 8R.34.
- Require design/outcome document evidence for every component.
- Require service, script, route, migration, or wiring evidence for every
  component.
- Require focused test evidence for every component.
- Require roadmap component-map and work-sequence coverage for every component.
- Require changelog coverage for every component.
- Reject file writes, manifest writes, storage mutation, command execution, and
  Git commands inside the audit service.

Acceptance criteria:

- Completion is blocked without complete Phase 8R.34 current closure evidence.
- Completion is blocked when any 8R.1 through 8R.34 mapped artifact is missing.
- Completion is blocked when the roadmap component map or work sequence omits
  any Phase 8R component.
- Completion is blocked when changelog coverage omits any Phase 8R component.
- The audit emits exact missing evidence rather than relying on narrative
  completion status.
- The service reads repository files only and performs no writes, storage
  mutation, command execution, manifest writes, or Git operations.

Implementation status:

- Phase 8R.35 final requirement completion audit is documented in
  [Policy Builder Phase 8R Final Requirement Completion Audit](policy-builder-phase-8r-final-requirement-completion-audit.md).
- The final requirement audit contract lives in
  `server/src/services/policyBuilderPhase8FinalRequirementCompletionAudit.mjs`.
- The exporter script lives in
  `scripts/run-policy-builder-phase-8r-final-requirement-audit.mjs`.
- The root runner is exposed as
  `npm run policy:phase8r:final-requirement-audit`.
- The focused final requirement audit test suite lives in
  `server/src/__tests__/services/policyBuilderPhase8FinalRequirementCompletionAudit.test.mjs`.
- Current implementation verifies the complete 8R.1 through 8R.34 evidence
  range so later artifact/exporter closure components cannot be skipped by the
  older Phase 8R.22 checkpoint range.
- Final closure inventory sync is documented in
  [Policy Builder Phase 8R Closure Inventory Sync](policy-builder-phase-8r-closure-inventory-sync.md).
- Current validation hardening classifies
  `client/src/components/policies/PolicyStarterTemplateAccelerator.vue` in the
  Phase 1R boundary inventory and Phase 3R workflow inventory so the final
  Phase 8R evidence chain can prove every current policy-builder surface has an
  explicit owner and cutline.

## Phase 8R Work Sequence

Implement Phase 8R in this order:

1. **8R.1 Native Schema Contract**
   Defines durable storage around the final model.
2. **8R.2 Migration Candidate Report**
   Makes readiness visible before mutation.
3. **8R.3 Explicit Conversion Workflow**
   Converts selected policies with validation and rollback snapshots.
4. **8R.4 Native Runtime Read Path**
   Makes converted policies run from native intent.
5. **8R.5 Rollback Snapshot And Reversion Window**
   Provides bounded safety without permanent dual models.
6. **8R.6 Legacy Write Path Shutdown**
   Prevents converted policies from drifting back.
7. **8R.7 Legacy Code Deletion Gates**
   Removes replaced paths after proof.
8. **8R.8 Backup, Restore, And Post-Upgrade Safety**
   Makes migration operationally safe.
9. **8R.9 Native Storage Test Reset**
   Protects the final storage model.
10. **8R.10 Native Backup And Restore Wiring**
    Makes native intent recoverable through the live backup/restore path.
11. **8R.11 Post-Upgrade Dry-Run Wiring**
    Connects candidate reporting to post-upgrade dry-run without applying
    conversion.
12. **8R.12 Post-Upgrade Apply Gate**
    Consumes current dry-run output, creates rollback snapshots, writes native
    intent records and migration events atomically, and reports rollback-safe
    operator failure IDs.
13. **8R.13 Native Runtime Cutover Verification**
    Proves converted policies read from native intent in real runtime paths and
    keeps rollback available before compatibility paths are deleted.
14. **8R.14 Compatibility Path Deletion Readiness**
    Proves every replaced compatibility path has native/runtime parity,
    rollback coverage, support diagnostics, and explicit deletion criteria
    before code is removed.
15. **8R.15 Compatibility Path Deletion Execution Plan**
    Creates an explicit manifest of exact compatibility files or code paths to
    remove, replacement evidence, rollback/support stance, and execution
    prerequisites before any deletion occurs.
16. **8R.16 Compatibility Path Deletion Execution Gate**
    Verifies clean worktree state, fresh backup/restore evidence, operator
    approval, manifest freshness, and final rollback/support stance immediately
    before any compatibility path deletion is allowed.
17. **8R.17 Controlled Compatibility Path Removal**
    Builds the first narrow compatibility path removal batch only after
    consuming a ready Phase 8R.16 gate output, selected approved manifest paths,
    and review metadata.
18. **8R.18 Controlled Compatibility Path Removal Apply**
    Applies one reviewed Phase 8R.17 removal batch through an explicit adapter,
    verifies result parity, and emits evidence for import/runtime validation
    before additional compatibility paths are removed.
19. **8R.19 Post-Removal Runtime Verification**
    Consumes Phase 8R.18 apply evidence, verifies removed paths are no longer
    imported or required, runs focused runtime/import checks, and blocks
    additional batches until validation passes.
20. **8R.20 Next Compatibility Removal Batch Authorization**
    Consumes verified Phase 8R.19 evidence, calculates remaining approved
    manifest paths, prevents already-removed paths from re-entering a batch, and
    authorizes only the next narrow removal batch.
21. **8R.21 Compatibility Removal Completion Audit**
    Consumes verified removal loop evidence, proves whether all approved
    compatibility manifest paths are gone, and reports any bounded remaining
    inventory before Phase 8R exits compatibility-removal mode.
22. **8R.22 Phase 8R Completion Checkpoint**
    Audits the complete Phase 8R roadmap, service contracts, tests, docs,
    changelog coverage, and validation evidence before Phase 8R is considered
    fully implemented.
23. **8R.23 Completion Evidence Run**
    Runs the Phase 8R.22 checkpoint against current-state evidence and resolves
    any missing component, roadmap, validation, or changelog proof before the
    Phase 8R objective is marked complete.
24. **8R.24 Validation Evidence Generator**
    Generates machine-readable focused, lint, markdown, and full validation
    evidence for the Phase 8R.23 closure run without changing checkpoint
    semantics.
25. **8R.25 Final Removal Audit Exporter**
    Generates machine-readable Phase 8R.21 final-removal-audit evidence from an
    explicit execution-plan manifest, current path state, source reference scan,
    and validation JSON.
26. **8R.26 Execution Plan Artifact Exporter**
    Generates the machine-readable Phase 8R.15 execution-plan JSON from
    explicit readiness, manifest, replacement, approval, rollback, and support
    evidence for downstream final-removal-audit tooling.
27. **8R.27 Controlled Removal Batch Artifact Exporter**
    Generates a machine-readable Phase 8R.17 controlled-removal batch from a
    ready execution plan, explicit execution-gate evidence, selected approved
    manifest paths, review reason, and reviewer metadata.
28. **8R.28 Controlled Removal Apply Artifact Exporter**
    Generates a machine-readable Phase 8R.18 controlled-removal apply artifact
    from a ready reviewed batch, explicit execute confirmation, and a bounded
    repo-relative filesystem adapter.
29. **8R.29 Post-Removal Runtime Verification Artifact Exporter**
    Generates a machine-readable Phase 8R.19 verification artifact from apply,
    reference-scan, runtime-check, and validation evidence before the next
    compatibility-removal batch can be authorized.
30. **8R.30 Next Compatibility Removal Batch Authorization Artifact Exporter**
    Generates a machine-readable Phase 8R.20 authorization artifact from
    verified post-removal evidence, the approved execution manifest, requested
    remaining paths, and operator authorization metadata.
31. **8R.31 Compatibility Removal Completion Audit Artifact Exporter**
    Generates a machine-readable Phase 8R.21 completion-audit artifact from
    Phase 8R.20 authorization, the approved execution manifest, removal
    verification, final scan, and validation evidence.
32. **8R.32 Completion Checkpoint Artifact Exporter**
    Generates a machine-readable Phase 8R.22 completion-checkpoint artifact
    from explicit component, roadmap, completion-audit, validation, and
    changelog evidence.
33. **8R.33 Final Closure Readout**
    Generates the final operator-facing Phase 8R closure decision from the
    Phase 8R.32 checkpoint artifact, preserving exact blocker categories.
34. **8R.34 Current Repository Closure Audit**
    Audits the current checkout by composing current artifact, roadmap,
    changelog, completion-audit, validation, checkpoint, and final-readout
    evidence into one completion decision.
35. **8R.35 Final Requirement Completion Audit**
    Verifies the full current Phase 8R.1 through 8R.34 sequence against
    current closure, artifact, roadmap, changelog, and focused-test evidence
    before the Phase 8R objective is marked complete.

Current starting point:

- Do not start Phase 8R schema migration until Phase 5R, 6R, and 7R contracts
  are stable enough to preserve.
- Do not expand legacy compatibility as a substitute for native storage.
- Do not allow rollback snapshots to become permanent alternate policy records.
- Use Phase 8R as the point where compatibility paths begin shrinking, not
  growing.

Implementation record:

- Future implementation should create a Phase 8R implementation doc with schema
  decisions, migration reports, rollback retention, native read/write behavior,
  and legacy deletion gates.

## Phase 9R: Production Naming And Contract Stabilization

Intent: remove roadmap-phase language from production code after the rebuilt
policy engine, runtime automation, native storage, and legacy removal paths have
been proven. Phase names are useful while planning and migrating; they should
not become permanent product architecture.

This phase exists because production services named after `Phase6R`, `Phase7R`,
or `Phase8R` will be misleading once the work is complete. Future roadmap work
will have different phase labels, and product code should describe durable
domain concepts instead:

```text
evidence boundary
intent inference
learning eligibility
automation readiness
policy migration
native policy storage
```

Official guidance alignment:

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  supports traceable, maintainable software changes. The naming cutover must be
  inventory-driven, tested, and reversible through normal version control.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for verifying application security controls. Renaming must
  not weaken server-side validation, auditability, authorization, or business
  logic boundaries.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  encourage stable names for operations and data. Trace attributes and event
  names should use durable product-domain terms rather than temporary roadmap
  phase identifiers.

### 9R.1 Production Name Inventory

Intent: identify every phase-coded production artifact before any rename.

Tasks:

- Inventory production service names, exported functions, constants, route
  names, scripts, package commands, trace attributes, event names, API payload
  fields, migration helpers, and generated artifacts containing:
  - `phase`,
  - `Phase`,
  - `6R`,
  - `7R`,
  - `8R`,
  - `R6`,
  - roadmap-only labels.
- Classify each reference as:
  - **Rename in production code**,
  - **Keep in docs/history**,
  - **Keep in tests only as migration evidence**,
  - **Delete with obsolete migration tooling**.
- Build a rename map from phase-coded names to durable product names.

Acceptance criteria:

- Every phase-coded production reference has a keep/rename/delete decision.
- Docs may retain phase names; runtime product code cannot without an explicit
  exemption.
- The rename map is checked in before code moves.

### 9R.2 Durable Domain Module Cutover

Intent: move server/client production modules to durable domain names.

Tasks:

- Rename Phase 6R evidence, intent, readiness, learning, and workflow modules to
  product-domain module names.
- Rename Phase 7R runtime/rebuild modules to runtime-domain names.
- Rename Phase 8R native storage and migration modules to storage/migration
  domain names after native storage is stable.
- Keep temporary adapter exports only when needed for one release window, and
  record their deletion gate.

Acceptance criteria:

- Runtime imports use durable product module names.
- Temporary compatibility exports have explicit removal dates/gates.
- No new production code imports phase-coded modules.

### 9R.3 Contract And Telemetry Naming Cutover

Intent: remove phase-coded labels from payloads, traces, events, and operator
diagnostics that can live beyond the roadmap.

Tasks:

- Rename internal contract versions from roadmap names to durable names where
  external compatibility allows it.
- Rename trace attributes and event labels to product-domain terms.
- Keep migration-history records clear enough to explain old phase-origin data
  without exposing phase labels as current product concepts.

Acceptance criteria:

- New runtime traces and events do not use phase-coded identifiers.
- Public or persisted compatibility fields are changed only through explicit
  migration/backward-compatibility rules.
- Diagnostic output describes destination evidence, intent, learning, readiness,
  migration, and storage directly.

### 9R.4 Naming Regression And Completion Audit

Intent: make the final naming state testable.

Tasks:

- Add a production-code scanner that fails when new phase-coded names appear in
  runtime modules without an allow-listed reason.
- Run the scanner in focused tests or CI before the rebuild is called complete.
- Update docs to show the final production module map.

Acceptance criteria:

- Production-code phase references are either gone or explicitly allow-listed
  as docs/history/test migration evidence.
- Full focused server/client tests pass after rename.
- The roadmap records the final durable module names.

## Testing Strategy

Required coverage should follow the re-imagined phase boundaries:

- Phase 0R vocabulary tests:
  - product labels use source-of-truth language,
  - broad genres are not described as automatic identity,
  - learning and outcome language remain separate.
- Phase 1R boundary tests:
  - modal orchestration does not generate evidence,
  - reference data and observed evidence remain distinct,
  - UI-only state does not serialize.
- Phase 2R draft/bridge tests:
  - draft commands are typed and allow-listed,
  - legacy payload preservation applies only through bridge code,
  - raw `customSignals` do not leak into product components.
- Phase 3R workflow tests:
  - destination context appears before starter-template mechanics,
  - evidence-backed options are distinguishable from static options,
  - hard limits require explicit operator action,
  - readiness shows next action, not internal diagnostics.
- Phase 5R server-authority tests:
  - client drafts cannot bypass server validation,
  - AI output cannot become final question text without normalization,
  - UI/Discord answers use one server-owned contract,
  - stale or malformed questions cannot authorize learning.
- Phase 6R engine tests:
  - evidence buckets are deterministic,
  - intent suggestions separate inferred evidence from declared constraints,
  - readiness is computed without exposing replay/provider internals.
- Phase 7R runtime/rebuild tests:
  - classification success and routing success are distinct,
  - broad genre overlap does not auto-route specialized destinations,
  - request-time choices require guarded learning,
  - rebuild proposals preserve explicit constraints and require acceptance.
- Phase 8R storage/migration tests:
  - native schema migrations are covered,
  - conversion is explicit and idempotent,
  - converted policies read from native intent,
  - rollback snapshots work within the retention window,
  - converted policies reject legacy write drift,
  - backup/restore includes native intent records,
  - deletion gates are testable before legacy path removal.
- Phase 9R production naming tests:
  - production modules no longer import phase-coded service names,
  - trace attributes and runtime event labels use durable product-domain terms,
  - any remaining phase-coded references are allow-listed as docs, tests,
    migration history, or temporary adapter evidence.

## Risks

- Authority drift: media-server application, declared intent, AI suggestions,
  and manual outcomes blur into one decision source again.
- Rebuilding the old UI: re-imagined engine pieces are exposed as new panels
  instead of becoming automation, readiness, or migration-verifier internals.
- Dual-model persistence: compatibility bridges and rollback snapshots become a
  permanent second policy model instead of a bounded migration tool.
- Server/client split: client draft behavior diverges from server-owned intent,
  question, and learning contracts.
- Unsafe learning: manual resolutions or AI explanations create durable policy
  updates without eligibility checks.
- Runtime opacity: classification success and routing success remain conflated,
  making successful-but-unrouted items look like silent failures.
- Migration surprise: opening, saving, or upgrading a legacy policy changes
  behavior without an explicit conversion workflow and rollback window.
- Template ambiguity: starter templates continue to imply durable authority
  instead of seeding editable declared intent.
- Test drag: old tests preserve abandoned UI surfaces or legacy payload behavior
  after their deletion gates should have passed.
- Phase-name drag: production code keeps roadmap phase labels after the roadmap
  is no longer relevant, making future work harder to reason about.

## Recommended Next Work

Work should move in two coordinated lanes after the re-imagination reset.

Builder lane:

1. Complete Phase 0R, 1R, 2R, 3R, and 6R inventories before adding new
   policy-builder controls.
2. Classify existing builder, draft, preview, replay, provider, and template
   artifacts as keep, rewrite, replace, or delete.
3. Use existing draft bridge and server intent contract tests as compatibility
   guards, not as proof that the current product surface should remain.
4. Start implementation with the Phase 6R artifact inventory and cutline, then
   backfill Phase 0R through 3R implementation docs with the same ownership
   decisions.
5. Do not continue replay/provider/TMDB UI work unless the artifact inventory
   classifies it as an engine primitive or migration verifier.
6. After Phase 8R legacy removal is proven, execute Phase 9R so production code
   names describe product domains rather than completed roadmap phases.

Runtime lane:

1. Complete the Phase 5R server-authority inventory before adding new runtime
   question or learning behavior.
2. Classify server intent, AI parsing, question, answer, learning, cleanup,
   impact-preview, and replay-preview services as keep, rewrite, replace, or
   delete.
3. Prioritize the Phase 5R runtime trust boundary:
   - model authority modes,
   - runtime clarification normalizer,
   - question/answer contract,
   - learning guard,
   - stale question cleanup.
4. Treat impact/replay services as verifier candidates until the Phase 5R and
   Phase 6R cutlines decide their final role.

The builder now has the start of a tested state boundary. The runtime needs the
same boundary: AI may identify uncertainty, but deterministic server logic
decides the final operator question, answer semantics, and whether the answer is
allowed to become durable learning.

Do not advance to library-derived policy generation until Phase 5R and Phase 6R
define server authority, evidence, learning, readiness, migration verification,
and deletion criteria.

## Open Questions

- What is the minimum observed-profile quality required before library contents
  can seed intent suggestions?
- Which evidence buckets may influence automation readiness, and which may only
  influence review wording?
- What exact states separate `classified`, `routed`, `classified_not_routed`,
  `needs_operator_review`, and `needs_routing_mapping`?
- Which manual outcomes are eligible for durable learning, and which are only
  final outcomes?
- What server-owned question shapes are allowed for UI and Discord, and which
  answer options can create later policy suggestions?
- Should AI output be limited to evidence extraction and uncertainty
  explanation, or can it propose intent changes that a deterministic service
  must validate?
- How should starter-template provenance be retained after templates become
  draft accelerators rather than policy authority?
- What legacy preset/custom-signal cases are unconvertible, and what explicit
  operator workflow handles them?
- What rollback snapshot retention window is long enough for safety without
  preserving a permanent dual model?
- Which old builder panels, preview services, replay services, and diagnostics
  are engine primitives, migration verifiers, or deletion candidates?
- What is the first implementation slice that proves the new model reduces
  operator decisions rather than adding new configuration work?
