# Candidate-Bound Verification Contract And Capability Admission

## Status

11R.2 is complete on 2026-08-10. It narrows the AI verification path for a
unique deterministic `prompt_confirm` policy candidate. This is a runtime
authority hardening change; it does not grant AI routing, learning, policy,
notification, provider, or domain-write authority.

## Problem

The prior verification prompt asked a model to return a library number or a
multi-library clarification. Parser and route-safety code retained the
deterministic candidate when the model disagreed, but an unsupported provider
could still receive the verification prompt and malformed verification output
could be repaired by a second local model. That is not a candidate-bound
contract.

## Official Research Basis

This implementation was reviewed against official guidance available in August
2026:

- OpenAI's API reference recommends `json_schema` over legacy JSON mode and
  documents strict schema adherence for supported models. [OpenAI Structured
  Outputs reference](https://platform.openai.com/docs/api-reference/responses-streaming/response/output_item/done?lang=node.js)
- Google documents structured output as syntactic JSON conformance that still
  requires application-side semantic validation and robust error handling.
  [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output?authuser=14&hl=en)
- OWASP recommends least privilege, server-side handling of privileges, output
  filtering, separation of untrusted content, and human approval for
  high-risk actions. [OWASP LLM01: Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- NIST AI RMF calls for explicitly defined human oversight, scope, testing,
  monitoring, and documented risk controls. [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

## Decision

The policy engine selects the candidate. The model can only return one of two
outcomes for that candidate:

```json
{"decision":"CONFIRM","reason":"brief reason"}
```

```json
{"decision":"ABSTAIN","reason":"brief reason"}
```

The response cannot contain a library number, library name, alternative
destination, clarification options, or any other property. The server binds a
`CONFIRM` to the policy-selected active library; the model never gets a choice
of destinations.

### Admission Rules

Before prompt assembly, profile reads, web search, locking, or generation, the
server requires all of the following:

1. A policy-path candidate and deterministic signal candidate resolve to the
   same active library.
2. The provider has effective `verification` authority.
3. The provider's adapter supports server-enforced structured output.
4. The generation request submits the dedicated shallow JSON Schema and sets
   strict authority admission at the router.

Only the currently supported non-reasoning OpenAI and Gemini adapter paths
satisfy that admission. Ollama, fallbacks, custom proxies, OpenRouter,
LiteLLM, disabled providers, and the non-schema OpenAI reasoning path do not.
They receive no verification prompt. The server returns a bounded advisory
review state and retains the deterministic candidate.

Strict verification does not invoke web search, does not include RAG candidate
names, and does not perform malformed-response repair. An invalid, non-JSON,
or schema-violating response is a server-owned abstention. Provider reasoning
is neither sent to the user nor persisted.

## Alternatives

### Let Every JSON-Capable Provider Verify

Pros: supports local deployments and fewer capability branches.

Cons: valid JSON does not establish adapter-level schema enforcement or
semantic authority. It conflates proposal capability with contract admission.

Decision: rejected.

### Permit Alternative Destinations In Verification

Pros: allows a model to express disagreement in one response.

Cons: turns verification into selection, expands output authority, and exposes
unneeded candidate choices. The deterministic service must then recover from
the model's proposal.

Decision: rejected. The model may abstain; the operator can choose a different
destination through the existing server-owned question.

### Repair Malformed Verification With A Local Model

Pros: may recover a response without operator review.

Cons: a second provider could transform a malformed strict response into an
accepted confirmation. This breaks provenance and capability admission.

Decision: rejected. Strict verification fails closed to advisory review.

## Final Recommendation Stack

1. Bind verification to the policy-selected candidate on the server.
2. Require an effective contract-grade provider and a narrow JSON Schema before
   any verification prompt is constructed or sent.
3. Accept only exact `CONFIRM` or `ABSTAIN` response objects and repeat
   semantic validation in application code.
4. Treat non-admission, abstention, and malformed output as bounded operator
   review while retaining deterministic routing authority.
5. Persist only the contract version and status identifier. Never retain
   candidate identifiers, provider reasons, prompts, raw output, or repair
   content for this contract.

## Implementation Evidence

- Runtime contract and admission: `server/src/services/classificationCandidateBoundVerificationContract.mjs`.
- Strict schema: `server/src/services/aiResponseSchema.mjs`.
- Verification prompt and parser: `server/src/services/aiPromptBuilderFormatters.mjs`,
  `server/src/services/aiResponseParser.mjs`, and
  `server/src/services/aiResponseParserResults.mjs`.
- Policy and RAG candidate binding: `server/src/services/classificationPolicyPathService.mjs`
  and `server/src/services/classificationRagLoopStages.mjs`.
- Bounded history projection: `server/src/services/classificationPersistenceService.mjs`.
- Focused coverage: `server/src/__tests__/classificationCandidateBoundVerificationContract.test.mjs`,
  `classificationAiService.test.mjs`, `services/aiResponseParser.test.mjs`,
  `services/aiPromptBuilder.test.mjs`, policy-path, RAG-stage, and persistence
  tests.

## Next Task

Proceed with **11R.3 Candidate-Bound Verification Observability And Operator
Explanation**: expose the bounded admission, abstention, and strict-contract
status in the review explanation without showing raw model content or adding a
new decision path.
