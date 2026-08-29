# Ollama Verification Capability Probe Design

## Status

Implemented on 2026-08-28 for the unreleased next commit. This design admits
only an explicitly tested, current **primary** self-hosted Ollama configuration
to candidate-bound verification. It does not broaden fallback authority or let
an LLM choose a routing destination.

## Problem

Candidate-bound confirmation reaches a strict `verification` authority mode.
Before this work, `aiProviderAuthority.mjs` used a static provider-ID allowlist
for that mode. A self-hosted Ollama model was therefore stopped before prompt
construction, so a confirmation policy correctly showed no Ollama usage even
when the configured model could accept a JSON Schema.

The pre-existing AI Settings summary was intentionally a read-only
configuration projection. It did not test endpoint reachability, model
availability, structured output, or whether a model tag had changed since a
previous test.

## Official Research Basis

Research was performed against official sources available on 2026-08-28.

- Ollama documents JSON Schema objects in the `format` field for generated
  responses, recommends application-side parsing/validation, and recommends
  temperature `0` for more deterministic structured output. [Ollama Structured
  Outputs](https://docs.ollama.com/capabilities/structured-outputs)
- Ollama's generate API explicitly supports either `"json"` or a JSON Schema
  object in `format`. [Ollama Generate API](https://docs.ollama.com/api/generate)
- The local model-list response includes a model `digest`. That gives the
  application an observable identity for the exact content behind a configured
  model tag. [Ollama List Models API](https://docs.ollama.com/api/tags)
- Ollama identifies `/api/generate` as a streaming NDJSON endpoint and notes
  that non-streaming responses can simplify structured-output handling. The
  production streaming path must therefore preserve the schema and require its
  completion signal. [Ollama Streaming](https://docs.ollama.com/api/streaming)
- OWASP recommends separating LLM data from instructions, applying output
  validation, preserving least privilege, and retaining human control for
  sensitive actions. [OWASP LLM Prompt Injection Prevention Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- Expensive provider operations need bounded time and frequency. The explicit,
  administrator-authorized test avoids background probing while retaining
  existing timeouts and model-generation limits. [OWASP API4:2023 Unrestricted
  Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)

## Design

### Capability States

| State | Meaning | Verification authority |
| --- | --- | --- |
| `not_checked` | The saved primary Ollama configuration has not completed a current probe, changed since the probe, or the result expired. | Denied |
| `verification_ready` | A fixed JSON-Schema test passed for the saved endpoint/model/revision and recorded model digest. | Granted for primary Ollama only |
| `classification_only` | Ollama is reachable but did not prove the bounded structured response. | Denied |
| `unavailable` | Endpoint/model reachability or model discovery failed. | Denied |
| `not_applicable` | Ollama is not the primary provider. | Denied |

An existing installation begins in `not_checked`. It is never silently elevated
by a migration, a page refresh, or a configuration save.

### Probe Boundary

`POST /api/settings/ai/verification-capability/test` accepts no endpoint,
model, prompt, or credential from the browser. It reads the saved singleton
configuration after the normal administrator authorization boundary, then:

1. reads `/api/tags` through the existing preflight API;
2. requires the configured model and a 64-character model digest;
3. sends one fixed, media-free JSON-Schema generation at temperature `0`;
4. requires exactly `{ "status": "ready", "contract":
   "candidate-bound-verification" }`; and
5. persists only a fixed verdict, SHA-256 configuration fingerprint,
   configuration revision, model digest, checked timestamp, bounded error code,
   and latency.

Raw provider errors, the probe prompt, model response, endpoint, model name,
credentials, media metadata, libraries, policies, and routing data do not cross
the result boundary or enter persistence.

The remote call is deliberately outside the database transaction. A short
transaction re-reads and locks the saved configuration before recording a
result; if the revision or fingerprint changed, the result is rejected with a
reload-required conflict. This prevents a slow probe from authorizing a newer
configuration.

### Runtime Boundary

The authority layer receives only a server-built evidence object. It grants
Ollama strict authority when all of these are true:

1. Ollama is the primary provider, never a fallback.
2. The saved capability verdict is current, fresh, and `verification_ready`.
3. The saved fingerprint/revision still match the current configuration.
4. The evidence model matches the provider model and includes its digest.

The streamed generation path now forwards both the JSON Schema and expected
model digest. Its preflight compares the current `/api/tags` digest before
generation. A changed tag fails closed rather than reusing the prior probe.
The existing candidate-bound parser still permits only `CONFIRM` of the
server-selected candidate or `ABSTAIN`; it never grants media routing authority
to model output.

### User Interface

AI Settings retains the read-only current capability summary and adds a nested,
identity-free Ollama state indicator. When Ollama is primary, it offers **Test
Ollama Verification**. The action explains that it sends one fixed, media-free
request and never routes media. The UI renders server-authored labels and
guidance only, plus a bounded last-tested timestamp; it does not display raw
provider errors in the status card.

## Alternatives

### Keep the Static Provider Allowlist

Pros: smallest implementation; uniform provider behavior.

Cons: rejects documented self-hosted structured-output support before a request
can be made; the UI cannot distinguish an untested model from an unsupported
provider.

Decision: rejected.

### Trust Any Ollama JSON Response

Pros: no saved capability state or explicit test.

Cons: JSON syntax alone does not establish a usable schema adapter, current
model identity, output semantics, or authorization. It violates the existing
fail-closed candidate contract.

Decision: rejected.

### Let the Browser Declare Capability

Pros: avoids a server probe endpoint.

Cons: editable client state is not security evidence and can become stale after
an endpoint/model change.

Decision: rejected.

### Probe Every Browser Refresh

Pros: appears current.

Cons: creates repeated model invocations, increases resource consumption, and
conflates a read with an expensive action.

Decision: rejected. Testing is explicit and administrator-authorized.

## Final Recommendation Stack

1. Keep the server-owned candidate contract and manual policy confirmation
   boundary unchanged.
2. Require an explicit, fixed, media-free JSON-Schema probe for the saved
   primary Ollama configuration.
3. Bind success to configuration revision/fingerprint and model digest; reject
   stale or changed identities both when persisting and before generation.
4. Treat every failure, expiry, fallback, and untested configuration as
   classification-only and fail closed.
5. Surface the current state in AI Settings without exposing raw diagnostics.
6. Keep probes bounded, authenticated, and separate from page refreshes and
   classification work.
