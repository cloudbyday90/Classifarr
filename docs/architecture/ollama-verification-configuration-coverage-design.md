# Ollama Verification Configuration Coverage — Design

## Context

The compatibility matrix already computes whether the saved primary Ollama
model was found in the server-discovered eligible local-model set. The report
exposes this as `configuredModelIncluded`, but the initial UI did not show it.
That left an operator unable to distinguish these two cases:

1. The saved model was tested and returned a result.
2. Other local models were tested, but the saved model was not installed,
   eligible, or discoverable.

This focused follow-up makes that relationship explicit without returning the
saved model name, the Ollama endpoint, or any provider response.

## Current guidance

This design was checked on 2026-08-29 against current primary sources:

- Ollama's model-list endpoint returns the server-discovered model name and
  digest, which is the authoritative source for the bounded selection already
  made by the server ([List models](https://docs.ollama.com/api/tags)).
- Ollama recommends a JSON Schema, local validation, and low temperature for
  dependable structured responses; the coverage indication must not weaken
  that existing strict-output contract
  ([Structured outputs](https://docs.ollama.com/capabilities/structured-outputs)).
- OWASP recommends server-side bounds and rate limiting for operations that
  can consume meaningful resources; this follow-up adds no request, target,
  model selection, or extra probe work
  ([API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)).
- W3C recommends programmatically determinable status messages, with
  `role="status"` providing a polite live-region mechanism for action results
  that do not move focus ([ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22.html)).

## Options considered

| Option | Advantages | Drawbacks |
| --- | --- | --- |
| Return and show the saved model name and endpoint | Gives maximal troubleshooting detail | Broadens provider-configuration exposure and duplicates the settings form. |
| Automatically replace the saved model with a compatible result | Reduces manual steps | Alters routing configuration from advisory evidence and could select an unintended build. |
| Document the boolean only | No UI work | Operators still have to infer whether their saved configuration participated. |
| Show an allow-listed coverage boolean and explicit next step | Explains the result while retaining the existing trust boundary | Does not identify the exact missing tag; the operator must consult saved settings and local Ollama. |

## Recommendation stack

1. Reuse the server-owned `configuredModelIncluded` boolean; do not make an
   additional API request or accept a browser-supplied model identity.
2. Render it only for a completed matrix or a no-local-models result, and only
   when it is an actual boolean. Treat all other values as unavailable.
3. For `true`, direct the operator to the saved capability test. For `false`,
   direct them to confirm that the saved model/tag is installed locally and
   then re-run both checks.
4. Render the dynamic guidance as an atomic polite status message. Keep the
   rest of the response independently allow-listed.
5. Keep the matrix advisory. A current successful saved capability test remains
   the sole admission control for strict candidate-bound verification.

## Security properties

The coverage signal is derived from the already bounded server-side
model-selection step and is returned inside the existing parameter-free,
administrator-only response. The client renders only a recognized boolean and
constant guidance. It neither sends nor displays the saved model, target,
credentials, model output, prompt, error, media, or policy data. It cannot
change AI settings, invoke Ollama, or grant strict-verification authority.
