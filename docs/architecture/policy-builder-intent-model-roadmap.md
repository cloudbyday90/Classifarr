# Policy Builder Intent Model Roadmap

Status: authoritative phased implementation plan and component inventory. This
document defines the execution sequence, task names, product rationale, and
completion criteria for policy work.

Current execution focus:

- **Completed:** 0R through 7R establish the policy engine, runtime authority,
  and lifecycle-first authoring flow. `/policies` has one server-admitted
  normal path; the retired advanced-settings hash is not an authoring target.
- **Completed:** **8R.37.4 Closure-Map Reconciliation**. Repository component
  evidence and active-installation cutover evidence are now separate,
  fingerprint-bound maps; automatic native policy conversion and normal policy
  automation remain unchanged.
- **Completed:** **10R.1.1 AI Authority Pipeline Acceptance**. An isolated
  database-backed acceptance suite now proves disabled and under-specified
  strict requests never reach a provider transport, while a verified response
  is normalized, parsed, marked advisory, and blocked from automatic routing.
- **Current operational finding:** **8R.36.11 Compatibility-Removal Evidence
  Regeneration** has rerun successfully with the v3 validation contract. The
  repository evidence is ready, while the active-installation completion artifact
  remains blocked. Obtain a current approved installation artifact through the
  deletion workflow, then rerun 8R.36.11 and its generated current closure and
  requirement audits. Do not infer closure from historical JSON or checkout state.
- **Continuous guardrail:** 9R naming and product-language gates remain
  required. Do not reintroduce a second policy-builder flow, advanced setting,
  or browser-owned automation decision.

See [Policy Intent Delivery Status Audit](policy-intent-delivery-status-audit.md)
for the current completion evidence, remaining work, and target end state.

The execution dependency is intentionally not numeric:

```text
completed foundations: 0R -> 1R -> 2R -> 3R -> 4R -> 5R -> 6R -> 7R
completed boundary isolation: 8R.37.1 -> 8R.37.2 -> 8R.37.3 -> 8R.37.4
active-installation prerequisite -> 8R.36.11 regeneration -> 8R.34/8R.35 current audits
completed platform acceptance: 10R.1.1 -> 10R.1.2 -> 10R.1.3
completed lifecycle acceptance: 10R.2.1 -> 10R.2.2
current platform acceptance: 10R.2.3
continuous guardrail: 9R zero-debt naming and product-language gates
```

Phase numbers identify workstreams; their dependency gates control delivery.
Phase 4R may start only when its required server projection is available for
the specific component being delivered. It must never invent browser-owned
readiness, policy meaning, provider recovery, or mutation authority to unblock
a screen.

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
- Policy authoring must not add, remove, or replace a preset attachment; existing attachments are round-trip compatibility context only.
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

components/policies/IntentSignalPicker.vue
  Presents server-projected, source-labelled candidates for explicit typed intent acceptance.

utils/policyIntentDraftBridge.js
  Preserves existing preset attachments as compatibility context without exposing attachment editing.
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

| Phase | Name | Delivery Status | Primary Outcome |
| --- | --- | --- | --- |
| 0R | Source of truth and vocabulary reset | Complete foundation | Shared authority model and product language |
| 1R | Builder state and engine boundary reset | Complete foundation | UI, draft, bridge, and reference-data ownership is explicit |
| 2R | Intent draft bridge as compatibility boundary | Complete foundation | Typed draft commands and isolated legacy serialization |
| 3R | Operator workflow rebuild | Complete contract cutline | Destination-first workflow vocabulary and component boundaries, not live UI proof |
| 4R | Live policy-authoring UI convergence | Active product work | One automation-first rendered authoring path, beginning with 4R.1 |
| 5R | Server authority, runtime questions, and learning guard | Not yet closed | Server owns intent validation, questions, answers, model authority, and learning |
| 6R | Re-imagined policy engine roadmap | Contract-complete foundation | Evidence, intent, readiness, workflow, and migration engine contracts |
| 7R | Runtime automation and library rebuild | Contract-complete foundation | Guarded runtime decisions, questions, rebuild, verifier, and rollback contracts |
| 8R | Native intent storage and legacy removal | Active parallel delivery lanes | Native storage lifecycle, per-install cutover evidence, and CI-only retirement |
| 9R | Production naming and contract stabilization | Ongoing zero-debt gate | Durable product names remain mandatory for all current source |

Non-negotiable sequencing rules:

- Do not add new policy controls before product vocabulary and Phase 1R state
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
  [Policy Authority Vocabulary](policy-authority-vocabulary.md).
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

- The policy authoring user mental model is documented in
  [Policy Authoring User Mental Model](policy-authoring-user-mental-model.md).
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
  [Policy Legacy Compatibility Vocabulary](policy-legacy-compatibility-vocabulary.md).
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

- Phase 5R question and learning components can use product vocabulary
  directly.
- Discord/UI questions can be normalized to the same terms.
- Manual resolution does not imply durable learning by default.

Implementation record:

- Phase 0R.4 question and learning vocabulary is documented in
  [Policy Question And Learning Vocabulary](policy-question-learning-vocabulary.md).
- The server-side question and learning vocabulary contract lives in
  `server/src/services/policyQuestionLearningVocabulary.mjs`.

### 0R.5 Documentation And Test Alignment

Intent: make the roadmap actionable before implementation resumes.

Tasks:

- Update implementation docs to use product vocabulary.
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
  [Policy Authoring Documentation And Test Alignment](policy-authoring-documentation-test-alignment.md).
- The server-side checklist contract lives in
  `server/src/services/policyAuthoringReadinessChecklist.mjs`.

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

- Phase 0R is complete as a vocabulary and authority foundation.
- Treat its contracts as required guardrails for all remaining product and
  runtime work. Reopen a Phase 0R task only when an approved product term or
  authority boundary changes.

Implementation record:

- Existing implementation details are documented in
  [Policy Builder Phase 0 Implementation](policy-builder-phase-0-implementation.md).
- Phase 0R.1 authority vocabulary is documented in
  [Policy Authority Vocabulary](policy-authority-vocabulary.md).
- The policy authoring user mental model is documented in
  [Policy Authoring User Mental Model](policy-authoring-user-mental-model.md).
- Phase 0R.3 legacy compatibility vocabulary is documented in
  [Policy Legacy Compatibility Vocabulary](policy-legacy-compatibility-vocabulary.md).
- Phase 0R.4 question and learning vocabulary is documented in
  [Policy Question And Learning Vocabulary](policy-question-learning-vocabulary.md).
- Phase 0R.5 documentation and test alignment is documented in
  [Policy Authoring Documentation And Test Alignment](policy-authoring-documentation-test-alignment.md).
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

`usePolicyBuilderTemplateSignals.js` and
`usePolicyBuilderCombinedSignals.js` were removed by the 3R.7 template role
reset because their only remaining callers exposed raw compatibility mechanics.

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
  - **Rewrite/delete after engine cutline**.
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
  engine authority, omits an engine cutline, or uses an invalid engine/delete
  action.

Implementation record:

- Phase 1R.1 boundary inventory is documented in
  [Policy Builder Boundary Inventory](policy-builder-boundary-inventory.md).
- The server-side inventory contract lives in
  `server/src/services/policyBuilderBoundaryInventory.mjs`.
- The inventory now includes `PolicyCombined*` policy-builder paths and
  classifies combined-signal legacy product surfaces as engine-cutline
  rewrite/delete candidates.
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
- New engine results can be passed in as data without embedding engine
  calculations in the modal.
- Tests assert visible behavior and command routing, not internal scoring.
- Current modal touchpoints are explicitly mapped to allowed responsibilities or
  extraction targets, and prohibited responsibilities fail the orchestration
  audit.
- Public modal events are explicitly bounded to visibility, close, and delegated
  save payloads with runtime emit validators and no policy-authority payloads.

Implementation record:

- Modal orchestration boundary is documented in
  [Policy Builder Modal Orchestration Boundary](policy-builder-modal-orchestration-boundary.md).
- The server-side modal orchestration contract lives in
  `server/src/services/policyBuilderModalOrchestrationContract.mjs`.
- The contract now includes a modal touchpoint audit for current save,
  composition, preview, legacy-adapter, summary-projection, and save-failure
  behavior. Profile regeneration is intentionally outside modal orchestration.
- The contract now includes a public event audit for `update:modelValue`,
  `save`, and `close`, and the Vue modal declares runtime emit validators for
  those events.
- Save-failure presentation now uses the app toast pattern instead of a blocking
  browser alert.

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

- Draft state boundary is documented in
  [Policy Builder Draft State Boundary](policy-builder-draft-state-boundary.md).
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

- Reference data boundary is documented in
  [Policy Builder Reference Data Boundary](policy-builder-reference-data-boundary.md).
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
- Define when bridge modules should be deleted or replaced after native intent
  storage is authoritative.

Acceptance criteria:

- Product components do not mutate raw legacy payloads directly.
- Legacy compatibility remains regression-tested.
- Bridge ownership is explicit enough to delete later.
- Compatibility modules, artifact ownership, raw mutation, product-facing raw
  access, and native-storage deletion gates can be audited before legacy bridge code
  is changed or removed.

Implementation record:

- Legacy compatibility boundary is documented in
  [Policy Builder Legacy Compatibility Boundary](policy-builder-legacy-compatibility-boundary.md).
- The server-side legacy compatibility boundary contract lives in
  `server/src/services/policyBuilderLegacyCompatibilityBoundary.mjs`.
- The contract now includes a compatibility ownership audit and
  compatibility-removal deletion-readiness evaluator.

### 1R.6 Test Boundary Reset

Intent: make tests protect the new architecture instead of freezing old UI
internals.

Tasks:

- Categorize existing tests as:
  - keep as behavior regression,
  - rewrite around product vocabulary,
  - rewrite around draft/bridge boundaries,
  - rewrite around future evidence/readiness contracts,
  - delete when abandoned diagnostic UI is removed.
- Add tests for boundary rules:
  - modal does not generate evidence,
  - draft commands are allow-listed,
  - reference options and observed evidence are distinct,
  - legacy payload mutation stays in bridge code,
  - legacy compatibility ownership audits remain clean,
  - legacy deletion remains blocked until all compatibility-removal gates are
    complete,
  - UI-only state is not serialized.
- Avoid adding snapshot-style tests that freeze transitional layout.

Acceptance criteria:

- Tests fail when authority boundaries are violated.
- Tests do not require preserving old diagnostic or legacy-first UI shape.
- Phase 2R can proceed with confidence that draft ownership is clear.

Implementation record:

- Test boundary reset is documented in
  [Policy Builder Test Boundary Reset](policy-builder-test-boundary-reset.md).
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

- Phase 1R is complete as a client-boundary foundation.
- Treat its module inventory, orchestration, draft, reference-data, bridge,
  and test contracts as required guardrails for 4R. Do not add client-owned
  evidence, readiness, persistence, or learning authority.

Implementation record:

- Existing implementation details are documented in
  [Policy Builder Phase 1 Implementation](policy-builder-phase-1-implementation.md).
- Phase 1R.1 boundary inventory is documented in
  [Policy Builder Boundary Inventory](policy-builder-boundary-inventory.md).
- Modal orchestration boundary is documented in
  [Policy Builder Modal Orchestration Boundary](policy-builder-modal-orchestration-boundary.md).
- Draft state boundary is documented in
  [Policy Builder Draft State Boundary](policy-builder-draft-state-boundary.md).
- Reference data boundary is documented in
  [Policy Builder Reference Data Boundary](policy-builder-reference-data-boundary.md).
- Legacy compatibility boundary is documented in
  [Policy Builder Legacy Compatibility Boundary](policy-builder-legacy-compatibility-boundary.md).
- Test boundary reset is documented in
  [Policy Builder Test Boundary Reset](policy-builder-test-boundary-reset.md).
- Client-boundary closure is verified by the durable
  [Policy Authoring Workflow Completion Audit](policy-authoring-workflow-completion-audit.md),
  which composes the boundary inventory, modal orchestration, draft state,
  reference data, legacy compatibility, test-boundary reset, normal workflow,
  and normal-path exclusion records into one side-effect-free gate.

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

- Define draft fields around product vocabulary:
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

- The policy authoring draft contract is documented in
  [Policy Authoring Draft Contract](policy-authoring-draft-contract.md).
- The server-side policy authoring draft contract lives in
  `server/src/services/policyAuthoringDraftContract.mjs`.

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
- Bridge code has explicit deletion and replacement criteria for native storage.
- The bridge isolation contract has an executable audit that fails unsafe
  responsibility ownership, serializer key drift, unsupported preservation
  overlap, raw mutation outside the bridge, and missing native-storage deletion gates.

Implementation record:

- The policy authoring legacy bridge boundary is documented in
  [Policy Authoring Legacy Bridge Boundary](policy-authoring-legacy-bridge-boundary.md).
- The server-side policy authoring legacy bridge boundary lives in
  `server/src/services/policyAuthoringLegacyBridgeBoundary.mjs`.

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
- Identify compatibility adapter commands that require product command targets.

Acceptance criteria:

- Invalid draft commands fail before serialization.
- Commands cannot create arbitrary compatibility payload fields.
- Future multi-select controls can emit batched typed commands without changing
  legacy bridge internals.
- The command boundary has an executable audit that fails unsafe command
  categories, payload authority drift, implemented future commands,
  operator-facing bridge adapters, read-only projection mutation, raw legacy
  terminology, and missing product command targets.

Implementation record:

- The policy authoring draft command boundary is documented in
  [Policy Authoring Draft Command Boundary](policy-authoring-draft-command-boundary.md).
- The server-side draft command boundary contract lives in
  `server/src/services/policyAuthoringDraftCommandBoundary.mjs`.
- Current bridge-adapter commands with product command targets are:
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

- Policy authoring draft view projection is documented in
  [Policy Authoring Draft View Projection](policy-authoring-draft-view-projection.md).
- The server-side policy authoring draft view projection contract lives in
  `server/src/services/policyAuthoringDraftViewProjection.mjs`.
- The client draft-view projection now exposes product-facing provenance,
  provenance counts, and read-only readiness/observed-evidence placeholders in
  `client/src/utils/policyIntentDraftView.js`.

### 2R.5 Server Authority Preparation

Intent: prepare the draft bridge to defer authority to server-owned contracts.

Tasks:

- Identify where client draft validation should remain client-side UX guardrail
  versus where server-side intent validation must be authoritative.
- Ensure save payloads can include explicit draft intent without trusting client
  inference.
- Align draft warnings with server-side intent contract names where possible.
- Prepare for server-provided profile-to-intent suggestions from the policy
  engine projection provider.
- Document how the draft bridge will behave when native intent storage exists:
  - create from native intent,
  - edit native intent projection,
  - serialize to native intent,
  - retain legacy bridge only for unconverted policies.

Acceptance criteria:

- The client draft bridge is clearly subordinate to server validation.
- Native intent storage can replace legacy serialization without rewriting the
  product components.
- server policy intent contract and policy-engine projection contracts have a
  clear insertion point.
- The server authority contract has an executable audit that fails client
  authority confusion, server authority loss, raw draft echo, missing insertion
  points, warning reason-code drift, missing native-storage replacement steps,
  and premature native storage activation.

Historical implementation record:

- The preparation-only authority record is retained as a retired document:
  [Policy Authoring Server Authority Preparation](policy-authoring-server-authority-preparation.md).
- Native storage is active. The current server contract is documented in
  [Policy Intent Contract Authority](policy-intent-contract-authority.md), and
  the remaining write-boundary work is 5R.2.

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
- Mark tests tied only to old diagnostic or advanced legacy UI as policy-engine
  rewrite or native-storage removal candidates.

Acceptance criteria:

- Tests protect the draft as an editing projection.
- Tests do not imply the client draft is durable authority.
- Tests preserve legacy compatibility until native storage replaces it.

Implementation status:

- The compatibility regression inventory is documented in
  [Policy Authoring Compatibility Regression Inventory](policy-authoring-compatibility-regression-inventory.md).
- The server-side compatibility regression inventory lives in
  `server/src/services/policyAuthoringCompatibilityRegressionInventory.mjs`.
- The client save payload builder now uses an explicit policy form field
  allow-list so UI-only state, read-only projections, and raw legacy placeholders
  cannot serialize before server validation.
- Policy-engine rewrite and native-storage removal candidates are tracked
  explicitly rather than treated as permanent policy-builder contracts.

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

- Phase 2R is complete as the draft/editing compatibility foundation.
- Do not expand draft state with evidence, learning, readiness, or persistence
  authority. Do not let bridge serializer details leak into product components.

Implementation record:

- Existing implementation details are documented in
  [Policy Builder Phase 2 Implementation](policy-builder-phase-2-implementation.md).
- The policy authoring draft contract is documented in
  [Policy Authoring Draft Contract](policy-authoring-draft-contract.md).
- The policy authoring legacy bridge boundary is documented in
  [Policy Authoring Legacy Bridge Boundary](policy-authoring-legacy-bridge-boundary.md).
- The policy authoring draft command boundary is documented in
  [Policy Authoring Draft Command Boundary](policy-authoring-draft-command-boundary.md).
- Policy authoring draft view projection is documented in
  [Policy Authoring Draft View Projection](policy-authoring-draft-view-projection.md).
- The retired preparation record is retained at [Policy Authoring Server
  Authority Preparation](policy-authoring-server-authority-preparation.md);
  current authority lives in [Policy Intent Contract
  Authority](policy-intent-contract-authority.md).
- The compatibility regression inventory is documented in
  [Policy Authoring Compatibility Regression Inventory](policy-authoring-compatibility-regression-inventory.md).
- Phase 2R is complete. Future updates should treat the draft bridge as a
  compatibility boundary while 5R migrates live writers and consumers to the
  active native authority contract.

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

- The policy-authoring workflow inventory is documented in
  [Policy Authoring Workflow Inventory](policy-authoring-workflow-inventory.md).
- The server-side policy-authoring workflow inventory contract lives in
  `server/src/services/policyAuthoringWorkflowInventory.mjs`.
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

- The policy-authoring destination flow is documented in
  [Policy Authoring Destination Flow](policy-authoring-destination-flow.md).
- The server-side policy-authoring destination flow contract lives in
  `server/src/services/policyAuthoringDestinationFlow.mjs`.
- The normal workflow is now explicitly ordered as select library, review
  observed destination meaning, accept or edit declared intent, confirm hard
  limits, confirm routing readiness, and save or defer.
- Starter templates are allowed only after destination context is visible, and
  new/sparse/unmapped libraries each map to one operator next action.
- Native new-policy creation now renders all five server-owned destination
  questions in their semantic order. Observed-value acceptance and evidence
  recovery are scoped to `What belongs here?`; routing readiness is shown in
  `Can this route?`, and unimplemented question controls are presented as
  bounded guidance rather than non-functional actions. See
  [Policy Authoring Destination Question Flow](policy-authoring-destination-question-flow.md).
- The workflow read now projects new, sparse, and unmapped destination states
  from bounded stored data. Missing or stale observed evidence directs the
  operator to declared intent while server-owned profile recovery remains
  automatic; a sparse valid profile remains guidance rather than guessed
  intent or a dead button; and an unmapped destination opens the existing
  library mapping screen. Profile-load and evidence-boundary failures remain
  recovery states, not false new-library claims. See [Policy Authoring
  Empty-State Mapping](policy-authoring-empty-state-mapping.md) and [Library
  Profile Regeneration Boundary](library-profile-regeneration-boundary.md).

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
- Define the target component set around product vocabulary:
  - `DestinationContextCard`,
  - `ObservedProfileSummary`,
  - `IntentSignalPicker`,
  - `IntentSignalChipList`,
  - `HardLimitControl`,
  - `AvoidControl`,
  - `ReviewTriggerControl`,
  - `PolicyDestinationEmptyStateNotice`,
  - `StarterTemplateSuggestion`.
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

- The policy-authoring component system is documented in
  [Policy Authoring Component System](policy-authoring-component-system.md).
- The server-side policy authoring component-system contract lives in
  `server/src/services/policyAuthoringComponentSystem.mjs`.
- The source-backed policy-authoring component inventory lives in
  `server/src/services/policyAuthoringComponentInventory.mjs`. It classifies
  every current policy Vue component, keeps compatibility controls out of the
  normal path, and distinguishes implemented targets from the remaining
  advisory constraint-control split. See [Policy Authoring Component
  Inventory](policy-authoring-component-inventory.md).
- The target component vocabulary now includes destination context, observed
  profile, signal picker, chip list, hard-limit, avoid, review-trigger,
  readiness next-action, and starter-template suggestion components. Retired
  diagnostic panels are not represented as authoring components.
- Option source semantics, typed-command interaction rules, explicit observed
  evidence acceptance, disabled-state explanations, and component-level
  accessibility requirements are pinned before Vue screen rebuild work starts.
- The workflow shell now composes `DestinationContextCard`,
  `ObservedProfileSummary`, and question-owned
  `PolicyDestinationEmptyStateNotice` recovery actions instead of owning
  generic context and readiness markup. The components render server-owned
  display values only; they add no policy, routing, provider, quota, learning,
  or media authority. See
  [Policy Authoring Workflow Component Extraction](policy-authoring-workflow-component-extraction.md).
- The workflow and boundary inventories classify the new components and their
  tests with no unclassified policy-authoring paths.

Implementation record:

- `IntentSignalPicker` is now the native-creation control for `What belongs
  here?`. It consumes server-normalized library evidence and selectable
  suggestions, separates read-only observations from proposed destination
  signals, supports explicit multi-select, and emits typed local-draft commands
  only. See [Policy Authoring Intent Signal
  Picker](policy-authoring-intent-signal-picker.md).
- The prior observed-suggestion selector and draft wrapper were removed rather
  than retained as parallel UI controls. The product path now uses
  `IntentSignalPicker`, `usePolicyIntentSignalDraft`, and
  `policyIntentSignalDraft` naming.
- `IntentSignalChipList` now owns declared-signal rendering and emits only the
  existing typed remove command plan. `IntentSignalPicker` retains source
  grouping, option selection, and typed add plans. See [Policy Authoring
  Intent-Signal Chip List](policy-authoring-intent-signal-chip-list.md).
- `HardLimitControl` now owns the maximum-rating selector, explicit
  confirmation, disabled reason, staged-value display, and typed local
  hard-limit plan emission. It rebuilds the approved control from the existing
  server-owned decision and eligibility projections; the composite surface
  retains availability, status, draft clearing, and the remaining advisory
  controls. See [Policy Authoring Hard-Limit
  Control](policy-authoring-hard-limit-control.md).
- `AvoidControl` now owns the advisory rating selector, explicit confirmation,
  disabled reason, staged-value display, and typed local avoid-plan emission.
  It rebuilds the approved control from the existing server-owned decision and
  eligibility projections and cannot present advisory behavior as a hard
  blocker. The composite surface retains availability, status, draft clearing,
  and the remaining review-warning control. See [Policy Authoring Avoid
  Control](policy-authoring-avoid-control.md).
- The workflow read now publishes a versioned server-owned intent-signal option
  projection. It composes bounded observed evidence, observed-profile options,
  optional matching starter-template suggestions, future common/custom sources,
  and disabled states without exposing raw profile/template payloads or letting
  the client infer source behavior. See [Policy Intent-Signal Option
  Projection](policy-intent-signal-option-projection.md).
- **3R.4.3 Server-Validated Custom Intent-Signal Entry** is complete. The
  optional sparse-library fallback accepts only a bounded `genres`, `keywords`,
  or `studios` value plus explanation; the server canonicalizes and validates
  it, reprojects it with the same broad-identity guard, and returns only the
  display-only workflow contract. The value never writes policy state, creates
  learning, routes media, or consumes a provider quota. The operator must still
  explicitly select the returned option before a typed local draft command is
  created. See [Policy Intent-Signal Custom
  Entry](policy-intent-signal-custom-entry.md).

**3R.5 Task 3R.5.1, Hard-Limit And Avoid Decision Model** is complete. The
display-only workflow read now publishes one audited, immutable server-owned
constraint projection. It separates automatic-application blockers,
confidence-lowering avoid behavior, and review warnings; it forbids raw values,
browser-derived semantics, policy persistence, runtime decisions, routing, and
provider activity. Observed absence cannot declare a hard limit or avoid rule;
it can only map to a review warning. See [Policy Constraint Decision
Model](policy-constraint-decision-model.md).

**3R.5 Task 3R.5.2, Constraint Draft-Command Adapter** is complete. It accepts
only a bounded, explicitly confirmed operator selection resolved from the
server-owned decision model and retains an immutable typed command in local
draft state. It performs no persistence, routing, learning, provider, quota,
media-server, or compatibility-bridge operation. See [Policy Constraint
Draft-Command Adapter](policy-constraint-draft-command-adapter.md).

**3R.5 Task 3R.5.3, Constraint Control Surface** is complete. Native policy
setup now renders labelled, keyboard-operable hard-limit, avoid, and
review-warning controls from the server-owned decision model. It visibly
separates blocker and advisory consequences, resets confirmation when an
explicit hard-limit or avoid value changes, retains typed commands only in the
active library's local draft, and excludes them from the native create payload.
See [Policy Constraint Control Surface](policy-constraint-control-surface.md).

**3R.5 Task 3R.5.4, Constraint Value Eligibility Projection** is complete.
The display-only workflow read now publishes the audited,
media-type-aware `policy.constraint_value_eligibility.v1` projection. Native
constraint controls render only its canonical rating and review-warning values;
unknown media types expose no free-text fallback. The client validates the
projection and retains only eligible values in transient local commands. This
adds no persistence, routing, runtime, learning, provider, quota, or
media-server authority. See [Policy Constraint Value
Eligibility](policy-constraint-value-eligibility.md).

**3R.5 Task 3R.5.5, Authorized Native Constraint Write Admission** is
complete. A protected, rate-limited server route now accepts only a strict
versioned typed-command DTO, derives the target library solely from the route,
and derives the administrator solely from the authenticated session. Its
admission service rebuilds and audits the decision and eligibility projections
before returning only a server-normalized admitted command. Rejections do not
read malformed request state, log submitted values, mutate policy storage,
route media, evaluate runtime behavior, create learning, call providers, or
read quota. Admission is explicitly not a reusable storage credential: a
future writer must repeat it within its own transaction. See [Policy Constraint
Write Admission](policy-constraint-write-admission.md).

**3R.5 Task 3R.5.6, Hard-Limit Control Extraction** is complete. The native
maximum-rating UI is now an isolated `HardLimitControl` component. It accepts
only the existing validated server projections, requires explicit confirmation,
and emits only the established typed local `set_hard_limit` command plan.
Invalid projections expose no hard-limit control; this adds no policy write,
routing, runtime-decision, learning, provider, quota, or compatibility authority.
See [Policy Authoring Hard-Limit
Control](policy-authoring-hard-limit-control.md).

**3R.5 Task 3R.5.7, Avoid Control Extraction** is complete. The native
rating-to-avoid UI is now an isolated `AvoidControl` component. It accepts only
the existing validated server projections, requires explicit confirmation, and
emits only the established typed local `add_avoid_value` command plan with the
server-defined advisory effect. Invalid projections expose no avoid control;
this adds no policy write, routing, runtime-decision, learning, provider, quota,
or compatibility authority. See [Policy Authoring Avoid
Control](policy-authoring-avoid-control.md).

**3R.5 Task 3R.5.8, Review-Trigger Control Extraction** is complete. The
native review-warning UI is now an isolated `ReviewTriggerControl` component.
It accepts only the existing validated server projections, exposes one labelled
review-condition select, and emits only the established typed local
`add_review_warning` command plan. Review conditions remain non-blocking and do
not require an additional confirmation; invalid projections expose no control.
This adds no policy write, routing, runtime-decision, learning, provider, quota,
or compatibility authority. See [Policy Authoring Review-Trigger
Control](policy-authoring-review-trigger-control.md).

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

- Policy authoring option selection is documented in
  [Policy Authoring Option Selection](policy-authoring-option-selection.md).
- The server-side policy authoring option-selection contract lives in
  `server/src/services/policyAuthoringOptionSelection.mjs`.
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

- Policy authoring constraints are documented in
  [Policy Authoring Constraints](policy-authoring-constraints.md).
- The server-side policy authoring constraints contract lives in
  `server/src/services/policyAuthoringConstraints.mjs`.
- Constraint controls are split into hard limit, avoid, and review warning
  records with explicit blocking/advisory intent semantics.
- Hard limits and avoid controls require explicit operator action and typed
  draft commands; observed absence can create only review warnings.
- Certification controls now separate max allowed rating from avoid rating so
  future UI work cannot conflate blocker and advisory behavior.
- **3R.5.1 Constraint Decision Model** is now published in the display-only
  workflow read as `policy.constraint_decision_model.v1`. It has three bounded
  outcomes and no values or execution authority, so future controls cannot
  derive hard-limit or avoid behavior in the browser.
- **3R.5.2 Constraint Draft-Command Adapter** is complete. The server-owned
  projection now carries an approved typed command identifier for each
  constraint control. A local-only adapter accepts one bounded, explicitly
  confirmed operator choice, revalidates the display-only projection, and keeps
  an immutable typed command in transient state. It performs no policy write,
  routing, learning, provider, quota, media-server, or compatibility-bridge
  operation. See [Policy Constraint Draft-Command
  Adapter](policy-constraint-draft-command-adapter.md).
- **3R.5.3 Constraint Control Surface** is complete. The native destination
  flow now exposes labelled native controls for hard limits, avoid values, and
  review warnings. Each control stages only the existing typed local command;
  hard-limit and avoid values require confirmation tied to the current value,
  and staged commands are visibly unsaved and absent from the create payload.
  See [Policy Constraint Control Surface](policy-constraint-control-surface.md).
- **3R.5.4 Constraint Value Eligibility Projection** is complete. The server
  publishes an audited `policy.constraint_value_eligibility.v1` allowlist for
  each supported library media type, using existing runtime certification order
  and bounded review-warning reasons. Native controls now use only labelled
  selects from that allowlist, while unsupported media types fail closed with
  no controls. The local command adapter revalidates each staged value and
  remains excluded from persistence, routing, runtime, learning, provider, and
  quota paths. See [Policy Constraint Value
  Eligibility](policy-constraint-value-eligibility.md).

**3R.5.5 Authorized Native Constraint Write Admission** is complete. The
server accepts the typed local command only through a strict DTO, reloads the
route-selected library, rebuilds and audits decision and eligibility state,
requires an authenticated administrator, and returns a server-normalized
non-persistent admission result. It is no substitute for a future transactional
storage gate and adds no runtime, routing, learning, provider, quota, or
media-server authority. See [Policy Constraint Write
Admission](policy-constraint-write-admission.md).

- **3R.5.6 through 3R.5.8 Constraint-Control Extractions** are complete.
  `HardLimitControl`, `AvoidControl`, and `ReviewTriggerControl` now each own
  their labelled native control and only emit the established typed local plan.
  The composite surface retains shared availability, status, staged-count, and
  clear-draft coordination; it no longer owns a constraint-specific editor.

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
- Remove browser preview/replay panels after their server migration-verifier
  retention decision is recorded; they are not a normal authoring workflow.

Acceptance criteria:

- Readiness answers what to do next.
- Readiness does not require understanding internal scoring or provider state.
- Diagnostic panel tests are rewritten around readiness or marked for deletion.

Implementation status:

- Policy authoring readiness is documented in
  [Policy Authoring Readiness](policy-authoring-readiness.md).
- The readiness module cutover is documented in
  [Policy Authoring Readiness Module Cutover](policy-authoring-readiness-module-cutover.md).
- The server-side policy authoring readiness contract lives in
  `server/src/services/policyAuthoringReadiness.mjs`.
- The normal readiness model now has six visible states and six issue records,
  each mapped to exactly one next action and one resolving destination workflow
  step/component.
- The readiness projection selects the highest-priority issue while preserving
  the full issue list for secondary display.
- **3R.6.1 Constraint Admission Readiness Handoff** is complete. A successful
  non-persistent constraint admission cannot add a readiness state, issue, or
  next action. Its response has no normal-workflow handoff field, and the
  admission audit rejects one if introduced. See [Policy Constraint Admission
  Readiness Handoff](policy-constraint-admission-readiness-handoff.md).
- **3R.6.2 Readiness Action Surface Audit** is complete. The unreachable
  generic readiness card is retired. Normal readiness actions remain in the
  destination question that owns the condition, and no browser focus action is
  offered when no resolver exists. See [Policy Authoring Readiness Action
  Surface Audit](policy-authoring-readiness-action-surface-audit.md).
- **3R.6.3 Live Readiness Presentation Audit** is complete. The v4
  operator-workflow read now maps every engine state and live issue to an
  existing owner action or truthful automatic guidance. Stale or unavailable
  profiles cannot expose selectable intent inputs, and automatic profile
  recovery is explained in the existing observed-profile summary. See [Policy
  Operator Workflow Live Readiness Presentation
  Audit](policy-operator-workflow-live-readiness-presentation-audit.md).
- Impact/replay browser panels and their client API facade are removed.
  Provider readiness, TMDB live preview, scoring details, and parity delta
  remain server-side migration-verifier or deletion material outside the normal
  authoring workflow.

### 3R.7 Starter Template Role Reset

Intent: keep templates useful without letting them remain the policy mental
model.

Tasks:

- Permit optional template-derived values only after destination context.
- Project template-derived values into product vocabulary:
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
- Accepting a template-derived candidate mutates the intent draft through typed
  commands.
- Raw templates and their internals are not normal editing surfaces.

Implementation status:

- The implemented boundary is documented in
  [Policy Starter Template Intent Boundary](policy-starter-template-intent-boundary.md).
- Template-derived values are server-projected, source-labelled candidates;
  the browser never receives a raw template attachment payload.
- Candidate acceptance emits existing typed intent-signal commands rather than
  mutating template mechanics.
- Raw selection, browser, and suggestion endpoint surfaces are deleted.
- Existing preset attachments remain read and round-trip compatibility context
  only until native storage migration; they are not current intent authority.
- **3R.7.1 Live Template Candidate Projection Audit** is complete. Normal and
  custom workflow reads now use the same server response guard, and the
  candidate audit rejects raw starter-template provenance before a response can
  reach the browser. See [Policy Starter-Template Live Candidate Projection
  Audit](policy-starter-template-live-candidate-projection-audit.md).
- **3R.7.2 Template Candidate Vocabulary Decision** is complete. The server
  now projects only exact `require_any` purpose candidates with an existing
  typed command owner. Template `prefer`, hard-limit, and avoid vocabulary is
  fail-closed until its semantics, server-owned eligibility, named control, and
  source-aware candidate command contract match exactly. See [Policy
  Starter-Template Candidate Vocabulary
  Decision](policy-starter-template-candidate-vocabulary-decision.md).
- **3R.7.3 Template Compatibility Bridge Inventory** is complete. The
  executable inventory now covers 20 retained server, client bridge, and
  compatibility-component artifacts; every artifact has the complete
  native-storage deletion gate, a successor, and an explicit compatibility-only
  boundary. The former raw template mechanics component is already retired.
  See [Policy Starter-Template Compatibility Bridge
  Inventory](policy-starter-template-compatibility-bridge-inventory.md).

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

- Policy authoring accessibility is documented in
  [Policy Authoring Accessibility](policy-authoring-accessibility.md).
- The durable server-side accessibility and decision-load contract lives in
  `server/src/services/policyAuthoringAccessibility.mjs`.
- The module cutover is documented in
  [Policy Authoring Accessibility Module Cutover](policy-authoring-accessibility-module-cutover.md).
- Every policy-authoring target component now maps to an accessibility and
  decision-load surface before Vue screens are rebuilt.
- Normal workflow surfaces require labels, helper text, keyboard operation,
  visible focus, no internal diagnostic language, and at most one primary
  action.
- Multi-select, chip removal, disabled reason, destructive confirmation, and
  readiness next-action requirements are pinned as executable audit rules.
- The save/defer footer now renders a blocked save's exact next correction in
  its single status message and describes the unavailable primary action with
  that message; it does not depend on a title tooltip or duplicate warning
  panel.
- Destination-question cards no longer repeat generic projected readiness
  labels. Explicit recovery actions remain in their owning card, while generic
  compatibility-edit readiness remains workflow-level:
  [Policy Authoring Destination Question Action Hierarchy](policy-authoring-destination-question-action-hierarchy.md).
- Destination empty-state recovery now uses an active action identifier,
  projection-owned busy copy, and a polite progress status without repeating
  an actionable card's next-action label:
  [Policy Destination Empty-State Action Resolution](policy-destination-empty-state-action-resolution.md).
- Workflow loading, server-reported profile recovery, and empty-state progress
  now resolve to one ordered live announcement:
  [Policy Builder Workflow Status Priority](policy-builder-workflow-status-priority.md).
- **3R.8.4 Keyboard Recovery-Flow Audit is complete.** The shared modal now
  has dialog semantics, contained keyboard navigation, Escape support, and
  normal focus restoration. Recovery rerenders preserve the action focus when
  possible, fall back to the current workflow result only when that action is
  removed, and send successful library-mapping navigation to the mapping
  destination instead of returning to a closed modal opener. The design and
  outcome are documented in
  [Policy Builder Keyboard Recovery Flow](policy-builder-keyboard-recovery-flow.md).
- **3R.8.5 Compatibility Maintenance Decision-Load Audit is complete.** The
  existing-policy surface now owns one purpose statement, establishes attached
  policy context before every editable control, removes the nested duplicate
  editor heading, shows a selector only when there is a genuine context choice,
  and presents completed migration feedback as non-blocking status. Typed draft
  commands and the compatibility-only boundary are unchanged. See [Policy
  Compatibility Maintenance Decision-Load
  Audit](policy-compatibility-maintenance-decision-load-audit.md).

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
- Product-facing tests use product vocabulary.
- Draft/bridge behavior remains covered by Phase 2R tests rather than duplicated
  in presentation tests.

Implementation status:

- Policy authoring presentation tests is documented in
  [Policy Authoring Presentation Tests](policy-authoring-presentation-tests.md).
- The server-side policy authoring presentation test contract lives in
  `server/src/services/policyAuthoringPresentationTests.mjs`.
- Current policy-builder presentation tests are categorized as keep, protect,
  remove, or draft-bridge-owned coverage before client test updates continue.
- The bounded presentation-test inventory now classifies all 30 direct
  policy-authoring tests plus four adjacent bridge tests exactly once, names
  the policy-list card as out of authoring scope, and fails on missing,
  duplicate, out-of-inventory, invalid-exclusion, or non-authoring
  normal-path coverage.
- Required presentation behaviors now cover starter-template ordering,
  observed evidence versus declared intent, typed multi-select commands,
  accessible names and disabled reasons, explicit hard-limit action, readiness
  next-action links, and absence of normal-path diagnostic panels.
- Replay, impact preview, and raw starter-template mechanics tests are marked
  as abandoned normal-path diagnostics instead of simplified workflow
  requirements.
- The first Vue-facing Phase 3R rewrite is documented in
  [Policy Authoring Setup Cards](policy-authoring-setup-cards.md).
  The modal now renders four setup cards after library context and keeps impact
  and replay verifier panels out of the default workflow unless explicitly
  enabled.
- **3R.9.1 Compatibility Presentation-Test Ownership Audit is complete.**
  Retained maintenance tests now have named observable-behavior ownership
  outside normal authoring. The audit requires context-first order or typed
  draft-command forwarding, maps each component to the complete native-storage
  deletion gate, and rejects legacy-layout or diagnostic-behavior protection.
  See [Policy Compatibility Maintenance Test Ownership
  Audit](policy-compatibility-maintenance-test-ownership-audit.md).

### 3R.10 Workflow Contract Closure And 4R Handoff

Intent: close Phase 3R as a workflow-definition workstream and create a
truthful, component-level handoff for the live UI-convergence work in Phase 4R.

Tasks:

- Reconcile 3R.1 through 3R.9 against their current source, tests, and design
  records. Mark each contract as complete, superseded, or missing evidence;
  do not infer completion from a component name or a historical screenshot.
- For every remaining live UI difference, create one 4R task/component owner
  with its rendered entry path, required server projection, action contract,
  and removal criterion.
- Verify that Phase 3R contains no browser persistence authority, runtime
  readiness derivation, provider recovery, migration action, or compatibility
  deletion execution.
- Reclassify native-storage, compatibility-retirement, rollback, and
  controlled-removal work under Phase 8R. Preserve their design records, but
  remove them from Phase 3R scope and numbering.
- Update the Phase 3R implementation record so it describes contract evidence
  and the Phase 4R handoff, not a claim that the complete live UI is delivered.

Acceptance criteria:

- Each 3R component has one truthful status and one next owner when work
  remains.
- Phase 3R has a complete, auditable handoff to 4R.1 through 4R.9.
- No Phase 3R task is blocked by native-storage deletion work.
- No Phase 3R record claims a live interaction outcome without its Phase 4R
  rendered-path and end-to-end evidence.

Status: complete. The closure audit reconciles the active Phase 3R contract
ledger against its source, test, and design artifacts; assigns each active
server/client workflow contract one Phase 4R owner; and fails closed on a
premature live-UI completion claim. The operational UI work that follows is
Phase 4R, and compatibility-removal work is Phase 8R. See [Policy Authoring
Workflow Closure And Phase 4R
Handoff](policy-authoring-workflow-closure-handoff.md).
Completed design records that retain a historical `3R.10.*` label describe the
pre-reclassification source history only; they are not active Phase 3R tasks.

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
10. **3R.10 Workflow Contract Closure And 4R Handoff**
    Separates complete workflow contracts from the live UI work that remains.

Current starting point:

- Phase 3R workflow-contract closure is complete.
- **4R.1 Live Entry-Path And Action Inventory** has now recorded the
  source-backed normal-path gap and component/action ownership. Do not infer a
  live entry path, rendered control, or successful action from the Phase 3R
  source contract, the 4R.1 source audit, or a historical implementation
  record.
- Do not add more warnings, readiness cards, or option controls before the
  Phase 4R inventory assigns the visible path and control to an owner.
- Do not preserve old preview/replay/provider panels in the normal workflow.

Implementation record:

- Existing implementation details are documented in
  [Policy Builder Phase 3 Implementation](policy-builder-phase-3-implementation.md).
- The policy-authoring workflow inventory is documented in
  [Policy Authoring Workflow Inventory](policy-authoring-workflow-inventory.md).
- The policy-authoring destination flow is documented in
  [Policy Authoring Destination Flow](policy-authoring-destination-flow.md).
- The policy-authoring component system is documented in
  [Policy Authoring Component System](policy-authoring-component-system.md).
- Policy authoring option selection is documented in
  [Policy Authoring Option Selection](policy-authoring-option-selection.md).
- Policy authoring constraints are documented in
  [Policy Authoring Constraints](policy-authoring-constraints.md).
- Policy authoring readiness is documented in
  [Policy Authoring Readiness](policy-authoring-readiness.md).
- Policy authoring starter templates are documented in
  [Policy Authoring Starter Templates](policy-authoring-starter-templates.md).
- policy authoring accessibility is documented in
  [Policy Authoring Accessibility](policy-authoring-accessibility.md).
- Phase 3R closure and the explicit Phase 4R ownership handoff are documented
  in [Policy Authoring Workflow Closure And Phase 4R
  Handoff](policy-authoring-workflow-closure-handoff.md).
- Policy authoring presentation tests are documented in
  [Policy Authoring Presentation Tests](policy-authoring-presentation-tests.md).
- The presentation-test module cutover is documented in
  [Policy Authoring Presentation Tests Module Cutover](policy-authoring-presentation-tests-module-cutover.md).
- Phase 3R contract checkpoints are closed through 3R.10. Future rendered
  component and browser-test work belongs to the named Phase 4R task sequence.
- The first Vue-facing rewrite slice is documented in
  [Policy Authoring Setup Cards](policy-authoring-setup-cards.md).
- The second Vue-facing rewrite slice is documented in
  [Policy Authoring Destination Sections](policy-authoring-destination-sections.md).
  The current intent editor now has distinct review behavior, destination
  identity, destination rules, and confidence-support anchors so setup-card
  actions no longer collapse into one monolithic editor target.
- The policy-authoring destination-section cutover renamed that design record
  and completion-audit entry to durable product-domain names, updated the
  workflow completion audit id to `policy_authoring_destination_sections`, and
  added
  [Policy Authoring Destination Sections Module Cutover](policy-authoring-destination-sections-module-cutover.md)
  as the outcome record.
- The third Vue-facing rewrite slice is documented in
  [Policy Authoring Review Triggers](policy-authoring-review-triggers.md).
  The review behavior group now has an **Ask When Unsure** checkbox control
  backed by `review_triggers.when_any` draft serialization, readable summaries,
  duplicate disabled reasons, and compatibility bridge coverage.
- The policy-authoring review-trigger cutover renamed that design record and
  completion-audit entry to durable product-domain names, updated the workflow
  completion audit id to `policy_authoring_review_triggers`, and added
  [Policy Authoring Review Triggers Module Cutover](policy-authoring-review-triggers-module-cutover.md)
  as the outcome record.
- The fourth Vue-facing rewrite slice is documented in
  [Policy Authoring Routing Readiness](policy-authoring-routing-readiness.md).
  Its local projection and unmounted card are historical artifacts: the card
  has been deleted because the active server-owned workflow now provides the
  normal readiness next action.
- The policy-authoring routing-readiness cutover renamed that design record and
  completion-audit entry to durable product-domain names, updated the workflow
  completion audit id to `policy_authoring_routing_readiness`, and added
  [Policy Authoring Routing Readiness Module Cutover](policy-authoring-routing-readiness-module-cutover.md)
  as the outcome record.
- The fifth Vue-facing rewrite slice is documented in
  [Policy Authoring Setup Card Progress](policy-authoring-setup-card-progress.md).
  The setup cards now derive complete, needs-setup, optional, and checking
  states from existing modal projections so the workflow shows progress without
  adding new API calls, persistence, routing execution, or diagnostic panels.
- The policy-authoring setup-card progress cutover renamed that design record
  and completion-audit entry to durable product-domain names, updated the
  workflow completion audit id to `policy_authoring_setup_card_progress`, and
  added
  [Policy Authoring Setup Card Progress Module Cutover](policy-authoring-setup-card-progress-module-cutover.md)
  as the outcome record.
- The sixth Vue-facing rewrite slice is documented in
  [Policy Authoring Save And Defer Action Boundary](policy-authoring-save-defer-action-boundary.md).
  The modal footer now exposes save readiness, disabled reasons, and a
  defer-without-saving action while preserving the existing close and save event
  contracts.
- The policy-authoring save/defer action-boundary cutover renamed that design
  record and completion-audit entry to durable product-domain names, updated
  the workflow completion audit id to
  `policy_authoring_save_defer_action_boundary`, and added
  [Policy Authoring Save And Defer Action Boundary Module Cutover](policy-authoring-save-defer-action-boundary-module-cutover.md)
  as the outcome record.
- The seventh Vue-facing rewrite slice is documented in
  [Policy Authoring Starter Template Accelerator](policy-authoring-starter-template-accelerator.md).
  Starter templates are now optional accelerators: save readiness no longer
  requires a selected template, no-template warnings are removed from the normal
  summary path, and the template browser/details surface is collapsed behind an
  accessible disclosure.
- The policy-authoring starter-template accelerator cutover renamed that design
  record and completion-audit entry to durable product-domain names, updated
  the workflow completion audit id to
  `policy_authoring_starter_template_accelerator`, and added
  [Policy Authoring Starter Template Accelerator Module Cutover](policy-authoring-starter-template-accelerator-module-cutover.md)
  as the outcome record.
- The eighth Vue-facing rewrite slice is documented in
  [Policy Authoring Accessibility And Decision Load Audit](policy-authoring-accessibility-decision-load-audit.md).
  Setup cards now expose one recommended next action, mark it with
  `aria-current="step"`, describe action links with status and completion
  context, and route no-template setup actions to an available intent-editor
  target instead of missing anchors.
- The policy-authoring accessibility and decision-load audit cutover renamed
  that design record and completion-audit entry to durable product-domain
  names, updated the workflow completion audit id to
  `policy_authoring_accessibility_decision_load_audit`, and added
  [Policy Authoring Accessibility And Decision Load Audit Module Cutover](policy-authoring-accessibility-decision-load-audit-module-cutover.md)
  as the outcome record.
- The ninth Vue-facing rewrite slice is documented in
  [Policy Authoring Presentation Test Reset](policy-authoring-presentation-test-reset.md).
  The highest-risk modal, impact preview, and replay preview tests now protect
  the destination-first workflow and verifier-only safety contract without
  freezing old provider, TMDB, scoring, parity, or sample-selection diagnostics
  as normal product UI.
- The policy-authoring presentation-test reset cutover renamed that design
  record and completion-audit entry to durable product-domain names, updated
  the workflow completion audit id to
  `policy_authoring_presentation_test_reset`, and added
  [Policy Authoring Presentation Test Reset Module Cutover](policy-authoring-presentation-test-reset-module-cutover.md)
  as the outcome record.
- The policy authoring workflow completion gate is documented in
  [Policy Authoring Workflow Completion Audit](policy-authoring-workflow-completion-audit.md).
  The server-owned completion audit now verifies durable server contracts,
  client workflow components, normal workflow rules, normal-path exclusions,
  and referenced artifact paths before runtime evidence work consumes the
  operator-intent surface.
- The policy-authoring workflow completion gate audit renamed the active client
  artifact kind from rewrite-slice terminology to
  `client_workflow_component`, added a guard that rejects active
  `policy-builder-phase-*` artifact paths, and recorded the outcome in
  [Policy Authoring Workflow Completion Gate Audit](policy-authoring-workflow-completion-gate-audit.md).

## Phase 4R: Live Policy-Authoring UI Convergence

Status: complete. The live rendered-path, lifecycle presentation, action
admission, bounded adjustment, maintenance, cutover, accessibility, and
browser workflow contracts are implemented and verified. Earlier component
extractions and read-model work remain inputs, not browser authority.

Intent: deliver the automation-first policy-authoring experience in the running
application. A library that has enough current evidence should start with a
server-derived destination proposal, not a blank form that asks the operator to
restate what Classifarr already knows.

### Why Phase 4R Exists

The former folded checkpoint confused three different kinds of work:

- Phase 3R defines the workflow vocabulary, component boundaries, and normal
  path exclusions.
- Phase 5R owns server authorization, question, answer, and learning
  contracts.
- Phase 6R.5 owns the server workflow projection and automation-readiness
  inputs.

None of those alone proves that the live browser renders a clear, functioning,
and low-decision experience. This phase owns that final composition and the
removal of the old builder path.

The current failure modes are explicit scope for this phase:

- known library evidence is displayed, then the operator is still required to
  select it again before creating a policy;
- optional hard limits, avoid rules, helpful matches, and review triggers are
  displayed as if every one were a required setup task;
- internal readiness, replay, provider, migration, or compatibility detail is
  repeated as normal product UI;
- a visible control has no bound action, a stale target, or a browser-inferred
  outcome;
- a component extraction is treated as a completed workflow even when its live
  entry path is still the old modal or an incompatible editor.

### Product Contract

The normal path is intentionally small:

```text
choose library
  -> read server-derived destination proposal and automation state
  -> create or save the proposal when the server admits it
  -> adjust only the part that is wrong or incomplete
  -> let Classifarr recover evidence and ask only for a material exception
```

For an existing, well-profiled library, the first screen must answer:

```text
What does this library appear to be for?
What will Classifarr do next?
Do I need to change anything before I continue?
```

It must not make the operator reconstruct observed genres, templates,
thresholds, provider state, replay results, or review mechanics. A
server-derived proposal is not a silent policy write: the browser may create a
local native draft or submit an explicitly admitted create/update request, but
the server remains the only persistence and authority boundary.

The normal surface has three areas, in this order:

1. **Destination proposal**: a concise, display-safe description of observed
   library meaning, evidence quality, and declared intent when it already
   exists.
2. **One next action**: create, save, wait for automatic recovery, or answer a
   specific material exception. It is the only primary action in the current
   state.
3. **Adjust this policy**: an optional disclosure containing the small,
   task-relevant controls needed to correct the proposal. It is not expanded by
   default for a ready library.

### Phase Boundaries And Dependencies

Phase 4R consumes, but does not replace, the surrounding authority work:

- **3R** supplies the workflow vocabulary, component inventories, typed draft
  commands, accessibility baseline, and normal-path exclusions.
- **5R.1, 5R.2, 5R.2a, 5R.4, 5R.5, and 5R.10** supply server-owned intent,
  initial-create, proposal/lifecycle, clarification, answer, and native-change
  contracts. Phase 4R cannot introduce a browser alternative for any of them.
- **6R.1, 6R.2, 6R.4, and 6R.5** supply observed evidence, declared-intent,
  automation-readiness, and bounded workflow projections. A UI component may
  ship only when the projection it requires exists and is validated.
- **8R native storage** remains the persistence authority. Phase 4R does not
  add a compatibility sidecar, a direct browser mutation path, or client-owned
  migration state.

Existing Vue-facing records in 3R and 6R.5 are treated as reusable inputs and
verification evidence. They do not close a 4R task until the task's live entry
path, error/recovery state, action binding, accessibility behavior, and legacy
removal criteria have passed together.

### UI And Security Rules

- The browser renders bounded server projections and forwards only
  allow-listed, typed commands through named client API functions. It never
  derives policy readiness, actor identity, routing eligibility, recovery work,
  provider state, or a mutation authorization.
- Each visible action has one declared action identifier, one available
  client API operation, an explicit loading/disabled/error state, and an
  end-to-end test. When an operation is not implemented or not admitted, the
  control is absent or renders plain guidance; it is never a dead button.
- Observed evidence is a proposal by default. The browser receives an opaque
  proposal reference and a bounded display summary; it never receives a raw
  observed-value payload merely to recreate the server proposal. The server
  reconstructs, rechecks, and explicitly admits the proposal before any
  persistence. Observed evidence is never silently persisted or treated as a
  hard limit, avoid rule, review trigger, or broad learning decision.
- A normal authoring entry is selected from a server-owned lifecycle state. A
  library that already has a policy, has stale evidence, or is recovering is
  routed to its bounded authoritative state instead of attempting another
  create or exposing a database conflict.
- Multi-select and chip controls are adjustment tools, not the main workflow.
  They appear only after the operator opens **Adjust this policy** or when the
  server identifies a specific missing decision.
- Hard limits, avoid values, review triggers, routing detail, and custom
  signals remain hidden until they are materially relevant. Optional values
  must not produce a generic warning or block a ready policy.
- No normal policy screen renders raw provider payloads, raw evidence values,
  replay/impact details, policy-storage migration data, database state,
  internal failure causes, or a privileged maintenance operation.
- The implementation uses native HTML controls where possible. A custom
  disclosure follows the [WAI-ARIA disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/);
  grouped multi-select uses the [WAI-ARIA checkbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/);
  and a modal is used only when the implementation satisfies the
  [WAI-ARIA modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
  Dynamic save, automatic-recovery, and error feedback follows [WCAG 2.2
  status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  without turning the interface into a stream of announcements.

## Phase 4R Component Map

### 4R.1 Live Entry-Path And Action Inventory

Intent: establish what the operator actually sees and can activate before
changing another component.

Tasks:

- Inventory every route, modal, hash target, list action, create action, edit
  action, and deep link that reaches policy authoring.
- Capture the rendered state for a new library, a well-profiled library, a
  sparse library, an unmapped library, a policy with an automatic recovery in
  progress, and a persisted native policy.
- Map every visible control to exactly one of:
  - a server-backed action contract,
  - a local, typed draft command,
  - an accessible disclosure/navigation control,
  - read-only information,
  - delete or replace before the next slice.
- Compare the live component tree against 3R's inventory and 6R.5's workflow
  projection. Record stale documentation, dead controls, duplicate summaries,
  browser-derived readiness, and legacy entry points as explicit removal work.
- Add a small, deterministic inventory/audit contract rather than a new
  browser diagnostic panel. It may be maintainer-facing test evidence only.

Acceptance criteria:

- Every normal authoring entry point and visible action is classified.
- No planned UI slice relies on a screenshot, static component import, or
  historical implementation record as evidence that it is live.
- The next component cutline identifies the exact live entry path to replace.

Implementation record:

- The source-backed inventory is documented in [Policy Authoring Live
  Entry-Path And Action Inventory](policy-authoring-live-entry-path-inventory.md).
  Its maintainer-facing contract is
  `server/src/services/policyAuthoringLiveEntryPathInventory.mjs` with focused
  Jest coverage.
- It classifies the lifecycle list, selected-library proposal route, one
  admitted create action, optional typed adjustments, existing/recovery states,
  the obsolete advanced-settings hash, and the reconciliation maintenance
  route. No retired modal entry is classified as normal authoring.
- `client/browser-tests/policy-authoring-live-entry-path.spec.js` verifies the
  rendered lifecycle-first path with contract-shaped server responses:
  keyboard selection, focus transfer, a single create action, opaque admission
  data, success feedback, and retired-hash exclusion. This controlled browser
  evidence does not replace server authorization or 8R installation evidence.

### 4R.2 Server Workflow Presentation Adapter

Intent: create one narrow client-side presentation adapter that validates and
projects the existing server workflow contract without recreating policy logic.

Tasks:

- Define a page-level view model for destination proposal, one next action,
  optional adjustment availability, and bounded recovery status.
- Reject malformed, stale, mismatched-library, or unsupported workflow
  projections before they render actionable controls.
- Keep server values display-safe and immutable; do not retain raw evidence,
  provider payloads, hidden policy fields, or compatibility data in client
  state.
- Define a single status priority for loading, saving, automatic recovery, and
  returned errors so cards cannot announce competing conclusions.
- Route all transport through named `client/src/api` leaf functions and retain
  existing stale-request cancellation/identity checks.

Acceptance criteria:

- The rendered authoring state comes from one validated server projection.
- The adapter contains no scoring, readiness, profile-recovery, or mutation
  decision logic.
- An invalid projection fails closed into a bounded non-actionable state.

Implementation outcome: complete. The server now returns and audits
`policy.authoring_workflow_presentation.v1`; the client validates and
deep-freezes the display-safe subset, preserves request identity checks, and
uses one status priority. See [Policy Authoring Workflow Presentation
Adapter](policy-authoring-workflow-presentation-adapter.md).

### 4R.3 Action Binding And Admission Feedback

Intent: make every button, link, and submit operation reliable before changing
the information architecture around it.

Tasks:

- Bind each primary and adjustment action to its server-owned action contract
  or a local typed-command boundary.
- Supply per-action pending, success, rejection, retryable-error, and
  unavailable states without exposing raw server errors or inventing success.
- Prevent duplicate submission with an action-local pending state and preserve
  the server's idempotency/concurrency result when one exists.
- Remove or replace controls that cannot reach an admitted operation; a label
  such as `Create Policy` must either submit the narrow native contract or not
  be rendered.
- Test the complete user-visible result for successful, rejected, stale, and
  unavailable operations.

Acceptance criteria:

- Every rendered interactive control has a functioning, tested outcome.
- The browser cannot turn an unavailable action into a request by changing
  local state or deep-linking.
- A rejected action leaves the server projection authoritative and reports one
  understandable next state.

Implementation outcome: the current native-create action component is complete.
It calls the named API leaf through an action-local composable, preserves
idempotency across safe retries, requires a server establishment receipt before
success, and emits only a confirmed policy identifier for list refresh. Safe
feedback now covers the currently reachable create, compatibility save,
custom-value validation, and typed routing-navigation boundaries; unsupported
empty-state actions are non-interactive. See [Policy Authoring Action Binding
And Feedback](policy-authoring-action-binding-and-feedback.md).

This is not a claim that every legacy list-level action is accepted as the
final product path. The current normal create opener is absent, and list-level
reset, maintenance, and raw failure surfaces remain explicit 4R.8 removal
work. Representative live-browser verification remains a separate 4R.1
requirement. **5R.2a, 4R.4a, 4R.4, 4R.4b, 4R.5.1, 4R.5.2.1, and 4R.5.3 are
complete.**

### 4R.4a Library Lifecycle Entry

Intent: give each connected library one authoritative authoring entry state
before rendering a proposal or opening an editor.

Dependencies: the completed 5R.2a contract provides a bounded candidate/lifecycle
projection. This component does not infer whether a library can create, already has a
policy, has stale evidence, or is recovering from local list state.

Tasks:

- Build one normal `/policies` entry component that lists only server-projected
  candidate states: eligible to create, existing native policy, existing
  compatibility maintenance, automatic recovery, or one bounded blocking
  action.
- Replace hidden local create-modal state with an explicit route or durable
  route-state contract that preserves selected library, back navigation, and
  focus restoration without exposing a second create path.
- Send existing-policy candidates to their later 4R.7 inspection surface;
  never let them issue another create request.
- Keep automatic recovery informational and keep server-declared navigation
  actions allow-listed. Do not add profile refresh, quota, reset, or
  reconciliation controls to this entry.
- Render safe load and action-result feedback. Remove browser `alert()` and
  raw failure text from the replacement entry path.

Acceptance criteria:

- Every connected library has one visible, authoritative lifecycle outcome.
- An eligible library can reach the proposal flow through one normal product
  entry; an existing policy cannot enter native create.
- Refresh, reload, and back navigation retain or safely restore the selected
  lifecycle state without browser-derived policy decisions.

Implementation outcome: complete. `/policies` now renders one strict,
server-confirmed lifecycle presentation per connected library and bounds reads
to four concurrent requests. It replaces local policy grouping and the hidden
create modal with durable `?library=<id>` selection and verified focus
restoration. Existing, recovery, unavailable, and malformed states are
non-creating; recovery exposes no refresh control; loading and failure feedback
contains no browser dialog or raw error. See [Policy Library Lifecycle
Entry](policy-library-lifecycle-entry.md).

### 4R.4 Destination Proposal Card

Intent: make the already-known library meaning the default first decision.

Tasks:

- Build one `DestinationProposalCard` from the 4R.2 display model and the
  5R.2a proposal-admission reference. The display model must not be widened
  with raw observed values just to make the card actionable.
- Show concise observed-library context, current declared purpose when it
  exists, evidence quality, and a bounded explanation of why the proposal is
  available or unavailable.
- For eligible evidence, render the server-derived proposed intent with its
  opaque proposal reference and revision held only for the admitted action.
  The browser forwards the reference and any allow-listed adjustment commands;
  the server reconstructs and rechecks the intent before persistence.
  Clearly distinguish `proposed` from `saved` and `adjusted` from `observed`.
- For sparse or unavailable evidence, show the smallest safe starting action;
  do not claim that absent data defines a policy or expose a browser refresh.
- Do not render a generic `Belongs Here` multi-select as a mandatory first
  step when the server has already supplied an eligible proposal.

Acceptance criteria:

- A well-profiled library can be understood and created/saved from one card
  plus its admitted primary action.
- Observed values never become durable policy state without explicit create or
  save admission.
- New and sparse libraries receive actionable guidance without a false
  readiness failure.

Implementation outcome: complete. The selected eligible library now prepares
one server-owned proposal and displays only its strict renderable projection:
bounded observed context, proposed purpose, and declared-rule counts. Opaque
reference and revision values are held outside the render component, then sent
only through the admitted idempotent action with typed allow-listed adjustments.
The card explicitly distinguishes `Proposed, not saved` from a confirmed saved
policy and renders no generic `Belongs Here` picker, profile refresh, template
shortcut, or raw failure text. See [Policy Destination Proposal
Card](policy-destination-proposal-card.md).

### 4R.4b Proposal Outcome Recovery

Intent: turn stale, concurrent, and interrupted proposal attempts into one
authoritative next state instead of a blind browser retry.

Dependencies: the completed 5R.2a contract returns bounded outcome identifiers
for stale proposal, existing policy, recovery pending, authorization rejection, and
retryable transport failure.

Tasks:

- On proposal revision mismatch, profile change, or stale admission, discard
  the local proposal reference and reload the lifecycle/proposal projection.
- On a duplicate or concurrent create, resolve the server-owned existing
  policy state and offer its inspection path; never expose a database conflict
  or resubmit a newly generated create payload.
- On a lost response or browser return, query lifecycle state before offering
  a new create. Retain the action idempotency key only for the unchanged active
  attempt; do not persist raw request bodies in browser storage.
- Keep success, stale, rejected, recovery, and retryable feedback mutually
  exclusive and announced through the bounded status surface.

Acceptance criteria:

- Two tabs, a refresh after submission, and a changed profile cannot create a
  second policy or leave the operator with an ambiguous result.
- Recovery from any create outcome starts from a fresh authoritative lifecycle
  projection, not cached observed values or browser-derived intent.

Implementation outcome: complete. The proposal admission boundary now classifies
bounded non-success, malformed, stale, concurrent, interrupted, and uncertain
outcomes without exposing raw errors. The policy list clears opaque proposal
state, rereads only the selected library lifecycle, and renders one polite
status message before offering any fresh server-derived guidance. It neither
persists proposal data nor retries or reconstructs policy intent in the
browser. See [Policy Authoring Proposal Outcome
Recovery](policy-authoring-proposal-outcome-recovery.md).

### 4R.5 Intent Adjustment Disclosure

Intent: retain meaningful create-time operator control without making editing
the default workflow.

Scope: this task is limited to a new policy proposal. Persisted native-policy
changes remain unavailable until 5R.10 provides a separate native-change
admission contract; this disclosure must not fall back to a legacy update
payload.

Tasks:

- Implement an optional **Adjust this policy** disclosure with explicit
  collapsed/expanded state and a stable accessible name.
- Compose the existing signal picker, chip list, and typed draft-command
  adapters only for the relevant signal groups.
- Surface source labels such as observed, proposal, template suggestion, and
  explicit operator value. Do not use counts alone to imply a value is a rule.
- Use grouped multi-select only for eligible known options, with one
  explanation and disabled reason per unavailable value; custom entry remains
  bounded by the server admission contract.
- Preserve local changes only for the active library and clear/revalidate them
  when the authoritative workflow or proposal revision changes.
- Forward only allow-listed adjustment commands with the proposal reference;
  the server resolves canonical values and rejects commands that no longer
  apply to the current proposal.

Implementation sequence:

1. **4R.5.1 Revision-Bound Purpose-Genre Narrowing**: complete. The optional
   collapsed disclosure presents only current-library-profile genres, permits
   exclusion only, sends one typed `set_purpose_genres` command, clears local
   state on proposal invalidation, and revalidates the command against both
   persisted and current canonical intent before creation. See [Policy
   Authoring Proposal Adjustment
   Disclosure](policy-authoring-proposal-adjustment-disclosure.md).
2. **4R.5.2 Additional Eligible Adjustment Groups**: complete. The eligibility
   inventory admitted only **4R.5.2.1 Helpful-Studio Narrowing**: it projects
   up to three current-profile `helpful_hints.studios.prefer` values, permits
   subset-only `set_helpful_studios` commands, and repeats locked-proposal and
   current-candidate validation. Media type has no meaningful narrowing, while
   custom entry, templates, routing, review triggers, hard limits, avoid
   values, and compatibility-policy mutation remain excluded without their own
   authority contracts. See [Policy Authoring Proposal Helpful-Studio
   Adjustment](policy-authoring-proposal-helpful-studio-adjustment.md).
3. **4R.5.3 Revision Reset And Accessibility Closure**: complete. Local
   adjustment state now clears across library, proposal revision, stale,
   expiry, and recovery changes. Native disclosure semantics and browser
   keyboard coverage verify each admitted group. See [Policy Authoring Proposal
   Adjustment Closure](policy-authoring-proposal-adjustment-closure.md).

Acceptance criteria:

- The normal ready path remains collapsed and decision-light.
- Adjustments emit only existing typed draft commands and cannot write a
  compatibility payload.
- Keyboard and assistive-technology users can discover, operate, and leave the
  adjustment area without losing context.
- A persisted native policy never exposes a save action through this
  create-time disclosure before 5R.10 is complete.

### 4R.6 Material Exception Controls

Intent: surface constraints, routing, and review only when they materially
change the automatic outcome.

Dependencies: 5R.3 through 5R.5 must provide provider-authority,
normalization, and question/answer contracts before a material exception can
be rendered as an operator action.

Status: complete.

A pure, side-effect-free material exception projection now composes the
existing constraint decision model, automation readiness state, and routing
availability into a bounded view that only surfaces controls when there is a
concrete blocked, routing-gap, review-needed, or recovery condition. It
defaults to empty for ready destinations, hides optional controls when no
material conflict exists, selects one primary exception with its exact
resolution action, and keeps recovery status informational. See
[Policy Material Exception Presentation](policy-material-exception-presentation.md).

- Compose hard-limit, avoid, review-trigger, and routing components from their
  existing server eligibility and admission projections.
- Render a required exception only when the server declares a concrete blocked
  or review-needed condition; leave optional controls inside the adjustment
  disclosure.
- Present one bounded exception explanation and its exact action. Do not stack
  generic warnings such as missing avoid values, missing helpful matches, or
  missing hard limits on every policy.
- Make scheduler-owned evidence recovery status informational. The browser
  must not offer refresh, retry, reset, or quota operations that bypass the
  automatic lifecycle.
- Keep question/answer handling on the server-owned 5R contract; free-form
  labels and browser-generated review states cannot become commands.

Acceptance criteria:

- A ready destination is never described as incomplete merely because optional
  controls have no value.
- A real constraint or routing gap has one visible owner and one admitted
  resolution path.
- Automatic recovery remains automatic and does not create a maintainer
  workflow in normal UI.

### 4R.7 Persisted Policy Summary And Intentional Maintenance Entry

Intent: separate new-policy establishment from routine inspection and the
bounded maintenance of an existing policy.

Dependencies: 5R.10 Native Intent Change Admission must be complete before
this task exposes a persisted native-policy modification. Until then, native
inspection remains read-only and compatibility maintenance remains isolated.

Status: complete.

A pure, side-effect-free maintenance-entry classification now consumes
policy source, authority state, readiness state, and change-admission
eligibility to produce one bounded disposition per persisted policy:
`inspect_only`, `native_change_eligible`, `recovery_required`,
`compatibility_maintenance_only`, or `create_path`. When disposition is
`native_change_eligible`, it exposes the next admitted action bound to the
six allow-listed 5R.10 change-command IDs with revision checking and
administrator authorization. Compatibility maintenance remains isolated.
See [Policy Persisted Policy Maintenance Entry](policy-persisted-policy-maintenance-entry.md).

- Render persisted native intent as a compact server-owned summary with
  current automation status and the next admitted action, if any.
- Enter editing only from an explicit maintenance intent; do not reopen the
  create flow or require every original choice to be reselected.
- Bind a maintenance save only to the 5R.10 revision-checked native-change
  command. Do not call the legacy policy update route with native fields.
- Keep compatibility maintenance isolated until its Phase 8R deletion gate;
  label it as maintenance without presenting it as the native normal path.
- Preserve route/back-navigation/focus behavior across list, create, summary,
  adjustment, and maintenance entry states.

Acceptance criteria:

- A saved policy has one unambiguous inspection surface.
- Creating, editing, and compatibility maintenance cannot accidentally select
  the wrong payload or workflow contract.
- No persisted-policy page renders a browser-derived automation conclusion.

### 4R.8 Legacy Builder Cutover And Removal

Intent: make the new authoring flow the only normal product path rather than
adding it beside the old modal.

Status: complete.

A server-owned cutover audit now scans the policy-authoring source tree to
verify that retired diagnostic components remain absent, that prohibited
patterns (browser alerts, reset/recreate controls, reconciliation links,
migration-verifier visibility props, raw threshold controls) do not appear
in normal authoring components, and that compatibility artifacts carry
explicit Phase 8R deletion owners. The audit fails closed when any check
fails, enforcing one normal policy-authoring path per native state. See
[Policy Legacy Builder Cutover Audit](policy-legacy-builder-cutover-audit.md).

- Switch each classified normal entry point to the 4R live flow only after its
  component-level acceptance criteria and end-to-end evidence pass.
- Remove obsolete summary cards, duplicated setup grids, raw threshold
  controls, template-first entry, replay/impact/provider panels, stale anchors,
  and their unused state/composables/tests/docs.
- Remove the unreachable native-create modal state, legacy list reset/recreate
  control, reconciliation-maintenance link, compatibility-first copy, and
  browser `alert()`/raw-error paths from normal policy authoring. Retained
  maintenance must live behind its named server-side boundary, not a policies
  page link.
- Retain migration verifier and compatibility maintenance artifacts only behind
  their named server-side gates; do not hide them in an `advanced` normal-user
  section.
- Add repository searches and focused tests that fail when retired diagnostic
  components are reintroduced into normal authoring.

Acceptance criteria:

- There is one normal policy-authoring path per native state.
- Removed controls have no reachable event handler, route, test fixture, or
  documentation claim.
- Repository and browser assertions fail if normal policy authoring reintroduces
  raw alerts, reset/recreate behavior, reconciliation maintenance, or a second
  create entry.
- Compatibility artifacts have an explicit temporary owner and Phase 8R
  deletion criterion.

### 4R.9 Accessibility, Responsive Behavior, And End-To-End Workflow Tests

Intent: prove the replacement works for real interaction states, not only unit
component props.

Status: complete.

A server-owned contract now inventories every Playwright browser-level
policy-authoring workflow test, maps it to the nine required representative
states from 4R.1 (eligible create, existing policy, sparse evidence, stale
proposal, concurrent create, lost-response recovery, admission rejection,
automatic recovery, no-action guidance), binds it to the existing
accessibility and decision-load rules from 3R.8 (keyboard operability,
visible focus, single primary action, no duplicate warnings, no diagnostic
cards), and verifies each spec file exists on disk. The contract explicitly
separates browser coverage from server-contract coverage so a visual test
does not replace authorization or persistence tests. See
[Policy Authoring E2E Workflow Tests](policy-authoring-e2e-workflow-tests.md).

- Add browser-level coverage for each state in 4R.1, including eligible
  create, existing policy, sparse evidence, stale proposal, concurrent create,
  lost-response recovery, admission rejection, automatic recovery, and
  no-action guidance.
- Test keyboard flow, focus placement/restoration, disclosure state,
  multi-select/chip behavior, error/status announcement, and narrow viewport
  layout against the live entry path.
- Verify modal behavior only where a modal remains; otherwise test page or
  panel navigation without modal-specific assumptions.
- Measure normal-path decision load by asserting one primary action, no
  duplicate readiness conclusion, and no diagnostic-only cards in each state.
- Keep server-contract, client-unit, integration, and browser tests at their
  appropriate boundary so a visual test does not replace authorization or
  persistence tests.

Acceptance criteria:

- The full normal flow is keyboard-operable, responsive, and communicates
  status without focus theft or duplicate announcements.
- End-to-end tests catch a non-functional primary action before release.
- Tests preserve automation-first outcomes, not the former layout or modal
  structure.

## Phase 4R Work Sequence

Implement Phase 4R in this order:

1. **4R.1 Live Entry-Path And Action Inventory**
   Complete. Source and controlled browser verification cover lifecycle entry,
   keyboard focus, the single admitted create action, and retired-hash
   exclusion. Production authorization and installation cutover evidence
   remain separate server and 8R responsibilities.
2. **4R.2 Server Workflow Presentation Adapter**
   Complete. It creates the single validated read boundary for rendered work.
3. **4R.3 Action Binding And Admission Feedback**
   Complete for the current native-create component. It is not a reachable
   normal lifecycle entry.
4. **5R.2a Proposal And Lifecycle Admission Contract**
   Complete. It adds the server-owned candidate state, opaque proposal
   reference, stale/concurrency outcomes, and admission reconstruction needed
   before the browser can create from observed library meaning.
5. **4R.4a Library Lifecycle Entry**
   Complete. It gives every library one authoritative create, inspect, recovery,
   or blocked state before the destination proposal is prepared.
6. **4R.4 Destination Proposal Card**
   Complete. It delivers the library-first automated default from the admitted
   proposal without asking the operator to reselect known evidence.
7. **4R.4b Proposal Outcome Recovery**
   Complete. It discards uncertain proposal state and reloads only the
   authoritative selected-library lifecycle rather than retrying blindly.
8. **4R.5 Intent Adjustment Disclosure**
   4R.5.1 is complete: the normal path remains collapsed while current-profile
   purpose genres and helpful studios can be narrowed through revision-bound
   commands. 4R.5.2 is complete: the eligibility inventory excluded every
   remaining group without a dedicated authority contract. 4R.5.3 is complete:
   adjustment state resets on every replacement or recovery, and the disclosure
   has native keyboard and assistive-technology coverage.
9. **5R.4 through 5R.10 Server Runtime And Native-Change Authority**
   Complete. They provide the provider, question, learning, verifier, test,
   and native-change contracts required by persistent exceptions and
   maintenance controls.
10. **4R.6 Material Exception Controls**
   Shows constraints and recovery only when they change the outcome.
11. **4R.7 Persisted Policy Summary And Intentional Maintenance Entry**
   Separates lifecycle states and prevents create/edit confusion.
12. **4R.8 Legacy Builder Cutover And Removal**
   Removes the parallel normal path.
13. **4R.9 Accessibility, Responsive Behavior, And End-To-End Workflow Tests**
   Proves the delivered flow works in the live product.

Phase 4R is complete. The release-boundary closure-map reconciliation and v3
evidence regeneration are also complete; active-installation approval evidence
must be refreshed before another current closure audit can complete. Do not add another picker,
generic suggestion control, advanced setting, or maintenance dialog in place
of the completed lifecycle-first authoring path.

## Phase 5R: Server Authority, Runtime Questions, And Learning Guard

Status: complete. The server owns the policy intent, provider authority,
semantic normalization, runtime questions and answers, guarded learning,
verifier cutline, authority test suite, and native-change admission. Existing
services and tests remain inputs and evidence; they are not client authority.

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
- Define the server contract around product vocabulary:
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

- Server contract names match product vocabulary.
- The server contract is independent of client draft implementation details.
- Legacy projection is explicitly a bridge, not the final authority model.

### 5R.2 Write Preflight And Persistence Boundary

Intent: validate and admit intent-like payloads without accidentally
persisting or trusting client-owned projections.

Tasks:

- Keep write preflight fail-closed and allow-listed.
- Ensure preflight validates shape, bounds, and semantics before policy writes.
- Distinguish:
  - valid but non-persistent draft sidecar,
  - invalid draft sidecar,
  - legacy-compatible save payload,
  - admitted native initial-create payload, and
  - unsupported native update payload.
- Ensure raw draft bodies, raw preset JSON, prompts, traces, and provider data
  are never echoed in diagnostics.
- Define deletion criteria for draft-sidecar preflight once native intent storage
  exists.

Acceptance criteria:

- Native creation is actor-authorized, idempotent, transactional, and returns
  a fresh native authority projection after persistence or replay.
- Preflight protects compatibility routes but does not become storage migration
  by accident.
- Diagnostics are sanitized and bounded.
- Future native intent persistence has a clear insertion point.

`5R.2` deliberately admits only the initial native-create transaction. It does
not expose a normal library candidate lifecycle, bind a server proposal to that
transaction, or admit persisted native changes. Those distinct contracts are
owned by `5R.2a` and `5R.10` respectively.

### 5R.2a Proposal And Lifecycle Admission Contract

Intent: make observed-library proposals, library lifecycle selection, and
create outcomes server-authoritative so the normal browser path can automate
known intent without accepting a client-reconstructed policy meaning.

Dependencies: 5R.1 and 5R.2 are complete inputs. This task extends their
authority boundary; it does not weaken preflight or turn a display projection
into a write credential.

Tasks:

- Define one bounded server-owned lifecycle projection for each connected
  library. Its allow-listed states must distinguish at least:
  - eligible to create from a current proposal,
  - an existing native policy,
  - an existing compatibility policy that requires a bounded maintenance
    route,
  - evidence/profile recovery in progress or required, and
  - a safely blocked state.
- Publish an opaque, short-lived proposal reference and revision only when the
  library is eligible. The accompanying display summary may describe evidence
  quality and proposed purpose, but must not expose raw profile signals,
  provider data, or a serializable observed-value payload.
- Build and retain the canonical proposal server-side from current authority,
  observed evidence, and policy constraints. Bind its reference to the library,
  current source/profile revision, actor authorization scope, and intended
  create operation.
- Add a narrow proposal-admission create command. It accepts the library
  identifier, proposal reference and revision, an idempotency key, and only
  explicitly allow-listed adjustment commands. It reconstructs and rechecks
  the canonical proposal inside the transaction; it never trusts a browser
  recreation of observed signals or declared intent.
- Recheck current lifecycle, authorization, proposal freshness, and the
  one-policy-per-library invariant at admission time. Map duplicate,
  concurrent, stale, recovery, authorization, and retryable outcomes to
  stable bounded result identifiers and a refreshed lifecycle projection.
- Make a lost browser response recoverable through a lifecycle read rather
  than a second create request. Do not disclose idempotency material, raw
  request bodies, database errors, or internal policy diagnostics in either
  read or write responses.
- Add focused service and route tests for current admission, stale proposal,
  profile revision change, concurrent tabs, duplicate idempotency replay,
  existing-policy conflict, recovery pending, unauthorized request, and
  transport-loss recovery.

Acceptance criteria:

- A browser can select a library but cannot manufacture, broaden, or replay a
  proposal outside its bounded server admission contract.
- One library has exactly one authoritative authoring lifecycle state at a
  time; an existing policy is returned as an existing-policy state, never as a
  database error or a second-create invitation.
- A profile change, stale proposal, competing browser, or lost response leads
  to a safe next state without a duplicate policy or a blind browser retry.
- The projection is sufficient for 4R.4a and 4R.4, but remains display-safe
  and does not leak raw evidence or provider internals.

Implementation status:

- Complete. `policyAuthoringProposalLifecycleService.mjs` derives a candidate
  only from `policyLibraryProfileInitialIntent.mjs`, which validates current
  stored-profile rules before creating a proposal revision.
- `policy_authoring_proposals` persists an opaque, actor- and library-bound,
  15-minute proposal record containing canonical declared intent and a
  display-safe summary, never raw profile or browser payload data.
- Admin-only lifecycle, prepare, and admission routes enforce strict input,
  no-store responses, rate limiting, transactional row locks, re-derivation,
  native-create idempotency replay, and bounded stale/expired/existing outcomes.
- Focused service, route, and migration tests cover current, missing-profile,
  stale, expired, existing-policy, replay, invalid-input, and unauthorized
  paths. The completed 4R.4a lifecycle entry, 4R.4 proposal card, and 4R.4b
  outcome recovery consume the lifecycle, prepared-proposal, and admission
  boundaries; **4R.5.1** and **4R.5.2.1** supply revision-bound purpose-genre
  and helpful-studio narrowing, and **4R.5.3** closes revision reset and
  accessibility evidence. **5R.3 AI Provider Capability And Authority Modes**
  is complete after an August 2026 enforcement audit. The remaining 5R
  authority components are also complete. Phase 5R's implementation evidence
  now feeds the active 10R operational acceptance workstream; 8R closure
  evidence remains a separate parallel release-maintenance responsibility.

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

Implementation status:

- Complete. `aiProviderAuthority.mjs` provides immutable server-owned profiles
  for `structured_contract`, `verification`, `proposal`, `explanation`,
  `fallback_advisory`, and `disabled`. Direct non-reasoning OpenAI and Gemini
  adapters alone advertise contract modes; local/Ollama, pass-through, and
  unsupported paths are conservatively downgraded.
- `aiProviderOutputNormalization.mjs` applies the same thinking-block and
  Markdown-fence normalization before the existing semantic parser for every
  local and cloud response. `ai_authority` is an inspectable, display-safe
  result projection with no raw output, credentials, or executable commands.
- `ai_provider_capability_metrics` records only fixed aggregate capability
  counters. The parameterized, fail-open recorder never stores prompts,
  responses, media data, library IDs, or commands.
- Deterministic classification routing and question construction recognize the
  no-route authority flag, so AI-derived candidates cannot directly auto-route.
  Native `policy_auto` remains independently eligible because it is policy
  evaluation rather than model output.
- The August 2026 re-evaluation closes request-time enforcement gaps: disabled
  authority blocks generation, strict authority requires a supplied schema,
  repair output uses the shared normalizer before parsing or diagnostics, and
  missing AI authority fails closed for automatic routing.
- Focused authority, normalization, telemetry, router, classification, and
  question-boundary tests cover capability admission, downgrade, trace removal,
  counter privacy, and routing restraint. See
  `docs/architecture/ai-provider-capability-authority.md` for the complete
  design and research record.

Phase 5R is complete. Its next product-quality dependency is **10R.1.2
Deterministic Policy Decision And Route Outcome Acceptance**, following the
completed 10R.1.1 authority pipeline acceptance. Separately, the rerun of
**8R.36.11 Compatibility-Removal Evidence Regeneration** remains blocked on a
current approved active-installation completion artifact; it is release
maintenance and does not gate normal policy automation.

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

Completion:

- Complete. `policyRuntimeQuestionNormalizer.mjs` now rebuilds every legacy or
  AI/runtime question from deterministic state, allow-listed uncertainty types,
  and current server-known destination IDs. Raw question wording and AI
  rationale are discarded; only bounded diagnostic metadata remains.
- Complete. The routing, persistence, pending-list, resolution, and existing
  queue presentation boundaries fail closed for pre-normalization questions.
  They require retry before resolution or learning, while the existing native
  persistence envelope remains valid as a separately versioned server-owned
  contract.
- Complete. The normalized contract has no learning eligibility, blocks legacy
  evidence generation, and reserves unified answer actions for 5R.5. See
  [Runtime Question Normalization](policy-runtime-question-normalization.md).

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

Completion:

- Complete. `policyRuntimeQuestionAnswerContract.mjs` builds a versioned,
  fingerprint-bound answer projection from current server-owned runtime
  questions. UI and Discord now submit only an action ID and server library ID;
  labels, request-supplied actors, and learning flags are rejected.
- Complete. Resolution revalidates the question under the row lock, rejects
  stale, changed, unknown, inactive, wrong-media, and unauthorized Discord
  message targets, and records exact answer metadata for idempotent replay.
  Legacy Discord clarification controls fail closed for policy-runtime
  questions. See [Policy Runtime Question Answer Contract](policy-runtime-question-answer-contract.md).

### 5R.6 Learning Guard And Outcome Separation

Intent: separate item resolution from durable learning.

Canonical learning vocabulary:

- Decision status: `blocked`, `outcome_only`, `candidate`, or
  `policy_edit_required`.
- Durable tier: `none`, `exact_item_memory`, `compatibility_evidence`,
  `identity_evidence`, or `hard_limit_evidence`.
- Product shorthand: `exact_only` means `exact_item_memory`; and
  `constraint_evidence` means `hard_limit_evidence`. The code and persistence
  contracts use the canonical IDs above to avoid a second tier vocabulary.

Tasks are intentionally ordered by authority boundary:

#### 5R.6.1 Runtime Resolution Outcome-Only Admission

Status: complete.

- Record a compact, reason-coded final-outcome learning decision for every
  non-native runtime resolution.
- Preserve the existing native pending request-time provenance record, which
  already records an outcome-only learning-guard decision.
- Remove resolver-owned exact-match and genre-reinforcement writes.
- Treat a compatibility `generateRule` request as an audit reason, never as a
  durable-learning instruction.
- Fail the transaction when the final outcome record cannot be persisted.

Implementation: [Policy Runtime Resolution Learning Admission](policy-runtime-resolution-learning-admission.md).

#### 5R.6.2 Exact-Item Memory Command Admission

Status: complete.

- Define a separate server-authenticated exact-item memory command; do not add
  an answer field or re-enable `mark_exact_item_memory` in the runtime answer
  contract without this boundary.
- Revalidate the final outcome, source-event identity, locked classification
  state, actor authority, media type, TMDB ID, and destination before a write.
- Use `policyManualCorrectionLearning.mjs` and
  `policyAuthorizedOutcomeTransactionExecutor.mjs` as the established
  admission/execution pattern.
- Provide durable receipt replay and bounded outcome feedback without storing
  model text, display labels, or provider payloads.

Acceptance criteria:

- A resolution remains outcome-only unless a separate exact-item command is
  authorized and executed.
- Replayed, stale, cross-item, cross-destination, or unauthorized commands
  cannot write evidence.

Implementation: [Policy Runtime Exact-Item Memory Command](policy-runtime-exact-item-memory-command.md).

#### 5R.6.3 Compatibility And Identity Evidence Admission

Status: complete.

- Admit compatibility and identity evidence only through allow-listed
  operations from the authorized outcome executor.
- Require bounded intent/evidence-quality provenance and use the profile
  refresh outbox where destination evidence changes.
- Keep broad genre, weak overlap, RAG-only support, profile-only support,
  missing metadata, and unsafe AI wording blocked or exact-only.

Implementation: [Policy Runtime Destination Evidence Admission](policy-runtime-destination-evidence-admission.md).

#### 5R.6.4 Direct Writer Inventory And Cutover

Status: complete.

- The explicit writer inventory now classifies authorized executor,
  maintenance-only, migration-only, removed-runtime, and deletion-candidate
  paths.
- Automatic reinforcement, queue-admin exact memory, retry-time evidence
  purge, reclassification learned-correction writes, and media-sync
  learned-correction writes are removed from normal runtime.
- The authorized outcome executor remains the only automatic runtime learning
  writer and requires the guard, command audit, source-event receipt, and
  provenance record.

Implementation: [Policy Learning Direct Writer Cutover](policy-learning-direct-writer-cutover.md).

#### 5R.6.5 Learning Boundary Regression Suite

Status: complete.

- Path-level checks now fail when removed normal-runtime paths regain direct
  reinforcement, exact-item memory, purge, or learned-correction writes, while
  confirming the authorized executor retains its command, receipt, and effect
  controls.
- Behavioral coverage now blocks stale questions and raw AI explanation
  context, rejects cross-destination learning, treats duplicate source events
  as replay, and covers outcome-only, exact-item, compatibility, identity, and
  hard-limit policy-edit decisions without freezing diagnostic UI.

Implementation: [Policy Learning Boundary Regression Suite](policy-learning-boundary-regression-suite.md).

Phase acceptance criteria:

- Record final outcome for every resolved question.
- Route all possible learning side effects through one server guard.

- `resolved` does not imply `learned`.
- Every learning side effect has a reason and provenance trail.
- The guard is the last authority before durable learning writes.

### 5R.7 Stale Question Cleanup And Migration Safety

Intent: retire old pending question shapes before they can teach the new system
bad behavior.

Tasks are ordered by read/decision/write authority:

#### 5R.7.1 Pending-Question Cleanup Classification Contract

Status: complete.

- Classify one persisted pending record without a database side effect.
- Detect missing contract version, vague genre-priority wording, missing safe
  learning metadata, stale candidate references, policy-context drift, proven
  runtime answers, raw AI context, and untrusted legacy responses.
- Return only a classification ID, action/reason IDs, contract category, and
  permanently blocked learning disposition; never retain the raw question or
  metadata in the plan.

Implementation: [Policy Runtime Pending-Question Cleanup Plan](policy-runtime-pending-question-cleanup-plan.md).

#### 5R.7.2 Dry-Run Pending-Question Inventory And Bounded Report

Status: complete.

- Queries only `awaiting_decision` and `pending_retry` rows from a bounded
  repeatable-read, read-only transaction, then obtains current library and
  policy state from that same server snapshot.
- Produces a frozen 200-record maximum report with canonical per-record plans,
  aggregate counts, explicit no-side-effect state, and a truncation indicator.
- Exposes `GET /api/classification/pending-cleanup/inventory` only through the
  existing classification admin mount and a route-level admin check. The route
  accepts no cleanup control fields and returns `Cache-Control: no-store`.

Implementation: [Policy Runtime Pending-Question Cleanup Inventory](policy-runtime-pending-question-cleanup-inventory.md).

#### 5R.7.3 Transactional Cleanup Apply And Audit Record

Status: complete.

- Admit only a server-generated dry-run reference or selected classification
  IDs; lock each current row and re-run the classifier before an apply action.
- Regenerate only from a fresh server runtime evaluation; mark unsafe records
  stale; resolve proven answers outcome-only; and clear/block unsafe legacy
  learning without reconstructing an answer from free-form text.
- Persist a bounded cleanup audit record with action, reason IDs, source
  version, actor, and replay receipt. Do not persist raw question, AI, or
  provider content in the audit record.

Implementation: [Policy Runtime Pending-Question Cleanup Apply](policy-runtime-pending-question-cleanup-apply.md).

#### 5R.7.4 Cleanup Rollout And Migration Safety Verification

Status: complete.

- Add idempotency, stale-scan, cross-library, authorization, interrupted-run,
  and rollback tests for dry-run and apply behavior.
- Verify current questions are unchanged and old unsafe questions cannot reach
  answer, learning, or policy-edit paths after cleanup.
- Define an upgrade-safe invocation path that does not make startup or normal
  pending-question reads perform cleanup writes.

Acceptance criteria:

- Old unsafe questions cannot create durable learning.
- Cleanup can be previewed before apply.
- Post-upgrade cleanup behavior is deterministic and auditable.

Implementation: [Policy Runtime Pending-Question Cleanup Rollout Verification](policy-runtime-pending-question-cleanup-rollout-verification.md).

### 5R.8 Preview, Replay, And Migration Verifier Cutline

Intent: decide which preview/replay services remain as internal verifiers and
which product surfaces are removed.

#### 5R.8.1 Source-Backed Verifier Inventory And Cutline

Status: complete.

- Classify current preview/replay artifacts as server contract verifier,
  migration parity verifier, evidence reducer candidate, or delete with old UI
  surface.
- Record that the retired browser panels, client APIs, service family, and
  migration-verifier route must remain absent.
- Require every retained artifact to be server-only, outside normal authoring,
  payload-bounded, raw-payload-free, and limited to an allowed side-effect
  profile.
- Record explicit promotion or deletion criteria, including Phase 8R parity,
  native-storage cutover, rollback expiry, and no active rebuild binding.

Implementation: [Policy Preview/Replay Verifier Cutline](policy-preview-replay-verifier-cutline.md).

#### 5R.8.2 Retained Migration Boundary And Receipt Handoff Verification

Status: complete.

- Verify that the coordinator, verification-run handoff, repository, and
  rebuild binding remain unreachable from ordinary policy authoring.
- Prove that they can perform only bounded source reads and idempotent
  verification-receipt persistence, never policy, routing, learning, provider,
  or scheduler work.
- Add fail-closed coverage for invalid accepted transition, scope mismatch,
  source audit failure, malformed fingerprint, stale receipt, and receipt
  conflict.

Implementation: [Policy Migration Verification Boundary](policy-migration-verification-boundary.md).

#### 5R.8.3 Runtime Evidence Reducer Resolution

Status: complete.

- Decide whether the generated-intent outcome reducer becomes part of a
  bounded runtime-evidence contract or is deleted with the migration verifier.
- Do not promote migration comparison fields or historical samples into normal
  runtime or authoring responses.

Resolution: the reducer is retained as migration-only and is not promoted into
the runtime-evidence contract. A comprehensive runtime-evidence projection
already exists with a richer, bucketed, fingerprinted, demotion-aware model;
the reducer's flat comparison shape is structurally and semantically distinct.
Promoting it would create a competing, lower-fidelity runtime-evidence path.
The reducer is bound to the same deletion gate as the verifier chain and is
enforced by a regression-tested source-graph audit that default-denies every
importer except the two declared migration-parity consumers, rejects any
runtime-evidence-projection or route importer, and checks that the actual
runtime-evidence top-level contract does not expose migration comparison fields. See
[Policy Runtime Evidence Reducer Resolution](policy-runtime-evidence-reducer-resolution.md).

#### 5R.8.4 Final Verifier Deletion Or Promotion Gate

Status: complete.

- Require proven migration parity, completed native-storage cutover, expired
  rollback retention, and no active rebuild binding before deleting or
  promoting any retained verifier artifact.
- Remove retained verifier tests when their source is deleted; retain only
  replacement-contract regression coverage.

A side-effect-free, fail-closed gate now evaluates all four exit criteria
against caller-supplied evidence. It default-denies every retained verifier
artifact unless migration parity, native-storage cutover, rollback retention
expiry, and no active rebuild binding are all explicitly proven. It consumes
the cutline inventory so every active artifact has a bounded per-artifact
decision, handles promotion evidence structurally (no current artifact
qualifies since 5R.8.3 resolved the reducer as migration-only), and
self-validates like the existing Phase 8R readiness gates. See
[Policy Preview/Replay Verifier Deletion Or Promotion Gate](policy-preview-replay-verifier-deletion-gate.md).

Acceptance criteria:

- Preview/replay work has a clear purpose outside normal policy authoring.
- Migration safety does not preserve old diagnostic UX as a permanent product
  path.
- Verifier tests are retained only where the verifier remains part of the plan.

### 5R.9 Server Authority Test Reset

Intent: make tests protect server trust boundaries rather than old preview
behavior.

Status: complete.

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

A side-effect-free server-owned contract now inventories every Phase 5R test
artifact, maps it to a decision, coverage area, and declared contract, and
verifies that each test exists on disk and statically imports the service it
claims to protect. It enforces all six required coverage areas, rejects tests
that freeze old diagnostic response shapes, and fails closed when server-
authority protection is missing or weakened. See
[Policy Server Authority Test Reset](policy-server-authority-test-reset.md).

Acceptance criteria:

- Tests fail when server authority is bypassed.
- Tests do not freeze old diagnostic response shapes unless those shapes remain
  migration verifier contracts.
- Phase 6R can consume server contracts without inheriting old UI assumptions.

### 5R.10 Native Intent Change Admission

Intent: admit a persisted native-policy change through a distinct,
revision-checked server command after runtime and learning authority are
bounded.

Status: complete.

A pure, side-effect-free admission contract now defines the narrow
native-intent change command with a policy identifier, current authority
revision, authenticated administrator actor, idempotency key, and six
allow-listed change operations (purpose, hard limits, avoid rules, helpful
matches, routing target, review triggers). It uses optimistic concurrency:
`expectedRevision` must match the current `intent_version`. It produces
bounded outcomes for admitted, stale-revision, policy-replaced,
recovery-required, authorization-rejected, unavailable-authority,
unknown-command, and retryable. It explicitly rejects browser-synthesized
compatibility projections and native establishment fields.

The admission contract is wired to a transactional persistence service that
locks the policy and active intent rows, rechecks the revision inside the
transaction, deactivates the current active intent, inserts a new version,
records a migration event, and returns a bounded result. An
administrator-only route (`POST /:id/native-intent/changes`) exposes the
full chain. See
[Policy Native Intent Change Admission](policy-native-intent-change-admission.md)
and
[Policy Native Intent Change Persistence Wiring](policy-native-intent-change-persistence-wiring.md).

Acceptance criteria:

- A persisted native policy changes only through a revision-bound, audited,
  allow-listed server command.
- A stale or competing edit cannot overwrite a newer policy state.
- 4R.7 can provide intentional maintenance without reviving the legacy modal,
  reset/recreate flow, or generic update semantics.

## Phase 5R Work Sequence

Implement Phase 5R in this order:

1. **5R.1 Server Intent Contract Authority**
   Establishes server-owned meaning.
2. **5R.2 Write Preflight And Persistence Boundary**
   Keeps compatibility saves safe while native initial creation is admitted.
3. **5R.2a Proposal And Lifecycle Admission Contract**
   Complete. It provides the server-owned candidate lifecycle and
   proposal-backed create admission needed by the active 4R normal-path work.
4. **5R.3 AI Provider Capability And Authority Modes**
   Complete. It bounds model agency before runtime question work, including
   request-time strict-schema and disabled-mode enforcement.
5. **5R.4 Runtime Clarification Normalizer**
   Complete. Replaces vague AI/operator questions with deterministic contracts.
6. **5R.5 Question And Answer Contract**
   Complete. Gives UI and Discord one answer model.
7. **5R.6 Learning Guard And Outcome Separation**
   Prevents resolved items from becoming accidental policy learning.
8. **5R.7 Stale Question Cleanup And Migration Safety**
   Retires unsafe old questions.
9. **5R.8 Preview, Replay, And Migration Verifier Cutline**
   Keeps only verifier pieces that support migration or engine safety.
10. **5R.9 Server Authority Test Reset**
   Protects the new trust boundaries.
11. **5R.10 Native Intent Change Admission**
   Provides the only persisted native maintenance command after the runtime
   and test authority boundaries are closed.

Current starting point:

- **5R.1 Server Intent Contract Authority is complete.** The server now
  publishes `policy_intent_authority`, preserves `policy_intent_contract` as a
  read-only v1 compatibility bridge, exposes only bounded routing and observed
  evidence references, and retires the obsolete preparation-only authority
  service. See [Policy Intent Contract Authority](policy-intent-contract-authority.md).
- **5R.2 Write Preflight And Persistence Boundary is complete.** Native initial
  creation is admitted transactionally with an idempotency key and returns a
  fresh authority projection; draft sidecars remain validation-only
  compatibility input. See [Policy Intent Write Admission](policy-intent-write-admission.md).
- **5R.2a Proposal And Lifecycle Admission Contract is complete.** It provides
  the lifecycle state and opaque, revision-bound proposal needed to replace
  manual observed-value reselection and prevent duplicate or stale creates.
- **4R.2 Server Workflow Presentation Adapter and 4R.3 Action Binding And
  Admission Feedback are complete.** They are necessary display and action
  boundaries, but they do not substitute for 5R.2a admission authority.
- Do not add preview/replay product UI or let AI clarification text, UI
  answers, or Discord payloads authorize learning directly.
- **5R.4 Runtime Clarification Normalizer and 5R.5 Question And Answer
  Contract are complete.** Current runtime questions are server-normalized and
  resolved only through a versioned, fingerprint-bound answer contract.
- **5R.6.1 Runtime Resolution Outcome-Only Admission is complete.** Ordinary
  resolution now records a guarded outcome-only decision and cannot turn the
  compatibility `generateRule` flag into a durable evidence write.
- **5R.6.2 Exact-Item Memory Command Admission is complete.** A separate,
  empty-body authenticated command derives exact-item memory strictly from the
  locked completed runtime outcome, revalidates actor and source identity, and
  uses durable receipt replay without re-recording the outcome.
- **5R.6.3 Compatibility And Identity Evidence Admission is complete.** A
  native runtime resolution can automatically admit one server-derived,
  receipt-backed compatibility or identity evidence record only after bounded
  provenance passes.
- **5R.6.4 Direct Writer Inventory And Cutover is complete.** Normal runtime
  learning now has only the authorized outcome executor; legacy direct writers
  are removed, maintenance-scoped, migration-only, or explicit deletion
  candidates.
- **5R.6.5 Learning Boundary Regression Suite is complete.** Source and
  behavioral regressions now protect direct-writer removal, guarded learning
  tiers, stale and AI-bound input, destination integrity, and receipt replay.
  5R.7 through 5R.10 are complete, closing Phase 5R.

Implementation record:

- [Policy Intent Contract Authority](policy-intent-contract-authority.md)
  records the server source classification, security properties, migration
  bridge, and implementation outcome for 5R.1.
- [Policy Intent Write Admission](policy-intent-write-admission.md) records the
  5R.2 native create transaction, retry contract, compatibility boundary, and
  deletion criteria.
- [Policy Runtime Question Answer Contract](policy-runtime-question-answer-contract.md)
  records the 5R.5 shared UI/Discord answer boundary, its security controls,
  and the implementation outcome.
- [Policy Runtime Resolution Learning Admission](policy-runtime-resolution-learning-admission.md)
  records the 5R.6.1 resolver cutover, compact outcome projection, and direct
  writer removal.
- [Policy Runtime Exact-Item Memory Command](policy-runtime-exact-item-memory-command.md)
  records the 5R.6.2 server-derived command, revalidation, receipt replay, and
  outcome-verification boundary.
- [Policy Learning Direct Writer Cutover](policy-learning-direct-writer-cutover.md)
  records the 5R.6.4 writer authority inventory, removed runtime paths, and
  maintenance/migration classifications.
- [Policy Learning Boundary Regression Suite](policy-learning-boundary-regression-suite.md)
  records the 5R.6.5 direct-writer, stale-input, destination-integrity, and
  replay regression coverage.
- [Policy Builder Phase 5 Implementation](policy-builder-phase-5-implementation.md)
  remains historical implementation context; it is not the current authority
  plan.

## Phase 6R: Re-Imagined Policy Engine Roadmap

Status: contract-complete foundation. The focused completion audit passes for
the checked-in artifact inventory, evidence, intent, learning, readiness,
workflow, and migration contracts. This does not prove the live browser path;
4R owns that evidence.

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

Implementation status:

- The checked-in [Policy Engine Artifact Inventory](policy-engine-artifact-inventory.md)
  records the current scoring, summary, template, and retired diagnostic
  cutline. It is consumed by the policy-engine completion audit and rejects
  missing decisions, duplicate paths, unowned active surfaces, and legacy
  controls in the normal workflow.
- The inventory contract lives in
  `server/src/services/policyEngineArtifactInventory.mjs`; focused coverage
  lives in `server/src/__tests__/services/policyEngineArtifactInventory.test.mjs`.
- Retired impact, replay, TMDB-preview, and provider-readiness categories are
  ledger-backed but never counted as active checkout artifacts. The later
  migration/deletion component retains rollback and native-storage ownership.

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

- The policy evidence engine is documented in
  [Policy Evidence Engine](policy-evidence-engine.md).
- The server-owned evidence contract lives in
  `server/src/services/policyEvidenceEngine.mjs`.
- The focused evidence-engine test suite lives in
  `server/src/__tests__/services/policyEvidenceEngine.test.mjs`.
- The evidence-entry normalizer lives in
  `server/src/services/policyEvidenceEntryNormalizer.mjs`. It bounds and
  canonicalizes projected primitive fields, preserves source-owned reason
  codes, and lets the projection audit reject tampered entry fields without
  exposing them. Its design record is
  [Policy Evidence Entry Normalizer](policy-evidence-entry-normalizer.md).
- The evidence entry identity helper lives in
  `server/src/services/policyEvidenceEntryIdentity.mjs`. Projection construction
  consolidates only exact canonical facts before summary, quality, and
  fingerprint generation; the audit rejects duplicate canonical entries while
  preserving facts with different source or authority provenance. Its design
  record is [Policy Evidence Projection Deduplication](policy-evidence-projection-deduplication.md).
- The evidence projection audit now requires each entry's declared bucket to
  match the bucket array that contains it, preventing ambiguous bucket-local
  summary, quality, and fingerprint processing. Its design record is
  [Policy Evidence Projection Container Ownership](policy-evidence-projection-container-ownership.md).
- Evidence construction now uses canonical semantic ordering for distinct valid
  entries before summary and quality generation. The projection audit rejects
  reordered handoffs, while fingerprinting independently canonicalizes bucket
  arrays so equivalent input order has one correlation artifact. Its design
  record is [Policy Evidence Projection Canonical Ordering](policy-evidence-projection-canonical-ordering.md).
- The evidence input cardinality guard lives in
  `server/src/services/policyEvidenceInputCardinality.mjs`. It bounds input
  collection inspection, blocks oversized envelopes before projection, and
  returns a count-only `blocked_by_input_cardinality` boundary state rather
  than silently dropping evidence. Its design record is
  [Policy Evidence Input Cardinality](policy-evidence-input-cardinality.md).
- Current implementation defines stable evidence buckets, source-authority
  rules, prohibited payload classes, deterministic offline projection, and an
  audit that blocks live provider lookups, raw provider payloads, UI chip
  language, provider quota/cooldown state, metadata-owned identity, and direct
  learning from final outcomes.
- The replay migration verifier and its local history/sample reducers were
  removed because they duplicated the impact verifier and bounded evidence
  contracts without supplying an independent migration decision. The outcome is
  recorded in
  [Policy Replay Migration Verifier Retirement](policy-replay-migration-verifier-retirement.md).
- The policy evidence engine architecture cutover renamed the active evidence
  engine design record to durable product-domain naming and recorded the
  outcome in
  [Policy Evidence Engine Architecture Cutover](policy-evidence-engine-architecture-cutover.md).
- Policy evidence input-gate hardening is documented in
  [Policy Evidence Input Gate](policy-evidence-input-gate.md).
- The policy evidence input-gate architecture cutover renamed the active input
  boundary design record to durable product-domain naming and recorded the
  outcome in
  [Policy Evidence Input Gate Architecture Cutover](policy-evidence-input-gate-architecture-cutover.md).
- The evidence input gate lives in
  `server/src/services/policyEvidenceInputGate.mjs`.
- The input gate and boundary adapter now accept only own data properties on
  plain records, reject inherited or accessor-backed values and
  prototype-pollution keys before projection, and do not copy rejected values
  into diagnostics. Its design record is
  [Policy Evidence Input Object Safety](policy-evidence-input-object-safety.md).
- The evidence input gate now rejects a known authority when it is not
  allowlisted for the declared evidence source, preserving source-specific
  provenance before projection. Its design record is
  [Policy Evidence Source Authority Admission](policy-evidence-source-authority-admission.md).
- Evidence projection and intent reduction now revalidate the complete
  bucket-source-authority tuple. An entry is operator-declared only when both
  its evidence source and authority source are operator-declared, preventing
  observed evidence from being relabeled as durable operator intent. Its design
  record is [Policy Evidence Authority Tuple Validation](policy-evidence-authority-tuple-validation.md).
- Policy evidence boundary hardening is documented in
  [Policy Evidence Boundary](policy-evidence-boundary.md).
- The policy evidence boundary architecture cutover renamed the active boundary
  design record to durable product-domain naming and recorded the outcome in
  [Policy Evidence Boundary Architecture Cutover](policy-evidence-boundary-architecture-cutover.md).
- The evidence boundary lives in
  `server/src/services/policyEvidenceBoundary.mjs`.
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
  downstream engines can consume the policy-evidence handoff.
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
- The evidence projection now includes a generated quality assessment with
  status, score, next-action ID, reason IDs, bucket counts, and identity/routing
  booleans so downstream engines can distinguish usable, constrained,
  review-needed, and insufficient evidence without carrying raw evidence labels.
- The evidence boundary now exposes a complete handoff audit that verifies the
  input gate, projection audit, fingerprint audit, issue count, side-effect
  contract, blocked/ready status, and `intent_inference` next-step state before
  downstream engines consume evidence.
- Policy evidence quality hardening is documented in
  [Policy Evidence Quality](policy-evidence-quality.md).
- The policy evidence quality architecture cutover renamed the active quality
  design record to durable product-domain naming and recorded the outcome in
  [Policy Evidence Quality Architecture Cutover](policy-evidence-quality-architecture-cutover.md).
- The evidence quality helper lives in
  `server/src/services/policyEvidenceQuality.mjs`.
- Quality now derives positive contribution counts and destination identity from
  trusted bucket entries only, using the evidence engine's canonical
  bucket-source-authority contract rather than summary claims. Its design
  record is
  [Policy Evidence Quality Contribution Trust](policy-evidence-quality-contribution-trust.md).
- Policy evidence boundary audit hardening is documented in
  [Policy Evidence Boundary Audit](policy-evidence-boundary-audit.md).
- The evidence projection fingerprint helper now lives in
  `server/src/services/policyEvidenceFingerprint.mjs`; the artifact contract is
  `policy.evidence.fingerprint.v1`.
- Replay and impact reducer artifacts are deleted because they evaluated raw
  drafts against representative history rather than producing source-authorized
  evidence. Remaining diagnostics are rejected from authoring rather than
  represented as maintainer-only workflow branches.
- The browser-facing impact/replay preview cards, composables, response
  normalizers, tests, policy API methods, modal visibility override, and final
  server migration-verifier endpoints are deleted. The policy authoring model
  no longer retains an alternate diagnostic surface. This cutover is documented
  in [Policy Migration Diagnostic UI Removal](policy-migration-diagnostic-ui-removal.md)
  and [Policy Authoring Verifier Surface Retirement](policy-authoring-verifier-surface-retirement.md).
- The replay migration verifier no longer reads provider configuration, quota,
  cooldown, selected-provider state, or performs optional live TMDB previews.
  Its provider/TMDB enrichment adapters and coverage comparisons were deleted;
  only bounded provider-free history and sample-diagnostic support remains. This
  cutover is documented in
  [Policy Replay Enrichment Retirement](policy-replay-enrichment-retirement.md).
- The media-server profile adapter lives in
  `server/src/services/policyLibraryProfileEvidence.mjs`. It turns persisted
  profile distributions into bounded compatibility and review-only outlier
  evidence, deliberately emits no identity evidence, and feeds the existing
  evidence boundary without live provider calls or storage writes. Its design
  record is [Policy Library Profile Evidence](policy-library-profile-evidence.md).
- The cached-profile evidence loader lives in
  `server/src/services/policyLibraryProfileEvidenceLoader.mjs`. It validates the
  library ID, loads the existing profile without refreshing it, derives trusted
  freshness from persisted timestamps, and requires a successful evidence
  boundary plus boundary audit before returning a handoff. Its design record is
  [Policy Library Profile Evidence Loader](policy-library-profile-evidence-loader.md).
- The policy evidence envelope lives in
  `server/src/services/policyEvidenceEnvelope.mjs`. It requires the cached
  profile handoff, combines bounded persisted-source snapshots, and invokes the
  existing evidence boundary once without adding database, refresh, provider, or
  storage side effects. Its design record is
  [Policy Evidence Envelope](policy-evidence-envelope.md).
- The envelope now derives each collector section's source and authority from
  the shared evidence input contract, exposes only sanitized provenance IDs,
  and audits provenance drift before downstream engines consume the handoff.
  Its design record is
  [Policy Evidence Envelope Provenance](policy-evidence-envelope-provenance.md).
- The library outcome evidence collector lives in
  `server/src/services/policyLibraryOutcomeEvidenceCollector.mjs`. It uses
  parameterized, library-scoped reads for final classification outcomes and
  manual corrections, returns bounded evidence fields only, and leaves learning
  decisions to later guarded components. Its design record is
  [Policy Library Outcome Evidence Collector](policy-library-outcome-evidence-collector.md).
- The library pending-answer evidence collector lives in
  `server/src/services/policyLibraryPendingAnswerEvidenceCollector.mjs`. It
  reads only bounded proof that a policy question was resolved, supports the
  shared outcome transition with a narrow legacy Discord marker fallback,
  excludes answer content and responder identity, and projects every record as
  review-only evidence until the learning guard evaluates it. Its design record
  is [Policy Library Pending-Answer Evidence Collector](policy-library-pending-answer-evidence-collector.md).
- The library routing-outcome evidence collector lives in
  `server/src/services/policyLibraryRoutingOutcomeEvidenceCollector.mjs`. It
  normalizes persisted classification routing state into bounded succeeded,
  blocked, or skipped evidence, accepts only fixed application-owned reason
  values, excludes raw route errors and Arr payloads, and never retries or
  attempts routing. Its design record is
  [Policy Library Routing-Outcome Evidence Collector](policy-library-routing-outcome-evidence-collector.md).
- The library metadata evidence collector lives in
  `server/src/services/policyLibraryMetadataEvidenceCollector.mjs`. It reads
  bounded aggregated typed genre facts from final classification rows, excludes
  raw provider JSON and other unconstrained metadata categories, normalizes
  values before projection, and supplies compatibility evidence only. Its design
  record is [Policy Library Metadata Evidence Collector](policy-library-metadata-evidence-collector.md).
- The library evidence loader lives in
  `server/src/services/policyLibraryEvidenceLoader.mjs`. It validates the
  cached profile handoff first, runs all bounded source collectors only after
  that handoff passes, requires every nested audit, and builds exactly one
  evidence envelope without live lookups or writes. Its design record is
  [Policy Library Evidence Loader](policy-library-evidence-loader.md).
- The shared collector record contract lives in
  `server/src/services/policyLibraryEvidenceRecordContract.mjs`. It verifies
  the bounded primitive record shape and source-owned reason codes emitted by
  outcome, pending-answer, routing, and metadata collectors before envelope
  aggregation. Its design record is
  [Policy Library Evidence Record Contract](policy-library-evidence-record-contract.md).
- The policy evidence handoff verifier lives in
  `server/src/services/policyEvidenceHandoffVerifier.mjs`. It verifies the
  complete profile-to-envelope contract, including the static engine, loader,
  envelope, boundary, independently recomputed projection, fingerprint, quality,
  and side-effect audits, and returns a sanitized intent-inference handoff
  summary. Its design record is [Policy Evidence Handoff Verifier](policy-evidence-handoff-verifier.md).
  The projection revalidation hardening is recorded in
  [Policy Evidence Handoff Projection Revalidation](policy-evidence-handoff-projection-revalidation.md).
  Verified fingerprint provenance propagation is documented in
  [Policy Library Intent Proposal Fingerprint Provenance](policy-library-intent-proposal-fingerprint-provenance.md).
  The opaque proposal registry revalidates stored proposal fingerprint
  provenance before resolution or consumption; its design record is
  [Policy Intent Proposal Registry Snapshot Revalidation](policy-intent-proposal-registry-snapshot-revalidation.md).
  The declared-intent command requires its proposal fingerprint to agree with
  the verified handoff fingerprint before the future persistence gate; its
  design record is [Policy Declared Intent Command Fingerprint Provenance](policy-declared-intent-command-fingerprint-provenance.md).
- The library intent proposal service lives in
  `server/src/services/policyLibraryIntentProposalService.mjs`. It accepts
  declared operator intent only through the shared evidence input gate, loads
  and verifies the full library evidence handoff once, preserves fingerprint
  and quality provenance, and calls the bounded intent reducer only after that
  handoff is ready. It returns a proposed intent or a stable blocked outcome;
  ready-result handoff-audit hardening is documented in
  [Policy Library Intent Proposal Handoff Audit](policy-library-intent-proposal-handoff-audit.md).
  The emitted bounded intent must retain the verified handoff fingerprint before
  the proposal becomes ready; its design record is
  [Policy Library Intent Proposal Intent Provenance](policy-library-intent-proposal-intent-provenance.md).
  it does not persist policy state, learn, refresh, call providers, read quota,
  or route media. Its design record is
  [Policy Library Intent Proposal Service](policy-library-intent-proposal-service.md).
- The first mandatory durable-name cutover in the policy-engine domain is
  complete: the completion audit's private default chain builder now uses a
  product-domain name rather than the previous Phase 6 label. The behavior is
  unchanged and no compatibility alias remains. Its outcome record is
  [Policy Engine Completion Audit Naming Cutover](policy-engine-completion-audit-naming-cutover.md).
- The library rebuild contract now uses bounded-intent and policy-readiness
  validation language instead of Phase 6 diagnostics. Its product behavior and
  conservative acceptance, rollback, and side-effect gates are unchanged. The
  outcome record is [Policy Library Rebuild Naming Cutover](policy-library-rebuild-naming-cutover.md).
- The runtime/rebuild test reset now verifies contract-to-test ownership in
  addition to file availability: all required runtime services must map to a
  focused repository-contained ESM test that statically imports the declared
  service. Guarded-outcome projection and runtime-metrics input are separate
  required contracts. Its design record is
  [Policy Runtime Rebuild Test Contract Coverage](policy-runtime-rebuild-test-contract-coverage.md).
- Migration deletion readiness now accepts only the durable
  `nativeIntentStorageStable` input. The retired phase-named alias had no
  persisted, public, or downstream caller, so it was removed instead of
  retaining compatibility debt. Its outcome record is
  [Policy Migration Native Intent Criterion Cutover](policy-migration-native-intent-criterion-cutover.md).
- The evidence artifact cutline now reconciles every active Rewrite, Replace,
  and Delete inventory group with one bounded engine successor. Direct evidence
  mappings must use admitted evidence bucket/source pairs, while scoring,
  workflow, intent, readiness, and migration groups stay explicitly owned by
  their respective engines. The completion audit consumes this static contract;
  runtime library evidence loading remains checkout-independent. Its design
  record is [Policy Evidence Artifact Cutline](policy-evidence-artifact-cutline.md).

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
- Allow template-derived values only as server-projected, source-labelled
  candidates that require explicit typed intent acceptance, never as hidden
  policy containers.
- Preserve legacy preset/custom-signal compatibility only as a bridge until
  native intent storage is ready.

Acceptance criteria:

- A library profile can produce a proposed intent draft.
- The draft explains why each suggested signal exists.
- The draft separates declared operator constraints from inferred evidence.
- Legacy policies can still round-trip through the compatibility bridge.

Implementation status:

- Policy intent engine is documented in
  [Policy Intent Engine](policy-intent-engine.md).
- The policy intent engine architecture cutover renamed the active intent
  design record to durable product-domain naming and recorded the outcome in
  [Policy Intent Engine Architecture Cutover](policy-intent-engine-architecture-cutover.md).
- The server-owned intent contract lives in
  `server/src/services/policyIntentEngine.mjs`.
- The focused intent-engine test suite lives in
  `server/src/__tests__/services/policyIntentEngine.test.mjs`.
- Deterministic profile-to-intent suggestion rules now live in
  `server/src/services/policyProfileIntentSuggestionRules.mjs`. The pure
  server-owned plan accepts only bounded evidence projection, attaches a stable
  rule ID and explanation to every derived entry, keeps observed constraints
  out of declared fields, and exposes a recomputation audit. Its design record
  is [Policy Profile Intent Suggestion Rules](policy-profile-intent-suggestion-rules.md).
- Broad-genre promotion now has a separate versioned eligibility contract in
  `server/src/services/policyBroadGenreIdentityEligibility.mjs`. A broad
  observed genre needs a non-stale specific media-server identity with at least
  two observed items and `0.70` confidence, or an operator-declared specific
  identity. The suggestion reducer and draft audit both recompute this contract;
  metadata, stale, weak, or malformed provenance cannot qualify. Its design
  record is [Policy Broad-Genre Identity Eligibility](policy-broad-genre-identity-eligibility.md).
- Intent-entry projection is normalized by
  `server/src/services/policyIntentEntryNormalizer.mjs`, which excludes
  object-valued evidence and lets the intent audit reject tampered primitive
  fields. Its design record is
  [Policy Intent Entry Normalizer](policy-intent-entry-normalizer.md).
- Intent inference now separates raw evidence from pure projection reduction:
  `buildPolicyIntentDraftFromEvidenceInput` invokes the bounded evidence
  boundary, while `buildPolicyIntentDraftFromEvidenceProjection` rejects every
  non-`policy.evidence.v1` value. The normal workflow allowlists its evidence
  envelope so routing and diagnostics do not become evidence. Its design record
  is [Policy Intent Input Boundary](policy-intent-input-boundary.md).
- Current implementation consumes Phase 6R.1 evidence projection and produces
  proposed destination intent for `belongs_here`, `helpful_matches`,
  `hard_limits`, `avoid`, `ask_when`, `routing_target`, confidence,
  assumptions, and warnings.
- The intent engine now exposes a bounded entry point that consumes the Phase
  policy evidence boundary result, requires the projection fingerprint, blocks
  failed evidence-boundary handoffs, and carries a sanitized evidence-boundary
  snapshot into the intent draft for downstream correlation.
- The bounded intent entry point now audits the evidence projection fingerprint,
  trace attributes, and sanitized provenance against the returned policy evidence
  projection before producing an intent draft.
- The bounded intent entry point now consumes the policy evidence quality
  assessment, carries a sanitized quality snapshot into the evidence boundary,
  and blocks missing or insufficient quality with
  `blocked_by_evidence_quality` before intent inference.
- Policy intent quality-gate hardening is documented in
  [Policy Intent Quality Gate](policy-intent-quality-gate.md).
- The policy intent quality-gate architecture cutover renamed the active
  quality-gate design record to durable product-domain naming and recorded the
  outcome in
  [Policy Intent Quality Gate Architecture Cutover](policy-intent-quality-gate-architecture-cutover.md).
- The contract demotes unsupported broad-genre identity to helpful evidence,
  prevents metadata from owning destination identity, treats stale or missing
  evidence as review triggers instead of exclusions, keeps hard limits and avoid
  entries tied to operator-declared authority, and produces no learning side
  effects.
- The declared intent command contract lives in
  `server/src/services/policyDeclaredIntentCommand.mjs`. It accepts only a
  resolver-provided server proposal, validates an authenticated administrator,
  exact proposal fingerprint, allowlisted declared-intent fields, and explicit
  hard-limit confirmation, then returns a persistence-free command envelope.
  Its design record is
  [Policy Declared Intent Command](policy-declared-intent-command.md).
- The server-owned proposal registry lives in
  `server/src/services/policyIntentProposalRegistry.mjs`. It snapshots only
  verified ready proposals, returns short-lived opaque actor-scoped references,
  resolves a trusted command snapshot without exposing stored evidence, and
  provides fingerprint-bound one-time consumption for a future native storage
  transaction. Its design record is
  [Policy Intent Proposal Registry](policy-intent-proposal-registry.md).
- Native policy persistence remains blocked until it can atomically consume the
  registered reference and write the native intent version. The registry is an
  ephemeral review capability, not a substitute policy database.
- Legacy preset/custom-signal behavior remains a compatibility bridge only;
  future Phase 6R/8R work must decide how bridge output maps into native intent
  storage after learning and readiness gates are stable.

### 6R.3 Learning Guard

Intent: decide whether an operator decision should become durable learning,
exact-item memory, profile evidence, or only outcome history.

Tasks:

- **6R.3.1 Canonical Learning Intake Contract:** normalize all five learning
  source classes into one source/event/answer/question/outcome envelope before
  guard evaluation. The contract must be side-effect free, retain a bounded
  source event identifier, exclude raw AI/provider payloads, and fail closed
  for unknown source, answer, frame, or outcome drift.
- **6R.3.2 Learning Intake Adapter Adoption:** move manual classification
  changes, confirmations, Discord answers, request destination choices, and
  routing outcomes through the canonical intake contract one adapter at a time.
  Re-derive actor, source, and workflow state server-side; remove duplicate
  pre-guard normalization only after each adapter's replacement passes.
- **6R.3.3 Authorized Outcome And Learning Persistence:** add the later
  transaction boundary that validates current state, authorization, and
  idempotency before it writes final outcomes, approved learning, or profile
  refresh commands. Intake and the guard remain pure.

Implementation task sequence:

1. **6R.3.3a Authorized Persistence Command Contract:** define and test the
   pure command that requires canonical intake, guard decision, server-derived
   authorization, and transaction-locked current state to agree before it can
   plan an outcome, learning, or refresh operation.
2. **6R.3.3b Source-Event Idempotency Ledger:** add an append-only unique
   source-event receipt and repository. It must return an existing receipt for
   an exact replay and reject a source-event payload mismatch.
3. **6R.3.3c Transaction Executor:** lock current state, revalidate actor and
   destination, claim the source-event receipt, persist the final outcome, and
   apply only command-approved operations in one rollback-safe transaction.
4. **6R.3.3d Manual Correction Adoption:** move the active API manual
   correction path through the executor and remove its direct exact-item write.
5. **6R.3.3e Profile Refresh Command Consumer:** persist and consume approved
   refresh commands only after compatibility and identity evidence writers are
   ready; exact-item memory must not queue a refresh.
   - **6R.3.3e.1 Profile Refresh Command Contract:** validate a compact,
     side-effect-free refresh command against the authorized outcome command.
     It must require compatibility or identity evidence, the locked final
     destination, and the guard's refresh reason. Complete; documented in
     [Policy Profile Refresh Command Contract](policy-profile-refresh-command-contract.md).
   - **6R.3.3e.2 Compatibility Evidence Writer:** define and persist a bounded
     compatibility evidence record for a command-authorized manual outcome.
     It must not alter declared intent or infer a hard limit. Complete;
     documented in [Policy Compatibility Evidence Writer](policy-compatibility-evidence-writer.md).
   - **6R.3.3e.3 Identity Evidence Authority Writer:** define the stricter
     identity admission path. Manual outcome authority alone must not turn one
     answer into destination identity; require the allowed observed or
     operator-declared authority before persistence. Complete; documented in
     [Policy Identity Evidence Authority Writer](policy-identity-evidence-authority-writer.md).
   - **6R.3.3e.4 Refresh Outbox Persistence:** insert a compact profile-refresh
     outbox row in the same transaction as an admitted evidence mutation and
     deduplicate by the authorized source event. Complete; documented in
     [Policy Profile Refresh Outbox Persistence](policy-profile-refresh-outbox-persistence.md).
   - **6R.3.3e.5 Refresh Worker Consumer:** claim committed outbox rows with a
     bounded retry policy and idempotently invoke the existing library-profile
     generator. It must never run on rollback or on exact-item memory. Complete;
     documented in [Policy Profile Refresh Worker
     Consumer](policy-profile-refresh-worker-consumer.md).
6. **6R.3.3f Concurrency And Recovery Audit:** prove replay, state drift,
   authorization loss, writer failure, and transaction rollback behavior with
   focused unit and integration tests. Complete; documented in [Policy
   Authorized Outcome Concurrency And Recovery
   Audit](policy-authorized-outcome-concurrency-recovery-audit.md).
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

- Policy learning guard is documented in
  [Policy Learning Guard](policy-learning-guard.md).
- The policy learning guard architecture cutover renamed the active learning
  design record to durable product-domain naming, removed a production-facing
  roadmap-phase audit message, and recorded the outcome in
  [Policy Learning Guard Architecture Cutover](policy-learning-guard-architecture-cutover.md).
- The server-owned learning guard contract lives in
  `server/src/services/policyLearningGuard.mjs`.
- Phase 6R.3.3a is complete. The pure command in
  `server/src/services/policyAuthorizedOutcomePersistenceCommand.mjs` accepts
  only canonical intake and guard decisions whose bounded source, source event,
  final outcome, revalidated actor authority, and transaction-locked current
  state agree. It can plan an outcome-only resolution when learning authority
  is absent, performs no writes, and is not yet wired into active routes.
- Phase 6R.3.3b is complete. The append-only source-event ledger in
  `server/src/services/policyAuthorizedOutcomeReceiptRepository.mjs` requires
  a caller-owned transaction, binds compact authorized command semantics to a
  SHA-256 fingerprint, returns the original receipt for exact replay, and
  rejects source-event mismatches. It has no active route consumer; a replace
  restore explicitly discards this runtime state rather than restoring stale
  idempotency receipts. Its design record is
  [Policy Authorized Outcome Idempotency Ledger](policy-authorized-outcome-idempotency-ledger.md).
- Phase 6R.3.3c is complete. The modular executor in
  `server/src/services/policyAuthorizedOutcomeTransactionExecutor.mjs` locks
  classification and destination state in a consistent order, revalidates
  server-derived authority, rebuilds the command, claims the receipt, records
  a compact outcome projection, and writes only exact-item memory. Missing
  compatibility, identity, or refresh consumers fail closed. It supports a
  caller-owned transaction for source lifecycle adapters, and the active
  manual correction route adopts it through Phase 6R.3.3d. Its design record is
  [Policy Authorized Outcome Transaction Executor](policy-authorized-outcome-transaction-executor.md).
- Phase 6R.3.3d is complete. The active manual correction route now requires a
  read-write authenticated principal and composes its locked classification
  transition, persisted correction-row source event, authorized receipt,
  legacy-compatible corrected outcome, and admitted exact-item memory in one
  transaction. Its source-specific design record is
  [Policy Manual Correction Transaction Adoption](policy-manual-correction-transaction-adoption.md).
- Phase 6R.3.3e.1 is complete. The pure profile-refresh command and authorized
  parent-command audit allow only compatibility or identity learning plans that
  target the locked final destination and carry the guard refresh reason. It
  performs no queue, profile, or evidence write. Its design record is
  [Policy Profile Refresh Command Contract](policy-profile-refresh-command-contract.md).
- Phase 6R.3.3e.2 is complete. The modular compatibility writer compiles only
  command-authorized, locked-state `genre`, `studio`, `franchise`, or
  `certification` support into the existing canonical evidence store at a fixed
  supporting confidence. It cannot create identity, hard-limit, avoid, or
  declared-intent data, and remains uninvoked until refresh outbox persistence
  can be atomic. Its design record is
  [Policy Compatibility Evidence Writer](policy-compatibility-evidence-writer.md).
- Phase 6R.3.3e.3 is complete. The identity writer creates an append-only,
  source-event-keyed admission only after an eligible manual outcome matches
  exactly one active declared native purpose rule. It never changes native
  intent; raw library distributions are not observed authority. The defined
  observed extension path requires a server-qualified current projection and
  fingerprint. It remains uninvoked until Phase 6R.3.3e.4 can atomically write
  an evidence mutation and refresh outbox row. Its design record is
  [Policy Identity Evidence Authority Writer](policy-identity-evidence-authority-writer.md).
- Phase 6R.3.3e.4 is complete. The transaction executor persists a compact,
  source-event-deduplicated profile-refresh record atomically with admitted
  compatibility or identity evidence. Replace restore clears the operational
  outbox rather than importing runtime work. Its design record is
  [Policy Profile Refresh Outbox Persistence](policy-profile-refresh-outbox-persistence.md).
- Phase 6R.3.3e.5 is complete. The scheduled worker claims committed,
  allowlisted outbox rows with a short UUID lease and deterministic ordered
  `SKIP LOCKED` batches, calls the existing idempotent profile generator after
  claim commit, and uses token-guarded completion or three-attempt bounded
  retry. It cannot claim exact-item memory or a rolled-back record. Its design
  record is [Policy Profile Refresh Worker Consumer](policy-profile-refresh-worker-consumer.md).
- Phase 6R.3.3f is complete. The isolated PostgreSQL integration audit proves
  one exact source event yields one durable effect under concurrent execution,
  state drift and authorization loss write no receipt, writer failure rolls
  back outcome/evidence/outbox state, and expired outbox leases reject stale
  completion tokens. Its design record is [Policy Authorized Outcome
  Concurrency And Recovery Audit](policy-authorized-outcome-concurrency-recovery-audit.md).
- The focused learning-guard test suite lives in
  `server/src/__tests__/services/policyLearningGuard.test.mjs`.
- Final-outcome shaping and route-transition validation now live in
  `server/src/services/policyFinalOutcomeNormalizer.mjs`; both the learning
  guard and request-time learning use its bounded `policy.final_outcome.v1`
  contract before they evaluate learning eligibility. Its design record is
  [Policy Final Outcome Normalizer](policy-final-outcome-normalizer.md).
- The guard vocabulary and focused reducer can evaluate manual classification
  changes, operator confirmations, Discord pending answers, request destination
  choices, and Arr routing outcomes into separate final-outcome and learning
  decisions. That is not yet a claim that every live adapter converges through
  one runtime intake path.
- Phase 6R.3.1 now provides the shared
  `server/src/services/policyLearningIntakeContract.mjs` envelope and focused
  test suite. It allowlists the five sources, requires a bounded source-event
  identifier, strips raw AI/provider payloads, binds final outcome to source and
  answer outcome, and performs no writes.
- Manual correction, request-time, native pending, routing, request/import,
  and Discord adapter adoption now use the canonical intake contract. Their
  decisions remain pure and must not be mistaken for authorized durable writes.
- Phase 6R.3.2a is complete for manual classification correction. The route
  derives `classification_correction:<persisted row id>` after it records the
  correction, and `policyManualCorrectionLearning.mjs` now requires valid
  canonical intake before guard evaluation. The adapter remains side-effect
  free; the later exact-item persistence path and all remaining source adapters
  are separate work.
- Phase 6R.3.2b is complete for request-time learning. It now requires valid
  canonical intake before the guard runs, keeps the existing
  question-reduction/evidence-fingerprint proof chain, and retains the
  intake's final outcome as the decision outcome. Native pending, routing, and
  Discord adapters remain separate adoption components.
- Phase 6R.3.2c is complete for native pending-resolution provenance. Its
  validated question-reduction path retains the request-time intake, while the
  missing or invalid-plan fallback now builds and audits the same canonical
  intake before guard evaluation. It exposes only compact source-event
  provenance, fails closed for an unknown fallback question frame, and remains
  outcome-only with no persistence, routing, provider, or profile-refresh
  side effect. Native route outcomes, request-import fallback, and Discord
  answers remain separate adapter components.
- Phase 6R.3.2d is complete for native pending route outcomes. Its two
  admitted terminal route states now derive canonical intake from the existing
  server-owned request-time event before guard evaluation. Route success and
  missing mapping remain outcome-only; malformed intake blocks persistence,
  and no provider, quota, refresh, or routing capability was added.
  Request-import fallback and Discord answers remain separate components.
- Phase 6R.3.2e is complete for request/import terminal-routing admission.
  Valid native question proof retains the request-time intake, while missing
  or invalid proof now passes through canonical fallback intake before the
  guard. The admission remains outcome-only, excludes queue payload and raw
  route data, and adds no provider, quota, refresh, route, or learning side
  effect.
- Phase 6R.3.2f is complete for Discord verification and correction answers.
  The server derives bounded correlation from persisted pending state, retains
  the native persisted-question fingerprint when available, requires a
  recorded final outcome, and sends both actions through canonical
  `discord_pending_answer` intake. Both actions are outcome-only: direct
  Discord preference and exact-match writes were removed, while status,
  outcome, routing, idempotency, and reply behavior remain intact. Post-answer
  routing is isolated in `discordClarificationRouting.mjs` and no adapter gains
  provider, quota, profile-refresh, route, or learning-write authority.
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
- The learning guard now exposes a bounded entry point that consumes the policy
  intent result, requires the carried policy evidence
  projection fingerprint, blocks failed or unfingerprinted intent handoffs, and
  attaches a sanitized intent/evidence boundary snapshot to the learning
  decision wrapper.
- The bounded learning entry point now requires the upstream bounded intent
  evidence-fingerprint audit to pass and rejects mismatched wrapper-versus-intent
  evidence fingerprints before evaluating learning candidates.
- The bounded learning entry point now also requires wrapper and embedded intent
  evidence-quality snapshots to exist, match, and avoid the `insufficient`
  status before any durable learning candidate is evaluated.
- Policy learning quality-gate hardening is documented in
  [Policy Learning Quality Gate](policy-learning-quality-gate.md).
- The policy learning quality-gate architecture cutover renamed the active
  quality-gate design record to durable product-domain naming and recorded the
  outcome in
  [Policy Learning Quality Gate Architecture Cutover](policy-learning-quality-gate-architecture-cutover.md).

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

- Policy automation readiness engine is documented in
  [Policy Automation Readiness Engine](policy-automation-readiness-engine.md).
- The server-owned readiness contract lives in
  `server/src/services/policyAutomationReadinessEngine.mjs`.
- The focused readiness-engine test suite lives in
  `server/src/__tests__/services/policyAutomationReadinessEngine.test.mjs`.
- Operational routing, profile-freshness, and hard-limit inputs now pass
  through `server/src/services/policyAutomationReadinessInputNormalizer.mjs`
  before readiness is evaluated. It accepts only bounded state, fails
  conservatively for malformed booleans, and excludes raw routing configuration
  from readiness output. Its design record is
  [Policy Automation Readiness Input Normalizer](policy-automation-readiness-input-normalizer.md).
- Current implementation consumes bounded evidence, intent, learning, routing,
  and profile freshness inputs into one state: `ready`,
  `needs_more_examples`, `needs_operator_review`, `needs_routing`,
  `blocked_by_hard_limit`, or `stale_profile`.
- The lower-level readiness reducer now accepts only explicit evidence and
  intent contracts. Raw evidence keys and invalid versions fail immediately;
  runtime callers must use the existing bounded-contract wrapper. Its design
  record is [Policy Automation Readiness Contract
  Boundary](policy-automation-readiness-contract-boundary.md).
- Readiness is computed from cached/local state only, returns reason-coded
  issues with next actions, treats profile refresh as stale readiness, and
  ignores replay, impact preview, provider, TMDB, and raw scoring diagnostic
  inputs instead of allowing them to become product gates.
- Active native-policy libraries with a missing or stale stored profile are now
  recovered independently of readiness reads: a bounded scheduler planner adds
  a compact server-owned request to the existing durable profile-refresh
  outbox, and the existing leased worker rechecks freshness before generating.
  It coalesces active work per library, never fabricates learning provenance,
  and does not require a browser, dialog, policy write, provider, or quota
  interaction. The design and outcome record is [Native Policy Profile Refresh
  Automation](policy-native-profile-refresh-automation.md).
- Native policy creation now has a separate local draft-completeness boundary:
  its footer checks only selected library and explicitly accepted purpose, never
  locally inferred routing or diagnostic state. Server establishment and the
  post-create handoff remain authoritative. The implementation and outcome are
  documented in [Policy Native Create Readiness
  Boundary](policy-native-create-readiness-boundary.md).
- Readiness now exposes a bounded entry point for new runtime/rebuild callers:
  it requires successful bounded evidence, intent, and learning results,
  verifies their shared sanitized evidence projection fingerprint, and attaches
  a bounded context to the readiness input summary without exposing raw
  evidence labels.
- The bounded readiness entry point now also requires the upstream evidence,
  intent, evidence-fingerprint, and learning audits to pass before automation
  readiness is evaluated.
- The bounded readiness entry point now requires evidence, intent, and learning
  to carry matching, usable evidence-quality snapshots before any automation
  readiness state is returned.
- The bounded readiness entry point now admits only two server-owned decision
  sources: request-time learning and the library-rebuild no-write handoff. It
  rejects missing, unknown, noncanonical, or version-mismatched source
  descriptors before it derives readiness; its design record is [Policy
  Decision Handoff Source](policy-decision-handoff-source.md).
- Policy automation readiness architecture cutover is documented in
  [Policy Automation Readiness Engine Architecture Cutover](policy-automation-readiness-engine-architecture-cutover.md).
- Policy automation readiness quality-gate hardening is documented in
  [Policy Automation Readiness Quality Gate](policy-automation-readiness-quality-gate.md).
- Policy automation readiness quality-gate architecture cutover is documented in
  [Policy Automation Readiness Quality Gate Architecture Cutover](policy-automation-readiness-quality-gate-architecture-cutover.md).

### 6R.5 Operator Workflow Rebuild

Intent: make policy setup dead simple while preserving meaningful control.

Boundary: 6R.5 owns the server-owned workflow projection and its automation
inputs. Phase 4R owns the final live browser composition, action liveness,
accessibility, responsive behavior, and retirement of parallel authoring UI.
Vue-facing 6R.5 records are evidence that a projection consumer exists; they
do not complete the Phase 4R UI-convergence acceptance criteria.

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

- Policy operator workflow is documented in
  [Policy Operator Workflow](policy-operator-workflow.md).
- The server-owned workflow projection lives in
  `server/src/services/policyOperatorWorkflow.mjs`.
- The focused operator-workflow test suite lives in
  `server/src/__tests__/services/policyOperatorWorkflow.test.mjs`.
- The Phase 6R.5 library-first read API now exposes a display-only five-section
  workflow at `GET /api/policies/operator-workflow/libraries/:libraryId`. It
  reads cached profile evidence and stored routing mapping only, returns
  observed values as explicitly accepted suggestions, and cannot refresh media,
  call providers, consume quota, persist policy state, learn, or route. Its
  design record is [Policy Operator Workflow Read API](policy-operator-workflow-read-api.md).
- The policy-builder entry path now renders that projection through
  `PolicyBuilderWorkflowShell.vue` and its bounded request composable. It
  replaces the local setup-card grid and standalone routing-readiness panel
  with the five destination-first questions, current-library suggestions, and
  server-owned readiness next action. It validates response authority and
  drops stale library requests. For a new policy, bounded observed genres,
  studios, and keywords are available through an unchecked native multi-select
  that produces typed local draft commands; observations remain unselected
  unless the operator explicitly accepts them. Its design record is
  [Policy Builder Library-First Workflow Shell](policy-builder-library-first-workflow-shell.md).
- The unmounted compatibility setup-card grid, its browser-derived progress
  projection, and focused tests are deleted. Native creation continues to use
  the server-owned destination workflow and readiness surface; its design and
  outcome record is [Policy Compatibility Setup-Card Grid Retirement
  Audit](policy-compatibility-setup-card-grid-retirement-audit.md).
- The unreachable server-side four-step setup-card contract is deleted. The
  user-mental-model service now retains only live shared UX term IDs,
  operator-workflow control-kind IDs, and its internal diagnostic-language
  guard; the five-section workflow remains the single server-owned projection.
  Its design and outcome record is [Policy Compatibility User-Mental-Model
  Setup-Card Contract Retirement
  Audit](policy-compatibility-user-mental-model-setup-card-contract-retirement-audit.md).
- Native policy creation now accepts only the explicit typed-draft result and
  establishes the policy row, native authority, audit records, routing target,
  and rollback snapshot in one transaction. It rejects legacy preset
  attachments, non-administrator calls, unsupported observed values, and
  partial writes. Its design record is [Policy Observed Suggestion Native
  Creation](policy-observed-suggestion-native-creation.md).
- Native creation now uses a dedicated three-field request contract. The
  browser sends only library identity, policy name, and explicit native intent;
  the server rejects hidden compatibility fields before legacy validation or a
  transaction begins and applies its own retained compatibility-column
  defaults. Its design record is [Policy Native Create Payload
  Cutline](policy-native-create-payload-cutline.md).
- New policy creation now uses a dedicated native-first surface: it loads only
  the library context, presents unchecked observed destination values, requires
  explicit accepted purpose before creation, and omits legacy templates,
  migration notices, raw preset controls, and scoring thresholds. A persisted
  policy now selects its surface from the full server read model: an explicit
  `policy_intent_contract.source` of `native_intent` enters a read-only native
  view, while compatibility contracts retain the compatibility editor. Its
  design record is [Policy Native-First Create
  Surface](policy-native-first-create-surface.md).
- Persisted compatibility policies now enter
  `PolicyCompatibilityMaintenanceSurface.vue`, rather than sharing the native
  destination-first workflow. The retained editor, migration acknowledgement,
  and compatibility footer behavior remain available, while the policy neither
  requests nor presents the native operator-workflow projection. Its design
  record is [Policy Compatibility Maintenance
  Surface](policy-compatibility-maintenance-surface.md).
- The compatibility-maintenance entry audit now admits native inspection only
  for a server-validated `native_intent_active` projection. Invalid, ambiguous,
  incomplete, or trace-mismatched native projections are read-only recovery:
  they do not render compatibility controls, a save footer, a native-readiness
  request, or a browser repair action. Its design record is [Policy
  Compatibility Maintenance Entry
  Audit](policy-compatibility-maintenance-entry-audit.md).
- The compatibility editor scope audit now retains typed destination-rule
  maintenance while removing raw scoring-weight, combination-mode, and
  threshold controls. Existing compatibility decision values are preserved in
  the serializer and validated only by the server; the client no longer owns a
  scoring mutation path or weight-total save gate. Its design record is [Policy
  Compatibility Editor Scope
  Audit](policy-compatibility-editor-scope-audit.md).
- Compatibility maintenance no longer derives aggregate `Ready`, `Ready with
  notes`, or `Needs review` state from its unsaved browser draft. It retains
  direct per-section edit guidance while native policies continue to receive a
  single server-owned readiness next action. Its design record is [Policy
  Compatibility Intent Readiness Boundary
  Audit](policy-compatibility-intent-readiness-boundary-audit.md).
- Compatibility section cards no longer translate an unsaved draft into
  warnings, completion badges, or generated next actions. They retain direct
  edit instructions, labeled configured-signal chips, and duplicate-safe controls;
  native policies remain the only surface with server-owned readiness. Its
  design and outcome record is [Policy Compatibility Section Advisory Scope
  Audit](policy-compatibility-section-advisory-scope-audit.md).
- Compatibility section cards now use their labeled configured-signal chips as
  the sole compatibility-draft display. The redundant behavior-summary helper
  and rendering were removed because every generated sentence interpreted
  runtime policy behavior. Its design and outcome record is [Policy
  Compatibility Section Configuration Summary Scope
  Audit](policy-compatibility-section-configuration-summary-scope-audit.md).
- Compatibility editor group helpers now provide only concise instructions for
  the editable signals in each group. Browser-generated claims about
  automation safety, review behavior, matching fit, or confidence effects were
  removed. Its design and outcome record is [Policy Compatibility Group
  Instruction Scope Audit](policy-compatibility-group-instruction-scope-audit.md).
- Compatibility editor framing now names the direct editing task and retains
  only the selectable context and factual empty state. Save mechanics,
  reconciliation, new-policy establishment, and redundant context counts were
  removed from the browser. Its design and outcome record is [Policy
  Compatibility Editor Framing Copy Scope
  Audit](policy-compatibility-editor-framing-copy-scope-audit.md).
- Compatibility maintenance framing now states only the direct destination
  editing task for the existing policy. The permanent browser-owned workflow
  comparison and static live-status announcement were removed; typed command
  forwarding and server-validated writes remain unchanged. Its design and
  outcome record is [Policy Compatibility Maintenance Surface Framing
  Audit](policy-compatibility-maintenance-surface-framing-audit.md).
- Compatibility migration notices now retain only a bounded, report-derived
  removal outcome, affected-preset preview, and version-scoped local dismissal.
  The browser-authored upgrade headline and manual reapply prompt were removed;
  the notice neither changes policy state nor establishes workflow authority.
  Its design and outcome record is [Policy Compatibility Migration Notice
  Audit](policy-compatibility-migration-notice-audit.md).
- Compatibility maintenance no longer renders a global policy-behavior summary
  or derives its warnings from the unsaved draft. The retained editor's labeled
  configured-signal controls are the sole compatibility-draft representation;
  server validation remains authoritative for every write. Its design and
  outcome record is [Policy Compatibility Intent Summary
  Audit](policy-compatibility-intent-summary-audit.md).
- Policy footers now report only an unmet direct prerequisite or a returned
  server error. The browser no longer presents save success, compatibility
  routing, or automation-readiness state, and the local compatibility routing
  projection was removed. Its design and outcome record is [Policy
  Compatibility Save-Footer Admission
  Audit](policy-compatibility-save-footer-admission-audit.md).
- The unmounted compatibility routing-readiness card and its focused test are
  deleted. Native creation continues to present only server-owned readiness
  through the operator workflow and its bounded next-action card. Its design
  and outcome record is [Policy Compatibility Routing-Readiness Card
  Retirement Audit](policy-compatibility-routing-readiness-card-retirement-audit.md).
- Persisted native policies now use a compact, read-only summary instead of
  reopening the five-section creation workflow. It shows display-safe stored
  purpose from the policy detail contract and **policy** readiness from active
  native intent, cached profile freshness, and stored routing. It does not
  reopen the library-first creation workflow or authorize an action. The
  implementation is documented in [Persisted Native Policy
  Summary](policy-persisted-native-summary.md) and [Policy Native Readiness
  Summary Contract](policy-native-readiness-summary-contract.md).
- Native creation now reads insufficient profile evidence as status only:
  unavailable, stale, empty, and failed-read states hide observed candidates
  without offering browser refresh or reread actions. It does not reopen legacy
  templates or raw authoring controls. Server-owned profile recovery establishes
  later evidence; the retirement record is [Policy Library-Rebuild Native
  Evidence Recovery Retirement](policy-library-rebuild-native-evidence-recovery-retirement.md).
- The native-readiness recovery action is now scheduler-owned. Missing and stale
  active-native profiles are queued automatically through the durable profile
  refresh outbox, while the current read-only summary remains side-effect free.
  Persisted native-policy status now projects bounded scheduled, queued,
  processing, or current recovery state with no browser refresh control. Its
  design record is [Native Policy Profile-Recovery
  Status](policy-native-profile-recovery-status.md). Terminal native-refresh
  failure now produces one delayed, idempotent successor per failed outbox row
  without operator intervention; pending future successors remain `scheduled`
  in the bounded status projection. The design and outcome record is [Native
  Profile Refresh Terminal Recovery](policy-native-profile-refresh-terminal-recovery.md).
  Native refresh failure classification now uses fixed server-owned codes.
  A durable per-library/source-revision circuit opens immediately for known
  local configuration failures and after three recurring recoverable terminal
  failures. It suppresses ordinary work, waits two hours, and lets the existing
  scheduler create one successor-backed probe; a successful profile refresh
  clears the runtime state automatically. Circuits and retained terminal
  history compact only after current source-revision protection and a bounded
  retention window. No browser retry, reset, or manual recovery action is
  introduced. The design and outcome records are [Native Profile Refresh
  Failure Classification](policy-native-profile-refresh-failure-classification.md)
  and [Native Profile Refresh Automatic Circuit
  Policy](policy-native-profile-refresh-circuit-policy.md). The readiness
  summary now derives the current scheduler candidate and, only when there is
  no active refresh, projects a valid exact-source-revision open or half-open
  circuit as fixed `awaiting_automatic_probe` copy. It exposes no failure,
  cooldown timestamp, outbox data, retry, or reset control. Optional circuit
  lookup failure falls back to normal scheduled recovery. The design and
  outcome record is [Native Profile Recovery Circuit Status
  Projection](policy-native-profile-recovery-circuit-status-projection.md).
  A database-backed lifecycle integration test now proves a terminal failure
  opens the circuit, the fixed automatic-wait state is projected during
  cooldown, one scheduler-owned probe runs, a successful worker refresh clears
  runtime state, and readiness returns to current without browser intervention.
  Its design and outcome record is [Native Profile Refresh Circuit Lifecycle
  Integration](policy-native-profile-refresh-circuit-lifecycle-integration.md).
  A cross-source-revision database integration case now proves that an old open
  circuit cannot block or label a new current content revision. The old circuit
  remains retained for bounded recovery history while a new server-derived
  source revision queues independently and projects only current work. Its
  design and outcome record is [Native Profile Refresh Circuit Source-Revision
  Integration](policy-native-profile-refresh-circuit-source-revision-integration.md).
  A concurrent-planner database integration case now proves two scheduler
  instances create at most one due probe for the same current circuit. Exact
  PostgreSQL circuit locking and the durable outbox leave one half-open circuit
  and one queued successor, while the losing planner observes the committed
  state and blocks. Its design and outcome record is [Native Profile Refresh
  Circuit Concurrent-Planner
  Integration](policy-native-profile-refresh-circuit-concurrent-planner-integration.md).
  A concurrent-worker database integration case now proves two workers execute
  the single pending probe at most once. PostgreSQL skip-locked claiming gives
  one worker durable ownership; it alone generates the profile, completes the
  probe, and clears the circuit. Its design and outcome record is [Native
  Profile Refresh Circuit Concurrent-Worker
  Integration](policy-native-profile-refresh-circuit-concurrent-worker-integration.md).
  A lease-expiry reclaim database integration case now proves a crashed
  worker's expired probe can be reclaimed safely without a stale token clearing
  the circuit. The replacement worker owns a new claim token and is solely able
  to complete the second attempt and clear recovery state. Its design and
  outcome record is [Native Profile Refresh Circuit Lease-Reclaim
  Integration](policy-native-profile-refresh-circuit-lease-reclaim-integration.md).
  A post-generation claim-loss database integration case now proves a worker
  that persisted a current profile before disappearing does not cause duplicate
  generation. The replacement worker reclaims the expired probe, derives the
  current stored profile, completes the second attempt as already current, and
  then clears the circuit. Its design and outcome record is [Native Profile
  Refresh Circuit Post-Generation Claim-Loss
  Integration](policy-native-profile-refresh-circuit-post-generation-claim-loss-integration.md).
  A lease-exhaustion terminalization database integration case now proves an
  exhausted expired probe becomes a fixed terminal failure before it can do
  profile work or clear recovery state. The planner recognizes only the
  matching active failed probe, reopens the circuit through its normal bounded
  transition, and blocks work until cooldown. Its design and outcome record is
  [Native Profile Refresh Circuit Lease-Exhaustion Terminalization
  Integration](policy-native-profile-refresh-circuit-lease-exhaustion-terminalization-integration.md).
  A post-exhaustion cooldown re-probe database integration case now proves two
  scheduler instances create exactly one later automatic probe for the reopened
  circuit. Its successful worker completion clears runtime state and returns
  readiness to current without browser or operator intervention. Its design and
  outcome record is [Native Profile Refresh Circuit Post-Exhaustion Cooldown
  Re-Probe
  Integration](policy-native-profile-refresh-circuit-post-exhaustion-cooldown-reprobe-integration.md).
  A repeated-probe-failure database integration case now proves two terminal
  automatic failure cycles reopen only their matching active circuit, retain a
  capped circuit failure count, and let concurrent schedulers create exactly
  one later successor. It preserves durable terminal rows for separate
  retention compaction and never needs browser or operator action. Its design
  and outcome record is [Native Profile Refresh Circuit Repeated-Probe-Failure
  Integration](policy-native-profile-refresh-circuit-repeated-probe-failure-integration.md).
  A native profile-refresh recovery retention-compaction database integration
  case now proves expired inactive closed circuit state and its terminal outbox
  history are removed together after retention. Open and half-open circuits,
  pending-probe revisions, protected current revisions, and recent closed
  history remain intact. Its materialized retained-set design avoids partial
  cleanup under PostgreSQL's data-modifying CTE snapshot rules. Its design and
  outcome record is [Native Profile Refresh Circuit Retention-Compaction
  Integration](policy-native-profile-refresh-circuit-retention-compaction-integration.md).
  A concurrent planner-and-compaction database integration case now proves
  overlapping scheduler instances retain an otherwise expired current source
  revision while scheduling its automatic recovery. Exact circuit locking and
  durable outbox source identity leave one pending successor; the second
  planner safely replays it. Its design and outcome record is [Native Profile
  Refresh Circuit Planner-Compaction Interleaving
  Integration](policy-native-profile-refresh-circuit-planner-compaction-interleaving-integration.md).
  A compaction-failure isolation database integration case now proves a cleanup
  outage cannot interrupt durable current automatic recovery scheduling. The
  planner returns its fixed failure signal while the next successful scheduler
  run replays current work and removes expired inactive history automatically.
  Its design and outcome record is [Native Profile Refresh Circuit
  Compaction-Failure Isolation
  Integration](policy-native-profile-refresh-circuit-compaction-failure-isolation-integration.md).
  A concurrent retention-compaction database integration case now proves two
  overlapping cleanup callers remove expired inactive history exactly once. The
  materialized retained set preserves protected current revisions; the losing
  caller safely reports zero work with no orphaned circuit or terminal outbox
  history. Its design and outcome record is [Native Profile Refresh Circuit
  Concurrent Retention-Compaction
  Integration](policy-native-profile-refresh-circuit-concurrent-retention-compaction-integration.md).
  The Phase 6R.5 native recovery-retention completion audit now confirms one
  server-owned persisted-policy path: bootstrap starts the advisory-lock
  scheduler, the automation service plans before delivering durable outbox
  work, the planner is the sole production compaction caller, and the
  persisted recovery projection is read-only. Its design and outcome record is
  [Native Profile Refresh Recovery-Retention Completion
  Audit](policy-native-profile-refresh-recovery-retention-completion-audit.md).
  The audit identified one separate Phase 6R.6 cutline: the initial native
  creation workflow contained a browser-triggered evidence-refresh path. It is
  now retired through the bounded migration cutline rather than treated as part
  of persisted recovery or retention.
- Successful native creation now remains visible through a compact handoff that
  reads the persisted policy before displaying declared-intent counts and
  routing state. It uses the successful create receipt when that follow-up read
  is unavailable, never rebuilds policy authority from the browser draft, and
  does not claim transient observed suggestions are persisted provenance. Its
  design record is [Policy Native Create Handoff](policy-native-create-handoff.md).
- Initial native establishment now retains one bounded, server-generated
  observed-library-profile provenance snapshot in the same transaction. It is
  explicitly non-authoritative, cannot change policy intent, routing, learning,
  or media actions, and records safe unavailable or rejected states when a
  stored profile cannot supply bounded evidence. The payload is redacted after
  the aligned 14-day recovery window while retaining only a minimal audit
  marker. Its design record is [Policy Observed Evidence
  Provenance](policy-observed-evidence-provenance.md).
- Retired diagnostic panels no longer have a component, accessibility, readiness,
  or workflow exemption. Readiness rejects their identifiers instead of routing
  them to an alternate authoring branch; the outcome is documented in
  [Policy Authoring Verifier Surface Retirement](policy-authoring-verifier-surface-retirement.md).
- Intent entries now pass through
  `server/src/services/policyOperatorWorkflowEntryNormalizer.mjs` before normal
  workflow projection. It retains display-safe primitives only, rejects unknown
  authority sources and raw-object fields during audit, and prevents provider
  or diagnostic payloads from entering destination setup. Its design record is
  [Policy Operator Workflow Entry Normalizer](policy-operator-workflow-entry-normalizer.md).
- Current implementation defines the normal workflow as five destination-first
  sections: `what_belongs_here`, `what_should_not_go_here`,
  `what_helps_but_should_not_decide_alone`,
  `when_should_classifarr_ask`, and `can_this_route`.
- The workflow projection consumes policy intent and readiness, keeps routing
  readiness read-only, returns one primary action per section, blocks direct
  policy persistence or routing execution, and explicitly excludes impact
  preview, replay preview, replay parity, provider gates, provider readiness,
  TMDB coverage, raw scoring, and diagnostic panels from the normal flow.
- The workflow now exposes a bounded entry point for new runtime/rebuild
  callers: it requires successful bounded intent and bounded readiness results,
  verifies their shared sanitized evidence projection fingerprint, and attaches
  bounded provenance to the workflow without exposing raw evidence labels.
- The bounded workflow entry point now also requires the upstream intent,
  evidence-fingerprint, and readiness audits to pass before any operator
  workflow projection is returned.
- The bounded workflow entry point now requires bounded intent, readiness
  boundary context, and embedded readiness input context to carry matching,
  usable evidence-quality snapshots before any operator workflow projection is
  returned.
- The bounded workflow entry point now requires the approved readiness
  decision-source admission to match sanitized source summaries in both
  readiness contexts, and retains only the verified source summary in its
  workflow boundary. The design record is
  [Policy Operator Workflow Decision-Source Provenance](policy-operator-workflow-decision-source-provenance.md).
- Policy operator workflow architecture cutover is documented in
  [Policy Operator Workflow Architecture Cutover](policy-operator-workflow-architecture-cutover.md).
- Policy operator workflow quality-gate hardening is documented in
  [Policy Operator Workflow Quality Gate](policy-operator-workflow-quality-gate.md).
- Policy operator workflow quality-gate architecture cutover is documented in
  [Policy Operator Workflow Quality Gate Architecture Cutover](policy-operator-workflow-quality-gate-architecture-cutover.md).

### 6R.6 Migration And Deletion Path

Intent: move from legacy preset/custom-signal policy behavior to the new engine
without carrying both systems permanently.

Tasks:

- **6R.6.1 Migration Preview Contract**: define one bounded, server-owned
  comparison of legacy policy behavior and generated native intent for
  representative classifications. Inventory the creation-only browser
  evidence-refresh path as a replace-or-delete target, preserve rollback data
  and its explicit window, and keep all preview output out of the normal
  operator workflow.
- **6R.6.2 Representative Classification Source Adapter**: select one
  deterministic, bounded, server-only set of usable legacy/native outcome pairs
  from persisted policy and classification records. Carry compact source
  provenance, treat missing legacy baselines as insufficient coverage, and do
  not call providers, render browser controls, route media, or write state.
- **6R.6.3 Migration Verification Coordinator**: invoke the representative
  source only for an accepted, validated rebuild proposal; pass ready samples
  through preview and verifier contracts; and stop on insufficient coverage or
  an audit failure. Keep coordination server-only and prohibit browser
  controls, routing, and policy writes.
- **6R.6.4 Persisted Verification-Run Handoff**: persist only the bounded,
  replay-protected coordinator result required by the snapshot gate: accepted
  transition fingerprint, source provenance/summary, verifier fingerprint and
  status, and audit summaries. Prohibit raw samples, snapshot creation, policy
  replacement, routing, and browser controls.
- **6R.6.5 Library Rebuild Snapshot-Gate Verification Binding**: require the
  snapshot gate to load and validate one matching immutable verification
  receipt in its transaction before it creates rollback evidence. Accept only a
  current accepted transition and a `no_migration_differences` receipt; reject
  missing, stale, mismatched, review-required, and risk-blocked evidence
  without rerunning verification, replacing policy, routing media, or exposing
  a browser control.
- **6R.6.6 Library Rebuild Replacement-Gate Receipt Binding**: replace the
  replacement gate's caller-supplied verifier report with the immutable receipt
  bound to its persisted execution gate. In the replacement transaction, lock
  the gate and receipt, require their IDs and verifier fingerprints to agree,
  revalidate a current `no_migration_differences` result, and stop before all
  native-intent, routing, or migration-event writes when any binding is missing
  or invalid. Do not rerun verification, expose a browser control, or retain
  raw samples or differences.
- **6R.6.7 Library Rebuild Server-Owned Cutover Orchestration**: compose an
  accepted transition, its persisted verification receipt, rollback snapshot,
  and replacement only through one idempotent server-owned workflow. Expose
  bounded stop states only, never a browser control or raw verification output;
  do not rerun completed receipts, write routing outside the replacement
  transaction, or authorize legacy deletion.
- **6R.6.8 Library Rebuild Legacy-Path Deletion Readiness Gate**: define one
  bounded, server-owned final-removal readiness artifact from completed native
  cutover, exact receipt/snapshot provenance, rollback-window disposition,
  runtime authority confirmation, and a removal inventory. It must fail closed
  on missing or conflicting evidence and must not delete, hide, archive, route,
  or expose a browser control.
- **6R.6.9 Library Rebuild Legacy-Path Final-Removal Audit**: consume only a
  freshly evaluated 6R.6.8 artifact and the current server-owned removal
  inventory to produce one non-executing, controlled final-removal plan.
  Recheck provenance inside its own transaction, report exact blockers, and do
  not delete, hide, archive, route, or expose a browser control.
- **6R.6.10 Library Rebuild Legacy-Path Global Release Retirement Gate**:
  aggregate fresh 6R.6.9 plans for the deployment's current enabled policies,
  bind them to one current removal inventory and release state, and report a
  non-executing repository-retirement decision. It must fail closed and must
  not delete, hide, archive, route, or expose a browser control.
- **6R.6.11 Library Rebuild Legacy-Path Controlled Repository Retirement**:
  use a ready 6R.6.10 result only as a release prerequisite for one small,
  version-controlled source-removal change. Delete the classified legacy
  artifacts and unreachable references/tests/docs together, keep the running
  service without repository-write authority, and require normal CI and
  deployment-health gates before release.
  - **6R.6.11.1 Native Browser Evidence-Recovery Retirement**: delete the
    native-create browser refresh/reload panel, client state utility, tests,
    imports, and stale documentation. Render observed-signal controls only
    from current selectable server projection or server-admitted custom entry;
    keep profile lifecycle recovery server-owned. Retire the remaining
    `sync_media_server_library` empty-state action and its browser
    `sync -> refresh -> reload` composable; a profile-less library must show
    declared-intent guidance instead of recovery work.
  - **6R.6.11.2 Browser Impact And Replay Preview Retirement**: delete the
    legacy impact/replay cards, composables, utilities, tests, imports, and
    documentation from policy authoring while preserving the bounded
    server-side migration verifier outside normal workflow.
  - **6R.6.11.3 Legacy Migration-Verifier Service Retirement**: delete
    superseded verifier route/service paths only after the retained
    server-owned cutover evidence proves their replacement and removal gates.
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

- Policy migration deletion path is documented in
  [Policy Migration Deletion Path](policy-migration-deletion-path.md).
- The migration-preview decision, design, and outcome are documented in
  [Policy Migration Preview Contract](policy-migration-preview-contract.md).
- `server/src/services/policyMigrationPreviewContract.mjs` now owns bounded,
  comparison-only legacy/native outcome evaluation. It requires at least one
  usable legacy baseline, caps emitted differences, suppresses raw payloads,
  and returns explicit insufficient coverage instead of claiming parity from
  no comparison.
- The representative-classification source decision, design, and outcome are
  documented in [Policy Migration Representative Classification Source](policy-migration-representative-classification-source.md).
- `server/src/services/policyMigrationRepresentativeClassificationSource.mjs`
  now resolves the active persisted policy library before selecting a bounded
  set of finalized classification outcomes for its media type. It emits only
  compact destination outcomes and generated-intent results, with deterministic
  provenance and no provider, browser, routing, or write action.
- The source deliberately treats these records as destination-library outcomes,
  not historical policy-owned replays: `classification_history` has no durable
  policy ID. Empty usable coverage remains explicit and cannot claim parity.
- `server/src/services/policyMigrationGeneratedIntentOutcome.mjs` provides the
  shared generated-outcome projection used by the representative source and
  verifier so default outcome semantics remain aligned.
- The migration-verification coordinator decision, design, and outcome are
  documented in [Policy Migration Verification Coordinator](policy-migration-verification-coordinator.md).
- `server/src/services/policyMigrationVerificationCoordinator.mjs` now derives
  policy context only from a validated, current accepted rebuild transition,
  then invokes the persisted source and verifier in sequence. It stops before
  verification on invalid acceptance, source audit failure, or insufficient
  coverage and suppresses invalid verifier output.
- `server/src/services/policyMigrationVerificationCoordinatorContract.mjs`
  owns the coordinator's versioned stop states, sanitized result, and audit.
  Coordinator output excludes raw representative classifications and cannot
  apply a replacement, delete legacy paths, route media, or write state.
- The persisted verification-run handoff decision, design, and outcome are
  documented in [Policy Migration Verification-Run Handoff](policy-migration-verification-run-handoff.md).
- `server/src/services/policyMigrationVerificationRunHandoff.mjs` now invokes
  the coordinator and enters a transaction only for its audited `ready`
  result. It records a fixed receipt or a safe replay outcome and never creates
  a rollback snapshot, replacement, route, learning mutation, or browser
  control.
- `server/src/services/policyMigrationVerificationRunContract.mjs` reduces
  coordinator data to the accepted-transition digest, source
  provenance/summary, verifier fingerprint/status/difference counts, and audit
  summaries. It rejects unsafe coordinator output and strips unexpected receipt
  fields before a result is returned.
- `server/src/services/policyMigrationVerificationRunRepository.mjs` owns the
  parameterized PostgreSQL claim and conflict lookup. The immutable
  `policy_migration_verification_runs` table has a server-derived unique key,
  contains no raw samples or verifier differences, and is runtime-only during
  replace restore.
- The replacement-gate receipt-binding decision, design, and outcome are
  documented in [Policy Library-Rebuild Replacement-Gate Verification
  Binding](policy-library-rebuild-replacement-gate-verification-binding.md).
  `policyLibraryRebuildReplacementGate.mjs` now ignores caller-supplied
  verifier reports and locks the exact verification receipt recorded by the
  persisted execution gate before it can write native intent, routing, or a
  migration event. The receipt ID and verifier fingerprint must agree, and the
  event retains only receipt provenance rather than raw verification output.
- The server-owned cutover decision, design, and outcome are documented in
  [Policy Library-Rebuild Cutover Orchestration](policy-library-rebuild-cutover-orchestration.md).
  `policyLibraryRebuildCutoverOrchestrator.mjs` probes the snapshot gate first
  and invokes verification only for a fixed missing-receipt result; it then
  applies native replacement only after a current or newly persisted rollback
  snapshot. Its compact contract suppresses raw verification output, browser
  controls, direct routing, and legacy deletion authority.
- The deletion-readiness decision, design, and outcome are documented in
  [Policy Library-Rebuild Legacy Deletion Readiness](policy-library-rebuild-legacy-deletion-readiness.md).
  `policyLibraryRebuildLegacyDeletionReadinessService.mjs` now loads exact
  completed cutover provenance under shared locks and produces only a transient
  readiness artifact. It requires a matching immutable receipt, replacement
  event, expired-and-redacted un-restored rollback snapshot, one semantic
  native authority, and a compact removal-inventory fingerprint. It writes no
  readiness state and cannot delete, hide, archive, route, or expose a browser
  control.
- The final-removal-audit decision, design, and outcome are documented in
  [Policy Library-Rebuild Legacy Final-Removal Audit](policy-library-rebuild-legacy-final-removal-audit.md).
  `policyLibraryRebuildLegacyFinalRemovalAuditService.mjs` now rebuilds compact
  cutover evidence, inventory, and readiness in one transaction before it
  returns a non-executing per-library plan. It rejects stale or future
  readiness, inventory drift, and forged execution permissions, and stops at
  the deployment-wide release-retirement boundary without deleting, hiding,
  archiving, routing, or exposing a browser control.
- The global release-retirement decision, design, and outcome are documented
  in [Policy Library-Rebuild Legacy Global Release Retirement Gate](policy-library-rebuild-legacy-global-release-retirement-gate.md).
  `policyLibraryRebuildLegacyGlobalReleaseRetirementGateService.mjs` now locks
  the current enabled-policy inventory, rebuilds each compact final-removal
  plan against one inventory and timestamp, and emits only a fingerprint-bound
  repository-retirement proposal. Missing, duplicate, invalid, stale, or
  mismatched evidence fails closed; it cannot mutate the repository, delete
  runtime data, route media, or add a browser control.
- Native browser evidence recovery is retired from policy creation. The
  destination picker consumes only current selectable server projection or
  server-admitted custom entry; it cannot refresh a profile or retry a
  workflow read from the browser. The design and outcome are documented in
  [Policy Library-Rebuild Native Evidence Recovery
  Retirement](policy-library-rebuild-native-evidence-recovery-retirement.md).
- The residual new-library `sync_media_server_library` browser path is also
  retired. Missing persisted profiles now show declared-intent guidance; the
  native-create browser cannot sync a library, refresh a profile, or reload the
  workflow. The design and outcome are documented in [Policy Library-Rebuild
  Empty-State Sync Retirement](policy-library-rebuild-empty-state-sync-retirement.md).
- Browser impact/replay preview retirement is complete. The current removal
  inventory, modal orchestration contract, and migration candidate report no
  longer describe the browser family already deleted from source; bounded
  server-side verification remains outside normal authoring. The design and
  outcome are documented in [Policy Library-Rebuild Browser Impact And Replay
  Preview Retirement](policy-library-rebuild-browser-impact-replay-preview-retirement.md).
- Legacy migration-verifier service retirement is complete. The current
  removal ledger no longer describes the already-deleted verifier HTTP route,
  impact/replay services, enrichment services, or focused tests. The retained
  `policyMigrationVerifierRollback` module is an internal cutover and rollback
  safety contract with active conversion/runtime consumers, not a legacy route.
  The design and outcome are documented in [Policy Library-Rebuild Legacy
  Migration-Verifier Service Retirement](policy-library-rebuild-legacy-migration-verifier-service-retirement.md).
- `server/src/services/policyMigrationVerifierRollback.mjs` consumes the
  preview contract while retaining rebuild acceptance, rollback, fingerprint,
  trace, and deletion gates. It rejects ambiguous old/new sample input names.
- The deletion plan now embeds the versioned preview contract. Native browser
  evidence recovery has been retired; no normal workflow surface was added.
- The server-owned migration cutline lives in
  `server/src/services/policyMigrationDeletionPath.mjs`.
- The focused migration/deletion test suite lives in
  `server/src/__tests__/services/policyMigrationDeletionPath.test.mjs`.
- Current implementation classifies policy-builder artifacts as
  `keep_engine_primitive`, `migration_verifier`, `delete_after_migration`, or
  `native_storage_blocker`.
- Old impact preview, replay preview, provider readiness, metadata coverage,
  raw scoring, and policy-write diagnostics are delete-after-migration targets,
  never normal operator workflow.
- Migration deletion requires stable policy engine contracts, representative
  comparison, rollback snapshot, rollback window, deletion checklist, and
  native storage blocked until storage migration readiness is proven.
- Migration planning now exposes a bounded entry point for new runtime/rebuild
  callers: it requires a successful bounded policy operator workflow result,
  verifies sanitized workflow provenance, and attaches the bounded workflow
  context to the migration plan before the migration/deletion audit can pass.
- The bounded migration entry point now also requires the upstream bounded
  workflow audit to pass before migration/deletion planning can proceed.
- The bounded migration entry point now requires the bounded workflow result and
  embedded workflow context to carry matching, usable evidence-quality
  snapshots before migration/deletion planning can proceed.
- The bounded migration entry point now requires the workflow's approved
  readiness source-admission audit to match both workflow source summaries and
  carries only the verified summary into migration-plan provenance. The design
  record is [Policy Migration Decision-Source Provenance](policy-migration-decision-source-provenance.md).
- Policy migration deletion path architecture cutover is documented in
  [Policy Migration Deletion Path Architecture Cutover](policy-migration-deletion-path-architecture-cutover.md).
- Policy migration quality-gate hardening is documented in
  [Policy Migration Quality Gate](policy-migration-quality-gate.md).
- Policy migration quality-gate architecture cutover is documented in
  [Policy Migration Quality Gate Architecture Cutover](policy-migration-quality-gate-architecture-cutover.md).

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

- Policy engine completion is documented in
  [Policy Engine Completion Audit](policy-engine-completion-audit.md).
- The completion audit lives in
  `server/src/services/policyEngineCompletionAudit.mjs`.
- The focused completion-audit test suite lives in
  `server/src/__tests__/services/policyEngineCompletionAudit.test.mjs`.
- Current completion audit verifies seven policy-engine records: artifact
  inventory and cutline, evidence engine, intent engine, learning guard,
  readiness engine, operator workflow, and migration/deletion.
- The gate fails if any component lacks a doc, service, test, passing audit, or
  expected semantic `nextStep` chain.
- The gate also builds the bounded policy-engine handoff chain and fails if
  evidence, intent, learning, readiness, workflow, or migration wrappers fail,
  have missing or non-passing nested audits, drift away from the shared
  sanitized evidence projection fingerprint, miss/drop/drift evidence-quality
  snapshots, carry insufficient quality, carry raw evidence labels in boundary
  provenance, or drop/alter the approved decision-source chain from readiness
  through workflow and migration. The design record is
  [Policy Engine Completion Decision-Source Chain](policy-engine-completion-decision-source-chain.md).
- The completion quality-chain hardening is documented in
  [Policy Engine Completion Quality Chain](policy-engine-completion-quality-chain.md).
- Policy engine completion quality-chain architecture cutover is documented in
  [Policy Engine Completion Quality Chain Architecture Cutover](policy-engine-completion-quality-chain-architecture-cutover.md).
- The gate also fails if legacy replay, impact, provider, TMDB, scoring, or old
  policy-builder documentation artifacts lack explicit migration/deletion
  decisions, remain allowed in the normal operator workflow, or unblock native
  storage prematurely.

Current starting point:

- The 6R contract foundation is complete. Use it as the server projection input
  for 4R, and reopen an engine component only when the Phase 5R authority
  reconciliation or a live 4R state exposes a missing bounded contract.
- Do not reintroduce provider, replay, impact, or diagnostic product UI.

## Phase 7R: Runtime Automation And Library Rebuild

Status: contract-complete foundation. The focused runtime completion audit
passes for the checked-in runtime/rebuild contract chain. Production delivery
still requires 4R's live authoring evidence and 8R's installation-specific
native-storage evidence where applicable.

Intent: make the re-imagined engine operational at runtime. Phase 7R is where
Classifarr stops treating policy intent as a builder-only concept and starts
using server-owned evidence, intent, readiness, question, and learning contracts
to classify, ask, route, and rebuild safely.

Phase 7R depends on these prior contracts:

- product vocabulary and authority model,
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

- Runtime decision inventory is documented in
  [Policy Runtime Decision Inventory](policy-runtime-decision-inventory.md).
- The server-owned runtime inventory lives in
  `server/src/services/policyRuntimeDecisionInventory.mjs`.
- The focused runtime-inventory test suite lives in
  `server/src/__tests__/services/policyRuntimeDecisionInventory.test.mjs`.
- Policy runtime decision inventory architecture cutover is documented in
  [Policy Runtime Decision Inventory Architecture Cutover](policy-runtime-decision-inventory-architecture-cutover.md).
- Current implementation classifies runtime artifacts as
  `keep_runtime_engine_primitive`, `rewrite_around_policy_contracts`,
  `replace_with_readiness_question_contract`, or `delete_after_migration`.
- The inventory now requires critical runtime surface coverage for
  classification route entrypoints, pending/correction routes, second-pass
  diagnostics, metadata enrichment, Discord pending notifications,
  classification orchestration, routing, and persistence paths so new runtime
  behavior cannot bypass the cutline silently.
- The inventory now separates queue dispatch from retry and requires the queue
  service, worker loop, task processor, mutation service, and scheduled retry
  driver. Dispatch paths explicitly identify stale-decision replay and
  classification/routing-conflation risks before runtime wiring changes. The
  design and outcome are documented in [Policy Runtime Queue Dispatch
  Cutline](policy-runtime-queue-dispatch-cutline.md).
- Runtime entrypoints are also a required stage, and authority identifiers
  outside the server-owned vocabulary fail focused inventory validation.
- The inventory now also requires Phase 7R runtime/rebuild contract surface
  coverage for evidence projection, evidence fingerprinting, automation
  decisions, question reduction, request-time learning, library rebuild,
  migration verification, and runtime metrics/trace services so replacement
  contracts cannot bypass the cutline silently.
- Every runtime artifact identifies an authority source before behavior changes:
  media-server contents, declared operator intent, manual outcome, AI output,
  metadata provider evidence, or legacy template compatibility.
- Known bad question paths are listed for replacement: genre-priority
  questions, AI invalid-response questions, AI disagreement questions, and
  pending resolution rule-generation flags.
- Classification/routing conflation and broad-genre authority risks are
  explicit cutline risks before runtime evidence projection work begins.

### 7R.2 Runtime Evidence Projection

Intent: ensure runtime classification uses the same evidence buckets as policy
rebuild and readiness.

Tasks:

- Build or identify a runtime evidence projection that can evaluate an item
  against candidate destinations using policy evidence buckets:
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

- Runtime evidence projection is documented in
  [Policy Runtime Evidence Projection](policy-runtime-evidence-projection.md).
- Policy runtime evidence projection architecture cutover is documented in
  [Policy Runtime Evidence Projection Architecture Cutover](policy-runtime-evidence-projection-architecture-cutover.md).
- The server-owned runtime evidence projection lives in
  `server/src/services/policyRuntimeEvidenceProjection.mjs`.
- The focused runtime-evidence test suite lives in
  `server/src/__tests__/services/policyRuntimeEvidenceProjection.test.mjs`.
- Current implementation maps runtime library profile, operator intent,
  classification history, manual corrections, pending answers, RAG neighbors,
  metadata signals, Arr routing outcomes, and profile freshness into policy
  evidence buckets.
- Low-trust RAG neighbors, unknown-library evidence, stale profile state,
  failed routing, raw provider payloads, and unsupported broad genre overlap are
  demoted with bounded reason codes instead of becoming destination authority.
- The projection is deterministic, side-effect-free, does not call live
  providers, suppresses raw payloads, and emits bounded trace attributes for
  later runtime decision tracing.
- Queue-dispatched classification now has a separate server-owned evidence
  admission boundary. It projects only allowlisted current evidence, rejects
  cached projections/automation decisions and unsupported inputs, and binds a
  fresh projection fingerprint to an opaque task fingerprint and retry attempt.
  It remains side-effect-free and does not yet alter worker execution. The
  design and outcome are documented in [Policy Runtime Queue Evidence
  Admission](policy-runtime-queue-evidence-admission.md).
- Each runtime evidence projection now includes a stable sanitized SHA-256
  fingerprint with bounded provenance counts/source ids, allowing automation
  decisions to bind to the exact evidence projection without
  carrying raw evidence labels forward.
- The projection audit now recomputes the sanitized fingerprint, verifies the
  carried provenance and trace attributes, and rejects stale, malformed, or
  mismatched fingerprint handoffs before automation can consume runtime
  evidence.
- Runtime operator intent now uses the shared bounded evidence boundary. A
  rejected intent is omitted with a stable warning while independent runtime
  evidence remains available; the sanitized boundary context is bound into the
  runtime fingerprint and audit. Its design record is [Policy Runtime Operator
  Intent Boundary](policy-runtime-operator-intent-boundary.md).
- Runtime evidence adapters now reuse the shared bounded entry normalizer and
  reject source-authority relabeling during audit, so runtime and core evidence
  retain the same primitive field and provenance contract. Its design record is
  [Policy Runtime Evidence Entry Contract](policy-runtime-evidence-entry-contract.md).
- Runtime evidence now derives bounded trace reasons from sanitized entries and
  validates fixed warning records plus the complete trace-attribute map against
  the projection fingerprint. Its design record is [Policy Runtime Evidence
  Trace Contract](policy-runtime-evidence-trace-contract.md).

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
- Carry the sanitized runtime evidence projection fingerprint through the
  decision evidence block and trace attributes.
- Reject missing, malformed, mismatched, or raw-provenance fingerprints before a
  decision can pass validation.
- Require the decision evidence block to carry the runtime evidence validation
  result, and reject trace `evidence_valid` values that drift from that result.

Acceptance criteria:

- Runtime can distinguish classify, route, ask, skip, and blocked states.
- Missing route mapping cannot look like a completed route.
- Automatic decisions are explainable from server-owned evidence and intent.

Implementation status:

- Automation decision contract is documented in
  [Policy Automation Decision Contract](policy-automation-decision-contract.md).
- Policy automation decision contract architecture cutover is documented in
  [Policy Automation Decision Contract Architecture Cutover](policy-automation-decision-contract-architecture-cutover.md).
- The server-owned automation decision contract lives in
  `server/src/services/policyAutomationDecisionContract.mjs`.
- The focused automation-decision test suite lives in
  `server/src/__tests__/services/policyAutomationDecisionContract.test.mjs`.
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
- Queue-dispatched classification now has a separate server-owned decision
  adapter. It revalidates the fresh queue evidence admission, binds the existing
  automation decision to opaque task/evidence/execution fingerprints, rejects
  raw or unsupported inputs, and remains side-effect-free without changing
  worker behavior. The design and outcome are documented in [Policy Runtime
  Queue Automation Decision](policy-runtime-queue-automation-decision.md).
- The decision contract also requires nested runtime evidence validation proof
  and rejects decisions whose bounded trace evidence-valid attribute disagrees
  with the evidence block.
- Automation decision output now uses a server-owned state/action/permission
  matrix with canonical state-specific reasons and trace attributes. Mutated
  actions, permissions, reason records, or trace fields fail validation before
  a later execution component can act. Its design record is [Policy Automation
  Decision Output Contract](policy-automation-decision-output-contract.md).
- Decision construction now separates raw runtime-input adaptation from the
  projection-only state-machine reducer. Raw evidence cannot be rebuilt by the
  reducer; its design record is [Policy Automation Decision Input
  Boundary](policy-automation-decision-input-boundary.md).

### 7R.4 Runtime Question Reduction

Intent: ask fewer, better questions only when automation cannot proceed safely.

Tasks:

- Use policy question contracts for all runtime review prompts.
- Ask only for destination-fit uncertainty, hard-limit conflicts, routing gaps,
  stale profile conditions, or insufficient identity evidence.
- Reject or rewrite genre-priority questions before persistence.
- Prefer exact item confirmation over broad policy learning when evidence is
  weak.
- Ensure old pending questions are routed through stale-question cleanup before
  they can be answered or learned from.
- Carry the automation decision evidence fingerprint into the question-reduction
  plan, planned question, and bounded trace attributes.
- Carry the automation decision validation result and reject bounded trace
  `decision_valid` values that drift from the carried validation proof.

Acceptance criteria:

- Runtime questions match product vocabulary.
- Questions include learning eligibility metadata.
- Manual answers resolve outcomes without automatically mutating policy.

Implementation status:

- Runtime question reduction is documented in
  [Policy Runtime Question Reduction](policy-runtime-question-reduction.md).
- Policy runtime question reduction architecture cutover is documented in
  [Policy Runtime Question Reduction Architecture Cutover](policy-runtime-question-reduction-architecture-cutover.md).
- The server-owned runtime question reducer lives in
  `server/src/services/policyRuntimeQuestionReduction.mjs`.
- Queue-dispatched classification now uses the separate, side-effect-free
  `server/src/services/policyRuntimeQueueQuestionReduction.mjs` adapter. It
  re-audits a ready queue automation decision, retains only opaque execution
  provenance, and binds the resulting question plan to the same evidence
  fingerprint without persisting or sending a question.
- The focused runtime-question test suite lives in
  `server/src/__tests__/services/policyRuntimeQuestionReduction.test.mjs`.
- Current implementation consumes `policy.automation_decision.v1` and returns
  a disposition instead of directly creating questions: `suppress_question`,
  `create_operator_question`, `configure_routing`, `refresh_profile`,
  `block_automation`, `gather_evidence`, or `stale_question_cleanup`.
- `auto_route_ready` suppresses questions; `classified_not_routed` and
  `needs_routing_mapping` become routing actions; stale profiles become refresh
  actions; stale or legacy pending questions must go through cleanup before
  answer or learning.
- Operator questions are limited to accepted policy question frames and include
  learning eligibility metadata with durable learning disabled by default.
- Rejected legacy frames such as broad-genre priority, AI-authored policy edit,
  provider-specific diagnostic, and replay parity interpretation are rewritten
  before persistence.
- Question-reduction plans now preserve the sanitized automation decision
  evidence fingerprint across the plan, planned question, and trace attributes;
  validation rejects missing or mismatched bindings before a question can pass.
- Question-reduction plans also carry the automation decision validation result
  and fail validation when that proof is missing, mismatched with the embedded
  decision, or not mirrored by the bounded question trace.
- Clarification construction now separates raw runtime-input adaptation from
  the decision-only reducer. The reducer requires a valid automation decision
  and rejects raw decision fields; its design record is [Policy Runtime
  Clarification Decision Boundary](policy-runtime-clarification-decision-boundary.md).
- Question-reduction validation now recomputes the allowed disposition, action,
  planned question, learning metadata, and bounded trace from the embedded
  automation decision. Altered plan or trace fields fail before a later
  persistence component can act.

### 7R.5 Request-Time Learning And Destination Selection

Intent: treat media requests and manual destination choices as meaningful but
not automatically durable learning.

Tasks:

- Define how request/import flows provide destination intent signals.
- Record request-time destination choice separately from final routed outcome.
- Pass request-time decisions through the policy learning guard before profile or
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
- Carry bounded runtime question-reduction validation proof into the
  request-time decision and mirror that validity state into trace attributes.

Acceptance criteria:

- Request-time choices can improve future decisions only through the learning
  guard.
- A failed route does not become positive destination evidence.
- Manual changes are auditable and reversible.
- Request-time learning cannot pass validation when the upstream
  question-reduction proof is missing, invalid, fingerprint-drifted, or not
  reflected in trace.

Implementation status:

- Request-time learning and destination selection is documented in
  [Policy Request-Time Learning And Destination Selection](policy-request-time-learning.md).
- Policy request-time learning architecture cutover is documented in
  [Policy Request-Time Learning Architecture Cutover](policy-request-time-learning-architecture-cutover.md).
- The server-owned request-time learning contract lives in
  `server/src/services/policyRequestTimeLearning.mjs`.
- The focused request-time learning test suite lives in
  `server/src/__tests__/services/policyRequestTimeLearning.test.mjs`.
- Request-time learning now uses the shared final-outcome normalizer, so routed
  and missing-mapping outcomes retain their validated route state when they pass
  through the learning guard; neither event can claim direct learning or a
  policy write.
- Current implementation normalizes five runtime event types:
  `user_requested_destination`, `operator_confirmed_destination`,
  `operator_manual_destination_change`, `route_succeeded`, and
  `route_failed_missing_mapping`.
- Destination selection is recorded separately from final outcome so request
  preference, operator change, and routed result cannot be conflated.
- Request-time and manual decisions are passed through the policy learning
  guard before they can become learning candidates or request profile refresh.
- Successful Arr routing records a routed final outcome but cannot write durable
  learning directly.
- Missing Arr mapping records a route-failure outcome and is explicitly blocked
  from becoming positive destination evidence.
- Manual destination changes are marked auditable and reversible. Request,
  import, Discord, and routing adapters remain side-effect-free at the policy
  boundary; none can directly mutate policy evidence, queue a profile refresh,
  or perform provider, quota, or routing work.
- Request/import classification tasks now use the bounded
  `policyRequestImportDestinationAdmission.mjs` adapter after classification.
  It records only successful Arr routes and missing Arr mappings in the
  completed task result, never infers a requester destination choice, and
  requires a valid task- and attempt-bound queue question-reduction envelope
  before it can call the request-time reducer. The live queue invokes
  `classificationServiceCore.mjs` through its queue-only entry point, and
  `policyNativeClassificationQuestionHandoff.mjs` supplies current native
  inputs only when the selected library matches a validated native runtime
  candidate. `policyRuntimeQueueQuestionReductionProducer.mjs` rebuilds the
  queue evidence, decision, and opaque envelope from declared intent, the
  persisted library profile, and stored routing mapping; it cannot read live
  media/provider state, consume quota, route, create a question, or write
  learning. Direct generic plans remain internal to pending-question
  persistence and are retired as request/import terminal proof. Legacy,
  malformed, and selected-library-mismatched results remain outcome-only
  through the learning guard. Its design records are
  [Policy Native Classification Question Handoff](policy-native-classification-question-handoff.md)
  and
  [Policy Request/Import Destination Admission](policy-request-import-destination-admission.md),
  plus [Policy Runtime Queue Question-Reduction Producer](policy-runtime-queue-question-reduction-producer.md).
- Queue-produced question-reduction plans now reach request-time learning only
  through `policyRequestTimeQueueQuestionReduction.mjs`. It re-audits the queue
  envelope, binds its opaque evidence to the current classification task and
  attempt, admits terminal routing outcomes only, and preserves outcome-only
  fallback for invalid, stale, cross-task, or competing proof. Its design
  record is [Policy Request-Time Queue Question-Reduction Admission](policy-request-time-queue-question-reduction.md).
- Request-time terminal-route integration is now audited by
  `policyRequestTimeTerminalRouteIntegrationAudit.mjs`. It inventories the
  request/import queue's active queue-bound proof and outcome-only fallback
  alongside native pending's outcome-only route persistence. It verifies the
  queue-specific classification call, queue producer, queue-only terminal
  handoff, and absence of a direct terminal plan. Its design record is [Policy
  Request-Time Terminal-Route Integration Audit](policy-request-time-terminal-route-integration-audit.md).
- Task 7R.5.2 is complete: the request/import terminal admission no longer
  accepts a direct generic question-reduction plan. A source-backed terminal
  audit fails if that obsolete input returns. The producer cutover retains the
  persisted native pending-question plan solely for separately validated manual
  selection provenance; native pending route results remain outcome-only and
  manual corrections retain their own exact-item learning guard. Its design
  record is [Policy Request-Time Learning Provenance
  Cutover](policy-request-time-learning-provenance-cutover.md).
- Queue webhook history now writes the normalized selected library name rather
  than treating the legacy string result as an object.
- The first live runtime adapter now handles authenticated manual classification
  corrections. It loads the corrected destination from the database, validates
  media-type compatibility, records the final outcome, and creates exact-item
  memory only when `policyManualCorrectionLearning.mjs` and the learning guard
  admit it. The endpoint no longer accepts caller-controlled audit actors or
  reinforces broad metadata patterns from one correction. Its design record is
  [Policy Manual-Correction Learning Admission](policy-manual-correction-learning-admission.md).
- Native pending-item answers now resolve through the authoritative policy
  resolver with legacy rule generation disabled. Before browser or Discord
  routing can begin, `policyNativePendingResolutionProvenance.mjs` validates the
  persisted normalized question, selected allowlisted outcome, alternate
  destination binding, and complete question-reduction fingerprint chain. It
  records the bounded selection as a separate request-time transition and passes
  it through the learning guard. Current outcomes remain outcome-only; Discord
  labels, identities, and interaction metadata cannot create exact-item or broad
  policy evidence. Malformed native selections fail retry-safe rather than using
  a legacy fallback. Its design record is [Policy Native Pending-Resolution
  Provenance](policy-native-pending-resolution-provenance.md).
- Native pending route-result persistence now uses the shared
  `policyNativePendingRouteOutcome.mjs` and
  `policyNativePendingRouteOutcomePersistence.mjs` components in both browser
  and Discord flows. They derive the destination from resolver provenance,
  reuse the normalized request-time route event, and append only an actual
  `route_succeeded` or a confirmed `route_failed_missing_mapping` transition.
  The adapter and persistence wrapper remain outcome-only: no route result can
  write policy evidence or queue profile refresh work. Its design record is
  [Policy Native Pending-Route Outcome Adapter](policy-native-pending-route-outcome.md).
  Completion, transient failures, invalid metadata, and already-routed results
  remain separate operational states rather than policy evidence.
- Phase 7R Completion Audit Task 7R.10.1 is complete. Request-time learning
  now inventories native pending selection and route-outcome documentation,
  services, and focused tests; the runtime/rebuild reset independently requires
  their outcome-only coverage and static ESM contract ownership. Its design
  record is [Policy Runtime Completion Native Pending Adapter
  Coverage](policy-runtime-completion-native-pending-adapter-coverage.md).
- Valid native `create_operator_question` plans now pass through
  `policyRuntimeQuestionPersistenceAdmission.mjs` immediately before the
  existing classification persistence call. It re-audits the native handoff,
  reconstructs the reduction plan, preserves existing questions, and applies a
  canonical pending-question envelope only when the selected library remains
  valid. The existing classification-history transaction and pending-item
  notifications materialize the one pending record; automatic Arr routing
  stops at the established non-final gate. Native browser and Discord answers
  remain outcome-only even when a legacy caller requests rule generation. Its
  design record is [Policy Runtime Question Persistence Admission](policy-runtime-question-persistence-admission.md).
- Native pending-question presentation now has a bounded browser and Discord
  adapter. The server validates the canonical envelope before it projects the
  two allowed outcome buttons, while the Command Center renders only
  `Resolve in <destination>`, `Resolve without learning`, an explicit alternate
  destination path, and retry. Generic confirm and option-list controls are
  not rendered for native envelopes, and bulk confirmation skips them. Discord
  explains that alternate destinations must be chosen in Classifarr instead of
  reusing the legacy correction workflow. The design record is [Policy Native
  Pending-Question Presentation](policy-native-pending-question-presentation.md).
- Native pending resolutions now append a bounded
  `native_pending_resolution` transition before the existing `resolved`
  transition. The transition distinguishes a suggested destination from an
  operator confirmation or explicit alternate destination, carries only the
  normalized outcome and guarded request-time summary, and never claims that
  routing succeeded. The Discord-specific post-route guard adapter was removed
  so browser and Discord share this one resolver-owned provenance boundary.
- Request-time learning decisions now preserve the upstream sanitized evidence
  fingerprint through the decision, bounded learning-guard context, and trace;
  validation rejects missing or mismatched fingerprint handoffs.
- Request-time learning decisions now carry bounded question-reduction
  validation proof, preserve the same sanitized evidence fingerprint from the
  question-reduction handoff, and fail validation when proof or trace validity
  drifts.
- Request-time validation now recomputes bounded trace output from the
  normalized event, route result, learning guard, and question-reduction proof.
- Request-time learning now separates raw runtime adaptation, normalized event
  construction, and validated-plan reduction. The reducer derives provenance
  only from the clarification plan and rejects raw question, automation, event,
  and fingerprint fields; its design record is [Policy Request-Time Learning
  Input Boundary](policy-request-time-learning-input-boundary.md).

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
- Refuse to consume guarded outcomes that do not pass request-time learning
  validation, including bounded question-reduction proof.
- Keep guarded-outcome fingerprint trace counts synchronized with bounded source
  summaries.
- Keep guarded-outcome request-proof trace counts synchronized with bounded
  source summaries.

Acceptance criteria:

- Rebuild proposals explain evidence source and confidence.
- Rebuild proposals only consume guarded outcomes that carry sanitized SHA-256
  upstream evidence fingerprints.
- Rebuild proposals only consume guarded outcomes that carry valid request-time
  learning proof and matching question-reduction evidence fingerprints.
- The decision-only rebuild reducer accepts only a validated guarded-outcome
  projection and rejects raw guarded outcomes and raw learning decisions.
- Missing guarded-outcome fingerprints and trace/source summary mismatches fail
  validation before migration comparison.
- Missing or invalid guarded-outcome request proof and trace/source summary
  mismatches fail validation before migration comparison.
- Rebuild readiness uses a verified no-write handoff rather than fabricating a
  request-time learning event, and its evidence, intent, and readiness
  fingerprints must agree before a proposal can be reviewed.
- Rebuild does not automatically delete or replace existing policies.
- Explicit operator constraints are preserved unless the operator changes them.

Implementation status:

- Library-derived policy rebuild is documented in
  [Policy Library-Derived Policy Rebuild](policy-library-policy-rebuild.md).
- Policy library-derived policy rebuild architecture cutover is documented in
  [Policy Library-Derived Policy Rebuild Architecture Cutover](policy-library-policy-rebuild-architecture-cutover.md).
- The server-owned rebuild proposal contract lives in
  `server/src/services/policyLibraryPolicyRebuild.mjs`.
- Task 7R.6.1 is complete: `policyLibraryRebuildInputContract.mjs` is the
  server-owned rebuild admission boundary. It requires a verified cached-profile
  handoff for the selected library, canonicalizes declared constraints and
  routing, derives observed absences only from profile evidence, and admits
  guarded outcomes only through the validated projection. Raw profile,
  freshness, absence, and learning fields are rejected before proposal
  construction; its design record is [Policy Library Rebuild Input
  Contract](policy-library-rebuild-input-contract.md).
- Task 7R.6.2 is complete: `policyLibraryRebuildAcceptanceTransition.mjs`
  converts only a current reviewable rebuild proposal into a time-bounded manual
  acceptance transition. It binds the full proposal, policy/intent/library
  context, and same-policy rollback-window plan with SHA-256 fingerprints;
  migration comparison rejects raw approval booleans and raw rollback objects.
  The transition cannot replace policy and explicitly requires later persisted
  snapshot and replay protection evidence. Its design record is [Policy Library
  Rebuild Acceptance Transition](policy-library-rebuild-acceptance-transition.md).
- The focused rebuild test suite lives in
  `server/src/__tests__/services/policyLibraryPolicyRebuild.test.mjs`.
- The focused input-contract suite lives in
  `server/src/__tests__/services/policyLibraryRebuildInputContract.test.mjs`.
- Current implementation consumes observed library profile evidence,
  fingerprint-bound guarded outcomes, explicit constraints, routing
  configuration, observed outliers, observed absences, and profile freshness.
- Rebuild evidence now flows through the shared bounded evidence boundary using
  an allow-listed envelope. A rejected boundary produces a sanitized
  `blocked_by_evidence_boundary` proposal with no projection, intent, or
  readiness output. Its design record is [Policy Library Rebuild Evidence
  Boundary](policy-library-rebuild-evidence-boundary.md).
- Rebuild output reuses policy evidence projection, intent draft, and
  readiness contracts instead of inventing a separate policy schema.
- Rebuild now invokes the bounded intent entry point instead of direct
  projection reduction. A failed intent boundary retains no derived projection,
  intent, or readiness; insufficient identity remains the actionable
  `needs_more_evidence` state. Its design record is
  [Policy Library Rebuild Intent Boundary](policy-library-rebuild-intent-boundary.md).
- Rebuild now derives a verified, side-effect-free readiness handoff from the
  guarded-outcome projection before invoking the shared bounded readiness
  wrapper. Handoff or readiness-boundary failures return no derived proposal
  contracts; its design record is [Policy Library Rebuild Readiness
  Handoff](policy-library-rebuild-readiness-handoff.md).
- Proposals include evidence source summaries, confidence, assumptions,
  warnings, an explicit operator acceptance gate, and a rollback snapshot gate.
- Guarded outcome source summaries now carry bounded accepted/missing
  fingerprint counts, request-proof counts, sanitized digest lists, and trace
  attributes mirror those counts without raw labels, prompts, or payloads.
- Guarded outcomes without upstream evidence fingerprints are not converted
  into compatibility or outlier proposal evidence and fail validation as an
  incomplete handoff.
- Guarded outcomes without valid request-time learning proof are not converted
  into compatibility or outlier proposal evidence and fail validation as an
  incomplete handoff.
- Rebuild now projects only validated request-time decisions into bounded
  guarded-outcome evidence. The decision-only reducer rejects raw outcomes and
  raw learning decisions; its design record is [Policy Library Rebuild Input
  Boundary](policy-library-rebuild-input-boundary.md).
- Observed absence is warning-only review context and cannot become avoid or
  exclusion evidence.
- Explicit hard limits and avoid rules are preserved as operator-declared
  constraints unless a later operator action changes them.
- Proposal side effects remain disabled: no activation, replacement, deletion,
  learning write, or routing write happens in this slice.

### 7R.7 Migration Verifier And Rollback Path

Intent: verify generated intent behavior before replacing legacy behavior.

Tasks:

- Use policy verifier pieces to compare legacy compatibility behavior with
  generated intent behavior.
- Keep verifier output bounded and side-effect-free.
- Bind verifier output to a stable sample-set fingerprint built from normalized
  comparison samples, verifier options, and bounded rebuild proposal evidence
  metadata.
- Recompute embedded rebuild proposal validation instead of trusting stale
  validation flags from integration code.
- Bind sample-set provenance to guarded-outcome fingerprint counts and
  request-proof counts from the embedded rebuild proposal.
- Show only migration-relevant differences:
  - destination changes,
  - newly blocked items,
  - newly review-required items,
  - route-readiness changes,
  - evidence-confidence changes.
- Require rollback snapshots before applying accepted replacements.
- Define deletion criteria for old preset/custom-signal runtime paths after
  native intent storage proves stable.

Acceptance criteria:

- Operators can see meaningful migration risk before accepting rebuilds.
- Verifier reports carry a SHA-256 sample-set fingerprint and trace attribute
  for the exact sanitized comparison set.
- Missing, malformed, or mismatched verifier fingerprints fail validation.
- Missing or stale rebuild proposal validation proof fails validation.
- Sample-set provenance that drifts from guarded-outcome fingerprint or
  request-proof counts fails validation.
- Verifier output does not become normal policy-authoring UI.
- Rollback path is explicit and tested.

Implementation status:

- Migration verifier and rollback path is documented in
  [Policy Migration Verifier And Rollback Path](policy-migration-verifier-rollback.md).
- Policy migration verifier and rollback architecture cutover is documented in
  [Policy Migration Verifier And Rollback Architecture Cutover](policy-migration-verifier-rollback-architecture-cutover.md).
- The server-owned verifier contract lives in
  `server/src/services/policyMigrationVerifierRollback.mjs`.
- The focused verifier test suite lives in
  `server/src/__tests__/services/policyMigrationVerifierRollback.test.mjs`.
- Current implementation consumes a durable library-derived rebuild proposal and sanitized
  representative legacy/proposed comparison samples.
- Verifier construction now separates raw rebuild input from a validated
  rebuild-proposal reducer. The reducer rejects raw `proposalInput` values and
  validates the proposal before comparison or rollback-gate derivation; its
  design record is [Policy Migration Verifier Proposal
  Boundary](policy-migration-verifier-proposal-boundary.md).
- Verifier reports now carry a stable sample-set fingerprint with bounded
  provenance for sample count, raw-payload suppression, verifier options,
  proposal version/status, sanitized proposal evidence digests,
  guarded-outcome fingerprint counts, and guarded-outcome request-proof counts.
- Trace attributes mirror the sample-set fingerprint, and validation rejects
  missing, malformed, or mismatched fingerprint handoffs.
- Validation recomputes the embedded rebuild proposal validation result and
  rejects missing or stale proposal-validation proof.
- Validation rejects sample-set provenance that no longer matches the embedded
  rebuild proposal guarded-outcome fingerprint or request-proof summary.
- Verifier output is bounded to migration-relevant differences only:
  destination changes, newly blocked items, newly review-required items,
  route-readiness changes, and evidence-confidence changes.
- Application gates require explicit operator acceptance plus rollback snapshot
  and restore path before any later replacement can apply.
- Task 7R.7.1 is complete: `policyLibraryRebuildSnapshotGate.mjs` revalidates a
  current accepted rebuild transition inside one database transaction, locks the
  matching policy and active native intent, persists the authoritative rollback
  snapshot and migration event, and records one-time execution state keyed by
  the transition fingerprint. It never replaces policy behavior. Expired,
  stale, mismatched, and competing requests are blocked; a valid repeat
  returns the original persisted execution without a second snapshot write.
  Backup restore intentionally clears this short-lived authorization state
  rather than reviving a historic approval.
- Task 7R.7.2 is complete: `policyLibraryRebuildReplacementGate.mjs` requires
  the persisted snapshot gate and a no-difference verifier report bound to the
  same accepted transition. In one transaction it locks the policy, original
  intent, execution record, and current rollback snapshot; writes the next
  native intent version, rules, routing target, validation status, and a
  replacement event; then marks the gate terminal. A matching retry returns
  that terminal execution without a second write. Typed identity, helpful, and
  avoid entries translate deterministically; label-only strict constraints are
  blocked rather than guessed. Its design record is [Policy Library Rebuild
  Replacement Gate](policy-library-rebuild-replacement-gate.md).
- Task 7R.7.3 is complete: versioned structured strict-constraint descriptors
  now preserve exact native signal, operator, values, mode, and semantics
  through the sanitized rebuild input, evidence projection, and intent draft.
  Replacement converts only validated descriptors into native hard-limit rules;
  unknown, malformed, and label-only constraints remain blocked. Its design
  record is [Policy Library Rebuild Strict-Constraint
  Descriptors](policy-library-rebuild-strict-constraint-descriptors.md).
- Legacy deletion readiness is blocked until native intent storage is stable,
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

- Runtime metrics and decision trace is documented in
  [Policy Runtime Metrics And Decision Trace](policy-runtime-metrics-trace.md).
- The active architecture-name cutover is documented in
  [Policy Runtime Metrics And Decision Trace Architecture Cutover](policy-runtime-metrics-trace-architecture-cutover.md).
- The server-owned metrics/trace projection lives in
  `server/src/services/policyRuntimeMetricsTrace.mjs`.
- Metrics aggregation now accepts only a valid normalized metrics-input
  contract. The runtime adapter suppresses sensitive raw fields before the
  reducer can aggregate counters or traces; its design record is [Policy
  Runtime Metrics Input Boundary](policy-runtime-metrics-input-boundary.md).
- The focused metrics/trace test suite lives in
  `server/src/__tests__/services/policyRuntimeMetricsTrace.test.mjs`.
- Current implementation counts policy runtime automation, question, learning,
  rebuild, migration verifier, and rebuild lifecycle outcomes into bounded
  counters for auto-routed, classified-not-routed, review, hard-limit block,
  missing routing, stale profile, learning allowed/blocked/downgraded, rebuild
  accepted/rejected, and rollback events.
- Trace records use stable `classifarr.policy.runtime_metrics_trace.*`
  attributes, bounded component ids, bounded reason codes, and a configurable
  `maxTraceRecords` limit.
- Trace records now carry supported upstream SHA-256 source fingerprints from
  automation decisions, question reductions, request-time learning decisions,
  rebuild proposals, and migration verifier reports. Rebuild proposal traces use
  a derived guarded-outcome fingerprint-set digest so metrics can correlate to
  rebuild evidence without copying labels, item titles, or raw evidence.
- Validation rejects malformed or mismatched trace fingerprint attributes.
- Raw provider payloads, raw replay/impact payloads, prompts, embeddings,
  provider payloads, and diagnostic internals are suppressed from trace output.
- Operator summaries are limited to action-oriented next steps such as configure
  routing, review pending items, refresh profile, review rebuild verifier, or no
  action required.
- Task 7R.8.1 is complete: the server-owned runtime metrics persistence
  admission accepts only the validated metrics-trace contract, rejects
  unsupported, raw, prompt, embedding, provider, and identity fields, and
  produces only a minimized counter/trace-summary snapshot. It requires a
  1-90 day `recorded_at` retention policy with a 30-day default, fingerprints
  the snapshot, and keeps storage and OpenTelemetry export disabled. Its design
  record is [Policy Runtime Metrics Persistence
  Admission](policy-runtime-metrics-persistence-admission.md).
- Metrics storage and OpenTelemetry export remain future integration work. Any
  future sink must consume only a revalidated admitted snapshot, enforce
  physical expiry, and add no ordinary policy-authoring control.

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
- Require each declared runtime contract to map to a focused ESM test that
  statically imports the service it claims to protect.

Acceptance criteria:

- Tests fail when runtime bypasses server authority.
- Tests distinguish classification success from routing success.
- Tests protect rebuild safety without freezing old preview UI.

Implementation status:

- Runtime and rebuild test reset is documented in
  [Policy Runtime And Rebuild Test Reset](policy-runtime-rebuild-test-reset.md).
- The active architecture-name cutover is documented in
  [Policy Runtime And Rebuild Test Reset Architecture Cutover](policy-runtime-rebuild-test-reset-architecture-cutover.md).
- Current implementation adds a server-owned reset manifest that classifies
  runtime/rebuild tests as kept regressions, runtime contract rewrites, or
  abandoned impact/replay diagnostic deletion candidates.
- The reset now verifies that each declared test artifact path is
  repository-relative, resolves inside the repository, and exists on disk, so
  stale replacement paths fail validation instead of remaining documentation.
- The reset now also verifies contract-to-test ownership: every required
  runtime service has a focused ESM test artifact that statically imports its
  declared service. Guarded-outcome projection and runtime-metrics input are
  distinct required contracts, and the retention-bound metrics persistence
  admission is also required; unknown, missing, or mismatched mappings fail
  closed. The design record is
  [Policy Runtime Rebuild Test Contract Coverage](policy-runtime-rebuild-test-contract-coverage.md).
- Required reset coverage now explicitly includes broad genre no specialized
  auto-route, missing routing as `classified_not_routed`, stale questions unable
  to learn, guarded request-time choices, explicit constraint preservation, and
  rollback snapshot requirements.
- Validation rejects runtime/rebuild rewrites that bypass server authority,
  missing-routing coverage that conflates classification and routing success,
  missing replacement contracts, missing trace reasons, missing or
  repository-escaping artifact paths, and old preview UI frozen as the migration
  contract.

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
10. **7R Completion Audit**
    Proves all runtime/rebuild contracts, artifacts, and handoffs are complete
    before Phase 8R native storage work starts.

Current starting point:

- Treat the 7R contract chain as a protected runtime foundation.
- Do not expose migration verifier details as normal authoring UI, and do not
  advance a runtime behavior change without the Phase 5R learning authority
  gate and the existing runtime completion audit.

Implementation record:

- Runtime completion audit is documented in
  [Policy Runtime Completion Audit](policy-runtime-completion-audit.md).
- The active architecture-name cutover is documented in
  [Policy Runtime Completion Audit Architecture Cutover](policy-runtime-completion-audit-architecture-cutover.md).
- The server-owned completion gate lives in
  `server/src/services/policyRuntimeCompletionAudit.mjs`.
- The focused completion audit suite lives in
  `server/src/__tests__/services/policyRuntimeCompletionAudit.test.mjs`.
- Current completion audit verifies all fourteen runtime/rebuild components:
  the runtime evidence and decision chain, library rebuild proposal and
  acceptance, migration verifier, persisted rollback snapshot, native
  replacement, structured strict constraints, metrics trace, metrics
  persistence admission, and test reset. Each
  must have current docs, services, focused tests, a passing component audit,
  and the expected semantic `nextStep` handoff before the native intent storage
  boundary can begin. It also requires the runtime/rebuild test reset to report
  complete focused ownership for every required runtime contract; a generic
  passing reset status cannot bypass that proof. Request-time learning also
  inventories the native pending selection and route-outcome supporting
  artifacts, including route persistence behavior, so their outcome-only
  boundaries cannot silently drift. Its design record is
  [Policy Runtime Completion Audit Contract Coverage](policy-runtime-completion-audit-contract-coverage.md).
- Runtime completion now also requires the policy-engine completion gate to
  pass with zero issues before native intent storage can begin. It retains only
  a sanitized dependency summary; the design record is
  [Policy Runtime Completion Engine Gate](policy-runtime-completion-engine-gate.md).

## Phase 8R: Native Intent Storage And Legacy Removal

Status: active parallel delivery lanes. Native runtime lifecycle contracts are
implemented in the repository; installation cutover remains evidence-driven per
deployment. Repository retirement is CI/release maintenance and cannot block
4R or add source-mutation capability to the running application.

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
- Migration must be current-state validated, reportable, reversible during the
  rollback window, and eventually followed by deletion of replaced paths.
- Automatic reconciliation is permitted only through the bounded Phase 8R.3.2
  maintenance workflow; ordinary policy reads, saves, and runtime decisions
  remain side-effect-free.
- Runtime reads native intent as the authority once a policy is converted.

### Phase 8R Delivery Lanes

Phase 8R has four distinct delivery lanes. They are deliberately not one
linear application workflow:

1. **Native Intent Runtime Lifecycle**: 8R.1 through 8R.13 are platform
   behavior. They own native storage, automatic conversion, authority,
   rollback, backup/restore, and runtime reads.
2. **Installation Cutover Evidence**: 8R.14 through 8R.16 establish current,
   read-only instance evidence. They may report a blocked installation but
   cannot create a policy UI, delete source, or mutate repositories.
3. **Repository Retirement**: 8R.17 through 8R.21 are release-maintenance
   concerns. Their evidence may support a reviewed CI change, but no browser,
   route, scheduler, client API, or normal running-service path may mutate
   repository source.
4. **Closure Evidence**: 8R.22 through 8R.36 prove repository
   `implementationReadiness` independently from installation `instanceCutover`.
   Neither result is authorization for source mutation.

The active boundary plan is [Policy Native Storage Runtime And
Release-Maintenance Boundary](policy-native-storage-runtime-release-boundary.md).
It rejects extending the production review-context registry proposed by the
former 8R.17.3 continuation: a running policy service must not become a source
code writer.

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
- Ensure schema maps directly to server policy intent contract fields and Phase 6R
  intent engine output.
- Avoid storing UI-only draft state, transient readiness, provider payloads,
  prompts, traces, embeddings, or replay diagnostics as durable policy intent.
- Add indexes for policy lookup, library lookup, single active policy authority, and
  migration state.

Acceptance criteria:

- Native schema can represent declared intent without legacy `customSignals`.
- Schema separates durable policy intent from evidence snapshots and migration
  metadata.
- Server validation remains required before writes.

Implementation status:

- Native schema contract is documented in
  [Policy Native Schema Contract](policy-native-schema-contract.md).
- The module-name cutover is documented in
  [Policy Native Schema Contract Module Cutover](policy-native-schema-contract-module-cutover.md).
- Current implementation defines a side-effect-free server schema contract for
  native policy intent header, intent rules, routing target reference,
  starter-template application provenance, migration events, rollback snapshots,
  and validation/schema status.
- The contract requires lookup indexes for policy, library, single active policy
  authority, rule lookup, rule JSONB values, routing target, migration state,
  rollback expiry, and validation status.
- Validation rejects legacy `customSignals`-style storage gaps, missing server
  policy intent rule fields, unbounded rollback snapshots, missing server
  validation gates, missing referential boundaries, missing single-active-policy
  uniqueness, and durable UI/provider/prompt/trace/embedding/replay diagnostic
  fields.
- This component does not create database tables yet; SQL migration and
  conversion are reserved for later Phase 8R components after the candidate
  report and explicit conversion workflow are defined.

#### 8R.1.1 Active Native Intent Integrity Correction

Intent: repair the live schema invariant before native intent is treated as a
single policy authority.

The existing partial unique index covers `(policy_id, intent_version)` when
`active = true`. It does **not** prevent two active rows with different
versions for the same policy. That leaves runtime reads and legacy-write guards
to infer authority from an ambiguous state.

Tasks:

- Add a report that identifies policies with more than one active intent and
  records the candidate canonical row without changing data.
- Define a transactional, idempotent repair migration with an explicit
  precedence rule and migration-event audit record.
- Replace the insufficient index with a partial unique index on `policy_id`
  where `active = true`.
- Test clean installs, upgraded installations, duplicate repair, rollback on
  invalid candidates, and concurrent active-intent attempts.

Acceptance criteria:

- Every policy has zero or one active native intent at the database level.
- Runtime and write guards can rely on that invariant instead of resolving
  duplicates heuristically.
- Repair never silently discards a native-intent payload.

Implementation status:

- The implementation design and operational outcome are documented in
  [Policy Active Intent Integrity Correction](policy-active-intent-integrity-correction.md).
- `policyActiveIntentIntegrity.mjs` provides a read-only, bounded duplicate
  report and chooses a canonical candidate only from `valid` or `warning`
  active intents using deterministic precedence.
- `20260713_150000_enforce_single_active_policy_intent.sql` locks writers,
  aborts before mutation for invalid-only duplicate groups, preserves every
  noncanonical row by deactivating and linking it to the canonical record, and
  records a metadata-only repair event.
- `idx_policy_intents_one_active_policy` now enforces one active intent per
  policy at the database level. Post-upgrade writes lock the owning policy row,
  and restore fails closed rather than silently skipping an unmappable active
  intent.

### 8R.2 Migration Candidate Report

Intent: identify which policies can safely move to native intent before writing
anything.

Tasks:

- Add dry-run reporting for every policy:
  - ready to convert,
  - needs operator review,
  - partial legacy inference,
  - unsupported legacy shape,
  - blocked by server contract validation.
- Report routing-target availability and profile freshness as a separate,
  bounded automation-readiness projection. Neither operational condition may
  block conversion of an otherwise valid native-intent contract.
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

- The policy intent migration candidate report is documented in
  [Policy Intent Migration Candidate Report](policy-intent-migration-candidate-report.md)
  and its module cutover record is captured in
  [Policy Intent Migration Candidate Report Module Cutover](policy-intent-migration-candidate-report-module-cutover.md).
- Current implementation adds a server-owned dry-run report that classifies each
  emitted policy as ready to convert, needing operator review, partial legacy
  inference, unsupported legacy shape, or blocked by server contract
  validation. It separately reports whether routing automation is ready, needs
  a routing target, needs a profile refresh, or needs both.
- The report uses the existing policy intent compatibility contract as the
  projection authority, then adds unsupported-shape, validation, bounded-reason,
  and deletion-impact checks. Routing-target and profile-freshness state are
  retained as automation blockers without retaining valid intent in legacy
  storage.
- Validation rejects reports that mutate storage, omit affected policy details,
  hide conversion or automation blockers behind generic statuses, omit
  deletion-impact estimates, or expose raw legacy JSON outside explicit
  maintainer mode.
- Runtime output now uses the durable `policy.intent_migration_candidate_report.v3`
  contract and `nextStep.stepId = explicit_conversion_workflow`, leaving roadmap
  phase IDs as planning metadata only.

#### 8R.2.1 Candidate Authority Eligibility

Intent: ensure migration readiness never describes a policy with ambiguous
active native authority as ready to convert or safe to automate.

Tasks:

- Compose the active-intent integrity report into candidate reporting before
  conversion readiness is calculated.
- Mark active-authority conflict as a bounded, explainable blocker with policy
  ID and candidate state, without exposing raw intent payloads.
- Keep candidate reporting read-only and preserve the existing compatibility
  projection for unresolved policies.

Acceptance criteria:

- A policy with two active native intents cannot be marked ready to convert.
- Invalid-only duplicate groups clearly require operator resolution.
- Clean policies retain the existing candidate-report result shape and
  side-effect-free behavior.

Implementation status:

- The design and outcome are documented in
  [Policy Candidate Authority Eligibility](policy-candidate-authority-eligibility.md).
- `policyCandidateAuthorityEligibility.mjs` reduces the active-intent integrity
  report to a policy-local, bounded eligibility decision without exposing native
  intent payloads or row IDs.
- The migration candidate report now assigns
  `blocked_by_active_intent_authority` before normal readiness calculation and
  validates that the blocker cannot be downgraded or emitted without
  explainable conflict details.
- Post-upgrade dry-run and apply entry points load the metadata-only integrity
  report with their bounded policy input, so an ambiguous active native
  authority cannot be selected for conversion.
- Policies without an authority conflict keep the existing candidate result
  shape and the report remains side-effect-free.

### 8R.3 Explicit Conversion Workflow

Intent: convert policies only when a scheduler-owned or controlled maintenance
process has a clear, auditable action.

Tasks:

- Convert selected policies from compatibility projection to native intent.
- Require Phase 5R validation before insert/update.
- Require Phase 7R migration verification for behavior-sensitive policies.
- Create a rollback snapshot before conversion.
- Record actor/source:
  - native intent reconciliation,
  - post-upgrade apply mode,
  - test fixture,
  - maintainer migration tool.
- Keep conversion idempotent.

Acceptance criteria:

- Conversion cannot run from ordinary policy read or unrelated save.
- Converted policies have native intent records and migration events.
- Failed conversion leaves the old active policy behavior intact.

Implementation status:

- The policy intent conversion workflow is documented in
  [Policy Intent Conversion Workflow](policy-intent-conversion-workflow.md)
  and its module cutover record is captured in
  [Policy Intent Conversion Workflow Module Cutover](policy-intent-conversion-workflow-module-cutover.md).
- Current implementation adds a side-effect-free server workflow plan that
  accepts selected policy IDs, an approved actor/source, a policy intent
  migration candidate report, optional migration verifier output, and rollback snapshot
  options.
- Conversion planning is allowed only for native reconciliation, post-upgrade
  apply mode, test fixtures, or maintainer migration tooling; it is rejected
  for ordinary policy reads, unrelated saves, and manual operator conversion.
- Ready conversion steps must have a ready candidate, server validation,
  rollback snapshot plan, migration event plan, native intent record plan,
  deterministic idempotency key, and legacy behavior retained until commit.
- Behavior-sensitive policies must have passing or accepted migration verifier
  output before the workflow can mark them ready.
- The interactive preview, selection, confirmation, and apply surface was
  removed. The reconciler is the normal conversion actor, while the retained
  administrator route reports bounded, read-only reconciliation status and
  blocker reasons. Recovery, rollback, and re-entry stay separately protected.
- Runtime output now uses the durable `policy.intent_conversion_workflow.v1`
  contract, `policy-intent:convert` idempotency keys, and
  `nextStep.stepId = native_runtime_read_path`, leaving roadmap phase IDs as
  planning metadata only.

#### 8R.3.1 Retired Administrator Conversion Maintenance Surface

Intent: record the removed transition path so it is not restored as product
behavior. It is not a compatibility route, endpoint, client API, service, or
dialog.

Implementation status:

- Retired by Task 8R.3.2.6.4 after automatic reconciliation, status, alerting,
  and compatibility-deletion resolution gates were verified.
- The former `/policies/native-intent-migration` route, preview/apply endpoints,
  candidate-selection composable, confirmation dialog, mutation limiter, and
  manual conversion service are deleted rather than hidden or redirected.
- The successor is `/policies/native-intent-reconciliation`, an
  administrator-only read-only status route. It exposes bounded scheduler,
  control, unresolved-inventory, and blocker-reason evidence only.

#### 8R.3.2 Automatic Native Intent Conversion Reconciliation

Intent: make native-intent conversion a bounded, server-owned maintenance
process rather than an administrator dialog, while preserving the current
authority, rollback, and audit guarantees.

Tasks:

- Create one dedicated reconciliation service that discovers unconverted
  policies, rebuilds current candidate eligibility, and invokes the existing
  post-upgrade apply gate only for ready policies.
- Run reconciliation after database migrations and on a bounded maintenance
  schedule until no ready legacy policies remain. Do not couple durable writes
  to ordinary reads, policy saves, or every process startup.
- Reuse the transactional authority locks, idempotency keys, rollback snapshots,
  migration events, and current policy validation from the existing conversion
  gate. Use the distinct `native_intent_reconciliation` actor source so
  automatic storage maintenance is auditable without being mistaken for an
  administrator or release-startup action. Do not introduce a second
  conversion writer.
- Process a bounded batch per run, record structured run outcomes, and leave
  blocked or incomplete candidates unchanged for a later retry.
- Fail closed on invalid authority, stale or insufficient evidence, missing
  required verification, or transaction failure. A blocked candidate is not a
  failed conversion and must not mark reconciliation complete.
- Keep routing, activation, policy learning, and explicit constraints outside
  the reconciler's authority. Native storage conversion must never make a
  destination automation-ready by itself.
- Replace the administrator apply dialog with a read-only status surface that
  shows last-run time, converted count, remaining ready count, and bounded
  blocked reasons. Retain an emergency disable control only as a server-side
  operational safeguard, not a normal authoring choice.
- Define a durable run/progress record so a skipped, empty, or blocked run is
  not treated as a permanently completed post-upgrade task.
- Add focused service, lifecycle, route/status, and transaction tests covering
  idempotent re-runs, mixed ready/blocked batches, retries, concurrent runner
  exclusion, rollback, and the absence of routing or policy-authoring writes.

Acceptance criteria:

- An eligible legacy policy converts without client selection, confirmation, or
  a modal dialog.
- Re-running the reconciler does not duplicate native intents, snapshots, or
  migration events for an already converted policy.
- A blocked policy remains visible to the status surface and is retried when
  its current data becomes eligible; it does not prevent other ready policies
  from converting.
- Only one reconciliation worker can apply a given batch at a time, and each
  conversion revalidates current state inside the existing transaction boundary.
- Conversion status is observable without exposing raw legacy payloads or
  creating a user-controlled write endpoint.
- Removing the dialog does not remove rollback, audit, authority-locking, or
  native runtime-read guarantees.

Implementation status:

- Task 8R.3.2.1 is implemented. Automatic reconciliation is the conversion
  actor, and the former manual administrator surface was retired by Task
  8R.3.2.6.4 after read-only status, alerting, lifecycle, and deletion-safety
  acceptance criteria passed.
- Design and outcome records:
  [Policy Native Intent Conversion Reconciler](policy-native-intent-conversion-reconciler.md)
  and [Native Intent Reconciliation Scheduler](native-intent-reconciliation-scheduler.md).
- Empty unconverted inventory now exits before lifecycle partitioning, state
  persistence, dry-run creation, and the conversion gate. It records the
  existing evaluated `no_candidates` ledger outcome rather than treating the
  intentionally absent conversion workflow as a failure. The design and outcome
  record is [Native Intent Reconciliation No-Work Safety](native-intent-reconciliation-noop-safety.md).

##### 8R.3.2.1 Scheduler Ownership And Single-Runner Exclusion

Intent: ensure automatic conversion can run from multiple application
instances without applying the same batch twice or making application startup
wait on storage maintenance.

Tasks:

- Register one bounded reconciliation task through the existing scheduler only
  after migrations and service initialization are complete.
- Add a dedicated `DB_ADVISORY_LOCKS` key and reuse
  `withSessionAdvisoryLock`; a runner that cannot acquire the lock reports a
  no-op lock-held outcome and performs no candidate scan or write.
- Run an initial non-blocking reconciliation opportunity after application
  readiness, then use a fixed maintenance cadence. Do not run conversion from
  request handlers, policy reads, or policy saves.
- Keep the scheduler lock scope around one reconciliation run while retaining
  the existing deterministic per-policy authority lock inside each apply
  transaction.
- Bound a run by both policy count and elapsed time so a large legacy inventory
  cannot monopolize the scheduler or database connection.

Acceptance criteria:

- Concurrent application instances produce at most one active reconciliation
  run.
- A runner that loses or cannot acquire the scheduler lock changes no policy
  state and does not create duplicate run evidence.
- A crashed runner releases its session lock with the database connection; a
  later scheduled run can resume from durable state.
- Application readiness does not wait for conversion completion.

Implementation outcome:

- `nativeIntentReconciliationService.mjs` invokes the existing transactional
  conversion gate with a fixed ten-policy, twenty-second execution budget.
- The service selects only policies without active native authority and excludes
  policies with a `rollback_applied` event, so ordinary recurring maintenance
  cannot immediately undo an intentional reversion.
- `schedulerService` owns one ten-minute cron task plus one non-blocking,
  ninety-second post-readiness opportunity. The recurring task uses node-cron's
  local `noOverlap` guard, while both opportunities use the dedicated session
  advisory lock key `2008` across replicas; duplicate registration, lock
  contention, and a pending initial timer are all harmless.
- Every automatic migration event has actor type `reconciler` and metadata
  source `native_intent_reconciliation`. The service returns and logs only
  bounded status, counts, and stable error IDs, never raw policy payloads.

##### 8R.3.2.2 Durable Run And Candidate Outcome Ledger

Intent: distinguish completed conversion work from deferred, blocked, and
transiently failed work without storing a second legacy-policy payload.

Tasks:

- Add a native-storage migration for bounded reconciliation run headers and
  per-policy outcomes, including run state, timestamps, candidate fingerprint,
  stable reason ID, retry-not-before timestamp, and compact counts.
- Persist outcomes only after the corresponding conversion transaction commits
  or the current candidate evaluation reaches a non-writing result. Do not let
  an empty, skipped, or lock-held attempt look like durable completion.
- Store only policy references, bounded reason IDs, state transitions, and
  fingerprints or digests; never copy `customSignals`, raw legacy JSON,
  prompts, provider payloads, or trace bodies into the ledger.
- Add retention that preserves the minimal support/audit record while pruning
  old run detail consistently with migration-event and rollback retention.
- Include the new tables in backup, restore, schema snapshot, and test-reset
  coverage.

Acceptance criteria:

- Status can explain whether a policy was converted, deferred, blocked, or
  waiting to retry without reading raw legacy policy data.
- A retry is tied to the current candidate fingerprint and cannot reuse a
  stale success or stale blocker as authority.
- Backup/restore preserves enough ledger state to resume safely without
  fabricating completed conversion work.

Implementation outcome:

- `20260715_130000_add_native_intent_reconciliation_ledger.sql` adds bounded
  native-storage run headers and per-policy outcomes with named state,
  fingerprint, count, timestamp, and reference constraints; it deliberately
  contains no policy JSON, prompts, provider data, or trace payloads.
- Reconciliation records the complete safe candidate evaluation only after the
  existing conversion transaction has returned. A failed or malformed ledger
  result cannot relabel a committed conversion as failed.
- Empty work is `evaluated` with `no_candidates`; scheduler lock contention
  does not create a durable row. Deferred outcomes carry their current
  fingerprint, while explicit retry timing and quarantine remain the scope of
  Task 8R.3.2.3.
- The ledger has transactionally locked, bounded 30-day outcome and 90-day
  header retention, plus schema, backup, restore, and lifecycle test coverage.
- Design and outcome record:
  [Native Intent Reconciliation Ledger](native-intent-reconciliation-ledger.md).

##### 8R.3.2.3 Eligibility, Retry, And Quarantine Semantics

Intent: retry transient conditions without thrashing permanently unsupported or
operator-remediation cases.

Tasks:

- Classify outcomes into `applied`, `deferred_retry`,
  `blocked_current_state`, `requires_maintenance`, and `system_failure` using
  stable server-owned reason IDs.
- Treat active-authority conflicts, invalid native state, incompatible legacy
  shapes, and required-verifier failures as non-writing blockers. They must not
  be converted merely to make inventory counts reach zero.
- Use bounded backoff for transaction, database, and transient service errors;
  reset retry eligibility only when the backoff expires or relevant candidate
  input has changed.
- Keep routing-target and profile freshness states separate from conversion
  eligibility. They can inform automation readiness but must not cause
  conversion retry churn.
- Escalate repeated technical failures to a circuit-breaker state, while keeping
  policy-local blockers visible rather than retrying them on every cadence.

Acceptance criteria:

- A blocked policy cannot prevent unrelated ready policies in the same or later
  batch from converting.
- A transient failure is retried without duplicate snapshots or migration
  events.
- An unsupported policy remains explicitly visible to support and blocks legacy
  deletion until it receives a real resolution.

Implementation outcome:

- `20260715_140000_add_native_intent_reconciliation_state.sql` adds one
  policy-local control-plane row with only a candidate fingerprint, safe state
  and reason IDs, retry timing, bounded failure count, and timestamps. It has
  no policy JSON, prompt, provider, credential, or exception-text field.
- Reconciliation inspects a bounded 100-candidate window but selects only the
  existing ten-policy apply batch. Unchanged terminal state and active retry
  backoff no longer consume the conversion batch; matching terminal state is
  quarantined until a changed fingerprint clears stale state and makes the
  policy eligible for current evaluation.
- Serialization, transaction, lock, database, and connection failures receive
  bounded fingerprint-stable backoff. Execution-budget pressure also backs off,
  but never consumes or resets the technical-failure limit; only three matching
  technical failures escalate to policy-local `requires_maintenance`.
- Backup retains compact state as historical evidence, but restore now discards
  it as live scheduling control and derives a new state from current authority.
  Routing and profile freshness remain automation-readiness signals and are
  excluded from conversion retry eligibility.
- Design and outcome record:
  [Native Intent Reconciliation Eligibility](native-intent-reconciliation-eligibility.md).

##### 8R.3.2.4 Reversion, Restore, And New-Policy Interaction Guard

Intent: prevent automation from undoing a valid rollback, racing a restore, or
attempting to convert policies that are already native by construction.

Tasks:

- When reversion restores a policy during the rollback window, persist a
  reconciliation hold tied to the reversion event. The reconciler must not
  immediately reconvert that policy before an explicit future eligibility
  transition or approved re-entry condition.
- Keep reconciliation disabled during backup restore until restore validation,
  schema parity, and native-authority integrity checks pass.
- On a verified restore, resume from current policy state rather than trusting
  an imported in-progress run as still active.
- Exclude already-native new policies from conversion discovery, and admit
  legacy-created policies only through the existing migration candidate report
  while the compatibility window remains open.
- Verify that converted-policy legacy-write guards and reversion transactions
  cannot race a reconciliation apply.

Acceptance criteria:

- A successful reversion remains reverted until explicit, attributable
  administrator re-entry.
- Restore cannot trigger conversion while source IDs, authority, or schema state
  are still being reconciled.
- New native policies never receive an unnecessary rollback snapshot or
  conversion event.

Implementation outcome:

- `20260715_150000_add_native_intent_reconciliation_lifecycle_guards.sql`
  adds one policy-local reversion hold and one singleton restore gate. Both
  store only stable IDs, references, and timestamps; neither stores legacy
  policy data or backup payloads.
- Native-intent reversion persists its `rollback_applied` event and active hold
  in one transaction. Reconciliation filters held policies before planning and
  rechecks both the global restore gate and policy hold after acquiring the
  existing authority lock, so discovery cannot race a later reversion.
- Backup restore closes reconciliation before writes, restores history and
  holds, discards retry scheduling state, validates schema and native authority
  after commit, and only then reopens reconciliation. Any validation failure
  leaves the gate closed for maintenance.
- A protected administrator re-entry endpoint releases a hold only after the
  server derives the authenticated actor, records a bounded audit event, and
  confirms no active native authority exists.
- Design and outcome record:
  [Native Intent Reconciliation Lifecycle Guard](native-intent-reconciliation-lifecycle-guard.md).

##### 8R.3.2.5 Operational Circuit Breaker And Emergency Stop

Intent: contain systemic failure without turning routine policy authoring into
an operator-controlled migration workflow.

Tasks:

- Add one server-side, default-enabled reconciliation setting with a documented
  emergency disable path. It is operational break-glass control, not a per
  policy-builder option.
- Open a persisted circuit breaker only for repeated system-level failures such
  as database unavailability, schema incompatibility, or invariant violations;
  policy-local blockers must not open it.
- Record the triggering bounded error category, opened timestamp, and recovery
  condition. Do not record exception stacks, credentials, or raw policy data in
  the status payload.
- Require a healthy subsequent evaluation before automatic recovery, or an
  explicit administrator reset when the failure category requires human
  remediation.

Acceptance criteria:

- A systemic failure stops further automatic conversion before repeated write
  attempts can amplify the issue.
- Disabling reconciliation does not affect native runtime reads, rollback,
  ordinary policy saves, or routing.
- Emergency state and recovery are auditable without exposing sensitive data.

Implementation outcome:

- `20260715_160000_add_native_intent_reconciliation_control.sql` adds one
  default-enabled singleton reconciliation control and compact control-event
  audit evidence. Both store only stable IDs, timestamps, and authenticated
  actor identifiers; neither stores policy payloads, stack traces, credentials,
  or raw database errors.
- Automatic reconciliation opens its persisted circuit only after three
  same-category systemic failures within fifteen minutes. Policy-local
  blockers, review requirements, routing setup, rollback holds, and
  post-commit ledger errors cannot open it.
- A transient circuit recovers only through a one-at-a-time, read-only probe
  and defers that pass before conversion resumes. Schema and authority-integrity
  categories require an attributable administrator reset before the probe.
- Protected reconciliation-control endpoints provide emergency stop, resume,
  status, and reset without adding any option to normal policy authoring.
- Design and outcome record:
  [Native Intent Reconciliation Circuit Breaker](native-intent-reconciliation-circuit-breaker.md).

##### 8R.3.2.6 Read-Only Status, Alerting, And Legacy Deletion Integration

Intent: make automatic conversion observable without retaining a second
interactive conversion workflow or permitting unsafe cleanup.

Tasks:

- Replace dialog apply controls with a read-only administrator status contract:
  last completed run, current state, bounded counts, next scheduled attempt,
  circuit state, and grouped blocker reason IDs.
- Emit structured migration events and application logs with a run correlation
  ID, sanitized reason category, and outcome counts. Do not log raw payloads,
  sessions, credentials, or unbounded exception text.
- Alert only on circuit-open, prolonged unresolved inventory, or repeated
  system failure; rate-limit and deduplicate alerts so scheduled work cannot
  create notification noise.
- Update compatibility deletion gates to require zero unconverted policies and
  no unresolved `requires_maintenance` outcomes. An operator support stance is
  not a substitute for a real storage-resolution path.
- Retire the manual apply endpoint and confirmation dialog only after the
  reconciler and status surface meet their production verification gates.

Acceptance criteria:

- Operators can determine why automatic conversion is waiting without being
  asked to select or confirm a normal batch.
- Logging and status output provide correlation and support value without
  exposing raw legacy data.
- Compatibility deletion cannot proceed because a blocked policy was merely
  acknowledged instead of resolved.

Implementation status:

- Task 8R.3.2.6.1 is implemented as bounded failure attribution and failed-run
  evidence. Every outer reconciliation abort now has one correlation ID, a
  safe execution stage/reason/category, a failed ledger header where storage is
  available, and a structured log record with no synthetic or raw stack trace.
  The design and outcome record is
  [Native Intent Reconciliation Failure Attribution](native-intent-reconciliation-failure-attribution.md).
- Task 8R.3.2.6.2 is implemented as an administrator-only, read-only status
  contract and durable alert evaluation. It exposes bounded last-run, control,
  unresolved-state, and grouped blocker evidence without restoring a manual
  conversion dialog. Only circuit-open, prolonged unresolved inventory, and
  repeated systemic failure can notify; durable lifecycle records deduplicate
  notices across replicas and restarts. The design and outcome record is
  [Native Intent Reconciliation Status And Alerting](native-intent-reconciliation-status-alerting.md).
- Task 8R.3.2.6.3 is implemented as a server-owned compatibility deletion
  resolution gate. It counts only current `requires_maintenance`
  reconciliation states, fails closed on missing or invalid evidence, and
  requires the count to be zero alongside zero unconverted policies. The
  inventory, gate, readiness report, and execution-plan bundle bind the same
  count in one read-only repeatable-read observation window. Support notes,
  acknowledgements, and alert transitions cannot clear it. The design and
  outcome record is [Compatibility Deletion Resolution Gate](policy-compatibility-deletion-resolution-gate.md).
- Task 8R.3.2.6.4 is implemented. The legacy manual preview/apply endpoint,
  selection flow, confirmation dialog, related mutation limiter, and
  manual-conversion authority were removed. The client now exposes only the
  administrator read-only `/policies/native-intent-reconciliation` status
  surface; the scheduler is the normal conversion path and protected recovery
  lifecycle actions remain separate. The design and outcome record is
  [Native Intent Manual Apply Retirement](native-intent-manual-apply-retirement.md).
##### 8R.3.2.6.1 Sanitized Failure Attribution And Failed-Run Evidence

Intent: make automatic reconciliation failures diagnostically useful without
turning exception text, stacks, or legacy payloads into persistent support
data.

Tasks:

- Attribute each throw-capable reconciliation boundary with a fixed stage ID.
- Derive only bounded failure category/reason IDs from the existing system
  error classifier; do not persist arbitrary error codes, messages, stacks, or
  causes.
- Bind public result, structured log record, and failed ledger header to a
  server-generated UUID correlation ID.
- Ensure an aborted run is persisted as `failed`, not `evaluated` with
  `no_candidates`, when its ledger write can complete.
- Suppress synthetic logger stacks for these structured operational events.

Acceptance criteria:

- An operator can correlate a failure to one safe stage/reason/category without
  seeing raw policy or infrastructure details.
- A failed run has a truthful ledger state even when no candidate outcome was
  available.
- Repeated known systemic categories retain circuit-breaker behavior; unknown
  errors remain observable but cannot open the circuit by themselves.

##### 8R.3.2.7 Failure-Injection And Lifecycle Test Matrix

Intent: prove the reconciler behaves safely across the operational states that
manual dialog testing cannot cover.

Completion: scheduler collision, restart continuity, post-snapshot
transaction-failure, and Docker-backed scheduler integration slices are
complete. They prove that a recurring reconciliation run holding the native
intent advisory lock causes the delayed startup run to skip rather than
duplicate conversion; scheduler reinitialization creates one fresh initial run
while a fresh state service reloads persisted retry backoff before selecting a
candidate; a rule-insert failure after rollback snapshot creation causes the
transaction wrapper to roll back all staged native writes without a commit; and
a ready legacy policy converts through the scheduler with a real PostgreSQL
session advisory lock and no client dialog or apply request. The Docker-backed
slice and full Testcontainers integration suite passed on 2026-07-16. The
design and outcome record is [Native Intent Reconciliation Failure-Injection
And Lifecycle Matrix](native-intent-reconciliation-failure-injection-lifecycle-matrix.md).

Alert lifecycle persistence now also has PostgreSQL-backed regression coverage.
The upsert explicitly types all reused `varchar` and `timestamptz` parameters,
so PostgreSQL cannot infer conflicting types for the firing-state parameter.
Alert failures retain only a fixed lifecycle stage and bounded reason, never
raw query or exception detail. The design and outcome record is [Native Intent
Reconciliation Alert Persistence Safety](native-intent-reconciliation-alert-persistence-safety.md).

Tasks:

- Add focused tests for lock contention, process restart, expired retry delay,
  changed candidate fingerprints, mixed ready/blocked batches, duplicate
  scheduler invocation, and time-budget exhaustion.
- Add transaction tests for authority conflicts, concurrent legacy writes,
  reversion races, database failure after snapshot creation, and restore-time
  suppression.
- Add lifecycle tests for disabled state, circuit opening and recovery,
  backup/restore continuity, status sanitization, and alert deduplication.
- Add one integration test proving a ready legacy policy converts through the
  scheduler with no client dialog or apply endpoint request.

Acceptance criteria:

- Tests prove automatic conversion is idempotent, bounded, recoverable, and
  non-authoritative for routing and policy learning.
- Tests prove no client interaction is required for an eligible policy.
- Tests prove failure paths preserve legacy behavior and rollback evidence.

##### 8R.3.2.8 Runtime Provenance And Failed-Run Recovery

Intent: make a failed or evaluated reconciliation run attributable to the
bounded application build that produced it, so support can distinguish a
running stale image from a current-source regression without exposing
deployment internals.

Tasks:

- Define one server-owned runtime-provenance contract with a release-version
  allowlist and an optional immutable Git-revision allowlist.
- Persist the normalized version/revision with each reconciliation ledger run;
  historical rows must remain readable as explicit unknown provenance.
- Return the same safe record from the read-only reconciliation status endpoint
  and show it on the existing administrator status page without a new action.
- Inject the Git revision into release images at CI build time without granting
  the application Docker-socket access or relying on mutable tags.
- Test malformed environment/database values, ledger parameterization,
  historical rows, and fresh-install schema generation.

Acceptance criteria:

- A failed run can identify its app version and, for release builds, Git
  revision without recording a raw image tag, container ID, environment value,
  exception, stack, or policy payload.
- Status remains read-only and normal reconciliation remains scheduler-owned.
- A missing or invalid revision cannot prevent reconciliation, persist an
  unsafe string, or cause a status-read failure.

Implementation status:

- Implemented by `nativeIntentReconciliationRuntimeProvenance.mjs`, the
  reconciliation ledger and status contracts, migration
  `20260716_030000_add_native_intent_reconciliation_runtime_provenance.sql`,
  and the existing status view.
- Release builds pass `github.sha` as `VCS_REF`; the production image exposes
  only the bounded value as `CLASSIFARR_BUILD_REVISION` and OCI revision
  metadata. Local builds remain safely attributable to the package version and
  `unknown` revision.
- The design and outcome record is [Native Intent Reconciliation Runtime
  Provenance](native-intent-reconciliation-runtime-provenance.md).

##### 8R.3.2.9 Semantic Native Authority Eligibility And Empty-Intent Recovery

Intent: make native runtime authority depend on a complete, safe, persisted
intent rather than the mere existence of one active header.

Tasks:

- Define one shared eligibility contract for runtime reads, reconciliation
  inventory, dry-run discovery, and native-intent materialization. An
  authoritative active header must have native source, inferred state, safe
  validation, and at least one persisted purpose rule.
- Treat a single active but non-authoritative row as compatibility behavior at
  the read boundary. Preserve the bounded reason state; do not load its child
  rules or silently treat its presence as completed conversion.
- Refuse automatic conversion for empty, incomplete, unsafe, or purpose-less
  contracts. Record the bounded condition as maintenance rather than a
  conversion success, retry loop, or raw-payload diagnostic.
- Repair only provable historical data: normalize a fully materialized legacy
  header to native source, deactivate an exact empty placeholder, and fail the
  migration for every other unresolved active shape.
- Enforce the semantic invariant with a deferred database constraint trigger
  so header and purpose-rule writes can complete in one transaction but an
  active purpose-less intent can never commit.
- Cover semantic authority selection, compatibility fallback, candidate
  eligibility, migration repair/refusal, and a real PostgreSQL deferred
  constraint transaction.

Acceptance criteria:

- An empty reconciliation header cannot suppress an otherwise-valid legacy
  policy at runtime.
- The scheduler never records a purpose-less or incomplete contract as a
  native conversion.
- A fresh or upgraded database cannot commit an active intent without native,
  inferred, safely validated header data and a purpose rule.
- Repair events contain only bounded action identifiers and no legacy policy,
  prompt, or exception payload.

Implementation status:

- Implemented by `policyNativeIntentAuthorityEligibility.mjs`, the native
  loader/read path, candidate report, post-upgrade apply gate, reconciliation
  lifecycle persistence, and migration
  `20260716_040000_enforce_semantic_native_intent_authority.sql`.
- The migration performs safe normalization or deactivation only for provable
  rows, fails closed for unresolved active data, and adds deferred header/rule
  constraints. The design and outcome record is [Policy Native Intent Semantic
  Authority Integrity](policy-native-intent-semantic-authority-integrity.md).

##### 8R.3.2.10 Initial Native Intent Establishment (Automatic Library-Profile Baseline)

Intent: complete the native-storage cutover for destinations with no legacy
preset configuration by deriving a bounded initial baseline from the connected
media-server library, the product's source of truth. This is automatic
conversion maintenance, not a policy-builder form, an AI inference, or a
learning write.

Tasks:

- Resolve every conversion candidate through one shared contract resolver.
  Preset-backed policies keep the legacy conversion contract; zero-preset,
  empty contracts use a current library-profile initialization contract.
- Derive only advisory identity and helpful evidence from normalized profile
  distributions. Preserve review settings and routing data, but never invent
  hard limits, avoid rules, policy-learning data, or external-provider input.
- Require a current profile with media items and observed genre identity before
  conversion. A missing, stale, or insufficient profile causes a bounded,
  automatic profile regeneration attempt and a retryable deferred state.
- Re-evaluate candidates after regeneration in the same bounded reconciliation
  run. Reuse existing transaction locks, rollback snapshots, migration events,
  idempotency, and semantic-authority validation for the write.
- Keep reports, state rows, logs, and migration metadata bounded: use status
  IDs, counts, and a profile fingerprint only; never publish profile labels,
  item data, paths, prompts, AI output, or raw policy payloads.
- Keep persistent technical failures retryable with capped backoff. They may
  alert operators, but must not become a terminal maintenance marker that
  requires someone to restart conversion manually.

Acceptance criteria:

- A current non-empty media-server library with no legacy policy presets gains
  exactly one active native intent without a dialog, route call, or operator
  action.
- Repeated reconciliation is idempotent and clears a stale terminal candidate
  marker when the recomputed profile-backed candidate fingerprint changes.
- A missing, stale, empty, or insufficient profile neither writes native
  intent nor changes routing, but self-recovers after profile generation or a
  future library sync supplies adequate evidence.
- The baseline has no hard-limit or avoid rules, makes no learning write, and
  never depends on names, local paths, metadata providers, RAG, or AI output.
- A profile-backed write remains protected by the same authority lock,
  transaction, rollback, and validation safeguards as preset conversion.

Implementation status:

- Task 8R.3.2.10.1 is implemented as a shared profile-backed initial-contract
  resolver used by both candidate discovery and the transaction-gated apply
  writer. It prevents the discovery/apply handoff from reintroducing the old
  empty-contract branch.
- Task 8R.3.2.10.2 is implemented as automatic profile recovery and retryable
  reconciliation state. The reconciler regenerates only deferred connected
  library profiles, reloads candidates once, and retries bounded technical
  failures with capped exponential backoff rather than terminal maintenance.
- The design and outcome record is [Automatic Library-Profile Native Policy
  Initialization](policy-library-profile-automatic-initialization.md).

##### 8R.3.2.11 Observed Evidence Establishment Provenance

Intent: retain only the bounded library-profile context available when native
authority is established, without turning observed evidence into a second
policy model or a source of routing and learning authority.

Tasks:

- Capture one server-generated bounded snapshot per initial establishment in
  the same transaction as the native intent, rules, routing record, migration
  event, rollback snapshot, and establishment audit record.
- Record only safe profile projection, freshness, source, capture state,
  timestamps, and deterministic digest data. Do not retain media items, paths,
  provider output, prompts, browser draft state, credentials, or secrets.
- Preserve safe `profile_unavailable` and `profile_rejected` snapshots without
  blocking authority derived from explicit operator intent.
- Redact the payload after the aligned rollback recovery window in a
  transactionally locked, one-way cleanup. Retain only minimal marker metadata
  and a digest.
- Include the bounded record in backup, restore, schema validation, scheduler,
  and storage-closure evidence. Restored redacted markers must remain redacted.

Acceptance criteria:

- The provenance snapshot cannot define, modify, or reactivate policy intent,
  routing, learning, provider calls, quota use, or media actions.
- A provenance persistence failure rolls back the entire initial establishment.
- Retention cannot expose or recreate the original observed evidence payload.
- Fresh-install and upgraded-install schema snapshots contain the same guarded
  provenance table and indexes.

Implementation status:

- A bounded server-owned provenance contract now captures a stored
  library-profile projection with explicit `observed_evidence` authority
  vocabulary, a SHA-256 correlation digest, and no durable authority fields.
- The initial-establishment transaction writes one linked snapshot. Missing or
  rejected stored profiles produce safe markers, while an insert failure rolls
  back all staged native establishment writes.
- A daily advisory-lock cleanup redacts expired payloads after fourteen days;
  the database trigger permits only that one-way transition. Backup/restore,
  schema, scheduler, and closure coverage include the record. The design and
  outcome record is [Policy Observed Evidence
  Provenance](policy-observed-evidence-provenance.md).

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

- Policy intent runtime read path is documented in
  [Policy Intent Runtime Read Path](policy-intent-runtime-read-path.md).
- Current implementation adds a focused server read-path service that prefers an
  attached active native intent contract for converted policies and falls back
  to the compatibility bridge for unconverted policies.
- Both paths return the same `configuration_view`, `policy_intent_contract`, and
  `policy_intent_read_trace` product shape through the existing mapper.
- Active invalid native intent is surfaced as `native_intent_invalid` instead of
  silently falling back to legacy custom-signal behavior.
- Read trace metadata records `native_intent` or `compatibility_bridge` with
  bounded `classifarr.policy.read.*` attributes.
- Validation rejects missing or mismatched read-source trace metadata, unstable
  contract shape, native reads that depend on custom signals, and read-path
  storage side effects.
- The module cutover renamed the read-path service, focused test, architecture
  record, payload version, exported constants/helpers, trace attributes, and
  runtime handoff to durable policy-domain names while preserving source
  selection and compatibility fallback behavior:
  [Policy Intent Runtime Read Path Module Cutover](policy-intent-runtime-read-path-module-cutover.md).

#### 8R.4.2 Policy Engine Native Authority Enforcement

Intent: ensure the native runtime read path is the actual classification
authority, not a policy-detail projection that coexists with legacy scoring.

Tasks:

- Batch-load bounded active native authority before loading compatibility
  presets for enabled policies.
- Load `policy_presets` only for unconverted policies; converted native,
  invalid-native, and authority-conflict policies must never enter the legacy
  scoring branch.
- Evaluate native purpose, hard-limit, helpful-hint, and avoid rules through a
  dedicated server module. Purpose must establish fit before supporting
  evidence can contribute.
- Fail closed for invalid/ambiguous authority and failed or unknown hard limits.
- Preserve compatibility behavior for unconverted policies and retain bounded
  source/status decision traces.

Acceptance criteria:

- A converted policy cannot be classified because of retained legacy preset or
  `custom_signals` data.
- Native purpose controls candidate eligibility before profile, RAG, pattern,
  or history evidence is considered.
- Native decision output records bounded source/status trace metadata without
  returning raw policy payloads.

Implementation status:

- Implemented by `policyEngineRuntimeAuthority.mjs` and
  `policyNativeIntentRuntimeEvaluator.mjs`; design and outcome are documented
  in [Policy Engine Native Runtime Authority](policy-engine-native-runtime-authority.md).
- `policyNativePolicyReadService.mjs` batch-loads active authority and child
  rows only for exactly one active intent. `policyEngineQueries.mjs` queries
  compatibility presets only for policies without native authority.
- Focused unit coverage plus a PostgreSQL policy-engine integration test prove
  native Animation intent overrides a retained legacy Horror preset.

#### 8R.4.1 Runtime Authority Selection Integrity

Intent: make the native runtime read path fail closed if a restored,
pre-migration, or otherwise inconsistent database has more than one active
native intent for a policy.

Tasks:

- Read at most two active native rows at the native-policy loader boundary.
- Treat exactly one active row as authoritative and do not load child rows when
  the authority is ambiguous.
- Preserve the native product-contract shape with a bounded blocked status;
  never choose a row by version, timestamp, or ID.
- Suppress compatibility fallback and legacy custom signals for the conflict.
- Record only a bounded authority state and capped active-row count in the
  runtime trace.

Acceptance criteria:

- Duplicate active native rows cannot result in arbitrary runtime authority.
- Converted policies with ambiguous authority cannot fall back to legacy
  custom-signal behavior.
- Native cutover verification blocks the conflict without exposing raw native
  policy data or row identifiers.

Implementation status:

- The design and outcome are documented in [Policy Native Runtime Authority
  Selection Integrity](policy-native-runtime-authority-selection-integrity.md).
- `policyNativeIntentAuthority.mjs` owns bounded native-authority states and
  caps ambiguous counts at two without carrying row IDs.
- `policyNativePolicyReadService.mjs` now uses `LIMIT 2`; it only loads rules,
  templates, and validation for exactly one active native row.
- The runtime policy query now derives compatibility-preset loading from the
  centralized runtime read decision. A single non-authoritative row receives
  the documented compatibility recovery data, while valid native authority and
  duplicate authority conflicts continue to suppress legacy presets.
- `policyIntentRuntimeReadPath.mjs` emits
  `native_intent_authority_conflict` instead of selecting an arbitrary row or
  falling back to legacy signals. The conflict response keeps the stable
  contract shape and has invalid contract validation by design.
- Runtime cutover verification treats the bounded conflict as a native-read
  blocker. Focused authority, loader, read-path, and cutover tests cover the
  behavior.

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
- Require automatic reconciliation to honor reversion holds so a successful
  rollback cannot be immediately undone by the next maintenance cadence.

Acceptance criteria:

- Rollback is possible during the defined window.
- Rollback snapshots are not permanent alternate policy storage.
- Retention behavior is documented and testable.
- A valid reversion is not immediately reconverted by automatic maintenance.

Implementation status:

- Policy rollback snapshot and reversion-window behavior is documented in
  [Policy Rollback Snapshot And Reversion Window](policy-rollback-snapshot-window.md).
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
- Automatic reconciliation uses a durable, policy-local active hold rather
  than a historical-event filter. The hold is written with `rollback_applied`,
  restored or rehydrated from older backups, and released only through the
  explicit server-verified administrator re-entry path.
- Validation rejects missing restore sections, missing actor/reason data,
  unbounded snapshots, raw payload exposure, permanent alternate storage,
  ordinary read/write revert, missing retention policy, bulky payload retention
  after expiry, and planning side effects.
- The module cutover renamed the rollback service, focused test, architecture
  record, exported constants/helpers, version, restore path, idempotency key,
  default reason code, and runtime handoff to durable policy-domain names while
  preserving rollback window bounds, required restore sections, actor gating,
  retention cleanup, raw-payload suppression, and no-side-effect validation:
  [Policy Rollback Snapshot Window Module Cutover](policy-rollback-snapshot-window-module-cutover.md).

#### 8R.5.1 Transactional Native Authority Reversion

Intent: make an unexpired rollback snapshot operational without restoring a
second permanent policy model.

Tasks:

- Require an approved server-side actor source and bounded reason code before
  reversion can begin.
- Lock policy, snapshot, and native intent rows in one transaction, then
  revalidate ownership, expiry, manifest completeness, and authority state.
- Restore compatibility authority only when the snapshot intent is the sole
  active intent; otherwise restore only the direct predecessor of a current
  native replacement.
- Mark the snapshot consumed and persist a bounded `rollback_applied` event in
  the same transaction.
- Return no raw snapshot payload and never reapply legacy rows that current
  conversion/rebuild flows did not mutate.

Implementation status:

- `policyNativeIntentReversionContract.mjs` owns fail-closed action and
  manifest validation, target selection, and bounded response contracts.
- `policyNativeIntentReversionService.mjs` orchestrates the approved
  transaction without owning SQL details.
- `policyNativeIntentReversionPersistence.mjs` owns row locks, native authority
  changes, snapshot consumption, and migration-event persistence.
- The administrator-only policy route derives the operator identity server-side
  and accepts only a bounded reversion reason; it never accepts actor authority
  or snapshot data from the client.
- The command blocks expired, redacted, malformed, foreign, ambiguous, or
  non-direct-successor state without changing authority.
- The implementation and official guidance are documented in [Policy Native
  Intent Reversion](policy-native-intent-reversion.md).

#### 8R.5.2 Rollback Snapshot Retention Cleanup

Intent: remove expired bulky rollback payloads while preserving only minimal
audit data.

Tasks:

- Select only expired snapshots whose payload is still present, using bounded
  batches and a transaction-owned cleanup lock.
- Replace the payload with a minimal redacted marker and retain policy, intent,
  snapshot version, timestamps, restore path, actor/reason audit data, and a
  digest when available.
- Make cleanup idempotent, never delete active runtime authority, and record a
  bounded cleanup event or report.
- Add expiry-boundary, already-cleaned, concurrent-run, and backup/restore
  tests.

Implementation status:

- The design and operational outcome are documented in
  [Policy Rollback Snapshot Retention](policy-rollback-snapshot-retention.md).
- `policyRollbackSnapshotRetentionService.mjs` redacts at most 500 expired,
  unredacted snapshot payloads in a transaction-scoped advisory-lock batch.
  It uses stable expiry ordering and `FOR UPDATE SKIP LOCKED` so cleanup does
  not wait on a snapshot another transactional workflow is inspecting.
- Each retained snapshot row keeps its identifiers, version, lifecycle
  timestamps, restore path, digest, payload size, and bounded source-audit
  reference in a redacted marker. The original actor and reason remain in the
  migration-event history; results and logs do not expose payload values.
- Redaction and the `rollback_snapshot_payload_redacted` audit event commit
  together. A failed update or event rolls the transaction back, preserving the
  original snapshot rather than leaving an unaudited partial cleanup.
- The daily retention scheduler invokes one bounded batch. The transaction lock
  makes overlapping scheduler instances a no-op, while a later run can process
  a row skipped because a reversion transaction held it.
- The storage closure audit maps the rollback window, transactional reversion,
  and retention cleanup as separate components. A complete closure result now
  requires the retention design, services, migration, fresh-install schema,
  scheduler wiring, and focused restore coverage.

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

- **8R.6.1 Enforced Legacy Mutation Guard** is complete when this roadmap
  update ships. The existing boundary planner is now invoked inside the same
  transaction as legacy mutations, rather than only describing what a caller
  should do.
- The guard locks the policy authority row and rejects legacy policy updates,
  reset flows, preset attach/detach operations, incompatible-preset cleanup,
  automatic preference writers, preference reverts, legacy rule migration,
  and legacy tuning-suggestion application when native intent is active.
- Metadata-only updates remain allowed, and unconverted policies retain the
  time-bounded compatibility path. Focused route, service, and transaction
  tests protect both outcomes.
- Legacy write-boundary behavior is documented in
  [Policy Legacy Write Boundary](policy-legacy-write-boundary.md).
- The module cutover renamed the service, focused test, architecture record,
  exported constants/helpers, version, and runtime handoff to durable
  policy-domain names while preserving converted-policy blocking,
  unconverted-policy compatibility warnings, native write readiness gating,
  native default gating, removal checklist validation, and no-side-effect
  guarantees:
  [Policy Legacy Write Boundary Module Cutover](policy-legacy-write-boundary-module-cutover.md).
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
  explicit and every policy has a real native-storage resolution.

Acceptance criteria:

- Replaced code is deleted after gates, not hidden or preserved permanently.
- Remaining compatibility is intentional and time-bounded.
- The repository no longer carries two full policy models after migration gates
  pass.
- A reconciler `requires_maintenance` outcome is a deletion blocker, not an
  exception that can be waived through a support stance alone.

Implementation status:

- Compatibility deletion gates are documented in
  [Policy Compatibility Deletion Gates](policy-compatibility-deletion-gates.md).
- The module cutover renamed the service, focused test, architecture record,
  exported constants/helpers, version, and runtime handoff to durable
  policy-domain names while preserving deletion categories, replacement
  coverage requirements, explicit support stance requirements,
  unconverted-policy blockers, compatibility inventory validation, and
  no-side-effect validation:
  [Policy Compatibility Deletion Gates Module Cutover](policy-compatibility-deletion-gates-module-cutover.md).
- The side-effect-free deletion-gate contract lives in
  `server/src/services/policyCompatibilityDeletionGates.mjs`.
- The focused deletion-gate test suite lives in
  `server/src/__tests__/services/policyCompatibilityDeletionGates.test.mjs`.
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
- Include automatic reconciliation run/outcome state in backup and restore, and
  suppress scheduled conversion until restored native authority passes integrity
  and schema validation.
- Add post-upgrade dry-run reporting before apply mode.
- Ensure failed post-upgrade migration cannot leave mixed partial writes.
- Add versioned schema checks and clear operator-facing migration errors.

Acceptance criteria:

- Fresh install and upgraded install schemas match after migrations.
- Backup/restore proves native policy recovery.
- Post-upgrade can report and apply conversion candidates safely.
- Restore cannot resume automatic conversion from stale in-progress state.

Implementation status:

- Native storage operational safety is documented in
  [Policy Native Storage Operational Safety](policy-native-storage-operational-safety.md).
- The side-effect-free operational safety contract lives in
  `server/src/services/policyNativeStorageOperationalSafety.mjs`.
- The focused safety test suite lives in
  `server/src/__tests__/services/policyNativeStorageOperationalSafety.test.mjs`.
- Current implementation enumerates native intent tables from the native schema
  contract, requires every native table in backup and restore coverage,
  requires restore validation for native policy recovery, rollback snapshots,
  migration events, and schema versions, and blocks readiness until
  fresh-install/upgraded-install schema parity is proven.
- Live backup/export and transactional restore now include native policy intent
  headers, rules, routing targets, starter-template provenance, migration
  events, rollback snapshots, and validation status; restore remaps old policy,
  library, and native intent IDs before restoring child rows.
- Live wiring is documented in
  [Native Backup And Restore Wiring](policy-native-backup-restore-wiring.md).
- Post-upgrade apply mode is blocked unless dry-run reporting is current,
  conversion is atomic, failure rolls back, legacy behavior stays active until
  commit, mixed partial native/legacy writes are prevented, and clear
  operator-facing migration error IDs are present.
- Phase 8R.3.2 extends backup/restore wiring with reconciliation state and a
  post-restore suppression gate. The reconciler must evaluate restored policy
  state afresh after integrity validation, not trust an imported active run.
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
  - automatic reconciliation scheduler, run/outcome ledger, retry, reversion,
    restore-suppression, circuit-breaker, and read-only status coverage,
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

- Native storage test reset is documented in
  [Policy Native Storage Test Reset](policy-native-storage-test-reset.md).
- The side-effect-free test reset contract lives in
  `server/src/services/policyNativeStorageTestReset.mjs`.
- The focused reset test suite lives in
  `server/src/__tests__/services/policyNativeStorageTestReset.test.mjs`.
- The module cutover removed phase-coded production identifiers, replaced
  `policyBuilderPhase8NativeStorageTestReset*` exports with
  `policyNativeStorageTestReset*`, moved the contract version to
  `policy.native_storage_test_reset.v1`, replaced `nextPhase` with
  `nextStep.stepId = native_backup_restore_wiring`, and renamed diagnostic
  deletion markers to `deleteAfterNativeStorageGates`:
  [Policy Native Storage Test Reset Module Cutover](policy-native-storage-test-reset-module-cutover.md).
- Current implementation inventories the native schema contract,
  dry-run candidate report, explicit conversion, native runtime read path,
  rollback/reversion, legacy write-blocking, backup/restore safety, and
  deletion-gate tests.
- Native SQL migration coverage is now supplied by
  `database/migrations/20260701_160000_add_policy_intent_native_storage.sql`,
  `database/schema/current.sql`, and `server/src/__tests__/migrations.test.mjs`.
- Native SQL migration coverage is also tied back to the native schema
  contract by
  `server/src/services/policyNativeSqlMigrationCoverage.mjs` and
  `server/src/__tests__/services/policyNativeSqlMigrationCoverage.test.mjs`.
- The native SQL migration coverage follow-up is documented in
  [Policy Native SQL Migration Coverage](policy-native-sql-migration-coverage.md).
- Legacy payload preservation tests are allowed only for unconverted policy
  compatibility, rollback snapshot restore, or maintainer migration fixtures.
- Abandoned diagnostic impact/replay tests must be deletion-scoped and cannot
  count as final native-storage product coverage.
- Validation rejects missing required coverage, unscoped legacy preservation,
  diagnostic tests not marked for deletion, diagnostic tests remaining after
  deletion gates pass, abandoned diagnostics marked as final coverage, and any
  planning side effects.

### 8R.10 Native Backup And Restore Wiring

Intent: make native intent recoverable through the real backup and
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

- Backups contain all native intent tables.
- Restores attach native rows to restored policy/library IDs, not stale IDs.
- Restore remains transactional.
- Orphaned native rows are skipped fail-closed.
- Post-upgrade conversion apply remains disabled until dry-run and transaction
  gates are wired.

Implementation status:

- Native backup/restore wiring is documented in
  [Policy Native Backup And Restore Wiring](policy-native-backup-restore-wiring.md).
- The architecture cutover renamed the standing record from
  `policy-builder-phase-8r-native-backup-restore-wiring.md` to
  `policy-native-backup-restore-wiring.md`, updated the policy storage closure
  evidence map,
  and confirmed the live production service names are already durable
  backup/restore domain names:
  [Policy Native Backup And Restore Wiring Module Cutover](policy-native-backup-restore-wiring-module-cutover.md).
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

- Dry-run uses the same Phase 8R candidate and controlled reconciliation
  workflow contracts as scheduler-owned conversion.
- Dry-run performs no policy, native storage, migration event, rollback
  snapshot, or legacy deletion side effects.
- No-policy and no-ready-candidate states report clearly without forcing an
  invalid empty-selection conversion workflow.
- Post-upgrade logs contain only bounded status/count/error identifiers, not raw
  policy payloads.

Implementation status:

- Post-upgrade dry-run wiring is documented in
  [Policy Post-Upgrade Dry-Run Wiring](policy-post-upgrade-dry-run-wiring.md).
- The dry-run service lives in
  `server/src/services/policyPostUpgradeDryRun.mjs`.
- The `policy_native_intent_dry_run` action is wired into
  `postUpgradeService`.
- Focused service tests cover ready, review-required, no-policy, loader mapping,
  and orchestration paths.
- The module cutover renamed the production service, focused test, architecture
  record, payload version, builder exports, and post-upgrade runner method to
  durable policy post-upgrade dry-run names; replaced the dry-run handoff with
  `nextStep.stepId = post_upgrade_apply_gate`; and preserved bounded loading,
  plan-only conversion workflow composition, no-side-effect checks, and
  operator-safe logging:
  [Policy Post-Upgrade Dry-Run Wiring Module Cutover](policy-post-upgrade-dry-run-wiring-module-cutover.md).

### 8R.12 Post-Upgrade Apply Gate

Intent: allow native intent conversion only after a current dry-run proves ready
and a transaction boundary is available.

Tasks:

- Consume current post-upgrade dry-run output.
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

- Post-upgrade apply gate is documented in
  [Policy Post-Upgrade Apply Gate](policy-post-upgrade-apply-gate.md).
- The apply-gate service lives in
  `server/src/services/policyPostUpgradeApplyGate.mjs`.
- The `policy_post_upgrade_apply_gate` action is wired into
  `postUpgradeService` but is not registered as an automatic release-version
  task.
- Focused tests cover missing dry-run, stale dry-run, successful transaction
  apply, and rollback-safe failure reporting.
- The module cutover renamed the production service, focused test, architecture
  record, payload version, builder/apply exports, post-upgrade action, migration
  reason code, rollback restore path, and post-upgrade runner import to durable
  policy post-upgrade apply-gate names; replaced the apply-gate handoff with
  `nextStep.stepId = native_runtime_cutover_verification`; and preserved the
  transaction boundary, rollback snapshot, idempotency, migration events,
  no-legacy-deletion behavior, and bounded operator errors:
  [Policy Post-Upgrade Apply Gate Module Cutover](policy-post-upgrade-apply-gate-module-cutover.md).

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

#### 8R.13.1 Current Runtime Read Evidence Collection

Status: implemented.

The execution-plan evidence bundle must derive cutover results from the current
enabled-policy runtime read models, rather than accepting representative
converted or unconverted policies from operator-maintained JSON. In one
repeatable-read, read-only transaction it must:

- load every enabled policy and its media-library context;
- attach bounded active native-intent rows in batches;
- classify converted authority from the persisted native authority state;
- verify every converted read is active, valid, native, and independent of
  legacy `customSignals`;
- verify every remaining unconverted read continues through the compatibility
  bridge; and
- publish only counts, bounded source traces, statuses, and bounded policy-ID
  samples for failed policies.

The input boundary may still declare deletion gates and confirmations, but it
must not determine the runtime read outcome. This makes the report portable
across installations with different policy names, libraries, and conversion
histories. The implementation and source research are recorded in
[Policy Native Runtime Cutover Evidence](policy-native-runtime-cutover-evidence.md).

Acceptance criteria:

- Converted detailed policy reads return `source: native_intent`.
- Unconverted detailed policy reads return compatibility fallback.
- Native reads do not depend on legacy `customSignals`.
- Legacy deletion remains blocked until the next deletion-readiness gate.
- Verification performs no policy, native write, rollback, or deletion side
  effects.

Implementation status:

- Policy native runtime cutover verification is documented in
  [Policy Native Runtime Cutover Verification](policy-native-runtime-cutover-verification.md).
- The native policy read loader lives in
  `server/src/services/policyNativePolicyReadService.mjs`.
- The cutover verification contract lives in
  `server/src/services/policyNativeRuntimeCutoverVerification.mjs`.
- Detailed `GET /api/policies/:id` now attaches active native intent before
  projection.
- Focused tests cover native row contract building, converted route projection,
  converted/unconverted cutover verification, rollback blocking, and deletion
  blocking.
- Approved native-intent conversion now returns a bounded, read-only
  post-conversion observation for only the selected policy IDs. It re-reads the
  current native runtime path and confirms active rollback availability without
  exposing payloads, adding a concise maintenance-screen outcome without
  creating another operator workflow. See
  [Policy Native Intent Post-Conversion Runtime Observation](policy-native-intent-post-conversion-runtime-observation.md).
- The module cutover renamed the route-facing native policy read service,
  runtime cutover verifier, focused tests, architecture record, payload version,
  exported verifier constants/builders, and runtime handoff to durable
  policy-domain names; updated route, deletion-readiness, evidence-map, and
  focused-test imports; and preserved converted/native read verification,
  unconverted compatibility fallback, rollback/deletion/support blockers, and
  no-side-effect validation:
  [Policy Native Runtime Cutover Verification Module Cutover](policy-native-runtime-cutover-verification-module-cutover.md).

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

- Compatibility path deletion readiness is documented in
  [Policy Compatibility Deletion Readiness](policy-compatibility-deletion-readiness.md).
- The module cutover renamed the service, focused test, architecture record,
  exported constants/helpers, version, and runtime handoff to durable
  policy-domain names while preserving cutover validation, deletion-gate
  validation, residual-reference blockers, backup/rollback/diagnostic/manifest
  confirmations, risk-count validation, and no-side-effect guarantees:
  [Policy Compatibility Deletion Readiness Module Cutover](policy-compatibility-deletion-readiness-module-cutover.md).
- The deletion-readiness contract lives in
  `server/src/services/policyCompatibilityDeletionReadiness.mjs`.
- The focused deletion-readiness test suite lives in
  `server/src/__tests__/services/policyCompatibilityDeletionReadiness.test.mjs`.
- Current implementation composes compatibility deletion gates and native
  runtime cutover verification, blocks residual references and missing safety
  confirmations, and validates that no deletion side effects occur.
- **8R.14a Current Enabled-Policy Conversion Inventory** - implemented a
  read-only, current-state inventory over every enabled policy and its latest
  active-intent validation metadata. Deletion readiness and the execution plan
  now require this versioned evidence to prove one valid active native intent
  per enabled policy; caller-supplied zero conversion counts cannot bypass the
  gate. The design and command are documented in
  [Policy Compatibility Deletion Current Inventory](policy-compatibility-deletion-current-inventory.md).
- **8R.14b Readiness Semantic Revalidation** - hardened the serialized
  deletion-readiness contract so a ready claim is accepted only when its
  retained native-authority, reconciliation-state, runtime-cutover,
  deletion-gate, residual-reference, recovery, support, and non-destructive
  handoff summaries still agree. Source freshness remains owned by the
  bounded Phase 8R.15 evidence bundle rather than a caller-supplied readiness
  report.
- **8R.14c Database-Owned Runtime Recovery Evidence** - native runtime cutover
  now derives rollback availability from the latest persisted snapshot linked
  to each enabled authoritative native intent. Collection is bounded to the
  existing read-only repeatable-read evidence window and returns only status,
  aggregate counts, and bounded numeric policy-ID samples. Caller-supplied
  rollback, compatibility-deletion, and support safety claims are ignored;
  compatibility-code deletion remains separately fail-closed pending explicit
  release evidence. The design and implementation outcome are documented in
  [Policy Native Runtime Recovery Evidence](policy-native-runtime-recovery-evidence.md).
- **8R.14d Database-Owned Backup/Restore Evidence** - compatibility deletion
  readiness now derives recovery proof from an append-only, validated restore
  record that must match the currently ready native restore gate and remain
  within its renewal window. The record carries only bounded verification facts;
  it never exposes an archive filename, path, payload, or credentials, and a
  persistence failure closes the restore lifecycle. The design and outcome are
  documented in [Policy Backup/Restore Verification Evidence](policy-backup-restore-verification-evidence.md).

### 8R.15 Compatibility Path Deletion Execution Plan

Intent: convert compatibility deletion readiness into a concrete, reviewable
execution manifest without deleting code.

Tasks:

- Consume compatibility deletion readiness.
- Consume compatibility deletion categories and exact compatibility paths.
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

- Execution planning is blocked unless compatibility deletion readiness passed.
- Every manifest entry has an exact path and replacement evidence.
- Missing rollback/support stance or manifest approval blocks the plan.
- Output never deletes files, archives files, removes routes, removes tests,
  mutates storage, or writes a manifest.
- Ready output advances only to a final execution gate.

Implementation status:

- Phase 8R.15 compatibility path deletion execution plan is documented in
  [Policy Compatibility Deletion Execution Plan](policy-compatibility-deletion-execution-plan.md).
- The production-name cutover is documented in
  [Policy Compatibility Deletion Execution Plan Module Cutover](policy-compatibility-deletion-execution-plan-module-cutover.md).
- The execution-plan contract lives in
  `server/src/services/policyCompatibilityDeletionExecutionPlan.mjs`.
- The focused execution-plan test suite lives in
  `server/src/__tests__/services/policyCompatibilityDeletionExecutionPlan.test.mjs`.
- Current implementation builds exact manifest entries from compatibility
  deletion categories and paths, requires replacement evidence by path or
  category, requires rollback/support/approval stances, emits a semantic
  `nextStep.stepId`, and validates that no deletion side effects occur.
- **8R.15a Current Execution-Plan Evidence Bundle** - implemented one
  side-effect-free, bounded observation window for current enabled-policy
  authority, runtime-cutover verification, compatibility deletion gates, and
  deletion readiness. The execution-plan artifact now consumes only this
  versioned bundle, preventing separately supplied readiness and gate evidence
  from drifting before a manifest is produced. The design and command are
  documented in [Policy Compatibility Deletion Execution-Plan Evidence Bundle](policy-compatibility-deletion-execution-plan-evidence-bundle.md).
- **8R.15a.1 Public Evidence-Collection Boundary** - completed the command
  hardening boundary around that bundle. The ESM runner now validates an
  allowlisted argument shape and object input before loading evidence, removes
  caller-controlled observation time, returns stable collected, blocked, or
  input/output outcomes, redacts dependency failures, and closes its database
  resource on every branch. Focused tests cover malformed input, blocked
  readiness, loader and output failures, and cleanup failure without a live
  database.
- **8R.15a.2 Provenance-Bound Embedded Maintenance Runner** - completed a
  noninteractive, read-only collector for embedded PostgreSQL deployments.
  It requires a clean reviewed checkout, a running explicitly named container,
  and a full OCI image revision matching the checkout before it starts a
  short-lived helper. The helper shares only the target network namespace,
  receives no Docker socket or application data, mounts source read-only, can
  write only a new `.tmp` evidence output, drops capabilities, prevents
  privilege escalation, and sets PostgreSQL default transactions read-only.
  Unknown, mutable, mismatched, or local images without revision provenance
  block before database contact. Ready evidence still requires the existing
  execution-plan and named-actor execution gate. The design and outcome record
  is [Policy Compatibility Deletion Evidence Maintenance Runner](policy-compatibility-deletion-evidence-maintenance-runner.md).

### 8R.16 Compatibility Path Deletion Execution Gate

Intent: verify final pre-execution conditions before compatibility path deletion
can move to a separate controlled deletion step.

Tasks:

- **8R.16.1 Execution-Gate Artifact And Evidence Binding**
  - Consume a current v2 fingerprint-valid compatibility deletion execution-plan
    artifact, not a raw plan.
  - Require timestamped preflight records bound to the exact artifact
    fingerprint for worktree, recovery, approval, final stances, and manifest
    verification.
  - Reject stale, future, pre-artifact, malformed, or actorless human decision
    records. Database-owned recovery evidence is intentionally actorless and
    must instead carry source and artifact provenance.
  - Remove caller-supplied readiness booleans from the execution-gate and
    controlled-batch input contracts.
- **8R.16.2 Preflight Evidence Collection Boundary**
  - Build a separately invoked, provenance-bound collector for only
    machine-verifiable execution-gate observations: the reviewed checkout
    state, approved artifact fingerprint, manifest-path continuity, and current
    runtime evidence references.
  - Emit a versioned bounded artifact under `.tmp` that distinguishes observed,
    missing, stale, and invalid preflight evidence without accepting caller
    asserted readiness flags.
  - Reuse the 8R.15a.2 source/image provenance and read-only containment model
    when the collector needs embedded runtime observation.
  - Do not manufacture backup/restore recovery proof, final support stance, or
    named-actor approval. Those remain explicit evidence inputs to the existing
    execution gate.
  - Do not create an apply path, run a deletion, mutate storage, or invoke the
    production application endpoint.
- **8R.16.3 Collector-To-Gate Attestation Integration**
  - Make the execution-gate boundary consume a separately supplied preflight
    evidence artifact only after it revalidates the artifact fingerprint,
    source revision, timestamps, and manifest observation ordering against the
    current execution-plan artifact.
  - Derive worktree and manifest verification records from that artifact; do
    not let the caller replace them with booleans or use the artifact as a
    substitute for recovery, support, rollback, or approval evidence.
  - Reject stale, cross-artifact, altered, duplicate, or post-observation
    checkout evidence before a controlled removal batch can be assembled.
- **8R.16.4 Pre-Apply Change Detection And TOCTOU Boundary (Completed)**
  - Immediately before a controlled apply adapter receives an entry, compare
    the current checkout revision and the approved manifest path state to the
    preflight artifact.
  - Block an apply if the source revision changed, a manifest path changed
    type, became a symlink, disappeared, or no longer matches `HEAD` after
    preflight collection.
  - Keep this as a final read-only recheck owned by the controlled apply
    boundary; do not broaden the preflight collector into a deletion command.
- **8R.16.5 Embedded-Runtime Evidence Escalation Rules**
  - Define the limited conditions that require an embedded runtime probe
    instead of the retained execution-plan evidence reference.
  - Reuse the 8R.15a.2 revision-matched image, read-only filesystem, dropped
    capability, bounded resource, and read-only PostgreSQL containment model
    for any such probe.
  - Fail closed if image provenance, containment, or runtime query evidence is
    unavailable; never fall back to an unverified host or container claim.
- Require a clean worktree confirmation.
- Require verified and fresh backup/restore evidence.
- Require explicit operator approval with an approving actor.
- Require final rollback or post-window recovery stance.
- Require final support stance for converted native policies.
- Require manifest freshness and confirmation that it still matches the current
  execution plan.
- Keep the gate side-effect-free.

Acceptance criteria:

- Gate is blocked unless the current execution-plan artifact is ready, valid,
  fingerprint-valid, and bound to current preflight evidence.
- Dirty worktree blocks the gate.
- Missing or stale backup/restore evidence blocks the gate.
- Missing approval, approving actor, rollback stance, or support stance blocks
  the gate.
- Stale or mismatched manifest blocks the gate.
- Gate never deletes files, archives files, removes routes, removes tests,
  mutates storage, writes manifests, or runs Git commands.

Implementation status:

- Phase 8R.16 compatibility path deletion execution gate is documented in
  [Policy Compatibility Deletion Execution Gate](policy-compatibility-deletion-execution-gate.md).
- The production-name cutover is documented in
  [Policy Compatibility Deletion Execution Gate Module Cutover](policy-compatibility-deletion-execution-gate-module-cutover.md).
- The execution-gate contract lives in
  `server/src/services/policyCompatibilityDeletionExecutionGate.mjs`.
- The focused execution-gate test suite lives in
  `server/src/__tests__/services/policyCompatibilityDeletionExecutionGate.test.mjs`.
- Task 8R.16.1 now uses the v4 execution-gate contract. A separately
  fingerprint-valid recovery artifact binds the existing database-owned
  backup/restore verification evidence to the exact execution-plan artifact;
  recovery booleans and recovery records in the operator-evidence envelope are
  rejected. The current gate and controlled-batch path retain no mixed legacy
  readiness input. The design and outcome record is
  [Policy Compatibility Deletion Recovery Evidence Binding](policy-compatibility-deletion-recovery-evidence-binding.md).
- Serialized execution-gate output is revalidated against its retained artifact
  and preflight evidence. A modified ready claim, execution policy, or handoff
  cannot remain valid merely because its outer envelope is well-formed.
- The public controlled-removal batch command is the operator-facing gate
  handoff: it serializes the evaluated `executionGate` inside the batch
  artifact, and its public contract test verifies the ready gate remains bound
  to the exact execution-plan artifact fingerprint. No duplicate standalone
  gate writer is required.
- Current implementation verifies artifact readiness, worktree cleanliness,
  backup/restore freshness, operator approval, final support stances, manifest
  verification, emits a semantic `nextStep.stepId`, and validates that no
  deletion side effects occur.
- Task 8R.16.2 is implemented. The new public preflight collector derives a
  versioned `.tmp` artifact from the reviewed checkout, exact approved artifact
  fingerprint, manifest-path continuity, and retained runtime-evidence
  reference. It emits only `observed`, `missing`, `stale`, or `invalid` states,
  rejects unsafe paths and caller-controlled time, and does not contact Docker,
   PostgreSQL, or the production application. The design and outcome record is
   [Policy Compatibility Deletion Preflight Evidence Collection](policy-compatibility-deletion-preflight-evidence-collection.md).
- Task 8R.16.3 is implemented. The v4 execution gate consumes a complete
  collector artifact and independently revalidates its fingerprint, source
  revision, timestamps, plan binding, manifest ordering, duplicate paths,
  runtime-evidence reference, and side-effect state. It derives machine facts
  only from that artifact, accepts database-owned recovery evidence only from
  its dedicated fingerprint-bound artifact, and accepts separately bound
  operator evidence only for approval and final stances. Cross-plan, stale, altered,
  duplicate, post-observation, and machine-claim substitution cases block
  before a controlled removal batch can be assembled. The design and outcome
  record is [Policy Compatibility Deletion Preflight Attestation](policy-compatibility-deletion-preflight-attestation.md).
- Task 8R.16.4 is implemented. The controlled apply boundary now performs a
  final per-entry, read-only checkout recheck immediately before an adapter
  receives an entry. It requires the approved source revision, observed
  manifest membership, a regular non-symlink live path, an exact regular
  `HEAD` blob, and a clean path-to-`HEAD` comparison. Revision or path drift
  blocks the entry and stops the remaining batch; bounded verification summaries
  distinguish that state from adapter or result failure. The design and outcome
  record is [Policy Compatibility Deletion Pre-Apply Change Detection](policy-compatibility-deletion-pre-apply-change-detection.md).
- Task 8R.16.5 is implemented. The preflight artifact now carries a
  fingerprint-bound runtime-evidence escalation decision. It requires the
  existing provenance-bound, read-only embedded maintenance runner only when
  the artifact, checkout, and manifest are otherwise observed but the retained
  runtime-evidence reference is missing or stale. Invalid evidence, unsafe
  preflight state, unavailable containment, image-provenance failure, or an
  unavailable runtime query remains blocked and cannot fall back to a host,
  mutable-tag, or caller-provided runtime claim. The design and outcome record
  is [Policy Compatibility Deletion Runtime Evidence Escalation](policy-compatibility-deletion-runtime-evidence-escalation.md).

### 8R.17 Controlled Compatibility Path Removal

Intent: consume the same ready evidence-bound execution-plan artifact and
compatibility deletion execution gate, then produce a small, reviewable
compatibility path removal batch without performing destructive changes.

Tasks:

- **8R.17.1 Artifact And Gate Cohesion**
  - Completed: replaced independent execution-plan and gate inputs with one
    evidence-bound execution artifact.
  - Completed: verifies the removal manifest is the same manifest fingerprinted
    by the gate.
  - Completed: rejects a ready gate when it is paired with a different plan or
    manifest.
- **8R.17.2 Manifest And Selection Safety**
  - Completed: requires exact canonical repository-relative paths for both the
    approved manifest and selected review batch, rejecting duplicates, aliases,
    and traversal forms.
  - Completed: requires selected entries to retain meaningful replacement
    evidence rather than a truthy empty object.
  - Completed: keeps this validation side-effect-free and binds its result into
    the existing removal review artifact.
- **8R.17.3 Scope-Aware Controlled-Removal Continuation**
  - Reclassified: the completed `3R.10.1` through `3R.10.19` design records
    are Phase 8R compatibility-retirement history, not Phase 3R workflow work.
    Their historical labels remain in their individual documents for source
    traceability; this roadmap is the active task authority.
  - Completed: the stream binds exact named test scopes to a current execution
    gate, performs a fresh review replay, writes external rollback evidence,
    and admits only one scoped apply through a server-owned production
    composer. It has no browser flow, generic mutation endpoint, client actor,
    caller-owned clock, or repository write capability outside its bounded
    source-writer contract.
  - Superseded direction: do not add a server review-context registry. It
    would extend running-service reachability to repository source mutation.
    Tasks 8R.37.1 and 8R.37.2 completed the static inventory and removal of
    the isolated server-resident path before a CI/release-maintenance-only
    retirement command is considered.
- Consume approved compatibility deletion manifest entries.
- Consume compatibility deletion execution-gate output.
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

- Controlled compatibility path removal is documented in
  [Policy Controlled Compatibility Path Removal](policy-controlled-compatibility-path-removal.md).
- Artifact and gate cohesion is documented in
  [Policy Controlled Compatibility Path Removal Artifact Cohesion](policy-controlled-compatibility-path-removal-artifact-cohesion.md).
- The module naming cutover is documented in
  [Policy Controlled Compatibility Path Removal Module Cutover](policy-controlled-compatibility-path-removal-module-cutover.md).
- The removal-batch contract lives in
  `server/src/services/policyControlledCompatibilityPathRemoval.mjs`.
- The canonical manifest and selection boundary lives in
  `server/src/services/policyControlledCompatibilityPathRemovalSelection.mjs`.
- The focused removal-batch test suite lives in
  `server/src/__tests__/services/policyControlledCompatibilityPathRemoval.test.mjs`.
- Current implementation builds a side-effect-free removal review batch only
  from the fingerprint-valid execution-plan artifact whose fingerprint matches
  the execution gate's embedded artifact. It rejects malformed or duplicate
  manifest paths, noncanonical or duplicate selection input, and empty
  replacement-evidence claims before it emits a semantic `nextStep.stepId` and
  defers destructive application to the controlled apply boundary because
  candidate paths still have live imports.

### 8R.18 Controlled Compatibility Path Removal Apply

Intent: apply one reviewed controlled compatibility path removal batch through
an explicit adapter boundary and record structured apply evidence for
post-removal verification.

Tasks:

- **8R.18.1 Review Artifact Integrity**
  - Completed: apply input now carries a valid controlled removal review bound
    to one execution-plan artifact and execution gate.
  - Completed: revalidates that context before an adapter receives any entry.
  - Completed: rejects altered, missing, or mismatched artifact-and-gate
    context without calling the adapter.
- **8R.18.2 Adapter Failure Containment**
  - Completed: stops the reviewed batch after the first adapter exception,
    rejected result, or forbidden reported side effect; later entries are not
    rechecked or submitted after that point.
  - Completed: records the bounded stopped entry and halt reason, preserves
    earlier applied evidence, and requires post-removal verification only when
    at least one reviewed path actually applied.
- Consume a ready controlled compatibility path removal review batch.
- Require `executeApply=true`.
- Require explicit operator confirmation with confirming actor.
- Require an injected apply adapter with `applyEntry(entry)`.
- Apply only reviewed batch entries through the adapter.
- Require apply result count, path, and action parity with the reviewed batch.
- Reject archive, storage, and Git-command side effects inside the service.
- Emit apply evidence for the next runtime/import verification step.

Acceptance criteria:

- Apply is blocked unless the controlled removal batch is ready and valid.
- Apply is blocked without explicit execute flag and named confirmation actor.
- Apply is blocked without an adapter.
- Adapter failures are captured as bounded risks.
- Adapter exceptions, rejected adapter results, and forbidden reported side
  effects stop the batch before a later entry reaches the adapter.
- Mismatched paths, mismatched actions, or `applied=false` results block apply.
- Service does not run Git commands or mutate storage.
- Apply output identifies bounded removal side effects and validates that
  unexpected side effects did not occur.

Implementation status:

- Controlled compatibility path removal apply is documented in
  [Policy Controlled Compatibility Path Removal Apply](policy-controlled-compatibility-path-removal-apply.md).
- Review integrity is documented in
  [Policy Controlled Compatibility Path Removal Review Artifact Integrity](policy-controlled-compatibility-path-removal-review-artifact-integrity.md).
- The module naming cutover is documented in
  [Policy Controlled Compatibility Path Removal Apply Module Cutover](policy-controlled-compatibility-path-removal-apply-module-cutover.md).
- The apply contract lives in
  `server/src/services/policyControlledCompatibilityPathRemovalApply.mjs`.
- The focused apply test suite lives in
  `server/src/__tests__/services/policyControlledCompatibilityPathRemovalApply.test.mjs`.
- Current implementation fingerprints and replays the complete reviewed
  artifact-and-gate context before an injected adapter receives any entry. It
  requires explicit confirmation, verifies result parity, rejects archive,
  storage, and Git-command side effects, fails closed after the first
  adapter-level anomaly, and emits a semantic `nextStep.stepId` that reflects
  whether a runtime verification or blocker-resolution path is required.

### 8R.19 Post-Removal Runtime Verification

Intent: consume controlled-removal apply evidence and prove the removed
compatibility paths are no longer imported, runtime checks still pass, and
focused plus full validation evidence exists before another removal batch can
proceed.

Tasks:

- **8R.19.1 Runtime Evidence Integrity**
  - Completed: binds every supplied import scan, runtime check, and validation
    result to the exact applied controlled-removal review artifact fingerprint.
  - Completed: rejects missing, altered, or cross-batch evidence before
    post-removal verification can pass.
  - Completed: preserves side-effect-free evidence evaluation and bounded
    diagnostics.
- **8R.19.2 Partial-Apply Runtime Verification Eligibility**
  - Completed: permits runtime verification of a bounded, valid applied prefix
    only after a controlled apply stops at the immediately following entry.
  - Completed: requires a known halt reason with a matching apply status, a
    contiguous canonical applied prefix, bounded stopped entry, intact ready
    review and execution-gate fingerprints, and exact applied-path scope for
    partial import, runtime, focused-validation, and full-validation evidence.
  - Completed: emits `verified_partial_apply` only as a non-authorizing state;
    it directs blocker resolution and is rejected by next-batch authorization
    and completion-audit paths. The completed-batch pathway remains unchanged.
- Consume complete controlled-removal apply evidence or a bounded eligible
  partial prefix.
- Require apply evidence to be valid and structurally attributable.
- Require import/reference scan evidence for every applied removal path.
- Block if any removed path is still referenced.
- Require focused runtime/import checks to pass.
- Require focused and full validation evidence to pass.
- Reject storage or Git-command side effects inside the verifier.
- Emit authorization context for the next removal batch.

Acceptance criteria:

- Verification is blocked unless controlled-removal apply evidence is complete
  and valid, or proves the bounded eligible partial prefix.
- Missing import scan evidence blocks verification.
- Any lingering reference to a removed path blocks verification.
- Missing or failed runtime checks block verification.
- Missing or failed focused/full validation blocks verification.
- Verifier does not run source searches, tests, Git commands, storage mutation,
  or additional removals itself.

Implementation status:

- Post-removal runtime verification is documented in
  [Policy Post-Removal Runtime Verification](policy-post-removal-runtime-verification.md).
- Partial-apply verification eligibility is documented in
  [Policy Post-Removal Partial-Apply Verification Eligibility](policy-post-removal-partial-apply-verification-eligibility.md).
- Review-bound runtime evidence is documented in
  [Policy Post-Removal Runtime Evidence Integrity](policy-post-removal-runtime-evidence-integrity.md).
- The durable module naming cutover is documented in
  [Policy Post-Removal Runtime Verification Module Cutover](policy-post-removal-runtime-verification-module-cutover.md).
- The verifier contract lives in
  `server/src/services/policyPostRemovalRuntimeVerification.mjs`.
- Partial apply eligibility is isolated in
  `server/src/services/policyPostRemovalApplyEligibility.mjs`.
- The focused verifier test suite lives in
  `server/src/__tests__/services/policyPostRemovalRuntimeVerification.test.mjs`.
- The runtime-evidence artifact contract lives in
  `server/src/services/policyPostRemovalRuntimeEvidenceArtifact.mjs`, with
  focused tests in
  `server/src/__tests__/services/policyPostRemovalRuntimeEvidenceArtifact.test.mjs`.
- Current implementation requires a fingerprint-valid, review-bound runtime
  evidence artifact before it consumes apply, import scan, runtime check, and
  focused/full validation evidence; it blocks lingering references or failed
  checks, rejects storage/Git side effects, and emits semantic `nextStep`
  evidence. A verified partial prefix is explicitly non-authorizing and routes
  only to blocker resolution; only a completed verified apply can continue to
  next-batch authorization.

### 8R.20 Next Compatibility Removal Batch Authorization

Intent: consume verified post-removal runtime evidence and the approved
compatibility deletion manifest, calculate remaining manifest paths, prevent
already removed paths from re-entering a batch, and authorize only the next
narrow removal batch.

Tasks:

- **8R.20.1 Next-Batch Authorization Artifact Integrity**
  - Completed: requires a fingerprint-valid post-removal runtime evidence
    artifact, not a detached verified-status summary.
  - Completed: revalidates the artifact's applied removal-review fingerprint
    and removed paths against the next-batch authorization context and manifest.
  - Completed: rejects missing, altered, mismatched, or cross-manifest runtime
    evidence before a remaining manifest path can be authorized.
  - Completed: preserves bounded, side-effect-free authorization diagnostics.
- Require post-removal runtime evidence to be verified and valid.
- Require compatibility deletion execution-plan evidence to be ready and valid.
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

- Next compatibility removal batch authorization is documented in
  [Policy Next Compatibility Removal Batch Authorization](policy-next-compatibility-removal-batch-authorization.md).
- The module naming cutover is documented in
  [Policy Next Compatibility Removal Batch Authorization Module Cutover](policy-next-compatibility-removal-batch-authorization-module-cutover.md).
- The authorization contract lives in
  `server/src/services/policyNextCompatibilityRemovalBatchAuthorization.mjs`.
- The focused authorization test suite lives in
  `server/src/__tests__/services/policyNextCompatibilityRemovalBatchAuthorization.test.mjs`.
- Current implementation authorizes only requested remaining manifest paths,
  blocks already removed or unknown paths, caps batch size, requires operator
  context, and emits semantic `nextStep` evidence for the completion audit.

### 8R.21 Compatibility Removal Completion Audit

Intent: consume verified removal-loop evidence and prove whether all approved
compatibility manifest paths are gone, or report the bounded remaining
inventory that still needs another controlled removal loop.

Tasks:

- **8R.21.1 Completion Audit Artifact Integrity**
  - Require a fingerprint-valid next-batch authorization artifact, not detached
    completion authorization and post-removal verification summaries.
  - Revalidate its embedded runtime evidence artifact and applied
    removal-review fingerprint against the completion audit context.
  - Reject missing, altered, cross-batch, or cross-manifest authorization
    evidence before a completion result can pass.
  - Preserve the existing bounded remaining-inventory outcome and side-effect
    prohibition.
- Require complete next-batch authorization evidence.
- Require the approved compatibility deletion execution manifest.
- Require verified post-removal runtime verification evidence.
- Prove every approved manifest path is covered by verified removal evidence.
- Require final import/reference scan evidence for every approved manifest
  path.
- Block if any final scan reference remains.
- Require focused and full validation evidence to pass.
- Report remaining inventory separately from failed evidence.
- Reject file, archive, route, test, storage, manifest, or Git side effects
  inside the audit.

Acceptance criteria:

- Completion is blocked unless authorization reports no remaining paths.
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

- Compatibility removal completion audit is documented in
  [Policy Compatibility Removal Completion Audit](policy-compatibility-removal-completion-audit.md).
- The module naming cutover is documented in
  [Policy Compatibility Removal Completion Audit Module Cutover](policy-compatibility-removal-completion-audit-module-cutover.md).
- The audit contract lives in
  `server/src/services/policyCompatibilityRemovalCompletionAudit.mjs`.
- The focused audit test suite lives in
  `server/src/__tests__/services/policyCompatibilityRemovalCompletionAudit.test.mjs`.
- Task 8R.21.1 is implemented. Completion audit now consumes a
  fingerprint-valid next-batch authorization artifact instead of detached
  authorization and post-removal-verification summaries. It revalidates the
  embedded runtime evidence, binds the applied removal-review fingerprint to
  audit context, and replays authorization against the current manifest before
  a complete result can pass. The design is documented in
  [Policy Compatibility Removal Completion Audit Artifact Integrity](policy-compatibility-removal-completion-audit-artifact-integrity.md).
- Current implementation reports remaining inventory separately; blocks
  missing, altered, cross-review, or cross-manifest authorization evidence;
  requires final scan and focused/full validation evidence; and emits semantic
  `nextStep` evidence for the storage completion checkpoint.

Current removal slice:

- Starter-template mechanics removal is documented in
  [Policy Builder Phase 8R Starter Template Mechanics Removal](policy-builder-phase-8r-starter-template-mechanics-removal.md).
- The approved compatibility path
  `client/src/components/policies/PolicyStarterTemplateMechanics.vue` has been
  removed from product code and replaced by
  `client/src/components/policies/PolicyStarterTemplateAccelerator.vue`.
- The focused component test now targets
  `client/src/__tests__/PolicyStarterTemplateAccelerator.test.js`.
- The final-removal reference scanner now excludes tests and named
  control-plane manifest evidence so completion is blocked by product/runtime
  references rather than deletion-manifest evidence strings. It does not use a
  broad service-name prefix exclusion.
- The impact and replay migration verifiers, their routes, and their remaining
  local reducers were removed because they did not provide independent migration
  proof beyond bounded evidence, intent, readiness, and rollback contracts.
  Their history and retirement evidence are recorded in
  [Policy Impact Migration Verifier Retirement](policy-impact-migration-verifier-retirement.md)
  and
  [Policy Replay Migration Verifier Retirement](policy-replay-migration-verifier-retirement.md).

### 8R.22 Policy Storage Completion Checkpoint

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
- **Task 8R.22.1: Completion Checkpoint Artifact Integrity.** Require the
  completion audit to arrive as a current fingerprint-valid artifact that
  retains its authorization artifact, execution plan, and audit inputs. Replay
  the audit before the checkpoint reads its completion status; do not accept a
  detached nested audit object.
- Require focused, lint, markdown, and full validation evidence to pass.
- Require changelog coverage for every expected component.
- Reject file-write, storage, command-execution, and Git side effects inside
  the checkpoint.

Acceptance criteria:

- Storage checkpoint completion is blocked when any expected component lacks
  implementation, design-doc, contract, or test evidence.
- Storage checkpoint completion is blocked when the roadmap sequence or implementation
  status omits an expected phase ID.
- Storage checkpoint completion is blocked unless compatibility-removal
  completion-audit artifact evidence is complete, fingerprint-valid, and
  replay-valid.
- Storage checkpoint completion is blocked when focused, lint, markdown, or full
  validation evidence is missing or failed.
- Storage checkpoint completion is blocked when changelog coverage is missing for any
  expected phase.
- The checkpoint does not scan files, run commands, mutate storage, write
  docs/changelog, or run Git itself.

Implementation status:

- Policy storage completion checkpoint is documented in
  [Policy Storage Completion Checkpoint](policy-storage-completion-checkpoint.md).
- The durable module naming cutover is documented in
  [Policy Storage Completion Checkpoint Module Cutover](policy-storage-completion-checkpoint-module-cutover.md).
- The checkpoint contract lives in
  `server/src/services/policyStorageCompletionCheckpoint.mjs`.
- The focused checkpoint test suite lives in
  `server/src/__tests__/services/policyStorageCompletionCheckpoint.test.mjs`.
- Current implementation consumes component evidence, roadmap evidence,
  compatibility-removal completion-audit artifact evidence, validation evidence,
  and changelog evidence; blocks incomplete coverage; and emits semantic
  `nextStep` evidence for policy storage final closure readout only when all
  evidence passes.
- Task 8R.22.1 is implemented. The checkpoint no longer accepts a detached
  completion-audit object. It verifies the current completion-audit artifact
  fingerprint, requires retained replay inputs, and recreates the audit before
  it evaluates completion.

### 8R.23 Policy Storage Closure Evidence Run

Intent: normalize explicit current-state artifact evidence and run the Phase
8R.22 completion checkpoint against that evidence before Phase 8R is closed.

Tasks:

- **8R.23.1 Current-State Closure Evidence Artifact Integrity**
  - Emit a versioned current-closure audit that retains normalized closure
    inputs, binds the complete artifact with a SHA-256 fingerprint, and records
    a content-only fingerprint for the selected checkout's mapped artifacts,
    roadmap, and changelog.
  - Require the final requirement audit to validate the fingerprint and
    deterministically replay the closure evidence run, checkpoint artifact,
    and final readout before it evaluates completion.
  - Reject missing, legacy, malformed, altered, or non-replayable current
    closure artifacts, including evidence from a different or changed checkout,
    without executing repository commands or mutations.
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
- Compose the policy storage completion checkpoint instead of duplicating closure
  rules.
- Block completion when artifact inventory is empty, mapped artifacts are
  missing, checkpoint evidence is incomplete, validation evidence fails, or any
  side effect is reported.
- Reject file writes, storage mutation, command execution, and Git execution
  inside the evidence-run service.

Acceptance criteria:

- Evidence-run completion is blocked when the artifact inventory is empty.
- Evidence-run completion is blocked when any mapped storage closure artifact is
  missing.
- Evidence-run completion is blocked unless the composed policy storage checkpoint
  completes and validates.
- Windows-style and POSIX-style paths produce the same artifact matching result.
- Native backup/restore wiring is represented by the live
  backup/restore modules and lifecycle tests.
- The evidence run does not scan files, run commands, mutate storage, write
  docs/changelog, delete code, or run Git itself.
- The current-state script reports mapped artifact, roadmap, and changelog
  coverage while requiring a caller-supplied fingerprint-valid
  completion-audit artifact and validation evidence before closure can pass.

Implementation status:

- Policy storage closure evidence run is documented in
  [Policy Storage Closure Evidence Run](policy-storage-closure-evidence-run.md).
- The evidence-run module cutover is documented in
  [Policy Storage Closure Evidence Run Module Cutover](policy-storage-closure-evidence-run-module-cutover.md).
- The evidence-run contract lives in
  `server/src/services/policyStorageClosureEvidenceRun.mjs`.
- The current-state evidence collector lives in
  `server/src/services/policyStorageClosureCurrentEvidenceCollector.mjs`.
- The root runner lives in `scripts/run-policy-storage-closure-evidence.mjs`
  and is exposed as `npm run policy:storage-closure-evidence`.
- The focused evidence-run test suite lives in
  `server/src/__tests__/services/policyStorageClosureEvidenceRun.test.mjs`.
- The focused current-state collector test suite lives in
  `server/src/__tests__/services/policyStorageClosureCurrentEvidenceCollector.test.mjs`.
- Task 8R.23.1 is implemented. The current-evidence collector produces a
  versioned, content-only SHA-256 fingerprint for the selected checkout's
  mapped artifacts, roadmap, and changelog. The v5 current-closure audit
  retains it, while the v3 requirement audit recomputes it from the selected
  checkout and blocks altered or cross-checkout evidence before completion.
- The public closure-evidence command resolves relative completion-audit and
  validation artifacts from its selected `--cwd` checkout, preventing a caller
  directory from mixing another checkout's evidence with the repository it
  inventories.
- Current implementation consumes explicit artifact inventory, converts mapped
  artifact coverage into checkpoint component evidence, composes the storage
  completion checkpoint, blocks incomplete evidence, and emits
  `nextStep.stepId = policy_storage_closure_evidence_complete` only when
  supplied evidence satisfies the checkpoint.
- Current checkout execution reports all mapped storage closure artifacts
  present, then correctly blocks closure until machine-readable final removal
  audit evidence and validation evidence are supplied.

### 8R.24 Policy Storage Closure Validation Evidence

Intent: generate the machine-readable validation JSON required by the policy
storage closure evidence run without moving validation execution into the
completion checkpoint.

Tasks:

- **8R.24.1 Validation Evidence Artifact Integrity**
  - Bind the fixed command catalog, normalized command results, side-effect
    input, and derived check state with a versioned SHA-256 fingerprint.
  - Replay the artifact from retained input without command execution before
    a checkpoint or current-closure audit consumes it.
  - Reject legacy summary-only, malformed, altered, or re-fingerprinted
    derived-state-inconsistent evidence.
- Define fixed validation command specs for focused policy storage closure tests,
  server lint, markdown validation, and full server validation.
- Execute those commands from a root script with array arguments and no
  user-controlled shell command construction.
- Record bounded command evidence with command string, pass/fail state, exit
  code, signal, duration, timestamps, and failure message.
- Continue running later checks after failures by default so one failure does
  not hide other broken gates.
- Emit checkpoint-compatible JSON with `focused`, `lint`, `markdown`, and
  `full` entries.
- Keep the policy storage closure evidence run responsible for final closure
  decisions.

Acceptance criteria:

- Validation evidence is complete only when every configured check result is
  present and passed.
- Failed checks preserve bounded failure metadata without storing full logs in
  the JSON artifact.
- Unknown check IDs and reported file/storage/Git side effects are rejected.
- The generator can write JSON to `.tmp/policy-storage/validation-evidence.json`.
- The generator does not mutate policy storage, run Git, or change checkpoint
  semantics.

Implementation status:

- Policy storage closure validation evidence generation is documented in
  [Policy Storage Closure Validation Evidence](policy-storage-closure-validation-evidence.md).
- The validation evidence module cutover is documented in
  [Policy Storage Closure Validation Evidence Module Cutover](policy-storage-closure-validation-evidence-module-cutover.md).
- The validation evidence contract lives in
  `server/src/services/policyStorageClosureValidationEvidence.mjs`.
- The generator script lives in
  `scripts/generate-policy-storage-closure-validation-evidence.mjs`.
- The root runner is exposed as `npm run policy:storage-closure-validation-evidence`.
- The focused validation evidence test suite lives in
  `server/src/__tests__/services/policyStorageClosureValidationEvidence.test.mjs`.
- Task 8R.24.1 is implemented. The v2 artifact binds a source-controlled
  command catalog, bounded normalized results, side-effect input, and derived
  status through a SHA-256 fingerprint. The completion checkpoint and
  current-closure audit now require exact pure replay before they trust it.
- Current implementation generates validation JSON for the storage closure
  evidence run without moving command execution into closure consumers.

### 8R.25 Policy Storage Closure Final Removal Audit

Intent: generate the machine-readable final-removal-audit JSON that the policy
storage closure evidence run requires, without claiming completion while
approved manifest paths still exist.

Tasks:

- **8R.25.1 Approved Execution-Plan Artifact Source**
  - Completed: require the ready, fingerprint-valid compatibility deletion
    execution-plan artifact as the final-removal audit's sole manifest source.
  - Completed: reject raw plans, unready or malformed artifacts, invalid
    fingerprints, missing approval metadata, unsafe paths, duplicate paths,
    and entry-count or readiness mismatches before filesystem inspection.
  - Completed: expose only the validated nested plan to path-state and
    reference-scan work; invalid sources cannot define audit scope.
- **8R.25.2 Replayable Current-Checkout Path-State Evidence**
  - Completed: collect read-only boolean observations only for the approved,
    canonical manifest paths from one ready execution-plan artifact.
  - Completed: retain the artifact, observations, derived path state, and
    side-effect declaration in a fingerprint-valid, deterministic replay
    artifact; reject missing, unknown, duplicate, incomplete, or altered input.
  - Completed: require the v3 final-removal audit to consume only the replayed
    snapshot bound to the exact execution-plan artifact instead of a live
    filesystem callback.
- **8R.25.3 Next-Batch Authorization Snapshot Binding**
  - Completed: require next-batch authorization to consume a replay-verified
    path-state evidence artifact bound to the exact ready execution-plan
    artifact it retains.
  - Completed: derive remaining inventory from the snapshot's removed paths and
    require runtime applied paths to match that snapshot exactly before a new
    batch can be authorized.
  - Completed: reject raw plans, missing or altered snapshots, snapshots from a
    different execution-plan artifact, divergent manifest paths, and final
    audit consumers whose expected artifact fingerprint differs.
  - Implemented by
    `server/src/services/policyNextCompatibilityRemovalBatchAuthorizationPathStateSource.mjs`,
    the v3 authorization service, the v4 authorization artifact, and focused
    authorization, artifact, integrity, completion-audit, and final-audit
    coverage. Design rationale is documented in
    [Next-Batch Authorization Path-State Binding](policy-next-compatibility-removal-batch-authorization-path-state-binding.md).
- **8R.25.4 Final-Removal Generator Artifact-Chain Verification**
  - Completed: runs the public final-removal-audit JSON generator against a
    temporary checkout with a ready plan artifact, replay-verified path-state
    evidence, retained runtime verification through next-batch authorization,
    review fingerprint, validation evidence, and the real current-source scan.
  - Completed: proves the generator blocks a live product import and a
    snapshot from another execution-plan artifact without deletion, storage,
    Git, or source mutation.
- Completed: post-removal runtime verification is retained in the
  fingerprint-valid next-batch authorization artifact consumed by the final
  audit.
- Completed: the generator scans source roots for exact manifest-path
  references and supplies the result as final import/reference scan evidence.
- Completed: the generator composes the existing policy compatibility removal
  completion audit and emits JSON without changing checkpoint semantics.

Acceptance criteria:

- The exporter refuses to run without explicit execution-plan and replayable
  checkout path-state JSON paths.
- Existing manifest paths are reported as remaining inventory.
- Removed manifest paths are covered by bounded removal verification evidence.
- Final scan references block completion.
- The generated JSON can be passed to `npm run policy:storage-closure-evidence`.
- The exporter does not delete files, archive files, mutate storage, run Git, or
  fabricate completion when current evidence says inventory remains.

Implementation status:

- Policy storage closure final removal audit is documented in
  [Policy Storage Closure Final Removal Audit](policy-storage-closure-final-removal-audit.md).
- The module naming cutover is documented in
  [Policy Storage Closure Final Removal Audit Module Cutover](policy-storage-closure-final-removal-audit-module-cutover.md).
- The final-removal audit evidence contract lives in
  `server/src/services/policyStorageClosureFinalRemovalAudit.mjs`.
- The exporter script lives in
  `scripts/generate-policy-storage-closure-final-removal-audit.mjs`.
- The root runner is exposed as `npm run policy:storage-closure-final-removal-audit`.
- The focused final-removal audit evidence test suite lives in
  `server/src/__tests__/services/policyStorageClosureFinalRemovalAudit.test.mjs`.
- Checkout snapshot design and implementation are documented in
  [Policy Storage Closure Path-State Evidence](policy-storage-closure-path-state-evidence.md).
- The snapshot collector, evidence, fingerprint, and integrity contracts live
  under `server/src/services/policyStorageClosurePathState*.mjs` and the root
  runner is exposed as `npm run policy:storage-closure-path-state-evidence`.
- Current implementation can generate the final-removal-audit JSON input for
  the policy storage closure evidence run. It now requires the wrapper artifact
  and a replay-verified path-state artifact at the generator boundary;
  completion remains dependent on its real current checkout removal state.
- Task 8R.25.4 adds process-level coverage of that public generator boundary,
  including a complete artifact chain, a real scanner-derived reference block,
  and a cross-artifact checkout-snapshot block.

### 8R.26 Policy Compatibility Deletion Execution Plan Artifact

Intent: generate the fingerprint-valid compatibility deletion execution-plan
artifact that the policy storage closure final-removal audit requires, without
fabricating deletion readiness or performing compatibility path removal. The
nested execution plan is a diagnostic payload, not final-removal authority.

Tasks:

- **8R.26.1 Execution-Plan Exporter Artifact-Chain Verification**
  - Completed: runs the public exporter with ready evidence and proves its
    wrapper output is accepted as the authoritative final-removal manifest
    source while its nested plan output remains diagnostic only.
  - Completed: proves blocked readiness writes no output by default and
    produces only an explicit, non-authoritative diagnostic with
    `--allow-blocked`.
- Require explicit input evidence for readiness, deletion gates, replacement
  evidence, rollback stance, support stance, manifest approval, and approving
  actor.
- Build the nested compatibility deletion execution plan through the existing
  execution-plan contract.
- Wrap the generated plan with bounded artifact metadata, risks, validation,
  and no-side-effect evidence.
- Write the nested execution-plan JSON only for diagnostics and earlier
  read-only consumers.
- Write the fingerprint-valid wrapper artifact for downstream storage-closure
  final-removal audit authority.
- Block by default when the generated execution plan is not ready.
- Avoid deleting files, archiving files, mutating storage, running Git, or
  applying compatibility-removal batches.

Acceptance criteria:

- The exporter refuses to run without explicit input evidence.
- Missing approval or blocked readiness prevents ready output.
- Ready input writes a valid fingerprint-valid compatibility deletion
  execution-plan wrapper artifact.
- Blocked diagnostic output requires explicit `--allow-blocked`.
- The generated wrapper artifact can be passed to
  `npm run policy:storage-closure-final-removal-audit`; its nested plan cannot
  be passed as final-removal authority.
- The exporter does not delete files, archive files, mutate storage, run Git, or
  apply removal batches.

Implementation status:

- Policy compatibility deletion execution-plan artifact export is documented in
  [Policy Compatibility Deletion Execution Plan Artifact](policy-compatibility-deletion-execution-plan-artifact.md).
- The module naming cutover is documented in
  [Policy Compatibility Deletion Execution Plan Artifact Module Cutover](policy-compatibility-deletion-execution-plan-artifact-module-cutover.md).
- The execution-plan artifact contract lives in
  `server/src/services/policyCompatibilityDeletionExecutionPlanArtifact.mjs`.
- The exporter script lives in
  `scripts/generate-policy-compatibility-deletion-execution-plan-artifact.mjs`.
- The root runner is exposed as
  `npm run policy:compatibility-deletion-execution-plan-artifact`.
- The focused execution-plan artifact test suite lives in
  `server/src/__tests__/services/policyCompatibilityDeletionExecutionPlanArtifact.test.mjs`.
- Current implementation generates the fingerprint-valid wrapper artifact
  required by the policy storage closure final-removal audit while keeping
  deletion readiness caller-owned and explicit. The nested execution-plan JSON
  remains non-authoritative diagnostic output.
- Task 8R.26.1 adds process-level coverage of the public JSON boundary and
  confirms the wrapper-versus-diagnostic authority distinction and
  fail-closed blocked-output behavior.

### 8R.27 Policy Controlled Compatibility Removal Batch Artifact

Intent: generate the machine-readable controlled compatibility removal batch
JSON from a ready fingerprint-valid compatibility deletion execution-plan
artifact, explicit gate evidence, selected manifest paths, review reason, and
reviewer metadata.

Tasks:

- **8R.27.1 Controlled-Removal Batch Exporter Artifact-Chain Verification**
  - Completed: runs the public exporter with ready evidence and proves its
    nested review batch preserves the approved review artifact, execution-plan
    fingerprint, and execution-gate binding required by controlled apply.
  - Completed: proves mismatched preflight evidence writes no output by default
    and an out-of-manifest selection produces only an explicit, bounded
    diagnostic with `--allow-blocked`.
- Require a ready fingerprint-valid compatibility deletion execution-plan
  artifact.
- Require explicit gate input evidence for clean worktree,
  backup/restore freshness, operator approval, final rollback/support stance,
  and manifest freshness.
- Require selected paths to come from the approved execution-plan manifest.
- Require a narrow selected path batch with review reason and reviewer.
- Build the compatibility deletion execution gate through the existing gate
  contract.
- Build the reviewed removal batch through the existing controlled-removal
  contract.
- Write the nested removal-batch JSON for controlled apply tooling.
- Avoid deleting files, archiving files, removing routes/tests, mutating
  storage, writing manifests, or running Git.

Acceptance criteria:

- The exporter refuses to run without execution-plan and gate/review input JSON.
- Blocked gate evidence prevents ready removal-batch output.
- Selected paths outside the approved manifest prevent ready output.
- Ready output is bounded to the reviewed selected paths.
- The generated removal-batch JSON can be passed to later controlled apply
  tooling.
- The exporter performs no deletion, archive, route, test, storage, manifest,
  or Git side effects.

Implementation status:

- Policy controlled compatibility removal batch artifact export is documented in
  [Policy Controlled Compatibility Removal Batch Artifact](policy-controlled-compatibility-removal-batch-artifact.md).
- The module naming cutover is documented in
  [Policy Controlled Compatibility Removal Batch Artifact Module Cutover](policy-controlled-compatibility-removal-batch-artifact-module-cutover.md).
- The controlled-removal batch artifact contract lives in
  `server/src/services/policyControlledCompatibilityRemovalBatchArtifact.mjs`.
- The exporter script lives in
  `scripts/generate-policy-controlled-compatibility-removal-batch-artifact.mjs`.
- The root runner is exposed as
  `npm run policy:controlled-compatibility-removal-batch`.
- The focused controlled-removal batch artifact test suite lives in
  `server/src/__tests__/services/policyControlledCompatibilityRemovalBatchArtifact.test.mjs`.
- Current implementation generates the reviewed removal-batch JSON input for
  a later controlled apply artifact while keeping destructive removal out of
  this component.
- Task 8R.27.1 adds process-level coverage of the public JSON boundary and
  confirms that its nested review batch reaches controlled-apply confirmation
  checks without an integrity failure or an apply-adapter invocation.

### 8R.28 Controlled Removal Apply Artifact Exporter

Status: historical mutable-command design. 8R.37.3 retired its generator,
filesystem adapter, and npm command. The retained
`policyControlledRemovalApplyArtifact.mjs` module is an injected,
read-only evidence builder; it has no concrete source-mutation capability.

Historical intent: generate a machine-readable controlled-removal apply
artifact from a ready reviewed removal batch, explicit apply input evidence,
operator confirmation, and a bounded apply adapter.

Tasks:

- **8R.28.1 Public Apply Sandbox And Path-Boundary Verification**
  - Completed historically: the command boundary was tested in a disposable
    checkout before 8R.37.3 retired the command and its adapter.
- The retained service continues to validate reviewed batch and confirmation
  evidence through an injected adapter contract only.
- No CLI, npm runner, filesystem adapter, archive behavior, storage mutation,
  or Git-command side effect is available from this component.

Acceptance criteria:

- The pure artifact builder rejects invalid reviewed evidence and unsupported
  side effects.
- No repository source change can be initiated from this component.
- Its artifact output remains available to downstream verification as evidence
  only.

Implementation status:

- Controlled removal apply artifact export is documented in
  [Policy Controlled Removal Apply Artifact Exporter](policy-controlled-removal-apply-artifact-exporter.md).
- The durable module naming cutover is documented in
  [Policy Controlled Removal Apply Artifact Module Cutover](policy-controlled-removal-apply-artifact-module-cutover.md).
- The controlled-removal apply artifact contract lives in
  `server/src/services/policyControlledRemovalApplyArtifact.mjs`.
- The focused controlled-removal apply artifact test suite lives in
  `server/src/__tests__/services/policyControlledRemovalApplyArtifact.test.mjs`.
- The former public command, npm runner, filesystem adapter, and mutation
  tests were retired by 8R.37.3. The runtime release-maintenance audit rejects
  their restoration and rejects repository workflow contents-write
  permissions. See [Policy CI-Only Retirement Command Contract](policy-ci-only-retirement-command-contract.md).

### 8R.29 Post-Removal Runtime Verification Artifact Exporter

Intent: generate a machine-readable post-removal runtime verification artifact
from controlled-removal apply evidence, import/reference scan evidence, focused
runtime/import checks, and focused/full validation evidence.

Tasks:

- **8R.29.1 Public Runtime Verification Artifact-Chain Verification**
  - Completed: runs the public exporter against a nested controlled-apply
    result and verifies that its verification, runtime-evidence, and wrapper
    outputs retain the same reviewed-removal provenance.
  - Completed: proves incomplete scan coverage, remaining references, and
    cross-review evidence fail closed without output; blocked diagnostics
    require explicit `--allow-blocked`.
- Require controlled-removal apply-result JSON.
- Require completed import/reference scan evidence that covers every applied
  removal path.
- Block verification if any removed path is still referenced.
- Require focused runtime/import check evidence.
- Require focused and full validation evidence.
- Reuse the post-removal runtime verification contract.
- Avoid deleting files, mutating storage, running Git, or generating scan
  evidence implicitly.
- Write the standalone runtime evidence artifact for next-batch authorization,
  alongside nested verification JSON for diagnostics.

Acceptance criteria:

- The exporter refuses to run without apply-result and verification-input JSON.
- Incomplete or invalid apply evidence blocks verification.
- Missing scan coverage or remaining references block verification.
- Missing or failed runtime checks block verification.
- Missing or failed focused/full validation evidence blocks verification.
- Storage and Git side effects prevent verified artifact status.
- The generated runtime evidence artifact can be passed to next-batch
  authorization.

Implementation status:

- Post-removal runtime verification artifact export is documented in
  [Policy Post-Removal Runtime Verification Artifact Exporter](policy-post-removal-runtime-verification-artifact-exporter.md).
- The durable module naming cutover is documented in
  [Policy Post-Removal Runtime Verification Module Cutover](policy-post-removal-runtime-verification-module-cutover.md).
- The post-removal verification artifact contract lives in
  `server/src/services/policyPostRemovalRuntimeVerificationArtifact.mjs`.
- The exporter script lives in
  `scripts/generate-policy-post-removal-verification.mjs`.
- The root runner is exposed as
  `npm run policy:post-removal-verification`.
- The focused post-removal verification artifact test suite lives in
  `server/src/__tests__/services/policyPostRemovalRuntimeVerificationArtifact.test.mjs`.
- Current implementation consumes explicit scan/check/validation evidence,
  can write the review-bound runtime evidence artifact for next-batch
  authorization, and emits semantic `nextStep` evidence.
- Task 8R.29.1 adds process-level proof that the public exporter preserves the
  controlled-apply result contract and refuses unscanned, still-referenced, or
  cross-review evidence by default.

### 8R.30 Next Compatibility Removal Batch Authorization Artifact Exporter

Intent: generate the machine-readable next-batch authorization artifact from a
fingerprint-valid post-removal runtime evidence artifact, a ready compatibility
deletion execution plan, requested remaining manifest paths, and operator
authorization metadata.

Tasks:

- **8R.30.1 Public Next-Batch Authorization Artifact-Chain Verification**
  - Completed: runs the public JSON generator with a coherent fingerprinted
    runtime-evidence artifact, ready execution-plan wrapper, replay-verified
    path-state evidence, bounded path request, and matching review context.
  - Completed: proves unknown paths, a different review context, and runtime
    evidence from another manifest fail closed without output; an
    already-removed-path diagnostic requires explicit blocked-output allowance.
- Require fingerprint-valid post-removal runtime evidence artifact JSON.
- Require authorization context to name the artifact's applied removal-review
  fingerprint.
- Require ready compatibility deletion execution-plan JSON with approved
  manifest entries.
- Reject applied artifact paths that are outside the supplied manifest.
- Compute remaining manifest inventory from verified applied paths.
- Block unknown, already removed, empty, or overly broad requested batches.
- Require authorizing operator and reason while remaining paths exist.
- Reuse the existing next-batch authorization contract.
- Avoid deleting files, writing manifests, mutating storage, running tests,
  running scans, or running Git.
- Write the nested authorization JSON for the completion audit or the next
  controlled removal-batch loop.

Acceptance criteria:

- The exporter refuses to run without runtime evidence artifact, execution-plan,
  and authorization-input JSON.
- Missing, altered, cross-review, or cross-manifest runtime evidence blocks
  authorization.
- Invalid execution-plan manifest evidence blocks authorization.
- Unknown or already removed requested paths block authorization.
- Empty requested paths block authorization while remaining inventory exists.
- No remaining manifest paths produce completion evidence, not a forced empty
  batch.
- Any reported side effect prevents ready artifact status.

Implementation status:

- Next-batch authorization artifact export is documented in
  [Policy Next Compatibility Removal Batch Authorization Artifact Exporter](policy-next-compatibility-removal-batch-authorization-artifact-exporter.md).
- The next-batch authorization artifact contract lives in
  `server/src/services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs`.
- The exporter script lives in
  `scripts/generate-policy-next-batch-authorization.mjs`.
- The root runner is exposed as
  `npm run policy:next-batch-authorization`.
- The focused next-batch authorization artifact test suite lives in
  `server/src/__tests__/services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.test.mjs`.
- Task 8R.30.1 adds public process-level coverage in
  `server/src/__tests__/scripts/generatePolicyNextBatchAuthorization.test.mjs`
  and includes it in both the fixed storage-closure requirement audit and
  current-evidence inventory. It verifies one coherent artifact chain can
  produce authorization, while cross-review, cross-manifest, unknown, and
  already removed path inputs remain fail-closed.
- Current implementation regenerates verification from runtime artifact evidence
  and emits next-batch authorization or completion evidence with semantic
  `nextStep` output and without performing removal, scan, manifest, storage,
  or Git side effects.

### 8R.31 Compatibility Removal Completion Audit Artifact Exporter

Intent: generate the machine-readable compatibility-removal completion audit
artifact from authorization/completion evidence, compatibility deletion
execution-plan JSON, verified post-removal runtime evidence, final
import/reference scan evidence, and focused/full validation evidence.

Tasks:

- **8R.31.1 Public Completion-Audit Artifact-Chain Verification**
  - Completed: runs the public JSON generator with a fingerprint-valid
    next-batch artifact, exact execution plan, final scan, validation evidence,
    and matching review context.
  - Completed: proves complete and valid remaining-inventory output behavior,
    then proves altered authorization, cross-review input, and final scan
    references fail closed without output by default.
- Require next-batch authorization or completion JSON.
- Require compatibility deletion execution-plan JSON with approved manifest
  entries.
- Require verified post-removal runtime verification evidence.
- Require final import/reference scan evidence covering every approved manifest
  path.
- Block completion when final scan references remain.
- Preserve remaining-inventory as a valid non-complete artifact state.
- Reuse the existing compatibility-removal completion audit contract.
- Avoid deleting files, archiving, writing manifests, mutating storage, running
  tests/scans, or running Git.
- Write nested audit JSON for completion checkpoint inputs.

Acceptance criteria:

- The exporter refuses missing completion-authorization, execution-plan, or
  input JSON.
- Complete authorization with full evidence yields a complete artifact.
- Remaining authorization yields a remaining-inventory artifact.
- Missing or failing final scan, removal, validation, or execution-plan
  evidence blocks the artifact.
- Any side effect prevents complete or remaining artifact status.
- Generated audit JSON can feed the completion checkpoint.

Implementation status:

- Completion audit artifact export is documented in
  [Policy Compatibility Removal Completion Audit Artifact Exporter](policy-compatibility-removal-completion-audit-artifact-exporter.md).
- The completion-audit artifact contract lives in
  `server/src/services/policyCompatibilityRemovalCompletionAuditArtifact.mjs`.
- The exporter script lives in
  `scripts/generate-policy-compatibility-removal-completion-audit.mjs`.
- The root runner is exposed as
  `npm run policy:compatibility-removal-completion-audit`.
- The focused completion-audit artifact test suite lives in
  `server/src/__tests__/services/policyCompatibilityRemovalCompletionAuditArtifact.test.mjs`.
- Public command coverage lives in
  `server/src/__tests__/scripts/generatePolicyCompatibilityRemovalCompletionAudit.test.mjs`
  and is mapped in both the fixed closure requirement audit and current closure
  evidence inventory.
- Current implementation emits complete, remaining-inventory, or blocked audit
  artifacts with semantic `nextStep` output and without performing removal,
  scan, manifest, storage, or Git side effects. The artifact now retains the
  execution plan and audit inputs, binds them with a SHA-256 fingerprint, and
  supports deterministic replay by the storage completion checkpoint.

### 8R.32 Completion Checkpoint Artifact Exporter

Intent: generate the machine-readable policy storage completion checkpoint
artifact from explicit component evidence, roadmap evidence,
compatibility-removal completion-audit artifact evidence, validation evidence,
and changelog evidence.

Tasks:

- **8R.32.1 Public Completion-Checkpoint Artifact-Chain Verification**
  - Completed: runs the public JSON generator with one fingerprint-valid
    completion-audit artifact and explicit component, roadmap, validation, and
    changelog evidence.
  - Completed: proves a coherent chain produces complete output and altered
    completion-audit, roadmap, or validation evidence fails closed without
    output unless an operator explicitly requests a blocked diagnostic.
- **8R.32.2 Completion-Checkpoint Artifact Integrity Boundary**
  - Completed: retain the explicit component, roadmap, completion-audit,
    validation, changelog, and side-effect inputs in a versioned checkpoint
    artifact wrapper.
  - Completed: bind the wrapper with a versioned SHA-256 fingerprint and
    bounded provenance, then deterministically replay it before a final
    closure readout may use its status.
  - Completed: reject historical, malformed, altered, non-replayable, and
    replay-divergent checkpoint artifacts without a compatibility fallback.
- Require component evidence for the storage migration implementation set.
- Require roadmap sequence and implementation-status evidence.
- Require a complete and valid compatibility-removal completion-audit artifact.
- Require focused, lint, markdown, and full validation evidence.
- Require changelog evidence covering storage migration components.
- Reuse the policy storage completion checkpoint contract.
- Avoid collecting evidence, writing manifests, mutating storage, running
  commands, running Git, or changing files inside the service.
- Write nested checkpoint JSON for release/operator completion proof.

Acceptance criteria:

- The exporter refuses missing component, roadmap, completion-audit, validation,
  or changelog JSON.
- A complete compatibility-removal completion-audit artifact plus complete
  checkpoint evidence yields a complete artifact.
- Missing or incomplete compatibility-removal completion-audit evidence blocks
  completion.
- Missing roadmap, component, validation, or changelog evidence blocks
  completion through the nested checkpoint.
- Any side effect prevents complete artifact status.
- Generated checkpoint JSON can feed the final policy storage closure readout.
- The final consumer can verify a versioned wrapper fingerprint and exactly
  replay the artifact from its retained inputs.

Implementation status:

- Policy storage completion checkpoint artifact export is documented in
  [Policy Storage Completion Checkpoint Artifact Exporter](policy-storage-completion-checkpoint-artifact-exporter.md).
- The durable module naming cutover is documented in
  [Policy Storage Completion Checkpoint Module Cutover](policy-storage-completion-checkpoint-module-cutover.md).
- The completion-checkpoint artifact contract lives in
  `server/src/services/policyStorageCompletionCheckpointArtifact.mjs`.
- The exporter script lives in
  `scripts/generate-policy-storage-completion-checkpoint.mjs`.
- The root runner is exposed as
  `npm run policy:storage-completion-checkpoint`.
- The focused completion-checkpoint artifact test suite lives in
  `server/src/__tests__/services/policyStorageCompletionCheckpointArtifact.test.mjs`.
- Public command coverage lives in
  `server/src/__tests__/scripts/generatePolicyStorageCompletionCheckpoint.test.mjs`
  and is mapped in both the fixed closure requirement audit and current closure
  evidence inventory.
- Current implementation emits complete or blocked checkpoint artifacts with
  semantic `nextStep` evidence and without collecting evidence, running
  commands, mutating storage, or running Git.
- Version 4 checkpoint artifacts retain bounded source evidence and use a
  SHA-256 fingerprint plus deterministic replay verification at the final
  closure boundary. The contract and focused tests live in
  `policyStorageCompletionCheckpointArtifactFingerprint.mjs`,
  `policyStorageCompletionCheckpointArtifactIntegrity.mjs`, and
  `policyStorageCompletionCheckpointArtifactIntegrityBoundary.md`.

### 8R.33 Policy Storage Final Closure Readout

Intent: generate the final operator-facing policy storage closure decision from
the policy storage completion-checkpoint artifact.

Tasks:

- **8R.33.1 Public Final-Closure Readout Artifact-Chain Verification**
  - Completed: exercises the public final-readout generator against one
    fingerprint-valid, replayable checkpoint artifact.
  - Completed: proves altered checkpoint artifacts fail closed without output
    and valid blocked checkpoints write diagnostics only with explicit
    operator allowance.
- Require a policy storage completion-checkpoint artifact.
- Require a current, fingerprint-valid, replayable checkpoint artifact before
  its status can be used.
- Require the artifact to be complete and valid before closure can pass.
- Require the nested policy storage checkpoint to be complete and valid.
- Map blocked checkpoint states to component, roadmap, removal-audit,
  validation, or changelog blocker categories.
- Map invalid or missing wrapper artifacts to artifact-validation blockers.
- Reject file writes, manifest writes, storage mutation, command execution, and
  Git commands inside the readout contract.
- Emit a stable operator summary with the final decision and next action.

Acceptance criteria:

- The exporter refuses missing checkpoint-artifact JSON.
- A complete policy storage completion-checkpoint artifact yields a complete
  readout.
- Altered, historical, non-replayable, or replay-divergent checkpoint artifact
  evidence blocks with artifact-validation status.
- Missing or invalid policy storage checkpoint evidence blocks with artifact-validation
  status.
- Nested checkpoint failures preserve their blocker category.
- Any side effect prevents complete readout status.
- Generated readout JSON can be used by the policy storage current closure
  audit.

Implementation status:

- Policy storage final closure readout is documented in
  [Policy Storage Final Closure Readout](policy-storage-final-closure-readout.md).
- The durable module naming cutover is documented in
  [Policy Storage Final Closure Readout Module Cutover](policy-storage-final-closure-readout-module-cutover.md).
- The final closure readout contract lives in
  `server/src/services/policyStorageFinalClosureReadout.mjs`.
- The exporter script lives in
  `scripts/generate-policy-storage-final-closure-readout.mjs`.
- The root runner is exposed as
  `npm run policy:storage-final-closure-readout`.
- The focused final closure readout test suite lives in
  `server/src/__tests__/services/policyStorageFinalClosureReadout.test.mjs`.
- Public command coverage lives in
  `server/src/__tests__/scripts/generatePolicyStorageFinalClosureReadout.test.mjs`
  and is mapped in the fixed closure requirement audit and current closure
  evidence inventory.
- Current implementation emits complete or blocked final readouts without
  collecting evidence, running commands, mutating storage, or running Git; it
  emits semantic `nextStep` evidence for policy storage closure completion.
- The readout accepts only a version 4 checkpoint wrapper after fingerprint
  validation and deterministic replay. It uses the replayed artifact rather
  than the caller-supplied wrapper when it evaluates completion.

### 8R.34 Policy Storage Current Closure Audit

Intent: audit the current checkout against the storage closure chain by
combining current repository evidence, compatibility-removal completion-audit evidence,
validation evidence, the policy storage completion-checkpoint artifact, and the
policy storage final closure readout.

Tasks:

- Read current mapped closure artifact inventory from the checkout.
- Read current roadmap sequence and implementation-status evidence.
- Read current changelog coverage evidence.
- Require a complete and valid compatibility-removal completion-audit artifact.
- Require focused, lint, markdown, and full validation evidence.
- Compose the existing current evidence run.
- Compose the Phase 8R.32 checkpoint artifact from current evidence.
- Compose the policy storage final closure readout.
- Reject file writes, manifest writes, storage mutation, command execution, and
  Git commands inside the service.
- **8R.34.1 Public Current-Closure Audit Artifact-Chain Verification**
  - Run the public current-closure command against an isolated checkout with
    the complete mapped closure artifact range.
  - Prove emitted current audit, checkpoint, and final readout form one
    coherent artifact chain.
  - Prove altered validation evidence writes no output by default and missing
    checkout evidence emits diagnostics only through explicit blocked-output
    allowance.

Acceptance criteria:

- The exporter refuses missing completion-audit-artifact or validation-evidence
  JSON.
- Complete current repository evidence yields a complete audit.
- Missing mapped artifacts block current evidence.
- Missing validation or incomplete completion-audit evidence blocks closure.
- Any side effect other than repository file reads prevents complete status.
- Generated audit JSON can feed the final requirement-by-requirement Phase 8R
  completion audit.
- Public command coverage proves the current audit, checkpoint, and final
  readout outputs agree for a complete isolated checkout.

Implementation status:

- Policy storage current closure audit is documented in
  [Policy Storage Current Closure Audit](policy-storage-current-closure-audit.md).
- The durable module naming cutover is documented in
  [Policy Storage Current Closure Audit Module Cutover](policy-storage-current-closure-audit-module-cutover.md).
- The policy storage current closure audit contract lives in
  `server/src/services/policyStorageCurrentClosureAudit.mjs`.
- The exporter script lives in
  `scripts/run-policy-storage-current-closure-audit.mjs`.
- The root runner is exposed as
  `npm run policy:storage-current-closure-audit`.
- The focused policy storage current closure audit test suite lives in
  `server/src/__tests__/services/policyStorageCurrentClosureAudit.test.mjs`.
- Current closure audit v4 retains the normalized evidence needed to reproduce
  the closure decision, emits a SHA-256 fingerprint, and blocks the final
  requirement audit unless artifact verification and deterministic replay
  agree.
- Current closure output now preserves repository `implementationReadiness`
  separately from active-installation `instanceCutover`, with a dedicated
  cutover next step when source implementation is ready. The contract and
  outcome are documented in
  [Policy Storage Closure Scope Separation](policy-storage-closure-scope-separation.md).
- Current implementation reads mapped repository evidence and emits complete or
  blocked closure audits without writing files, mutating storage, running
  commands, or running Git.
- Task 8R.34.1 is implemented. Its isolated-checkout CLI test is mapped as
  closure evidence and part of the fixed validation command, verifying coherent
  outputs and fail-closed altered or missing evidence handling.

### 8R.35 Policy Storage Closure Requirement Audit

Intent: prove every mapped policy storage closure component requirement by
requirement before the closure sequence is treated as complete.

Tasks:

- Require a complete and valid policy storage current closure audit.
- Inventory mapped current checkout artifacts for every closure component in
  the current roadmap range.
- Require design/outcome document evidence for every component.
- Require service, script, route, migration, or wiring evidence for every
  component.
- Require focused test evidence for every component.
- Require roadmap component-map and work-sequence coverage for every component.
- Require changelog coverage for every component.
- Reject file writes, manifest writes, storage mutation, command execution, and
  Git commands inside the audit service.
- **8R.35.1 Public Closure Requirement-Audit Artifact-Chain Verification**
  - Generate a public current-closure artifact and consume it through the
    public requirement-audit command in an isolated mapped checkout.
  - Prove complete provenance produces a complete requirement audit.
  - Prove altered current-closure evidence writes no final audit by default and
    requirement-only missing evidence emits diagnostics only through explicit
    blocked-output allowance.

Acceptance criteria:

- Completion is blocked without complete policy storage current closure
  evidence.
- Completion is blocked when any mapped closure component artifact is missing.
- Completion is blocked when the roadmap component map or work sequence omits
  any mapped closure component.
- Completion is blocked when changelog coverage omits any mapped closure
  component.
- The audit emits exact missing evidence rather than relying on narrative
  completion status.
- The audit emits component-oriented evidence fields instead of phase-oriented
  public payload fields.
- The service reads repository files only and performs no writes, storage
  mutation, command execution, manifest writes, or Git operations.
- Public command coverage verifies a real current-closure to requirement-audit
  artifact chain in an isolated mapped checkout.

Implementation status:

- Policy storage closure requirement audit is documented in
  [Policy Storage Closure Requirement Audit](policy-storage-closure-requirement-audit.md).
- The durable module naming cutover is documented in
  [Policy Storage Closure Requirement Audit Module Cutover](policy-storage-closure-requirement-audit-module-cutover.md).
- The policy storage closure requirement audit contract lives in
  `server/src/services/policyStorageClosureRequirementAudit.mjs`.
- The exporter script lives in
  `scripts/run-policy-storage-closure-requirement-audit.mjs`.
- The root runner is exposed as
  `npm run policy:storage-closure-requirement-audit`.
- The focused policy storage closure requirement audit test suite lives in
  `server/src/__tests__/services/policyStorageClosureRequirementAudit.test.mjs`.
- Current implementation verifies the complete mapped closure component range
  so later artifact/exporter closure components cannot be skipped by the older
  policy storage checkpoint range.
- Final closure inventory sync is documented in
  [Policy Storage Closure Inventory Sync](policy-storage-closure-inventory-sync.md).
- Current validation hardening classifies
  `client/src/components/policies/PolicyStarterTemplateAccelerator.vue` in the
  Phase 1R boundary inventory and Phase 3R workflow inventory so the final
  Phase 8R evidence chain can prove every current policy-builder surface has an
  explicit owner and cutline.
- The current closure map also treats active-intent integrity correction,
  candidate authority eligibility, runtime authority selection integrity,
  transactional reversion, and rollback retention as independent evidence
  components. It also rejects predecessor compatibility-removal artifact
  wrappers so current closure cannot rely on stale evidence. The reconciliation
  and its design outcome are documented in
  [Policy Storage Completion Status Audit](policy-storage-completion-status-audit.md).
- Task 8R.35.1 is implemented. Its isolated-checkout public command test is
  part of fixed closure-validation evidence, proving the requirement audit
  consumes coherent current-closure provenance and fails closed for altered or
  incomplete evidence.

### 8R.36 Compatibility-Removal Evidence Regeneration

Intent: regenerate compatibility-removal evidence from the current checkout
without treating a historical plan or a partial removal batch as current
closure proof.

Tasks:

- **8R.36.1 Public Regeneration Artifact-Chain Verification**
  - Completed: runs the public regeneration command against an isolated
    checkout with a coherent fingerprint-valid execution-plan artifact,
    authorization, review, and
    validation artifacts.
  - Completed: proves remaining inventory remains observable, while predecessor
    plans, raw nested plans, altered wrappers, and live operational imports fail
    closed without output unless an operator explicitly requests a blocked
    diagnostic.
  - Completed: derives manifest path state from the current checkout, scans
    operational source references without treating control-plane inventories as
    runtime dependencies, and requires current focused and full validation
    evidence.
  - Completed: emits complete, remaining-inventory, or blocked completion-audit
    evidence without synthesizing deletion approval or performing a destructive
    action, then feeds the nested artifact to the current closure and
    requirement audits.
- **8R.36.2 Missing Evidence-Chain Diagnostics**
  - Completed: default collection still refuses to write an artifact when a
    current execution plan, next-batch authorization artifact, applied review
    fingerprint, or validation evidence is absent.
  - Completed: explicit `--allow-blocked` collection now emits a bounded,
    non-authoritative blocked record containing exactly the missing evidence
    categories. It skips execution-plan resolution, source scanning, and
    completion-audit construction,
    writes no nested completion-audit artifact, never manufactures approval,
    rejects unreadable supplied JSON, and cannot satisfy current-closure gates.
- **8R.36.3 Checkout-Bound Artifact Resolution**
  - Completed: relative evidence inputs and generated outputs resolve from the
    explicit `--cwd` checkout, while absolute paths remain explicit operator
    inputs.
  - Completed: isolated public-command coverage proves a shell launched from
    another directory cannot combine that caller's artifacts or outputs with
    the selected checkout's source, path-state, and reference-scan evidence.
- **8R.36.4 Provenance-Verified Local Evidence Builds**
  - Completed: smart Compose now derives `VCS_REF` only from a clean local
    checkout for build-producing commands. Dirty or unverifiable source is
    visibly labeled `unknown`, never mislabeled as the nearest commit.
  - Completed: `docker:smart:provenance-rebuild` rejects unverifiable source
    before Docker work, then performs a no-cache build, forced service
    recreation, and health wait so the maintenance runner can verify the
    running image automatically.
- **8R.36.5 Automatic Installation Evidence Diagnostics**
  - Completed: the provenance-bound maintenance runner can collect its
    current database-owned evidence with no prepared input JSON, producing a
    bounded fail-closed diagnostic under `.tmp`.
  - Completed: omitted input never manufactures coverage, support stance,
    residual-reference resolution, rollback support, support diagnostics, or
    manifest approval; reviewed input remains required for those release-level
    facts.
- **8R.36.6 Installation Diagnostic Readout**
  - Completed: maintenance output now separates ready native policy automation
    from blocked compatibility-code retirement prerequisites using only fixed
    blocker IDs and one next step.
  - A valid `blocked_by_rollback` or `blocked_by_deletion_gate` cutover summary
    is a compatibility-retirement blocker, not a native-automation failure;
    only invalid inventory, reconciliation, native-read, or fallback evidence
    can route an installation to runtime remediation.
  - Completed: helper output must retain a coherent risk count and ready state
    before the readout can consume it; a claimed ready result must validate,
    while structurally coherent blocked evidence remains observable. Raw
    evidence and backup details remain outside the public outcome.
- **8R.36.7 Release-Prerequisite Evidence Contracts**
  - Replace the reviewed-input `rollbackSupportVerified`,
    `supportDiagnosticsVerified`, and `deletionManifestApproved` booleans with
    small versioned evidence contracts bound to the current release-prerequisite
    context fingerprint and explicit subject. The later execution-plan artifact
    must retain that context through its existing fingerprint; pre-plan
    readiness cannot bind to an artifact that does not yet exist.
  - Each contract must fail closed on an absent, malformed, stale, mismatched,
    or unknown subject; it must expose only fixed status and reason IDs to the
    maintenance readout and cannot perform a restore, support operation,
    approval action, deletion, database write, source mutation, or Git
    operation.
  - Preserve the database-owned backup/restore verification as its own
    existing evidence boundary. Do not reintroduce it as a caller boolean or
    make routine native policy automation wait for compatibility-code removal
    release evidence.
- **8R.36.8 Execution-Plan Artifact Binding**
  - Require the current compatibility-deletion execution-plan artifact and bind
    its fingerprint directly through runtime evidence, authorization,
    completion evidence, and replay. A review fingerprint remains necessary
    but is not the sole downstream plan identity.
  - Reject absent, malformed, or cross-plan runtime evidence before another
    removal batch is authorized. Completion integrity must replay the same
    binding from the retained current artifact rather than trusting nested plan
    data or caller-supplied booleans.
- **8R.36.9 Public Artifact Exporter Cutover**
  - Require every public compatibility-removal exporter to emit the current
    runtime-evidence contract and carry its direct execution-plan fingerprint
    into its public artifact chain. A legacy runtime-evidence artifact must
    fail closed before a ready authorization, completion, or regeneration
    artifact can be written.
  - Keep blocked diagnostics bounded: expose fixed contract-version or binding
    reason IDs and one next step, never raw artifact payloads, local checkout
    paths, policy names, library names, secrets, or recovery controls.
  - Cover the cutover with isolated public-command tests for a current artifact,
    a pre-v2 runtime artifact, a missing digest, and an artifact bound to a
    different plan. The check must be deterministic and must not call a media
    server, provider, database, Docker daemon, or network service.
  - Keep the contract platform-agnostic and read-only: it cannot depend on a
    local checkout, policy name, library name, Docker state, database state,
    external provider, or media server.
- **8R.36.10 Instance Closure-Evidence Assembly**
  - Assemble the current-closure and requirement-audit artifacts from existing
    fingerprint-valid completion and validation evidence in one public,
    selected-checkout command.
  - Preserve evidence-production boundaries: assembly must not run validation
    commands, infer removal results, create missing approval evidence, write
    files inside its service, mutate storage, run Git, or call a provider,
    media server, Docker daemon, or network service.
  - Default blocked execution writes nothing. Explicit blocked output may
    write the same bounded assembly chain for diagnostic inspection, never a
    synthetic complete audit.
- **8R.36.11 Bounded Closure-Evidence Launcher**
  - Execute only the repository-owned validation-evidence producer and
    instance-evidence assembler with fixed Node paths, argument arrays, and
    `shell: false`. A caller cannot choose an executable or construct a shell
    command.
  - Require a current completion-audit artifact explicitly. The launcher may
    generate fresh validation evidence, but it must never infer, regenerate,
    or treat a local installation as authority for completion evidence.
  - Resolve all generated outputs under the selected checkout, use fixed
    command timeouts, report only compact stage progress and result IDs, and
    stop after the first failed or timed-out command. It must not call Docker,
    a database, a media server, a provider, Git, or the network.

Acceptance criteria:

- A predecessor execution-plan contract cannot produce a complete artifact.
- A source scan that has not completed blocks closure evidence.
- A path that still exists produces remaining-inventory evidence.
- In explicit diagnostic mode, absent approval-chain inputs produce stable
  blocked risk IDs and boolean presence state; default mode writes nothing.
- Control-plane inventory literals do not mask real imports or create false
  runtime-reference blockers.
- Regeneration performs no deletion, storage mutation, manifest write, command
  execution, or Git operation inside the service.

Implementation status:

- The design and research record is [Policy Compatibility-Removal Evidence
  Regeneration](policy-compatibility-removal-evidence-regeneration.md).
- The read-only service lives in
  `server/src/services/policyCompatibilityRemovalEvidenceRegeneration.mjs`.
- The root runner is `npm run policy:compatibility-removal-evidence`.
- The focused suite lives in
  `server/src/__tests__/services/policyCompatibilityRemovalEvidenceRegeneration.test.mjs`.
- The public artifact-chain suite lives in
  `server/src/__tests__/scripts/generatePolicyCompatibilityRemovalEvidence.test.mjs`.
- Current regeneration correctly exposes a broader unresolved deletion-readiness
  state when no current, approved execution plan is available. It must not be
  bypassed with a retired artifact.
- Task 8R.36.1 is implemented. The public command now exports only coherent
  current evidence from a ready fingerprint-valid execution-plan wrapper;
  blocked output requires explicit diagnostic allowance and cannot silently
  become current-closure authority.
- Task 8R.36.2 is implemented. Missing current evidence can now be observed
  safely before plan approval exists through a compact, non-authoritative
  diagnostic that cannot become nested closure input. Its public command does
  not resolve an execution plan or scan a checkout when required evidence is
  absent; malformed supplied inputs remain a hard command failure.
- Task 8R.36.3 is implemented. Relative evidence paths are now bound to the
  requested checkout, preventing cross-checkout artifact mixing during
  regeneration while preserving explicit absolute-path support.
- Task 8R.36.4 is implemented. The local smart Compose path now provides a
  clean-checkout, revision-labeled image without manual build arguments. Its
  strict maintenance command refuses dirty source before rebuilding, while the
  evidence runner retains its exact label-to-checkout verification boundary.
- Task 8R.36.5 is implemented. A revision-matched installation can now collect
  its automatic current-state diagnostic without a hand-authored input file;
  the diagnostic remains blocked until independently reviewed release evidence
  is present and cannot authorize code removal by omission. The design and
  outcome record is [Policy Compatibility Deletion Automatic Diagnostic
  Collection](policy-compatibility-deletion-automatic-diagnostic-collection.md).
- Task 8R.36.6 is implemented. Installation maintenance output now identifies
  whether native policy automation needs remediation or whether only
  compatibility-code retirement release prerequisites remain. It retains no
  raw evidence in the compact readout, and does not misclassify release-only
  rollback or deletion-gate blockers as policy runtime failures. The design and outcome record is [Policy
  Compatibility Deletion Installation Diagnostic
  Readout](policy-compatibility-deletion-installation-diagnostic-readout.md).
- Task 8R.36.7 is implemented. Release planning now accepts one compact,
  versioned attestation contract bound to a deterministic pre-plan context and
  constrained release-review subject. Missing, legacy, stale, malformed,
  mismatched, duplicate, or unrecognized-subject-type evidence blocks
  readiness; the CLI rejects legacy fields instead of silently ignoring them.
  Backup/restore remains database-owned, and native policy runtime automation
  remains independent. The design and outcome record is [Policy Compatibility
  Deletion Release-Prerequisite Evidence
  Contracts](policy-compatibility-deletion-release-prerequisite-evidence-contracts.md).
- Task 8R.36.8 is implemented. Runtime evidence now retains the SHA-256 digest
  of the applied execution-plan artifact, next-batch authorization compares it
  to its verified current plan source, and authorization-artifact integrity
  repeats that comparison during completion replay. The design and outcome
  record is [Compatibility-Deletion Execution-Plan Artifact
  Binding](policy-compatibility-deletion-execution-plan-artifact-binding.md).
- Task 8R.36.9 is implemented. Every public compatibility-removal exporter
  now checks the current v2 runtime-evidence contract and direct execution-plan
  binding before it writes a downstream artifact. Legacy, missing, malformed,
  and cross-plan evidence fails closed; an explicit blocked request receives
  only a fixed-ID, non-authoritative diagnostic and one regeneration step. The
  design and outcome record is [Compatibility-Removal Public Artifact Exporter
  Cutover](policy-compatibility-removal-public-artifact-exporter-cutover.md).
- Task 8R.36.10 is implemented. A platform-agnostic public assembler now
  derives current-closure and requirement-audit artifacts together from the
  same fingerprint-valid completion and validation evidence. It remains
  read-only and fails closed when the assembled closure chain is incomplete.
  The design and outcome record is [Policy Storage Instance Closure-Evidence
  Assembly](policy-storage-instance-closure-evidence-assembly.md).
- Task 8R.36.11 is revalidated after 8R.37.4. The bounded launcher runs only
  the fixed validation-evidence producer and instance assembler using direct
  Node processes with argument arrays and bounded timeouts. Its v3 validation
  catalog now directly covers the closure-map scope service and reconciliation
  design record. Completion-audit provenance remains explicit, generated files
  must remain inside the selected checkout, and a failed command stops the
  chain without relaying raw process output. The design and outcome record is
  [Policy Storage Closure Evidence Launcher](policy-storage-closure-evidence-launcher.md).

### 8R.37 Runtime And Release-Maintenance Boundary

Intent: keep automatic native policy migration and runtime authority inside the
platform while moving repository source retirement to a constrained
CI/release-maintenance concern.

Tasks:

- **8R.37.1 Runtime Capability Inventory And Isolation Decision**
  - Inventory every route, scheduler, bootstrap import, client API,
    environment entry point, and production service that reaches controlled
    compatibility removal.
  - Classify every result as native runtime lifecycle, read-only instance
    evidence, CI/release maintenance, or remove/decommission.
  - Prove no normal policy route, browser action, client API leaf, or scheduler
    can issue a source-removal authorization or invoke a source writer.
  - Complete: `policy:runtime-release-maintenance-audit` now inventories the
    source-mutating modules, fails closed on normal runtime reachability or a
    missing release-maintenance owner, and records the named-scope writer and
    production-admission composer for decommission. See [Policy Native Storage
    Runtime And Release-Maintenance Boundary](policy-native-storage-runtime-release-boundary.md).
- **8R.37.2 Runtime Reachability Removal**
  - Complete: removed the closed 19-module named-scope compatibility
    source-mutation subsystem and its dedicated tests and fixture without
    changing automatic native-intent conversion or policy automation.
  - The versioned audit fails closed if any retired module reappears and still
    reports source-writer runtime reachability independently.
- **8R.37.3 CI-Only Retirement Command Contract**
  - Complete: no approved target justified a generic executor, so the mutable
    CLI, filesystem adapter, npm command, and dedicated mutable-boundary tests
    were removed instead of receiving CI write credentials.
  - The audit now fails closed if a retired mutator, entry command, npm script,
    or workflow contents-write permission is reintroduced. See [Policy CI-Only
    Retirement Command Contract](policy-ci-only-retirement-command-contract.md).
- **8R.37.4 Closure-Map Reconciliation**
  - Complete: introduced an exact, fingerprint-bound component scope map.
    Repository implementation evidence excludes the nine active-installation
    compatibility workflow components; final closure remains strict and the
    output retains `implementationReadiness` and `instanceCutover` in every
    checkpoint, artifact, readout, and current audit. See [Policy Closure-Map
    Reconciliation](policy-closure-map-reconciliation.md).

Acceptance criteria:

- The running policy platform has no source-mutation capability.
- Policy conversion remains automatic, server-owned, transactional, and
  platform-agnostic for each installation.
- Compatibility source retirement is a reviewed release operation, never a
  normal policy configuration or maintenance feature.
- Phase 4R is not blocked by repository source retirement.

Implementation status: 8R.37.1 through 8R.37.4 complete, and 8R.36.11 has
regenerated v3 validation evidence. The active-installation completion artifact
must be refreshed before the generated current closure and requirement audits
can become complete. See [Policy Native Storage Runtime And Release-Maintenance
Boundary](policy-native-storage-runtime-release-boundary.md).

## Phase 8R Work Sequence

Implement Phase 8R in this order:

1. **8R.1 Native Schema Contract**
   Defines durable storage around the final model.
   - **Active Native Intent Integrity Correction** repairs and enforces the
     one-active-intent database invariant before authority can be trusted.
   - **Semantic Native Authority Eligibility And Empty-Intent Recovery**
     requires that a sole active header is a complete native intent with a
     purpose rule before it can replace compatibility behavior; exact empty
     placeholders are deactivated and all other invalid active forms block
     safely.
2. **8R.2 Migration Candidate Report**
   Makes readiness visible before mutation.
   - **Candidate Authority Eligibility** blocks conversion readiness when the
     active native authority is ambiguous.
3. **8R.3 Explicit Conversion Workflow**
   Converts selected policies with validation and rollback snapshots.
   - **Initial Native Intent Establishment** automatically initializes a
     destination with no legacy configuration from a current connected
     library profile. It derives only bounded advisory identity and helpful
     evidence, never hard limits, avoid rules, learning state, AI output, or
     external-provider input; stale or missing profiles are regenerated and
     retried safely.
   - **Observed Evidence Establishment Provenance** retains one bounded,
     non-authoritative stored-profile snapshot for an initial establishment,
     redacts its payload after the recovery window, and preserves only a
     minimal audit marker thereafter.
4. **8R.4 Native Runtime Read Path**
   Makes converted policies run from native intent.
   - **Runtime Authority Selection Integrity** makes duplicate active native
     authority fail closed instead of selecting a row or falling back.
5. **8R.5 Rollback Snapshot And Reversion Window**
   Provides bounded safety without permanent dual models.
   - **Transactional Native Authority Reversion** restores only authorized,
     valid, unexpired direct rollback state in one transaction.
   - **Rollback Snapshot Retention Cleanup** redacts expired payloads while
     retaining minimal audit data, a digest, and restore lifecycle metadata.
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
    consuming a ready compatibility deletion execution gate output, selected
    approved manifest paths, and review metadata.
18. **8R.18 Controlled Compatibility Path Removal Apply**
    Applies one reviewed controlled removal batch through an explicit adapter,
    verifies result parity, and emits evidence plus a semantic next-step handoff
    for import/runtime validation before additional compatibility paths are
    removed.
19. **8R.19 Post-Removal Runtime Verification**
    Consumes controlled removal apply evidence, verifies removed paths are no longer
    imported or required, runs focused runtime/import checks, and blocks
    additional batches until validation passes.
20. **8R.20 Next Compatibility Removal Batch Authorization**
    Consumes verified post-removal runtime evidence, calculates remaining
    approved manifest paths, prevents already-removed paths from re-entering a batch, and
    authorizes only the next narrow removal batch.
21. **8R.21 Compatibility Removal Completion Audit**
    Consumes verified removal loop evidence, proves whether all approved
    compatibility manifest paths are gone, and reports any bounded remaining
    inventory before Phase 8R exits compatibility-removal mode.
22. **8R.22 Policy Storage Completion Checkpoint**
    Audits the complete Phase 8R roadmap, service contracts, tests, docs,
    changelog coverage, and validation evidence before Phase 8R is considered
    fully implemented.
23. **8R.23 Policy Storage Closure Evidence Run**
    Runs the policy storage checkpoint against current-state evidence and resolves
    any missing component, roadmap, validation, or changelog proof before the
    Phase 8R objective is marked complete.
24. **8R.24 Policy Storage Closure Validation Evidence**
    Generates machine-readable focused, lint, markdown, and full validation
    evidence for the storage closure evidence run without changing checkpoint
    semantics.
25. **8R.25 Policy Storage Closure Final Removal Audit**
    Generates machine-readable final-removal-audit evidence from an explicit
    execution-plan manifest, current path state, source reference scan, and
    validation JSON.
26. **8R.26 Policy Compatibility Deletion Execution Plan Artifact**
    Generates the fingerprint-valid compatibility deletion execution-plan
    wrapper artifact from explicit readiness, manifest, replacement, approval,
    rollback, and support evidence for downstream final-removal-audit tooling.
27. **8R.27 Policy Controlled Compatibility Removal Batch Artifact**
    Generates a machine-readable controlled compatibility removal batch from a
    ready fingerprint-valid execution-plan artifact, explicit execution-gate
    evidence, selected approved manifest paths, review reason, and reviewer
    metadata.
28. **8R.28 Controlled Removal Apply Artifact Exporter**
    Generates a machine-readable controlled-removal apply artifact from a
    ready reviewed batch, explicit execute confirmation, and a bounded
    repo-relative filesystem adapter, then hands off to post-removal runtime
    verification through semantic `nextStep` evidence.
29. **8R.29 Post-Removal Runtime Verification Artifact Exporter**
    Generates a machine-readable post-removal verification artifact from
    controlled-removal apply, reference-scan, runtime-check, and validation
    evidence before the next compatibility-removal batch can be authorized.
30. **8R.30 Next Compatibility Removal Batch Authorization Artifact Exporter**
    Generates a machine-readable next-batch authorization artifact from
    verified post-removal evidence, the approved execution manifest, requested
    remaining paths, and operator authorization metadata.
31. **8R.31 Compatibility Removal Completion Audit Artifact Exporter**
    Generates a machine-readable compatibility-removal completion-audit
    artifact from next-batch authorization, the approved execution manifest,
    removal verification, final scan, and validation evidence.
32. **8R.32 Completion Checkpoint Artifact Exporter**
    Generates a machine-readable completion-checkpoint artifact from explicit
    component, roadmap, completion-audit, validation, and changelog evidence.
33. **8R.33 Policy Storage Final Closure Readout**
    Generates the final operator-facing policy storage closure decision from
    the storage completion-checkpoint artifact, preserving exact blocker
    categories.
34. **8R.34 Policy Storage Current Closure Audit**
    Audits the current checkout by composing current artifact, roadmap,
    changelog, completion-audit, validation, checkpoint, and final-readout
    evidence into one completion decision.
35. **8R.35 Policy Storage Closure Requirement Audit**
    Verifies the mapped closure component sequence against current closure,
    artifact, roadmap, changelog, and focused-test evidence before the closure
    objective is marked complete.
36. **8R.36 Compatibility-Removal Evidence Regeneration**
    Rebuilds compatibility-removal evidence from a current approved execution
    plan, current repository state, operational reference scan, and fresh
    validation. It reports the actual readiness state and never converts a
    historical partial manifest into closure proof.
37. **8R.37 Runtime And Release-Maintenance Boundary**
    Separates automatic native policy behavior from repository-retirement
    maintenance. **8R.37.1 Runtime Capability Inventory And Isolation
    Decision**, **8R.37.2 Runtime Reachability Removal**, **8R.37.3
    CI-Only Retirement Command Contract**, and **8R.37.4 Closure-Map
    Reconciliation** are complete. Do not build the former production
    review-context registry.

Completion state:

- All mapped Phase 8R component contracts have implementation, design,
  focused-test, roadmap, and Unreleased release-outcome evidence. Storage
  **implementation readiness** is therefore repository-scoped and independent
  of any operator's database. Final storage closure remains separately blocked
  until an individual installation's compatibility-removal evidence is
  regenerated from a current approved execution plan and that installation's
  deletion readiness gates pass.
- Closure output must keep these scopes explicit as `implementationReadiness`
  and `instanceCutover`. The first never reads an installation database; the
  second never acts as a claim that source implementation work is incomplete.
- The current closure audit v6 and final readout v2 now publish both scope
  summaries and an exact component scope map at their top-level decision
  boundary. Their fingerprints bind map membership, scope states, readiness
  booleans, and selected-checkout content evidence before a downstream
  requirement audit can rely on them.
- The closure catalog independently requires semantic native-authority
  eligibility and empty-intent recovery. A structural active-header repair
  alone cannot satisfy closure evidence because it does not prove that the
  header is complete enough to own runtime behavior.
- The storage closure validation generator is shell-free on direct Node and
  Windows invocations; its current evidence includes focused, lint, Markdown,
  unit, and integration validation.
- The current closure audit and requirement audit are the authoritative
  completion gates. They must be regenerated after any Phase 8R artifact or
  roadmap change rather than inferred from this roadmap narrative.
- New policy work follows Phase 9R durable naming rules. Do not recreate a
  compatibility path, a dual policy model, or phase-derived production contract.

## Phase 9R: Durable Product Naming Cutover

Status: ongoing enforcement. The current production naming and delivery-term
gates report zero prohibited production references; every remaining component
must preserve that zero-debt baseline.

Intent: remove temporary delivery language from production code as each rebuilt
component reaches its tested contract. Roadmap phase labels are useful in
planning and historical evidence, but must not become permanent product
architecture, current diagnostics, telemetry, or contract vocabulary.

### Activation Rule

Phase 9R is a mandatory cross-cutting workstream and an immediate prerequisite,
not end-of-project cleanup. It starts now and runs alongside evidence, intent,
runtime, storage, and legacy-removal work:

1. A new production component must use a durable product-domain name from its
   first commit.
2. After a functional component reaches its focused test contract, complete
   its mechanically scoped phase-name cutover before starting the next
   functional component in that domain.
3. A cutover may retain a compatibility alias only for a persisted/public
   contract migration with a documented deletion gate. Runtime aliases that
   merely preserve roadmap terminology are not allowed.
4. Temporary delivery labels remain allowed only in roadmap documents,
   changelog history, immutable migration evidence, and tests that prove a
   bounded old-to-new transition.
5. New source, capability, or handoff contracts must use durable
   product-domain names from their first commit. A roadmap label, `phase` word,
   or phase-derived alias is not an acceptable production contract identifier.

No policy-engine component is complete while its production source, exports,
current diagnostics, telemetry, or internal contract names still describe a
temporary roadmap phase. A persisted or public compatibility field is the only
exception, and it must have a migration owner, durable replacement, and explicit
deletion gate.

This sequencing keeps the refactor complete without mixing behavioral changes
and large rename batches in the same implementation task.

This phase exists because production services, errors, schema flags, trace
labels, and helper names that refer to `Phase6R`, `Phase7R`, `Phase8R`, or any
other delivery label will be misleading once the work is complete. Future work
will have different planning labels, and product code should describe durable
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

Design record:

- [Policy Builder Production Naming Cutover](policy-builder-production-naming-cutover.md)

Non-goals:

- Do not mix a behavioral component change with a broad rename batch. Complete
  the component's focused contract first, then make the related mechanical
  naming cutover before the next component begins.
- Do not leave adapters permanently. Compatibility exports are allowed only for
  a release boundary or persisted payload migration and require a deletion gate.
- Do not remove phase labels from docs, changelog history, migration evidence,
  or tests that intentionally prove old-to-new compatibility.

Required outcome:

```text
roadmap phases remain in roadmap/history
production code uses durable product-domain names
telemetry and payloads use durable product-domain names
tests enforce the boundary
```

### 9R.0 Immediate Durable Naming Gate And Naming Design

Intent: define the durable product vocabulary before any code moves.

Tasks:

- Publish the naming design record with official guidance, rename principles,
  pros/cons, and final recommendation stack.
- Define durable names for these production domains:
  - policy evidence boundary,
  - intent inference,
  - learning eligibility,
  - automation readiness,
  - operator workflow,
  - runtime evidence projection,
  - automation decision,
  - request learning,
  - library rebuild,
  - migration verification,
  - native policy storage.
- Define the allow-list categories for phase-coded references that may remain:
  docs, changelog history, migration evidence, legacy compatibility tests, and
  bounded temporary adapters.
- Require the production-name inventory and a focused rename decision before a
  functional policy-engine component can advance to its next task.
- Prefer isolated, non-persisted modules for early deconstruction batches;
  defer persisted/public naming changes to their dedicated compatibility task.
- Classify every current production reference into one of four bounded groups:
  - **pure delivery terminology**: remove or rename immediately after its
    focused component test passes;
  - **runtime lifecycle wording**: rename to a domain term such as `stage` only
    when it describes a durable execution lifecycle;
  - **persisted/public compatibility**: introduce a durable replacement,
    support an explicit reader window, then remove the legacy field under a
    migration gate;
  - **historical verification material**: keep only outside the production
    module tree, with no normal runtime import.
- Move roadmap-term scanning and historical-reference parsing out of production
  services into maintenance tooling before the final naming gate. The scanner
  may retain the historic search vocabulary because it is not product runtime
  code.

Acceptance criteria:

- The design record exists before production files are renamed.
- Durable names are product-domain names, not roadmap task names.
- Every later rename can point to the design record and map.
- A completed policy-engine component cannot start its successor while its own
  production names still carry roadmap language without a documented migration
  exception.
- A semantic execution `stage` is not a roadmap phase. Where existing code uses
  `phase` for durable progress or retrieval lifecycle state, rename it to
  `stage` in a dedicated compatibility cutover rather than treating it as an
  allowed exception.

Implementation status:

- The product-domain naming design is recorded in
  [Policy Builder Production Naming Cutover](policy-builder-production-naming-cutover.md).
- Historic-token scanning and repository traversal run only from maintenance
  tooling at `scripts/lib/policyProductionNamingInventory.mjs` and
  `scripts/lib/policyProductionNamingRepositoryScan.mjs`; normal application
  imports do not load the scanner.
- `npm run policy:production-naming-gate` combines the current repository
  inventory with the zero-debt regression baseline and fails on unclassified,
  newly phase-coded, or obsolete production naming references.
- `npm run test:ci` runs the naming gate before type checks and test suites, so
  a functional component cannot advance while it introduces unbounded
  delivery-language debt.
- The current gate reports zero production references, zero rename candidates,
  and zero obsolete migration-tooling references. The generated inventory is
  the authoritative current count; historical totals in this roadmap are not.
- The gate scans both artifact paths and contents, recognizes mixed-case
  `phase` and bounded numeric roadmap markers, and excludes unrelated model
  and certification identifiers. A zero-debt audit advances to the next
  product-domain component rather than requesting an unnecessary rename batch.

### 9R.1 Production Naming Inventory And Ownership Map

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
  - **Temporary adapter with deletion gate**,
  - **Delete with obsolete migration tooling**.
- Build a rename map from phase-coded names to durable product names.
- Separate inventory into production, test, docs, scripts, migrations, package
  commands, telemetry, payload fields, and generated artifacts.
- Run the inventory and regression audit after every completed functional
  component; reject new production references instead of waiting for the final
  cleanup batch.

Acceptance criteria:

- Every phase-coded production reference has a keep/rename/delete decision.
- Docs may retain phase names; runtime product code cannot without an explicit
  exemption.
- The rename map is checked in before code moves.
- The inventory does not increase after a completed component is committed.

Implementation status:

- Phase 9R.1 production name inventory is documented in
  [Policy Builder Production Name Inventory](policy-builder-production-name-inventory.md).
- Historic-token inventory lives in maintenance tooling at
  `scripts/lib/policyProductionNamingInventory.mjs`, not the application
  service tree.
- Repository scans are generated by
  `scripts/generate-policy-builder-production-name-inventory.mjs`.
- The focused inventory test suite lives in
  `server/src/__tests__/services/policyProductionNamingInventory.test.mjs`.
- Current implementation scans production code, tests, scripts/package
  commands, migrations, and docs/history; classifies each phase-coded reference
  as rename, keep, delete, or adapter-gated; and validates that production
  rename candidates carry durable product-domain targets.
- The repository scan adapter validates with no unclassified references and
  currently reports 0 production references and 0 rename candidates after
  storage-closure reference scanner hardening. The storage-closure scanner now
  excludes only tests and named control-plane evidence, while it scans all
  other service paths for manifest references.
  The inventory contract now emits the durable
  `nextStep.stepId = durable_domain_module_cutover` rather than a roadmap
  phase-shaped next action.
- The July 11, 2026 zero-debt ratchet remains the regression baseline. A July
  25, 2026 rerun reports zero production references, zero rename candidates,
  and zero obsolete tooling; earlier counts document individual cutovers, while
  the current generated inventory and regression audit define present debt.
- No temporary production names or rename candidates remain. Historical docs,
  tests, migration evidence, and maintenance scanners retain classified
  references; each future production change must preserve the zero-debt
  baseline rather than using a repository-wide search-and-replace.
- The first tooling-extraction cutover moved historic-token matching out of
  `server/src`, leaving the server regression audit to consume generated
  inventory only. Its design record is
  [Policy Production Naming Tooling Extraction](policy-production-naming-tooling-extraction.md).
- The runtime observability vocabulary cutover removed delivery labels from the
  current metrics operator summary and trace validation diagnostics while
  preserving the stable metrics contract and bounded output. Its design record
  is [Policy Runtime Observability Vocabulary Cutover](policy-runtime-observability-vocabulary-cutover.md).
- The AI parse diagnostics contract cutover replaced the current delivery-era
  diagnostic version with `classification.ai_parse_diagnostics.v1`. Existing
  history remains untouched because no runtime path reads or branches on the
  version field. Its design record is
  [Classification AI Parse Diagnostics Contract Cutover](classification-ai-parse-diagnostics-contract-cutover.md).

### 9R.2 Durable Domain Module Cutover

Intent: move server/client production modules to durable domain names.

Current deconstruction task:

- The policy-authoring readiness checklist is the first completed isolated
  deconstruction batch. It had no persisted/public contract or runtime caller,
  so it received durable module, export, component-record, test, and
  documentation names with no compatibility alias:
  [Policy Authoring Readiness Checklist Naming Cutover](policy-authoring-readiness-checklist-naming-cutover.md).

Tasks:

- Rename evidence, intent, readiness, learning, and workflow modules to
  product-domain module names.
- Rename runtime evidence, automation, question, request-learning, rebuild,
  migration-verifier, and metrics modules to runtime-domain names.
- Rename native storage, rollback, conversion, and legacy-removal modules to
  storage/migration domain names after native storage is stable.
- Keep temporary adapter exports only when needed for one release window, and
  record their deletion gate.
- Use mechanical file moves plus focused import rewrites; behavior changes are
  out of scope for this task.
- Complete one cohesive domain batch at a time immediately after its functional
  component is stable; do not defer the batch to a final project-wide rename.
- Treat the production naming inventory and regression audit as maintenance
  tooling, not an application service. Its historic-token matching belongs in
  scripts or test-only support once its callers are migrated.

Acceptance criteria:

- Runtime imports use durable product module names.
- Temporary compatibility exports have explicit removal dates/gates.
- No new production code imports phase-coded modules.
- No completed component leaves phase-coded source, export, audit, trace, or
  current diagnostic names behind unless its explicit migration gate requires
  one.

Implementation status:

- The policy-authoring readiness checklist now uses durable module, export,
  component-record, test, and architecture-record names; the inventory fell to
  184 production references and 185 rename candidates without a compatibility
  alias:
  [Policy Authoring Readiness Checklist Naming Cutover](policy-authoring-readiness-checklist-naming-cutover.md).
- The first narrow module cutover is complete for classification progress
  tracking. `classificationPhaseService`, `classificationPhaseUtils`, and
  `classificationPhaseProgress` were renamed to
  `classificationProgressStageService`,
  `classificationProgressStageUtils`, and
  `classificationProgressStageQueries`.
- Internal progress definitions use `STAGES` and `STAGE_METADATA` without
  phase-shaped compatibility aliases.
- The completed stage-storage cutover renamed persisted task queue progress,
  JSON history entries, API response fields, WebSocket payloads, and Command
  Center readers to durable stage terminology without retaining aliases.
- The RAG lifecycle helper now uses `classificationRagLoopStages` and
  stage-named exports for enrichment, second-pass retrieval, policy recheck,
  and AI rerun. It is an internal ESM boundary, so the cutover retained no
  temporary export aliases and preserved all execution, retry, and telemetry
  behavior. Its design record is
  [Classification RAG Loop Stage Naming Cutover](classification-rag-loop-stage-naming-cutover.md).
- The internal file-operation progress contract now uses `stage` in move
  failure objects and progress callbacks. Its callers remain server-internal,
  so no temporary response alias is retained. Its design record is
  [File Operation Stage Contract Cutover](file-operation-stage-contract-cutover.md).
- The classification-progress resume diagnostic now reports `resume stage`,
  matching the persisted field and returned value without changing resume
  behavior. Its design record is
  [Classification Resume Stage Diagnostic Cutover](classification-resume-stage-diagnostic-cutover.md).
- The policy-engine related-evidence scoring diagnostic now identifies the
  evidence operation without a delivery label, preserving its score and bounded
  debug context. Its design record is
  [Policy Engine Evidence Diagnostic Cutover](policy-engine-evidence-diagnostic-cutover.md).
- The native-intent storage vocabulary now describes explicit policy conversion
  instead of the delivery phase that introduced it, retaining validation,
  backup, and rollback prerequisites. Its design record is
  [Native Intent Conversion Vocabulary Cutover](native-intent-conversion-vocabulary-cutover.md).
- The policy-operator workflow audit now requires approved policy-authoring
  terms without referring to the design phase that introduced the vocabulary.
  Its design record is
  [Policy Operator Workflow Vocabulary Cutover](policy-operator-workflow-vocabulary-cutover.md).
- Storage-closure evidence and completion-checkpoint inputs now require
  durable component field names; undocumented phase-key fallback readers are
  rejected. Its design record is
  [Policy Storage Closure Input Contract Cutover](policy-storage-closure-input-contract-cutover.md).
- Storage-closure artifact maps, checkpoint expectations, current-state
  collection, requirement-audit coverage, and validation documentation now use
  durable component identifiers. Roadmap labels are collected generically and
  historic delivery values cannot satisfy current evidence. Its design record
  is [Policy Storage Closure Component Catalog Cutover](policy-storage-closure-component-catalog-cutover.md).
- WebSocket classification progress now rejects payloads without a durable
  stage, after an audit confirmed its sole producer emits stage events. Its
  design record is
  [WebSocket Progress Stage Contract Cutover](websocket-progress-stage-contract-cutover.md).
- Policy-authoring workflow completion evidence now describes durable product
  behavior rather than the delivery naming rule it enforces. Its design record
  is [Policy Authoring Workflow Behavior Cutover](policy-authoring-workflow-behavior-cutover.md).
- Policy-builder advanced-scoring extraction guidance now refers directly to
  the engine cutline rather than a future delivery phase. Its design record is
  [Policy Builder Engine-Cutline Vocabulary Cutover](policy-builder-engine-cutline-vocabulary-cutover.md).
- Evidence administration composables and view comments now describe their
  durable operator role rather than the delivery layer that introduced them.
  Its design record is
  [Evidence Administration Vocabulary Cutover](evidence-administration-vocabulary-cutover.md).
- Classification evidence migration scripts now describe their durable
  backfill role rather than the delivery phase that introduced them. Its design
  record is
  [Classification Evidence Migration Vocabulary Cutover](classification-evidence-migration-vocabulary-cutover.md).
- Outcome record:
  [Classification Progress Stage Naming Cutover](classification-progress-stage-naming-cutover.md).
- After the completed classification progress storage cutover, the repository
  inventory validates with 15,892 total phase-coded references, 7,467
  production references, and 7,489 rename candidates.
- The policy evidence quality helper has now been cut over to durable
  product-domain naming:
  [Policy Evidence Quality Module Cutover](policy-evidence-quality-module-cutover.md).
  `policyBuilderPhase6EvidenceQuality.mjs` was renamed to
  `policyEvidenceQuality.mjs`, its focused test was renamed, and the internal
  contract version moved to `policy.evidence.quality.v1`.
- After the evidence-quality cutover, the repository inventory validates with
  16,187 total phase-coded references, 7,514 production references, and 7,536
  rename candidates.
- The next durable module cutover renamed the evidence projection fingerprint
  helper to `policyEvidenceFingerprint.mjs`, renamed its focused test, and moved
  the fingerprint artifact contract to `policy.evidence.fingerprint.v1`:
  [Policy Evidence Fingerprint Module Cutover](policy-evidence-fingerprint-module-cutover.md).
- After the evidence-fingerprint cutover, the repository inventory validates
  with 16,129 total phase-coded references, 7,470 production references, and
  7,492 rename candidates.
- The follow-up durable module cutover renamed the bounded evidence boundary to
  `policyEvidenceBoundary.mjs`, renamed its focused test, moved the boundary
  contract to `policy.evidence.boundary.v1`, and replaced the boundary-local
  phase handoff with a product-domain `nextStep`:
  [Policy Evidence Boundary Module Cutover](policy-evidence-boundary-module-cutover.md).
- After the evidence-boundary cutover, the repository inventory validates with
  16,069 total phase-coded references, 7,446 production references, and 7,468
  rename candidates.
- The next durable module cutover renamed the evidence input gate to
  `policyEvidenceInputGate.mjs`, renamed its focused test, moved the input-gate
  contract to `policy.evidence.input_gate.v1`, and replaced its local
  phase-coded audit handoff with `nextStep`:
  [Policy Evidence Input Gate Module Cutover](policy-evidence-input-gate-module-cutover.md).
- After the evidence-input-gate cutover, the repository inventory validates with
  15,974 total phase-coded references, 7,390 production references, and 7,412
  rename candidates.
- The next durable module cutover renamed the evidence projection engine to
  `policyEvidenceEngine.mjs`, renamed its focused test, moved the projection and
  summary contracts to `policy.evidence.v1` and
  `policy.evidence.summary.v1`, and replaced the engine-local phase handoff
  with `nextStep`:
  [Policy Evidence Engine Module Cutover](policy-evidence-engine-module-cutover.md).
- After the evidence-engine cutover, the repository inventory validates with
  15,429 total phase-coded references, 7,024 production references, and 7,046
  rename candidates.
- The next durable module cutover renamed the intent inference engine to
  `policyIntentEngine.mjs`, renamed its focused test, moved the draft contract
  to `policy.intent.v1`, and replaced the engine-local phase handoff with
  `nextStep`:
  [Policy Intent Engine Module Cutover](policy-intent-engine-module-cutover.md).
- After the intent-engine cutover, the repository inventory validates with
  15,155 total phase-coded references, 6,857 production references, and 6,879
  rename candidates.
- The next durable module cutover renamed the learning guard to
  `policyLearningGuard.mjs`, renamed its focused test, moved the guard contract
  to `policy.learning_guard.v1`, and replaced the guard-local phase handoff
  with `nextStep`:
  [Policy Learning Guard Module Cutover](policy-learning-guard-module-cutover.md).
- After the learning-guard cutover, the repository inventory validates with
  14,856 total phase-coded references, 6,700 production references, and 6,722
  rename candidates.
- The next durable module cutover renamed the automation readiness engine to
  `policyAutomationReadinessEngine.mjs`, renamed its focused test, moved the
  readiness contract to `policy.automation_readiness.v1`, and replaced the
  readiness-local phase handoff with `nextStep`:
  [Policy Automation Readiness Engine Module Cutover](policy-automation-readiness-engine-module-cutover.md).
- After the automation-readiness cutover, the repository inventory validates
  with 14,634 total phase-coded references, 6,584 production references, and
  6,606 rename candidates.
- The next durable module cutover renamed the operator workflow to
  `policyOperatorWorkflow.mjs`, renamed its focused test, moved the workflow
  contract to `policy.operator_workflow.v1`, and replaced the workflow-local
  phase handoff with `nextStep`:
  [Policy Operator Workflow Module Cutover](policy-operator-workflow-module-cutover.md).
- After the operator-workflow cutover, the repository inventory validates with
  14,446 total phase-coded references, 6,480 production references, and 6,502
  rename candidates.
- The next runtime module cutover renamed the runtime evidence projection and
  runtime evidence fingerprint helpers to durable product-domain names, moved
  their contracts to `policy.runtime_evidence_projection.v1` and
  `policy.runtime_evidence_fingerprint.v1`, and replaced projection-local phase
  handoffs with `nextStep`:
  [Policy Runtime Evidence Projection Module Cutover](policy-runtime-evidence-projection-module-cutover.md).
- After the runtime-evidence-projection cutover, the repository inventory
  validates with 13,709 total phase-coded references, 5,875 production
  references, and 5,897 rename candidates.
- The next runtime module cutover renamed the automation decision contract to
  `policyAutomationDecisionContract.mjs`, renamed its focused test, moved the
  decision contract to `policy.automation_decision.v1`, and replaced the
  contract-local phase handoff with `nextStep`:
  [Policy Automation Decision Contract Module Cutover](policy-automation-decision-contract-module-cutover.md).
- After the automation-decision-contract cutover, the repository inventory
  validates with 13,331 total phase-coded references, 5,735 production
  references, and 5,757 rename candidates.
- The next runtime module cutover renamed runtime question reduction to
  `policyRuntimeQuestionReduction.mjs`, renamed its focused test, moved the
  question contract to `policy.runtime_question_reduction.v1`, and replaced the
  contract-local phase handoff with `nextStep`:
  [Policy Runtime Question Reduction Module Cutover](policy-runtime-question-reduction-module-cutover.md).
- After the runtime-question-reduction cutover, the repository inventory
  validates with 13,161 total phase-coded references, 5,653 production
  references, and 5,675 rename candidates.
- The next runtime module cutover renamed request-time learning to
  `policyRequestTimeLearning.mjs`, renamed its focused test, moved the
  request-time contract to `policy.request_time_learning.v1`, and replaced the
  contract-local phase handoff with `nextStep`:
  [Policy Request-Time Learning Module Cutover](policy-request-time-learning-module-cutover.md).
- After the request-time-learning cutover, the repository inventory validates
  with 12,971 total phase-coded references, 5,548 production references, and
  5,570 rename candidates.
- The next runtime module cutover renamed library-derived policy rebuild to
  `policyLibraryPolicyRebuild.mjs`, renamed its focused test, moved the
  rebuild proposal contract to `policy.library_policy_rebuild.v1`, and
  replaced the contract-local phase handoff with `nextStep`:
  [Policy Library-Derived Policy Rebuild Module Cutover](policy-library-policy-rebuild-module-cutover.md).
- After the library-derived-policy-rebuild cutover, the repository inventory
  validates with 12,769 total phase-coded references, 5,437 production
  references, and 5,459 rename candidates.
- The next runtime module cutover renamed migration verifier and rollback to
  `policyMigrationVerifierRollback.mjs`, renamed its focused test, moved the
  verifier and sample-set fingerprint contracts to
  `policy.migration_verifier.v1` and
  `policy.migration_verifier_sample_set_fingerprint.v1`, replaced the
  contract-local phase handoff with `nextStep`, and moved deletion readiness to
  native intent storage terminology:
  [Policy Migration Verifier And Rollback Module Cutover](policy-migration-verifier-rollback-module-cutover.md).
- After the migration-verifier cutover, the repository inventory validates with
  12,580 total phase-coded references, 5,341 production references, and 5,363
  rename candidates.
- The next runtime module cutover renamed runtime metrics and decision trace to
  `policyRuntimeMetricsTrace.mjs`, renamed its focused test, moved the metrics
  contract to `policy.runtime_metrics_trace.v1`, moved trace attributes to
  `classifarr.policy.runtime_metrics_trace.*`, and replaced the contract-local
  phase handoff with `nextStep`:
  [Policy Runtime Metrics And Decision Trace Module Cutover](policy-runtime-metrics-trace-module-cutover.md).
- After the runtime-metrics cutover, the repository inventory validates with
  12,373 total phase-coded references, 5,237 production references, and 5,259
  rename candidates.
- The policy runtime metrics and decision trace architecture cutover renamed
  the active runtime metrics design record to `policy-runtime-metrics-trace.md`,
  added a durable architecture cutover record, and updated roadmap/module
  references to the durable metrics/trace contract:
  [Policy Runtime Metrics And Decision Trace Architecture Cutover](policy-runtime-metrics-trace-architecture-cutover.md).
- After the runtime-metrics architecture cutover, the repository inventory
  validates with 9,407 total phase-coded references, 3,740 production
  references, and 3,762 rename candidates.
- The next runtime module cutover renamed runtime and rebuild test reset to
  `policyRuntimeRebuildTestReset.mjs`, renamed its focused test, moved the
  reset contract to `policy.runtime_rebuild_test_reset.v1`, and replaced the
  contract-local phase handoff with `nextStep`:
  [Policy Runtime And Rebuild Test Reset Module Cutover](policy-runtime-rebuild-test-reset-module-cutover.md).
- After the runtime/rebuild-test-reset cutover, the repository inventory
  validates with 12,214 total phase-coded references, 5,142 production
  references, and 5,164 rename candidates.
- The policy runtime and rebuild test reset architecture cutover renamed the
  active test-reset design record to `policy-runtime-rebuild-test-reset.md`,
  added a durable architecture cutover record, updated roadmap/module
  references to the durable test-reset contract, and updated the preceding
  metrics-trace records now that this cutover is no longer pending:
  [Policy Runtime And Rebuild Test Reset Architecture Cutover](policy-runtime-rebuild-test-reset-architecture-cutover.md).
- After the runtime/rebuild-test-reset architecture cutover, the repository
  inventory validates with 9,407 total phase-coded references, 3,740 production
  references, and 3,762 rename candidates.
- The next runtime module cutover renamed the completion audit to
  `policyRuntimeCompletionAudit.mjs`, renamed its focused test, moved the audit
  contract to `policy.runtime_completion_audit.v1`, replaced roadmap handoff
  ids with semantic `nextStep.stepId` validation, and pointed component
  evidence at durable module-cutover docs:
  [Policy Runtime Completion Audit Module Cutover](policy-runtime-completion-audit-module-cutover.md).
- After the runtime-completion-audit cutover, the repository inventory validates
  with 12,034 total phase-coded references, 5,050 production references, and
  5,072 rename candidates.
- The policy runtime completion audit architecture cutover normalized the
  active completion-audit design record, added a durable architecture cutover
  record, updated roadmap/module references to the durable completion-audit
  contract, and updated preceding runtime records now that completion-audit
  architecture naming is no longer pending:
  [Policy Runtime Completion Audit Architecture Cutover](policy-runtime-completion-audit-architecture-cutover.md).
- After the runtime-completion-audit architecture cutover, the repository
  inventory validates with 9,411 total phase-coded references, 3,740 production
  references, and 3,762 rename candidates.
- The next policy-engine module cutover renamed the completion audit to
  `policyEngineCompletionAudit.mjs`, renamed its focused test, replaced
  phase-coded component ids and `nextPhase` handoffs with semantic
  `nextStep.stepId` validation, and pointed component evidence at durable
  module-cutover docs:
  [Policy Engine Completion Audit Module Cutover](policy-engine-completion-audit-module-cutover.md).
- After the policy-engine-completion-audit cutover, the repository inventory
  validates with 11,766 total phase-coded references, 4,907 production
  references, and 4,929 rename candidates.
- The next diagnostic cutover removed phase-coded wording from the policy
  evidence engine's production warnings, validation messages, and reducer
  replacement targets while preserving risk ids and behavior:
  [Policy Evidence Engine Diagnostics Cutover](policy-evidence-engine-diagnostics-cutover.md).
- After the policy-evidence-engine diagnostics cutover, the repository
  inventory validates with 11,767 total phase-coded references, 4,897
  production references, and 4,919 rename candidates.
- The next authoring workflow cutover renamed the completion audit to
  `policyAuthoringWorkflowCompletionAudit.mjs`, replaced semantic record ids,
  and removed the production `nextPhase.phaseId` handoff in favor of
  `nextStep.stepId = policy_evidence_engine`:
  [Policy Authoring Workflow Completion Audit Module Cutover](policy-authoring-workflow-completion-audit-module-cutover.md).
- After the policy-authoring workflow completion audit cutover, the repository
  inventory validates with 11,640 total phase-coded references, 4,813
  production references, and 4,835 rename candidates.
- The next authoring workflow cutover renamed the workflow inventory contract
  to `policyAuthoringWorkflowInventory.mjs`, renamed its focused test, replaced
  phase-coded workflow exports/helpers with `POLICY_AUTHORING_WORKFLOW_*` and
  `policyAuthoringWorkflow*`, and moved its standing design record to
  [Policy Authoring Workflow Inventory](policy-authoring-workflow-inventory.md):
  [Policy Authoring Workflow Inventory Module Cutover](policy-authoring-workflow-inventory-module-cutover.md).
- After the policy-authoring workflow inventory cutover, the repository
  inventory validates with 11,420 total phase-coded references, 4,679
  production references, and 4,701 rename candidates.
- The next authoring workflow cutover renamed the destination-flow contract to
  `policyAuthoringDestinationFlow.mjs`, renamed its focused test, replaced
  phase-coded destination exports/helpers with `POLICY_AUTHORING_DESTINATION_*`
  and `policyAuthoringDestination*`, and moved its standing design record to
  [Policy Authoring Destination Flow](policy-authoring-destination-flow.md):
  [Policy Authoring Destination Flow Module Cutover](policy-authoring-destination-flow-module-cutover.md).
- After the policy-authoring destination flow cutover, the repository inventory
  validates with 11,128 total phase-coded references, 4,521 production
  references, and 4,543 rename candidates.
- The next authoring workflow cutover renamed the component-system contract to
  `policyAuthoringComponentSystem.mjs`, renamed its focused test, replaced
  phase-coded component, primitive, option-source, interaction, accessibility,
  and risk exports/helpers with `POLICY_AUTHORING_*` and
  `policyAuthoring*`, and moved its standing design record to
  [Policy Authoring Component System](policy-authoring-component-system.md):
  [Policy Authoring Component System Module Cutover](policy-authoring-component-system-module-cutover.md).
- After the policy-authoring component-system cutover, the repository inventory
  validates with 10,688 total phase-coded references, 4,267 production
  references, and 4,289 rename candidates.
- The next authoring workflow cutover renamed the option-selection contract to
  `policyAuthoringOptionSelection.mjs`, renamed its focused test, replaced
  phase-coded option-selection exports/helpers with
  `POLICY_AUTHORING_OPTION_SELECTION_*`,
  `POLICY_AUTHORING_OPTION_EVIDENCE_FIELD_IDS`, and
  `policyAuthoringOption*`, and moved its standing design record to
  [Policy Authoring Option Selection](policy-authoring-option-selection.md):
  [Policy Authoring Option Selection Module Cutover](policy-authoring-option-selection-module-cutover.md).
- After the policy-authoring option-selection cutover, the repository inventory
  validates with 10,578 total phase-coded references, 4,211 production
  references, and 4,233 rename candidates.
- The next authoring workflow cutover renamed the constraints contract to
  `policyAuthoringConstraints.mjs`, renamed its focused test, replaced
  phase-coded constraint and certification exports/helpers with
  `POLICY_AUTHORING_CONSTRAINT_*`,
  `POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS`, and
  `policyAuthoringConstraint*`, and moved its standing design record to
  [Policy Authoring Constraints](policy-authoring-constraints.md):
  [Policy Authoring Constraints Module Cutover](policy-authoring-constraints-module-cutover.md).
- After the policy-authoring constraints cutover, the repository inventory
  validates with 10,400 total phase-coded references, 4,137 production
  references, and 4,159 rename candidates.
- The next authoring workflow cutover renamed the accessibility contract to
  `policyAuthoringAccessibility.mjs`, renamed its focused test, replaced
  phase-coded accessibility surface, rule, risk, and helper exports with
  `POLICY_AUTHORING_ACCESSIBILITY_*` and `policyAuthoringAccessibility*`, and
  moved its standing design record to
  [Policy Authoring Accessibility](policy-authoring-accessibility.md):
  [Policy Authoring Accessibility Module Cutover](policy-authoring-accessibility-module-cutover.md).
- After the policy-authoring accessibility cutover, the repository inventory
  validates with 9,840 total phase-coded references, 3,865 production
  references, and 3,887 rename candidates.
- The next authoring workflow cutover renamed the presentation-test contract to
  `policyAuthoringPresentationTests.mjs`, renamed its focused test, replaced
  phase-coded presentation category, behavior, risk, owner, and helper exports
  with `POLICY_AUTHORING_PRESENTATION_TEST_*` and
  `policyAuthoringPresentation*`, replaced roadmap owners with durable coverage
  owners, and moved its standing design record to
  [Policy Authoring Presentation Tests](policy-authoring-presentation-tests.md):
  [Policy Authoring Presentation Tests Module Cutover](policy-authoring-presentation-tests-module-cutover.md).
- After the policy-authoring presentation-tests cutover, the repository
  inventory validates with 9,649 total phase-coded references, 3,750
  production references, and 3,772 rename candidates.
- The next authoring workflow cutover renamed the setup-card design record to
  [Policy Authoring Setup Cards](policy-authoring-setup-cards.md), updated the
  workflow completion-audit id to `policy_authoring_setup_cards`, and added the
  standing cutover record:
  [Policy Authoring Setup Cards Module Cutover](policy-authoring-setup-cards-module-cutover.md).
- After the policy-authoring setup-cards cutover, the repository inventory
  validates with 9,646 total phase-coded references, 3,749 production
  references, and 3,771 rename candidates.
- After the policy-authoring destination-sections cutover, the repository
  inventory validates with 9,650 total phase-coded references, 3,748
  production references, and 3,770 rename candidates.
- After the policy-authoring review-triggers cutover, the repository inventory
  validates with 9,645 total phase-coded references, 3,747 production
  references, and 3,769 rename candidates.
- After the policy-authoring routing-readiness cutover, the repository
  inventory validates with 9,645 total phase-coded references, 3,746
  production references, and 3,768 rename candidates.
- After the policy-authoring setup-card progress cutover, the repository
  inventory validates with 9,641 total phase-coded references, 3,745
  production references, and 3,767 rename candidates.
- After the policy-authoring save/defer action-boundary cutover, the repository
  inventory validates with 9,640 total phase-coded references, 3,744
  production references, and 3,766 rename candidates.
- After the policy-authoring starter-template accelerator cutover, the
  repository inventory validates with 9,639 total phase-coded references, 3,743
  production references, and 3,765 rename candidates.
- After the policy-authoring accessibility and decision-load audit cutover, the
  repository inventory validates with 9,638 total phase-coded references, 3,742
  production references, and 3,764 rename candidates.
- After the policy-authoring presentation-test reset cutover, the repository
  inventory validates with 9,634 total phase-coded references, 3,741
  production references, and 3,763 rename candidates.
- After the policy-authoring workflow completion gate audit, the repository
  inventory validates with 9,647 total phase-coded references, 3,741
  production references, and 3,763 rename candidates. The total count includes
  the new audit outcome documentation and a negative test fixture; the
  production baseline remains unchanged.
- After the policy evidence engine architecture cutover, the repository
  inventory validates with 9,630 total phase-coded references, 3,741
  production references, and 3,763 rename candidates. The production baseline
  remains unchanged because the server module and test names were already
  durable.
- After the policy evidence input-gate architecture cutover, the repository
  inventory validates with 9,619 total phase-coded references, 3,741
  production references, and 3,763 rename candidates. The production baseline
  remains unchanged because the server module and test names were already
  durable.
- After the policy evidence boundary architecture cutover, the repository
  inventory validates with 9,601 total phase-coded references, 3,741
  production references, and 3,763 rename candidates. The production baseline
  remains unchanged because the server module and test names were already
  durable.
- After the policy evidence quality architecture cutover, the repository
  inventory validates with 9,593 total phase-coded references, 3,741
  production references, and 3,763 rename candidates. The production baseline
  remains unchanged because the server module and test names were already
  durable.
- After the policy intent engine architecture cutover, the repository inventory
  validates with 9,572 total phase-coded references, 3,741 production
  references, and 3,763 rename candidates. The production baseline remains
  unchanged because the server module and test names were already durable.
- After the policy intent quality-gate architecture cutover, the repository
  inventory validates with 9,557 total phase-coded references, 3,741 production
  references, and 3,763 rename candidates. The production baseline remains
  unchanged because enforcement already lives in the durable intent engine.
- After the policy learning guard architecture cutover, the repository
  inventory validates with 9,544 total phase-coded references, 3,740 production
  references, and 3,762 rename candidates. The production baseline improves
  because a request-time learning audit message now uses durable policy-learning
  language.
- After the policy learning quality-gate architecture cutover, the repository
  inventory validates with 9,538 total phase-coded references, 3,740 production
  references, and 3,762 rename candidates. The production baseline remains
  unchanged because enforcement already lives in the durable learning guard.
- The policy automation readiness engine architecture cutover renamed the
  active readiness design record to `policy-automation-readiness-engine.md`,
  added a durable architecture cutover record, and aligned roadmap links with
  the existing `policy.automation_readiness.v1` runtime contract:
  [Policy Automation Readiness Engine Architecture Cutover](policy-automation-readiness-engine-architecture-cutover.md).
- After the policy automation readiness engine architecture cutover, the
  repository inventory validates with 9,515 total phase-coded references, 3,740
  production references, and 3,762 rename candidates. The production baseline
  remains unchanged because enforcement already lives in the durable readiness
  engine.
- The policy automation readiness quality-gate architecture cutover renamed the
  active readiness quality-gate design record to
  `policy-automation-readiness-quality-gate.md`, added a durable architecture
  cutover record, and aligned readiness quality-gate documentation with the
  existing server-owned bounded quality checks:
  [Policy Automation Readiness Quality Gate Architecture Cutover](policy-automation-readiness-quality-gate-architecture-cutover.md).
- After the policy automation readiness quality-gate architecture cutover, the
  repository inventory validates with 9,507 total phase-coded references, 3,740
  production references, and 3,762 rename candidates. The production baseline
  remains unchanged because enforcement already lives in the durable readiness
  engine.
- The policy operator workflow architecture cutover renamed the active workflow
  design record to `policy-operator-workflow.md`, added a durable architecture
  cutover record, and updated runtime-facing audit labels to say policy
  operator workflow:
  [Policy Operator Workflow Architecture Cutover](policy-operator-workflow-architecture-cutover.md).
- After the policy operator workflow architecture cutover, the repository
  inventory validates with 9,491 total phase-coded references, 3,740 production
  references, and 3,762 rename candidates. The production phase-coded baseline
  remains unchanged, but runtime-facing audit labels now use durable policy
  operator workflow wording.
- The policy operator workflow quality-gate architecture cutover renamed the
  active workflow quality-gate design record to
  `policy-operator-workflow-quality-gate.md`, added a durable architecture
  cutover record, and aligned workflow quality-gate documentation with the
  existing server-owned bounded quality checks:
  [Policy Operator Workflow Quality Gate Architecture Cutover](policy-operator-workflow-quality-gate-architecture-cutover.md).
- After the policy operator workflow quality-gate architecture cutover, the
  repository inventory validates with 9,483 total phase-coded references, 3,740
  production references, and 3,762 rename candidates. The production baseline
  remains unchanged because enforcement already lives in the durable operator
  workflow.
- The policy migration deletion path architecture cutover renamed the active
  migration/deletion design record to `policy-migration-deletion-path.md`,
  added a durable architecture cutover record, and updated runtime-facing audit
  labels to policy migration/deletion and policy runtime inventory wording:
  [Policy Migration Deletion Path Architecture Cutover](policy-migration-deletion-path-architecture-cutover.md).
- After the policy migration deletion path architecture cutover, the repository
  inventory validates with 9,457 total phase-coded references, 3,740 production
  references, and 3,762 rename candidates. The production phase-coded baseline
  remains unchanged, but runtime-facing migration/deletion and runtime inventory
  labels now use durable policy-domain wording.
- The policy migration quality-gate architecture cutover renamed the active
  migration quality-gate design record to `policy-migration-quality-gate.md`,
  added a durable architecture cutover record, and updated roadmap links to the
  durable workflow-quality continuity contract:
  [Policy Migration Quality Gate Architecture Cutover](policy-migration-quality-gate-architecture-cutover.md).
- After the policy migration quality-gate architecture cutover, the repository
  inventory validates with 9,447 total phase-coded references, 3,740 production
  references, and 3,762 rename candidates. The production phase-coded baseline
  remains unchanged, but the active migration quality-gate documentation now
  uses durable policy-domain wording.
- The policy engine completion quality-chain architecture cutover renamed the
  active completion quality-chain design record to
  `policy-engine-completion-quality-chain.md`, added a durable architecture
  cutover record, and updated roadmap links to the durable quality-continuity
  contract:
  [Policy Engine Completion Quality Chain Architecture Cutover](policy-engine-completion-quality-chain-architecture-cutover.md).
- After the policy engine completion quality-chain architecture cutover, the
  repository inventory validates with 9,440 total phase-coded references, 3,740
  production references, and 3,762 rename candidates. The production
  phase-coded baseline remains unchanged, but the active completion
  quality-chain documentation now uses durable policy-domain wording.
- The policy runtime decision inventory architecture cutover renamed the active
  runtime inventory design record to `policy-runtime-decision-inventory.md`,
  added a durable architecture cutover record, and updated roadmap/module
  references to the durable runtime cutline contract:
  [Policy Runtime Decision Inventory Architecture Cutover](policy-runtime-decision-inventory-architecture-cutover.md).
- After the policy runtime decision inventory architecture cutover, the
  repository inventory validates with 9,423 total phase-coded references, 3,740
  production references, and 3,762 rename candidates. The production
  phase-coded baseline remains unchanged, but the active runtime inventory
  documentation now uses durable policy-domain wording.
- The policy runtime evidence projection architecture cutover renamed the
  active runtime evidence projection design record to
  `policy-runtime-evidence-projection.md`, added a durable architecture cutover
  record, and updated roadmap/module references to the durable projection
  contract:
  [Policy Runtime Evidence Projection Architecture Cutover](policy-runtime-evidence-projection-architecture-cutover.md).
- After the policy runtime evidence projection architecture cutover, the
  repository inventory validates with 9,415 total phase-coded references, 3,740
  production references, and 3,762 rename candidates. The production
  phase-coded baseline remains unchanged, but the active runtime evidence
  projection documentation now uses durable policy-domain wording.
- The policy automation decision contract architecture cutover renamed the
  active automation decision design record to
  `policy-automation-decision-contract.md`, added a durable architecture
  cutover record, and updated roadmap/module references to the durable decision
  contract:
  [Policy Automation Decision Contract Architecture Cutover](policy-automation-decision-contract-architecture-cutover.md).
- After the policy automation decision contract architecture cutover, the
  repository inventory validates with 9,412 total phase-coded references, 3,740
  production references, and 3,762 rename candidates. The production
  phase-coded baseline remains unchanged, but the active automation decision
  documentation now uses durable policy-domain wording.
- The policy runtime question reduction architecture cutover renamed the active
  runtime question reduction design record to
  `policy-runtime-question-reduction.md`, added a durable architecture cutover
  record, and updated roadmap/module references to the durable question
  reduction contract:
  [Policy Runtime Question Reduction Architecture Cutover](policy-runtime-question-reduction-architecture-cutover.md).
- After the policy runtime question reduction architecture cutover, the
  repository inventory validates with 9,410 total phase-coded references, 3,740
  production references, and 3,762 rename candidates. The production
  phase-coded baseline remains unchanged, but the active runtime question
  reduction documentation now uses durable policy-domain wording.
- The policy request-time learning architecture cutover renamed the active
  request-time learning design record to `policy-request-time-learning.md`,
  added a durable architecture cutover record, and updated roadmap/module
  references to the durable request-learning contract:
  [Policy Request-Time Learning Architecture Cutover](policy-request-time-learning-architecture-cutover.md).
- After the policy request-time learning architecture cutover, the repository
  inventory validates with 9,404 total phase-coded references, 3,740 production
  references, and 3,762 rename candidates. The production phase-coded baseline
  remains unchanged, but the active request-time learning documentation now
  uses durable policy-domain wording.
- The policy library-derived rebuild architecture cutover renamed the active
  library-derived policy rebuild design record to
  `policy-library-policy-rebuild.md`, added a durable architecture cutover
  record, and updated roadmap/module references to the durable rebuild
  proposal contract:
  [Policy Library-Derived Policy Rebuild Architecture Cutover](policy-library-policy-rebuild-architecture-cutover.md).
- After the policy library-derived rebuild architecture cutover, the repository
  inventory validates with 9,404 total phase-coded references, 3,740 production
  references, and 3,762 rename candidates. The production phase-coded baseline
  remains unchanged, but the active library-derived rebuild documentation now
  uses durable policy-domain wording.
- The policy migration verifier and rollback architecture cutover renamed the
  active migration verifier design record to
  `policy-migration-verifier-rollback.md`, added a durable architecture cutover
  record, and updated roadmap/module references to the durable verifier
  contract:
  [Policy Migration Verifier And Rollback Architecture Cutover](policy-migration-verifier-rollback-architecture-cutover.md).
- After the policy migration verifier and rollback architecture cutover, the
  repository inventory validates with 9,408 total phase-coded references, 3,740
  production references, and 3,762 rename candidates. The production
  phase-coded baseline remains unchanged, but the active migration verifier
  documentation now uses durable policy-domain wording.
- The native schema contract module cutover renamed the schema contract to
  `policyNativeSchemaContract.mjs`, renamed its focused test, moved the
  contract to `policy.native_schema_contract.v1`, replaced schema-local phase
  risk ids and handoff fields with durable names and
  `nextStep.stepId = migration_candidate_report`, and updated direct native
  storage consumers:
  [Policy Native Schema Contract Module Cutover](policy-native-schema-contract-module-cutover.md).
- After the native-schema-contract module cutover, the repository inventory
  validates with 9,155 total phase-coded references, 3,603 production
  references, and 3,625 rename candidates.
- The native SQL migration coverage module cutover renamed the coverage
  contract to `policyNativeSqlMigrationCoverage.mjs`, renamed its focused test,
  moved the contract to `policy.native_sql_migration_coverage.v1`, replaced
  phase-local constants and handoff fields with durable names and
  `nextStep.stepId = native_storage_operational_wiring`, and updated roadmap
  and native-schema handoff references:
  [Policy Native SQL Migration Coverage Module Cutover](policy-native-sql-migration-coverage-module-cutover.md).
- After the native-SQL-migration-coverage module cutover, the repository
  inventory validates with 9,093 total phase-coded references, 3,568
  production references, and 3,590 rename candidates.
- The native storage operational safety module cutover renamed the
  backup/restore and post-upgrade safety contract to
  `policyNativeStorageOperationalSafety.mjs`, renamed its focused test, moved
  the contract to `policy.native_storage_operational_safety.v1`, replaced
  phase-local constants and handoff fields with durable names and
  `nextStep.stepId = native_storage_test_reset`, and updated roadmap plus
  upstream SQL coverage handoff references:
  [Policy Native Storage Operational Safety Module Cutover](policy-native-storage-operational-safety-module-cutover.md).
- After the native-storage-operational-safety module cutover, the repository
  inventory validates with 8,957 total phase-coded references, 3,502
  production references, and 3,524 rename candidates.
- The native storage test reset module cutover renamed the reset contract to
  `policyNativeStorageTestReset.mjs`, renamed its focused test and standing
  architecture record, moved the contract to
  `policy.native_storage_test_reset.v1`, replaced phase-local constants,
  builder exports, diagnostic deletion fields, and handoff fields with durable
  names and `nextStep.stepId = native_backup_restore_wiring`, and updated the
  policy storage closure evidence map:
  [Policy Native Storage Test Reset Module Cutover](policy-native-storage-test-reset-module-cutover.md).
- After the native-storage-test-reset module cutover, the repository inventory
  validates with 8,823 total phase-coded references, 3,417 production
  references, and 3,439 rename candidates.
- The native backup/restore wiring architecture cutover renamed the standing
  recovery record to `policy-native-backup-restore-wiring.md`, updated the
  policy storage closure evidence map and native storage safety references, and
  intentionally kept `backupService.mjs`, `backupRestore.mjs`, and
  `backupRestoreTables.mjs` because those production names already describe
  product behavior:
  [Policy Native Backup And Restore Wiring Module Cutover](policy-native-backup-restore-wiring-module-cutover.md).
- After the native-backup-restore-wiring architecture cutover, the repository
  inventory validates with 8,823 total phase-coded references, 3,416
  production references, and 3,438 rename candidates.

### 9R.3 Contract And Telemetry Naming Cutover

Intent: remove phase-coded labels from payloads, traces, events, and operator
diagnostics that can live beyond the roadmap.

Tasks:

- Rename internal contract versions from roadmap names to durable names where
  external compatibility allows it.
- Rename trace attributes and event labels to product-domain terms.
- Rename package scripts and generated artifact names that operators or CI will
  keep using after the roadmap completes.
- Keep migration-history records clear enough to explain old phase-origin data
  without exposing phase labels as current product concepts.
- Provide compatibility readers for persisted phase-coded payload fields only
  when a storage migration cannot safely rewrite historical records in place.
- Replace temporary completion identifiers such as `8r_*` with semantic
  component IDs before they become stored or cross-module contract keys. Keep
  legacy IDs only in a migration map that is read during a bounded conversion
  window.

Acceptance criteria:

- New runtime traces and events do not use phase-coded identifiers.
- Public or persisted compatibility fields are changed only through explicit
  migration/backward-compatibility rules.
- Diagnostic output describes destination evidence, intent, learning, readiness,
  migration, and storage directly.

Implementation status:

- The classification progress contract and storage cutovers are complete.
  API responses, WebSocket payloads, task queue progress storage, and Command
  Center processing UI use only durable stage terminology.
- The server-owned progress-contract builder lives in
  `server/src/services/classificationProgressStageContract.mjs`.
- Command Center processing UI uses stage terminology and operator-facing
  stage copy.
- Outcome record:
  [Classification Progress Stage Contract Cutover](classification-progress-stage-contract-cutover.md).

### 9R.4 Naming Regression And Completion Audit

Intent: make the final naming state testable.

Tasks:

- Add a production-code scanner that fails when new phase-coded names appear in
  runtime modules without an allow-listed reason.
- Run the scanner in focused tests or CI before the rebuild is called complete.
- Update docs to show the final production module map.
- Prove temporary adapter deletion gates are either complete or explicitly
  scheduled with owner, reason, and target release.

Acceptance criteria:

- Production-code phase references are either gone or explicitly allow-listed
  as docs/history/test migration evidence.
- Full focused server/client tests pass after rename.
- The roadmap records the final durable module names.

Implementation status:

- Phase 9R.4 naming regression is documented in
  [Policy Production Naming Regression Audit](policy-production-naming-regression-audit.md).
- The durable-named regression audit lives in
  `server/src/services/policyProductionNamingRegressionAudit.mjs`.
- The focused regression test suite lives in
  `server/src/__tests__/services/policyProductionNamingRegressionAudit.test.mjs`.
- Current implementation consumes the production naming inventory, requires a
  valid classification result, blocks increases above the approved July 11,
  2026 baseline for production references, rename candidates, and obsolete
  migration tooling, and rejects temporary adapters without deletion gates.
- The current baseline is `0` production references, `0` rename candidates,
  and `0` obsolete migration tooling references. Future components must retain
  this zero-debt result after inventory validation.

### 9R.5 Final Product-Language Audit

Intent: verify the completed platform can be understood without knowing the
roadmap phases.

Tasks:

- Audit user-facing labels, API payload examples, settings text, diagnostics,
  route names, logs, and release notes for temporary roadmap language.
- Confirm operator-facing text uses terms such as evidence, intent, readiness,
  learning, migration, storage, and automation instead of phase numbers.
- Keep historical changelog entries intact, but write current release notes in
  product-domain language.

Acceptance criteria:

- Normal operators do not need roadmap phase knowledge to understand the
  product.
- Current runtime diagnostics and settings do not expose completed phase labels.
- Historical docs remain searchable for migration evidence.

Implementation status:

- The current-surface audit is documented in
  [Product-Language Audit](policy-product-language-audit.md).
- `npm run policy:product-language-audit` scans runtime UI and server modules,
  operator commands, public API documentation, the product README, the current
  release-note section, and only the Unreleased changelog section.
- The audit has no write, storage, network, or process side effects. It reports
  only the surface, repository path, line number, matcher identifier, and
  matched temporary token; it never emits a source-line excerpt.
- Current results: 7 required surfaces, 1,149 audited files, and 0 temporary
  delivery-language findings.

### 9R.6 Completion Gate For Delivery-Term Removal

Intent: prove that the production module tree no longer teaches the current
roadmap.

Tasks:

- Scan `server/src` and `client/src` for delivery-phase words, codes, and
  roadmap-shaped contract/version identifiers.
- Verify every remaining match is either a domain `stage` term awaiting its
  dedicated cutover or a persisted/public compatibility field with a removal
  gate; neither may be introduced by new code.
- Verify source, exports, current diagnostics, telemetry, and normal API
  payloads use durable product-domain names.
- Verify roadmap-token scanners and historical parsers run from maintenance
  tooling, not normal application imports.

Acceptance criteria:

- No active production module uses a roadmap phase label as a source name,
  export, diagnostic, telemetry label, contract version, or internal key.
- Remaining compatibility readers are bounded by an owner, target release or
  migration condition, and deletion test.
- The naming regression baseline reaches zero for delivery-only production
  references; semantically durable execution lifecycle terms use `stage`.

Implementation status:

- The completion-gate outcome is documented in
  [Delivery-Term Removal Completion Gate](policy-delivery-term-removal-completion-gate.md).
- `npm run policy:delivery-term-removal-gate` scans current `client/src` and
  `server/src` files, excluding tests, then blocks delivery terms in source,
  exports, diagnostics, telemetry labels, and payload-building code.
- The gate also prevents production modules from importing maintenance-only
  historical-token parsers and validates each remaining compatibility reader
  against its owner, native-storage removal condition, all required deletion
  gates, and its declared deletion test.
- Current results: zero delivery-term production matches, zero production
  maintenance-parser imports, four live compatibility readers, and zero
  compatibility-boundary issues.
- The audit removed the obsolete `PolicyStarterTemplateMechanics.vue` reader
  from the active compatibility registry after confirming its replacement had
  already been deployed and the source file deleted.

## Phase 10R: Production Acceptance And Operational Readiness

Status: active. Phase 10R turns completed service contracts into deterministic,
installation-agnostic acceptance evidence. It does not create a second runtime
workflow, require an operator dialog, or depend on live external providers.

Intent: prove that the re-imagined policy platform works end-to-end through its
real service boundaries while preserving the distinction between deterministic
automation, bounded AI assistance, and installation-specific release evidence.

Design record:

- [AI Authority Pipeline Acceptance](ai-authority-pipeline-acceptance.md).
- [Provider Failure And Recovery Acceptance](provider-failure-recovery-acceptance.md).
- [Existing-Installation Lifecycle Acceptance](existing-installation-lifecycle-acceptance.md).
- [Reconciliation Idempotence And Native Runtime Read Acceptance](reconciliation-idempotence-native-runtime-read-acceptance.md).

### 10R.1 Classification And Authority Pipeline Acceptance

Intent: accept the full classification decision boundary in isolated fixtures
before relying on completed component contracts as an operational claim.

#### 10R.1.1 AI Authority Pipeline Acceptance

Tasks:

- Exercise persisted provider selection through the real router using a
  disposable database and deterministic in-process transport.
- Prove disabled authority, missing strict schema, and unsupported local
  verification all stop before provider invocation.
- Prove a schema-bound verification response crosses normalization, parser,
  safe authority projection, and routing restraint without retaining thinking
  text or obtaining route authority.
- Keep the acceptance fixture free of provider credentials, external network
  access, classification writes, policy writes, and media-server dependencies.

Acceptance criteria:

- The router can be instantiated with explicit transports without changing the
  production singleton's real-client behavior.
- Strict and disabled failures are verified by zero transport invocations.
- A valid verified result remains advisory and produces
  `ai_authority_advisory` at the real routing-decision boundary.
- The suite runs under the existing disposable integration-database harness.

Implementation status:

- Complete. `AIRouterService` accepts explicit cloud and local transports for
  isolated callers while the production singleton retains existing clients.
- `classificationAiAuthorityAttachment.mjs` owns the safe result projection.
- The integration suite covers disabled, schema-missing, unsupported-local,
  and normalized verified-response paths end to end without a live provider.

#### 10R.1.2 Deterministic Policy Decision And Route Outcome Acceptance

Intent: prove that native policy automation and non-routed outcomes remain
separate after the AI authority boundary.

Tasks:

- Exercise a policy-auto candidate through the real policy decision and route
  outcome boundaries in an isolated fixture.
- Prove the routing result distinguishes routed, classified-not-routed,
  blocked, and question-required outcomes.
- Verify AI-derived or policy-ineligible candidates cannot inherit the native
  policy route decision.
- Keep the fixture independent of a media-server connection and external AI
  provider.

Acceptance criteria:

- `policy_auto` is route-eligible only from current deterministic policy
  evaluation.
- AI and non-final candidates remain non-routed with an explicit safe reason.
- The test asserts observable classification outcome rather than internal
  implementation order.

Completion:

- Complete. The routing boundary now verifies that `policy_auto` carries a
  current `auto_classify` policy result for the same selected library. A method
  label, including one carried by an AI-authority result, cannot grant the
  policy route allowance.
- Complete. The isolated database-backed fixture runs the real policy engine,
  then exercises routed, classified-not-routed, AI-blocked,
  question-required, and provenance-invalid outcomes without a media-server or
  AI-provider connection. See
  `docs/architecture/deterministic-policy-decision-route-outcome-acceptance.md`.

#### 10R.1.3 Provider Failure And Recovery Acceptance

Intent: prove that bounded provider failures cannot convert into an unsafe
decision or obscure an otherwise deterministic policy outcome.

Tasks:

- Exercise disabled, unavailable, malformed, and transient provider outcomes
  with deterministic policy and question boundaries.
- Verify provider failure preserves a policy result when one exists and yields
  a bounded review or retry state when it does not.
- Verify aggregate capability telemetry remains privacy-bounded and does not
  become a decision authority.

Acceptance criteria:

- No provider failure causes an automatic AI route, policy mutation, learning,
  notification, or credential disclosure.
- Result and recovery states are deterministic and separately observable.

Completion:

- Complete. Provider-failure results now carry the versioned,
  privacy-bounded `provider_recovery.v1` projection. Transient and disabled
  availability failures queue a retry; permanent failures preserve policy
  evidence but require a server-owned question. Every valid recovery
  projection is independently denied at the route boundary.
- Complete. The isolated integration fixture covers deterministic policy-auto
  bypass, disabled, transient, permanent, and malformed provider outcomes
  without provider credentials, external calls, media-server connections, or
  persisted exception text. See
  `docs/architecture/provider-failure-recovery-acceptance.md`.

### 10R.2 Existing-Installation Lifecycle Acceptance

Intent: prove existing installations reach native policy behavior automatically
across valid combinations of libraries, policies, and configured providers.

Tasks:

#### 10R.2.1 Existing-State Conversion Matrix

Intent: prove the scheduler-owned reconciler reaches the correct durable state
from the representative persisted states an installation can already contain.

- Build an isolated PostgreSQL matrix covering no-policy, legacy-only,
  profile-backed sparse-evidence, already-native, and invalid legacy-source
  cases; assert native authority and conversion history for converted outputs.
- Invoke the real reconciliation scheduler boundary with no operator request,
  provider credentials, media-server connection, or maintainer-only command.
- Assert only state-appropriate durable effects: conversion writes native
  authority; no-policy and already-native cases do not receive conversion
  writes; invalid input creates only a bounded maintenance state.

Completion:

- Complete. The isolated PostgreSQL scheduler fixture proves no-policy,
  legacy-only, profile-backed sparse-evidence, already-native, and invalid
  source states without provider credentials, media-server access, or an
  operator request. Convertible cases persist one valid native authority and
  conversion history; invalid input persists only the bounded
  `requires_maintenance` state. See
  `docs/architecture/existing-installation-lifecycle-acceptance.md` and
  `server/src/__tests__/integration/native-intent-installation-lifecycle-acceptance.test.mjs`.

#### 10R.2.2 Reconciliation Idempotence And Native Runtime Read

Intent: prove automatic re-runs do not duplicate authority or migration
history, and converted authority is consumed through the native read boundary.

Tasks:

- Re-run the scheduler against the 10R.2.1 converted cases and confirm one
  active native intent, unchanged conversion-event count, and no maintenance
  dialog or approval request.
- Read converted policies through the production native-policy read service and
  verify the authoritative native contract rather than compatibility input is
  returned.

Completion:

- Complete. The isolated PostgreSQL acceptance fixture converts supported
  legacy and current-profile-backed policies, reruns the real scheduler, and
  proves the original active native authority and conversion-event sequence
  remain unchanged without a maintenance state or operator admission path.
- Complete. The production policy-engine read returns a validated
  `native_intent` contract for both converted policies and clears runtime
  compatibility presets before scoring. See
  `docs/architecture/reconciliation-idempotence-native-runtime-read-acceptance.md`
  and
  `server/src/__tests__/integration/native-intent-installation-lifecycle-acceptance.test.mjs`.

#### 10R.2.3 Bounded Lifecycle Diagnostics And Release-Evidence Separation

Intent: prove non-convertible installation states remain bounded and observable
without conflating normal policy operation with compatibility-code retirement.

Tasks:

- Verify invalid and deferred installation outcomes expose only bounded status,
  reason, and count fields; raw legacy configuration and provider payloads stay
  excluded.
- Verify native policy behavior remains available even when the separate
  installation-specific compatibility-removal artifact is unavailable or
  blocked.

### 10R.3 Operational Safety And Observability Acceptance

Intent: prove safe operator-visible outcomes under retries, stale evidence,
provider failures, routing gaps, and restart recovery.

Tasks:

- Exercise privacy-bounded logs, metrics, retry/recovery state, and no-route
  outcomes through real service boundaries.
- Verify no normal runtime entry can invoke compatibility retirement or source
  mutation capabilities.

### 10R.4 Release Acceptance Assembly

Intent: assemble repeatable repository, integration, and installation evidence
without confusing a repository test pass with a specific installation cutover.

Tasks:

- Define the CI acceptance manifest and required isolated suites.
- Bind active-installation evidence to its deployment fingerprint and approval
  workflow while keeping normal automation available.
- Provide a clear release readout with passed, blocked, and not-applicable
  components.

## Testing Strategy

Required coverage should follow the re-imagined phase boundaries:

- product vocabulary tests:
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
- Phase 10R operational acceptance tests:
  - configured authority admission, normalization, parsing, safe projection,
    and routing restraint execute together in an isolated fixture,
  - deterministic policy automation and AI-advisory outcomes remain distinct,
  - provider faults, routing gaps, and restart recovery preserve bounded,
    observable outcomes without live provider or media-server credentials.

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

The next sequence is dependency-gated rather than phase-number order:

1. **4R.1 Live Entry-Path And Action Inventory**: complete for source and
   controlled rendered-browser verification. The normal lifecycle-first entry
   and one admitted create action are regression-covered; production and
   installation evidence remain separate responsibilities.
2. **5R.1 Server Intent Contract Authority**: complete. The active read model
   now publishes native authority and marks the v1 projection as a read-only
   compatibility bridge.
3. **5R.2 Write Preflight And Persistence Boundary**: complete. Native initial
   creation is idempotent, actor-authorized, transactional, sanitized, and
   authoritative after commit or replay.
4. **4R.2 Server Workflow Presentation Adapter**: complete. The browser has
   one validated, immutable, non-authoritative page-read boundary.
5. **4R.3 Action Binding And Admission Feedback**: complete. Native create
   now has an action-local admitted API boundary and safe result feedback.
6. **5R.2a Proposal And Lifecycle Admission Contract**: complete. It supplies
   the server-owned candidate lifecycle, opaque proposal reference,
   current-state recheck, and bounded stale/concurrency recovery outcomes.
7. **4R.4a, 4R.4, and 4R.4b**: complete. They deliver the normal lifecycle
   entry, automated proposal default, and bounded outcome recovery without a
   second create path or a requirement to reselect known evidence. **4R.5.1**
   and **4R.5.2.1** now provide the only eligible exceptional adjustments;
   **4R.5.3** completes reset and accessibility evidence.
8. **5R.4 through 5R.10**, then **4R.6 through 4R.9**: complete. They deliver
   normalized model/question/learning and native-change authority, material
   exceptions, revision-safe maintenance, legacy UI cutover, accessibility,
   and browser end-to-end evidence.
9. **8R.37.4 Closure-Map Reconciliation**: complete. Repository
   implementation readiness now has a separate, integrity-bound component map
   from installation cutover evidence and native policy automation.
10. **10R.1.1 AI Authority Pipeline Acceptance**: complete. It proves the
    configured provider authority pipeline in an isolated database-backed
    fixture without a live provider, secret, or outbound request.
11. **10R.1.2 Deterministic Policy Decision And Route Outcome Acceptance**:
    complete. It proves native policy authority is verified at the route
    boundary and distinguishes routed, classified-not-routed, blocked, and
    question-required outcomes without an external dependency.
12. **10R.1.3 Provider Failure And Recovery Acceptance**: complete. A
    versioned recovery projection now separates transient retry from permanent
    review, preserves deterministic policy evidence, prevents recovery-driven
    routing, and omits provider exception text from result state and aggregate
    telemetry.
13. **10R.2.1 Existing-State Conversion Matrix**: complete. The real scheduler
    boundary accepts no-policy, legacy-only, already-native, profile-backed
    sparse-evidence, and invalid-source starting states, and verifies their
    bounded native or maintenance outcomes.
14. **10R.2.2 Reconciliation Idempotence And Native Runtime Read**: complete.
    Supported legacy and profile-backed policies remain one-authority,
    unchanged-history conversions across a second real scheduler run. Runtime
    reads are verified as native-sourced and compatibility-preset-free.
15. **10R.2.3 Bounded Lifecycle Diagnostics And Release-Evidence Separation**:
    next. Verify non-convertible lifecycle state is privacy-bounded and that
    blocked installation-specific retirement evidence cannot block ordinary
    native policy operation.
16. **8R.36.11 Compatibility-Removal Evidence Regeneration**: revalidated
    after the closure-contract change. It produced fresh v3 repository
    validation evidence and bounded blocked diagnostics because the
    active-installation completion artifact remains blocked. The next
    operational prerequisite is a current approved installation artifact; then
    rerun 8R.36.11 and the generated 8R.34/8R.35 audits. Continue the **9R**
    zero-debt naming gates on every component.

The completed 0R through 3R, 6R, and 7R contracts remain guardrails, not
permission to restore a diagnostic, template-first, or browser-authoritative
workflow.

## Decision Register And Remaining Follow-Ups

The following review distinguishes implemented platform decisions from work
that still needs operational acceptance. A resolved decision does not claim
that every deployment has completed its separate installation-evidence gate.

| Earlier question | Landing | Status |
| --- | --- | --- |
| Minimum observed-profile quality for an automatic baseline | The profile must be current, non-empty, and contain observed genre identity. It can create only advisory genre and media-type identity; it cannot create hard limits, avoid rules, learning, provider calls, or AI authority. | Resolved by 5R profile initialization and accepted in 10R.2.1/10R.2.2. |
| Evidence buckets that affect automation | Current deterministic native policy evidence can establish automation readiness. Observed evidence can establish limited identity or review context. AI, provider, RAG, and compatibility evidence cannot independently grant a route. | Resolved by 5R decision and 10R.1 acceptance contracts. |
| Separation of classified, routed, review, and mapping outcomes | The server-owned automation output contract binds each state to one action and permission tuple; `classified_not_routed`, `needs_operator_review`, and `needs_routing_mapping` cannot claim route authority. | Resolved by 5R output contract and 10R.1.2 acceptance. |
| Manual outcomes eligible for durable learning | Learning is distinct from final resolution. Only allow-listed evidence-backed tiers may proceed; AI prose, stale questions, ambiguous answers, diagnostics, and broad one-off genre selections are blocked, and hard limits require a policy edit. | Resolved by 5R learning guard. |
| UI and Discord question shapes | Only normalized server-owned frames with server-known destination IDs and bounded options may be rendered. Raw AI/provider wording and legacy question payloads fail closed. | Resolved by 5R question normalization and answer admission. |
| AI involvement in intent changes | AI output is structured advisory evidence only. It cannot route or write policy intent; any later policy change must pass deterministic server proposal and admission boundaries. | Resolved by 5R.3 and 10R.1.1. |
| Starter-template provenance after authority removal | Templates remain optional canonical candidates and persisted native template links. Raw attachments stay compatibility-only and do not define runtime policy authority. | Resolved by 3R/5R template boundaries. |
| Unconvertible legacy configuration and operator workflow | Supported cases convert automatically. Unsupported source shapes persist only a bounded `requires_maintenance` state, with no native authority. The acceptance proof for privacy-bounded diagnostics and its separation from release-retirement evidence is still missing. | **Follow-up: 10R.2.3.** |
| Rollback snapshot window | Native authority reversion defaults to 14 days, bounded to 1 through 30 days. After expiry, bulky payloads are redacted while minimal auditable metadata remains. | Resolved by 7R rollback and retention contracts. |
| Old builder, preview, replay, and diagnostics artifacts | Normal browser and HTTP surfaces are retired. The remaining verifier is internal, bounded migration evidence with a deletion gate; compatibility retirement remains CI/release maintenance only. | Resolved for runtime reachability; installation-specific retirement evidence remains a separate 8R release task. |
| Proof that the model reduces operator decisions | The normal authoring path and automatic conversion now remove routine library/profile recreation and conversion dialogs. A production decision-count baseline and release readout have not yet been defined. | **Follow-up: add to 10R.4 release acceptance.** |

### Re-Review Boundaries

- **Next:** 10R.2.3 must prove non-convertible lifecycle diagnostics expose
  only bounded status, reason, and count fields, and prove a blocked
  installation-specific retirement artifact cannot disrupt native policy
  operation.
- **Then:** 10R.3 must accept privacy-bounded observability and recovery under
  retries, stale evidence, routing gaps, and restart conditions.
- **Release:** 10R.4 must define the CI manifest, deployment-evidence readout,
  and a measured operator-decision reduction signal. The separately blocked
  8R.36.11 active-installation artifact remains a deployment prerequisite for
  compatibility retirement, not a prerequisite for ordinary policy automation.
