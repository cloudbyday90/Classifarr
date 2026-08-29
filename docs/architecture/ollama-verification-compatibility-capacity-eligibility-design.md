# Ollama Verification Compatibility Capacity Eligibility — Design

## Evidence and context

On 2026-08-29, a sanitized, media-free probe of the saved local `gemma4:e4b`
model returned the strict JSON-schema contract in about 14 seconds. The local
inventory also contained a much larger alternative model and several
embedding-oriented models. The original alphabetical selection could have
probed those alternatives even though they do not improve diagnosis of the
saved model.

This change keeps the configured model available for its explicit operator
test, but makes automatic comparison candidates resource eligible before the
matrix sends a generation request.

## Current guidance

This design was reviewed on 2026-08-29 against current primary sources:

- Ollama's model-list response includes a model name, digest, artifact size,
  and high-level details, which provides the server-owned data required for a
  bounded alternative decision ([List models](https://docs.ollama.com/api/tags)).
- Ollama's model-details endpoint can expose capabilities, but it is an
  additional API call per model. The chosen first step therefore uses the
  existing tag response and leaves unknown candidates out rather than claiming
  capability it cannot verify
  ([Show model details](https://docs.ollama.com/api-reference/show-model-details)).
- Ollama structured-output guidance continues to require a JSON schema, local
  validation, and low temperature; candidate pruning must not relax that
  contract ([Structured outputs](https://docs.ollama.com/capabilities/structured-outputs)).
- OWASP recommends server-side bounds and rate limiting for expensive API
  work; a request-count limit alone does not cap the memory cost of one large
  model load ([API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)).

## Options considered

| Option | Advantages | Drawbacks |
| --- | --- | --- |
| Preserve alphabetical selection | No new code | A large or embedding model can consume resources without producing useful comparison evidence. |
| Request model details for every installed model | Stronger capability information | Adds one provider call per model and expands the diagnostic surface before any bounded probe. |
| Allow browser-selected alternatives | Flexible | Breaks the server-owned resource and provider-target boundary. |
| Saved model plus server-side bounded alternatives | Preserves the intended model test while containing comparison cost | A compatible large or unclassified alternative is omitted until an explicit future policy is justified. |

## Recommendation stack

1. Always retain an installed saved model in the matrix. Its probe is the
   operator's explicit diagnostic target and remains subject to the existing
   timeout, single-flight, rate limit, fixed schema, and unload request.
2. For all other models, require a positive, safe artifact size no greater than
   24 GiB. Exclude unknown-size and oversized alternatives before generation.
3. Exclude clearly embedding-only candidates using only server-returned model
   name/family markers. This is a safe optimization, not a capability claim for
   every unknown family.
4. Preserve deterministic ordering and the six-model total ceiling. Return only
   an aggregate skipped-alternative count, never sizes, families, targets,
   full digests, prompts, responses, or errors.
5. Continue to exclude cloud-tagged models and retain the saved capability test
   as the only strict-verification authority.

## Security and operational properties

The policy is implemented in a dedicated ESM eligibility module. It consumes
only server-discovered tags and is not configurable by the browser. It adds no
provider route, persistence, logging payload, user-controlled model list, or
additional model-details query. An installed saved model remains explicit;
automatic alternatives fail closed when their artifact size is absent or too
large.
