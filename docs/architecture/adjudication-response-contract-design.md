# Aligned adjudication response contract

## Decision and scope

Review of commit `7715e4b8` confirmed a production mismatch: bounded adjudication
instructs the model to return pipe-delimited text while non-reasoning providers
receive an eight-field JSON schema. Its four-case local replay returned two valid
proposals, one output-limited response and one `problem_summary` rejection.

Replace only bounded adjudication's wire contract with:

```json
{"decision":"PROPOSE","library_number":1}
```

For uncertainty, require `{"decision":"ABSTAIN","library_number":null}`.
Generate the provider schema from the same strict Zod object used by the parser,
bounded to the actual two or three candidates. Embed that schema in the prompt.
Enforce the decision/index relationship in application validation as well.

The model chooses a candidate; it does not invent a confidence score, explanation,
question, destination name or routing permission. Preserve the existing internal
proposal/abstention result shapes for downstream policy consumers. Confidence
remains server-owned. Invalid responses remain rejected, not valid abstentions.

Do not repair adjudication with another model or the old pipe-format repair prompt.
Disable that path for this mode only. Generic classification and candidate-bound
verification keep their existing contracts. Historic stored outcomes are not
reparsed; no data migration, client API change, new UI or configuration is needed.

## Security and compatibility

- Treat retrieved descriptions and library names as data, never instructions.
- Accept only the exact two-key JSON object, bounded input size, valid decision,
  integer index in the current candidate list, or a null abstention index.
- Reject extra keys, prose, fenced responses, old pipe syntax, confidence fields,
  malformed JSON and inconsistent decisions. Do not salvage an embedded answer.
- Return server-owned error categories only; never retain model text or raw Zod
  messages in this mode. Do not create a model-written clarification question.
- A valid proposal is still subject to all existing policy, evidence, provider and
  fresh routing-receipt checks. This is not a threshold relaxation.
- Continue production's existing reasoning-model grammar bypass; those models
  receive the same JSON instructions and strict application validation.
- Old-format in-flight responses can be rejected during deployment. Cache keys
  based on prompt text naturally change; no historic response should be promoted
  into fresh routing authority.

## Official research

URLs were discovered through search and opened September 12, 2026. These sources
support practices applicable to the requested August 2026 baseline; mutable docs
are not claimed to be archived August snapshots. No new dependency version is
required. W3C's technique records a January 12, 2026 update.

- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs):
  provide a schema to the provider, ground the prompt with it, and validate output
  in the application. Fixed inference controls make local comparisons clearer.
- [Zod JSON Schema](https://zod.dev/json-schema): native schema conversion and
  strict objects support one definition for generation and field validation.
  Cross-field semantics still require explicit application checks.
- [JSON Schema additional properties](https://tour.json-schema.org/content/03-Objects/02-Additional-Properties):
  reject undeclared fields rather than treating generated extras as authority.
- [OWASP prompt-injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html):
  separate untrusted content from instructions, validate outputs and retain
  deterministic permission boundaries. Schema validity alone is not correctness.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22):
  existing status displays should use polite announcements without taking focus.
  This backend fix needs no new screen, acknowledgement or status widget.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Minimal, aligned JSON contract | Fewer generated tokens and irrelevant validation failures; one explicit choice | Requires coordinated parser and fixture changes | Implement |
| Keep eight fields but change prompt | Smaller compatibility change | Still generates discarded scores, questions and null fields | Not preferred |
| Increase output budget | May avoid one observed limit | More work and latency; leaves contract mismatch | Do not tune budget in this comparison |
| Repair malformed proposals | Can recover formatting errors | Additional call without original evidence may change the choice | Disable for adjudication |
| Relax policy thresholds | Fewer reviews immediately | Does not prove semantic correctness | Out of scope |

Stack: organic library evidence → policy-owned shortlist → shared bounded schema
and JSON prompt → strict response parser → existing policy and routing checks.

## Validation plan

Use adversarial and boundary tests for both two- and three-candidate contracts,
prompt/schema agreement, production provider dispatch, repair suppression,
unchanged generic classification/verification, abstention and receipt-free replay.
Rebuild local Compose and repeat the same four retained cases with the same model,
seed, context and 256-token bound. Report actual calls, proposal/abstention/rejection
counts, latency and token usage, without claiming accuracy from four weakly labelled
historic cases. Keep measured outcomes in a separate document.
