# Policy Builder Phase 0R Authority Vocabulary

Status: implemented as the first Phase 0R source-of-truth contract.

## Scope

Phase 0R.1 defines which source is allowed to mean what before the policy
builder, runtime question system, AI assistance, learning guard, and native
storage migration continue.

This slice does not change classification scoring, routing, database schema,
saved policy payloads, or UI behavior. It creates a small server-side ESM
contract and documentation that later phases can use as the vocabulary source.

## Research Inputs

Official sources reviewed as of June 2026:

- NIST AI Risk Management Framework:
  <https://www.nist.gov/itl/ai-risk-management-framework>
  - Classifarr should separate accountability, validity, transparency, and
    explainability concerns instead of letting one AI or scoring output become
    decision authority.
- NIST Generative AI Profile, AI 600-1:
  <https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf>
  - Generative AI output requires review, validation, and monitoring before it
    can affect consequential system behavior.
- OWASP Top 10 for Large Language Model Applications:
  <https://owasp.org/www-project-top-10-for-large-language-model-applications/>
  - LLM output should be bounded because prompt injection, excessive agency,
    sensitive information disclosure, and insecure output handling are normal
    design risks for AI-assisted systems.
- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - User-facing controls need clear labels and instructions, which supports a
    single vocabulary before redesigning the policy UI.
- GOV.UK Design System, Checkboxes:
  <https://design-system.service.gov.uk/components/checkboxes/>
  - Multi-select UI should make it clear when users can select more than one
    item, which supports the later Phase 3R component-system reset.

## Recommendations

1. Treat the server as the vocabulary and validation authority.
2. Make operator-declared intent the only durable policy authority in this
   slice.
3. Treat media-server contents as observed evidence that can suggest intent but
   cannot create hard limits or override declared intent by itself.
4. Treat AI output as non-authoritative: it can suggest, explain, or propose,
   but deterministic server logic must normalize it before any user-facing
   question, policy suggestion, or learning candidate.
5. Treat manual outcomes as final outcomes first. They can become learning only
   through the future learning guard.
6. Treat metadata providers as evidence enrichment, not policy meaning.
7. Treat legacy presets/templates as draft seeds and compatibility records, not
   the future authority model.

## Pros And Cons

### Pros

- Creates a concrete authority model before more UI or engine work lands.
- Gives Phase 1R, 2R, 3R, 5R, 6R, 7R, and 8R a shared source vocabulary.
- Prevents current library contents, AI output, metadata providers, and legacy
  templates from accidentally becoming durable policy authority.
- Gives tests a stable place to assert source separation.
- Keeps the slice low risk because there are no runtime, schema, or save-path
  side effects.

### Cons

- The module is a contract seed and is not wired into runtime enforcement yet.
- Existing UI labels still need later Phase 0R.2 and Phase 3R work.
- Existing legacy policy storage still carries preset/custom-signal shape until
  Phase 8R native storage conversion.
- Learning eligibility is intentionally conservative until Phase 5R defines the
  learning guard.

## Final Stack

- Server authority vocabulary:
  `server/src/services/policyAuthorityVocabulary.mjs`
- Unit coverage:
  `server/src/__tests__/services/policyAuthorityVocabulary.test.mjs`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- This implementation record:
  `docs/architecture/policy-builder-phase-0r-authority-vocabulary.md`

## Implemented Outcome

Phase 0R.1 now defines six source roles:

| Source | Product Term | Authority |
| --- | --- | --- |
| Media-server contents | Observed application | Evidence only |
| Operator-declared intent | Declared intent | Durable policy authority after validation |
| Manual outcome | Final outcome | Item resolution; learning candidate only through guard |
| AI output | AI suggestion | Non-authoritative input |
| Metadata provider | Metadata evidence | Evidence enrichment only |
| Legacy template | Starter template | Draft seed and compatibility bridge |

The contract intentionally makes only `operator_declared_intent` durable policy
authority. Every other source must pass through future server contracts before
it can affect durable policy, learning, routing, or native storage.

## Follow-Up

The next Phase 0R task is **0R.2 User Mental Model**. That task should translate
this authority model into the default operator-facing language before more
policy-builder controls are added.
