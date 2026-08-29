# Ollama Verification Capability Reliability Design

## Status

Implemented for the unreleased post-`v0.48.3-beta` commit on 2026-08-29. No
release is created by this work.

## Problem

An administrator could run the saved Ollama verification test and receive a
completion toast, while the status card still described the configuration as
untested. That made a completed, non-admitted probe indistinguishable from a
probe that never ran, and it obscured why strict candidate verification did not
call AI.

The generation adapter also sent `temperature` at the top level of the
`/api/generate` payload. Ollama documents generation controls as members of the
`options` object. In particular, its current structured-output guidance shows
Gemma 4 with a JSON Schema, `stream: false`, and `options: { temperature: 0 }`.

## Research Basis

Research was refreshed against official sources on 2026-08-29.

- The [Ollama Generate API](https://docs.ollama.com/api/generate) documents a
  JSON Schema object in `format` and identifies `options` as the container for
  runtime generation controls.
- [Ollama Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs)
  recommends schema validation, grounding the model with the schema, and lower
  temperature for deterministic completions. Its Gemma 4 example uses
  `options: { temperature: 0 }`.
- The official [Gemma 4 tag catalogue](https://ollama.com/library/gemma4/tags)
  lists `gemma4:e4b` as a current text-and-image local tag. It does not,
  however, replace the application-specific capability test.

The local saved `gemma4:e4b` configuration produced valid fixed-schema probe
responses repeatedly when invoked using the documented `options` shape. That
is evidence that the model can participate when the saved live test succeeds;
it is not a permanent entitlement, since a model tag can change.

## Design

### Request Construction

`ollamaGenerateRequest.mjs` is a narrow ESM request-builder service used by
both non-streaming and streaming generation. It creates only provider-supported
fields:

```js
{
  model,
  prompt,
  stream,
  format, // only for structured output
  options: { temperature },
}
```

When a JSON Schema is present, the builder forces `options.temperature` to `0`.
This leaves Classifarr's server-owned schema, bounded prompt, preflight, model
digest, and response parser unchanged.

### Capability-State Semantics

The server already persisted four current primary-Ollama probe outcomes:
`verification_ready`, `classification_only`, `unavailable`, and
`model_changed`. This design makes every current outcome visible to the
presentation layer. Only `verification_ready` with a valid model digest grants
provider authority; every other state remains fail-closed.

| State | UI meaning | Strict candidate verification |
| --- | --- | --- |
| `verification_ready` | Fixed schema probe passed. | May call the saved primary Ollama model. |
| `classification_only` | Probe completed but did not prove the contract. | Denied; ordinary classification remains available. |
| `unavailable` | Probe could not be completed. | Denied. |
| `model_changed` | Passed identity no longer matches. | Denied until re-tested. |
| `not_checked` | No current saved probe result. | Denied. |

The client maps those server-owned IDs to fixed toasts. It never renders a
provider error, endpoint, model identity, prompt, or generated content.

## Alternatives

| Option | Pros | Cons |
| --- | --- | --- |
| Keep a generic completion toast | Minimal UI work. | Misleading; a completed probe can still deny strict AI. |
| Treat every completed probe as ready | Fewer states. | Unsafe; grants authority without a demonstrated structured contract. |
| Require a different model such as a larger Gemma tag | May help model quality in some installations. | Does not solve an invalid request shape and adds resource cost; a tag still needs testing. |
| Use the documented request shape and retain truthful status | Standards-aligned, model-agnostic, explainable, and fail-closed. | Existing configurations must be explicitly re-tested. |

## Final Recommendation Stack

1. Use the documented `options.temperature` request field and JSON Schema
   `format` for both probe and strict streamed generation.
2. Keep `gemma4:e4b` available; judge the saved endpoint/model by the bounded
   server-side capability test, not a hard-coded model allowlist.
3. Preserve `classification_only` and `unavailable` as current, non-authorizing
   results so operators can distinguish them from `not_checked`.
4. Declare strict AI readiness only for `verification_ready` with current model
   identity; all failures, stale results, and changes remain denied.
5. Keep output, endpoint, credentials, and media data out of capability status
   payloads and client feedback.

## Open-Pull-Request Check

A fresh GitHub query on 2026-08-29 returned no open pull requests for
`cloudbyday90/Classifarr`. Therefore there is no random open PR to apply
locally for this change, and no pull request was merged.
