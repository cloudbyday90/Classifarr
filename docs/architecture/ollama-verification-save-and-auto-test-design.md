# Ollama verification save-and-auto-test design

## Decision

When an administrator changes the primary Ollama target in **Settings → AI**,
Classifarr uses one explicit action: **Save Changes and Test Strict
Verification**. It saves the selected configuration, then immediately runs the
existing administrator-authorized, fixed JSON-schema verification test against
that saved configuration.

The test remains advisory and fail-closed. A failed or unavailable result
prevents only strict candidate-bound verification from calling AI; it never
rolls back the administrator's valid general-classification configuration,
routes media, changes policy, retries, or accepts a browser-supplied provider
target.

## Problem

The former flow conflated two different states:

1. a draft model selected in the form; and
2. the saved model's verification result.

It then required an extra **Save AI Settings Anyway** action before a model
could become the saved target that the security-bound test is allowed to use.
That made a valid choice appear rejected, and forced an unnecessary second
operator decision.

## Official research basis

Reviewed on 2026-08-29:

- W3C's [ARIA22 status-message technique](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)
  recommends a persistent `role="status"` container, with explicit
  `aria-atomic="true"` when the whole message supplies necessary context.
  The save and test state is therefore visible and announced without moving
  focus.
- W3C's [WCAG 2.1 Success Criterion 4.1.3 explanation](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
  says action results, waiting state, and progress should be programmatically
  available without a context change, while avoiding unnecessarily interruptive
  alerts. The UI uses a polite status region, not an alert or modal.
- W3C's [alert-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/)
  is for urgent, user-acknowledged interruptions. A valid settings save with a
  non-blocking capability result does not meet that bar, so a second approval
  dialog is inappropriate.
- Ollama's [Generate API](https://docs.ollama.com/api/generate) documents
  `format` for JSON schema and `think` as a top-level control. The strict probe
  sends a schema with deterministic temperature and `think: false`; this keeps
  reasoning-model output in the response channel the contract validates.

## Interaction model

1. If the selected primary Ollama host, port, or model differs from the saved
   target, show an identity-free **Unsaved Ollama change** status. It states
   exactly what Save does: persist, then run a media-free test.
2. Make the primary control's label match that action:
   **Save Changes and Test Strict Verification**.
3. After the server confirms the save, set a visible status to **Saved Ollama
   configuration — testing strict verification** and invoke only the existing
   saved-configuration test endpoint.
4. Render the fixed server-projected outcome in the same status region and
   existing capability card. A failure gives an actionable next step without
   blocking general AI configuration.
5. A runtime model-digest mismatch that occurs outside this explicit save flow
   remains manually re-testable. Automatically probing an out-of-band model
   change could repeatedly call an unintended local model.

## Options

| Option | Pros | Cons |
| --- | --- | --- |
| Keep a confirmation gate | Makes degraded capability conspicuous | Creates the redundant second decision and hides the draft-versus-saved distinction. |
| Auto-probe every runtime mismatch | Minimal operator work | Unbounded and potentially unintended provider traffic. |
| **Save once, then auto-test that saved target** | One clear administrator intent, uses the authoritative saved configuration, preserves fail-closed admission | The save operation waits for the bounded test and reports a separate outcome. |
| Browser-probe the draft target | Fast apparent feedback | Would bypass saved-configuration identity, authorization boundaries, and the server-owned capability record. |

## Security and accessibility properties

- The browser never supplies a host, model, prompt, or schema to the strict
  test. The server reads the just-saved configuration.
- A capability failure cannot block a valid settings save or silently enable
  strict verification.
- The UI does not expose endpoint, model, digest, raw provider output, prompt,
  media, or error data in the draft/status messages.
- The status region exists before its text changes and uses `role="status"`,
  `aria-live="polite"`, and `aria-atomic="true"`; it neither steals focus nor
  uses an inappropriate assertive alert.
- Qwen reasoning is disabled only for the bounded strict JSON-schema probe.
  Normal classification behavior remains unchanged.

## Final recommendation stack

1. Keep provider capability admission and verification results server-owned.
2. Treat an administrator's save as the sole configuration decision; do not
   require a second acknowledgement of an advisory result.
3. Automatically test only the configuration just saved by that action.
4. Use an accessible, persistent status region to explain draft, testing, and
   result states.
5. Retain manual re-test for runtime drift and all failed/unavailable outcomes.
6. Use Ollama's documented top-level `think: false` only for the fixed strict
   contract, alongside the JSON schema.

## Next item

Validate the end-to-end save-and-auto-test flow against the local compose
deployment with a saved Qwen reasoning model and a saved Gemma model, then
confirm the capability card and aggregate verification history update together.
