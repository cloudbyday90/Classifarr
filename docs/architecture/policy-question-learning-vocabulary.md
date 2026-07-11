# Policy Question And Learning Vocabulary

Status: implemented as the fourth Phase 0R source-of-truth contract.

## Scope

Phase 0R.4 defines the vocabulary for runtime questions, answer outcomes, and
learning side effects.

This slice does not change Discord behavior, pending-item UI, classification
scoring, routing, database schema, AI prompts, or durable learning writes. It
creates a server-owned ESM contract that future Phase 5R question normalization
and learning guard work can consume.

## Research Inputs

Official sources reviewed as of June 2026:

- NIST AI Risk Management Framework:
  <https://www.nist.gov/itl/ai-risk-management-framework>
  - Human review and AI-assisted decisions should keep accountability,
    transparency, validity, and safety boundaries explicit.
- NIST Generative AI Profile, AI 600-1:
  <https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf>
  - Generative AI output should be validated and monitored before influencing
    consequential behavior.
- OWASP Top 10 for Large Language Model Applications:
  <https://owasp.org/www-project-top-10-for-large-language-model-applications/>
  - Prompt injection, excessive agency, sensitive information disclosure, and
    insecure output handling require bounded AI authority and deterministic
    validation.
- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - Review questions need labels and instructions that make the operator's task
    clear.
- W3C WCAG 2.2, Error Identification:
  <https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html>
  - Question and readiness flows should identify what needs attention and what
    action is available.
- Microsoft Human-AI Experience Guidelines:
  <https://www.microsoft.com/en-us/haxtoolkit/>
  - AI-assisted systems should communicate uncertainty, keep users in control,
    and make correction paths clear.

## Recommendations

1. Allow only destination-oriented runtime question frames:
   - destination fit,
   - missing evidence,
   - hard-limit conflict,
   - routing gap,
   - stale profile,
   - outlier review.
2. Reject question frames that make operators reason about internals:
   - broad genre priority,
   - AI-authored policy edits,
   - provider-specific diagnostics,
   - replay/parity interpretation.
3. Separate final outcome from learning side effect:
   - resolving the current item is not durable learning,
   - `Do not learn` must be explicit and side-effect free,
   - every learning side effect must pass the learning guard.
4. Treat hard-limit evidence as requiring explicit policy edit, not a simple
   runtime answer.
5. Normalize rejected question frames to deterministic replacement frames before
   UI or Discord renders them.

## Pros And Cons

### Pros

- Gives Phase 5R a stable enum contract for question normalization.
- Prevents vague genre-priority questions from teaching the system bad rules.
- Keeps Discord and UI answer semantics aligned.
- Makes durable learning opt-in through future guard logic rather than a hidden
  side effect of manual resolution.
- Keeps provider/replay/TMDB internals out of operator questions.

### Cons

- Existing runtime question generators are not wired to this contract yet.
- The vocabulary defines learning side effects but does not persist or evaluate
  them.
- The accepted question set may need expansion after Phase 5R inventories the
  existing runtime question paths.
- Some current pending-item UI copy may still use old wording until Phase 5R and
  Phase 3R consume this contract.

## Final Stack

- Authority vocabulary dependency:
  `server/src/services/policyAuthorityVocabulary.mjs`
- User mental model dependency:
  `server/src/services/policyUserMentalModel.mjs`
- Question and learning vocabulary contract:
  `server/src/services/policyQuestionLearningVocabulary.mjs`
- Unit coverage:
  `server/src/__tests__/services/policyQuestionLearningVocabulary.test.mjs`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- This implementation record:
  `docs/architecture/policy-question-learning-vocabulary.md`

## Implemented Outcome

Phase 0R.4 now defines accepted runtime question frames:

| Frame | Purpose |
| --- | --- |
| Destination fit | Ask whether the item belongs in the destination. |
| Missing evidence | Ask when evidence is insufficient to automate. |
| Hard-limit conflict | Ask whether a declared limit should block the item. |
| Routing gap | Separate classification from missing Arr routing. |
| Stale profile | Ask whether the library profile should refresh first. |
| Outlier review | Ask whether the item is an intentional exception. |

It also defines rejected question frames and replacement frames:

| Rejected Frame | Replacement |
| --- | --- |
| Broad genre priority | Destination fit |
| AI-authored policy edit | Missing evidence |
| Provider-specific diagnostic | Missing evidence |
| Replay parity interpretation | Outlier review |

Answer outcomes are now split from learning side effects:

| Answer Outcome | Learning Side Effect |
| --- | --- |
| Resolve this item | None |
| Remember exact item | Exact-item memory candidate |
| Add compatibility evidence | Compatibility evidence candidate |
| Add identity evidence | Identity evidence candidate |
| Add hard-limit evidence | Explicit policy edit required |
| Do not learn | None |

Manual resolution does not imply durable learning. Every learning candidate
requires the future Phase 5R learning guard.

## Follow-Up

The next Phase 0R task is **0R.5 Documentation And Test Alignment**. That task
should turn the Phase 0R contracts into a checklist and identify stale tests,
docs, labels, and assumptions before Phase 1R begins.
