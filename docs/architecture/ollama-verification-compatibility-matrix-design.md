# Ollama Verification Compatibility Matrix — Design

## Context

The saved Ollama verification test establishes whether the single configured
model may participate in strict candidate-bound verification. It does not
explain whether a local failure is specific to that model build or shared by
the installed local Ollama environment. This design adds an on-demand,
advisory compatibility matrix for a small, deterministic subset of installed
local models. It never broadens the strict-verification admission rule.

This design was reviewed on 2026-08-29 against current primary guidance:

- Ollama documents `GET /api/tags` for installed-model details, including a
  model name and digest ([List models](https://docs.ollama.com/api/tags)).
- Ollama documents `GET /api/version` for the local server version
  ([Get version](https://docs.ollama.com/api-reference/get-version)).
- Ollama's generate API supports a JSON Schema in `format`, and a
  non-streaming response is preferable for short structured work
  ([Generate API](https://docs.ollama.com/api/generate),
  [Streaming guidance](https://docs.ollama.com/api/streaming)).
- Ollama recommends a schema, local validation, and temperature `0` for
  reliable structured outputs ([Structured outputs](https://docs.ollama.com/capabilities/structured-outputs)).

## Options considered

| Option | Advantages | Drawbacks |
| --- | --- | --- |
| Test every returned model concurrently | Fast, complete-looking result | Can exhaust CPU, memory, GPU capacity, and request budgets; risks testing cloud-tagged models. |
| Accept browser-selected host, model list, or prompt | Flexible troubleshooting | Lets client input control provider reachability and compute cost; complicates authorization and audit boundaries. |
| Persist individual matrix results | Historical comparison | Retains model/build telemetry without being required for the immediate operator decision. |
| Fixed server-discovered local subset, serial and ephemeral | Bounded work; safe default; directly comparable responses | Needs an explicit artifact-size and embedding eligibility policy to avoid an expensive but irrelevant alternative probe. |

## Recommendation stack

1. Bind the Ollama transport to the saved AI Settings host and port on the
   server only; do not reuse a separate legacy Ollama-settings target. Ignore
   browser-supplied targets and exclude cloud-tagged model names.
2. Select the saved model first when it is installed. Select at most five
   remaining alternatives by stable name order only when their server-reported
   artifact size is known and within the capacity boundary, and they are not
   clearly embedding-only. Report aggregate omitted/skipped counts instead of
   silently presenting a complete matrix.
3. Collect the local Ollama version best-effort, then issue the existing fixed,
   media-free JSON-Schema probe serially with temperature `0`, non-streaming
   handling, a per-model timeout, and `keep_alive: 0`.
4. Return only the local version, model name, short build-digest prefix, fixed
   outcome ID, timestamp, and bounded latency. Do not persist results, model
   output, prompt, raw errors, endpoint, provider configuration, media,
   policy, route, or actor identity.
5. Make the manual action administrator-only through the existing settings
   boundary, impose a dedicated two-runs-per-hour limiter, and reject a
   concurrent matrix run. The UI must state that matrix output is advisory and
   the current saved capability still controls strict verification.

## Security and operational controls

The action is intentionally expensive relative to an ordinary API read.
OWASP recommends limiting interaction frequency and server-side resource
dimensions for operations that can consume substantial resources
([API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)).
The matrix rejects request bodies and has no client-selected model count or
target, a fixed six-model ceiling, server-side capacity eligibility for
alternatives, serial execution, per-model timeout, single-flight service gate,
and dedicated post-authentication limiter.

The matrix is a transient diagnostic rather than an audit log. OWASP advises
collecting only data proportionate to the purpose and excluding secrets,
connection details, sensitive content, and unnecessary technical data from
logs ([Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)).
Only a fixed operational busy/failure code may be logged. Model responses and
raw provider errors remain inside the probe implementation and are discarded.

```text
admin action, no request body
  -> dedicated limiter
  -> single-flight matrix service
      -> saved server configuration + local /tags
      -> best-effort /version
      -> serial, fixed-schema local model probes (maximum six)
      -> allow-listed ephemeral report
  -> AI Settings advisory panel

saved current capability
  -> remains the only strict verification authority
```

## Modules

- `ollamaVerificationCompatibilityMatrix.mjs` owns the fixed, safe report
  contract, deterministic model selection, and projection.
- `ollamaVerificationCompatibilityMatrixService.mjs` owns matrix execution and
  the one-run gate.
- `ollamaVerificationSavedConfigurationClient.mjs` owns the internal-only
  saved-configuration transport binding used by the matrix.
- `ollamaVerificationCompatibilityMatrixProbe.mjs` owns one fixed-schema,
  media-free probe result without exposing provider output.
- `ollamaVerificationCompatibilityMatrixHandler.mjs` owns HTTP translation of
  an in-progress result; `aiSettingsHandlers.mjs` composes it with existing
  settings dependencies.
- `OllamaVerificationCompatibilityMatrix.vue` independently allow-lists report
  fields before rendering them.
