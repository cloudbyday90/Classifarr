# Ollama verification save-and-auto-test outcome

## Delivered behavior

AI Settings now differentiates an unsaved primary Ollama target from the
current saved verification state. An identity-free **Unsaved Ollama change**
status explains that a single save action will persist the selection and run a
media-free strict-verification test.

The previous blocking **Save AI Settings Anyway** path is removed. After a
successful AI-settings save, a changed saved Ollama target is automatically
tested through the existing saved-configuration endpoint. The screen presents
testing and final result states with an accessible polite status region. A
failed test remains fail-closed for strict candidate-bound verification while
leaving general AI classification available.

## Qwen compatibility correction

The Ollama request builder now forwards an allow-listed `think` value at the
top level documented by Ollama. Both the saved capability probe and bounded
compatibility matrix send `think: false` with their fixed JSON schema. This
allows reasoning models such as Qwen 3.5 to return the strict JSON response in
the response field being validated, without altering ordinary classification
generation.

## Verification evidence

- AI Settings unit coverage verifies the one-step save flow, absence of a
  preflight confirmation, automatic saved-target test, visible result, and
  non-disclosure of an injected private endpoint.
- Server tests verify that `think: false` is allow-listed at the documented
  request level and that both strict verification probes include it.
- A no-cache local-compose rebuild completed successfully. The browser flow
  saved Qwen 3.5, automatically completed strict verification successfully,
  then restored Gemma 4 and automatically completed the same strict test.
  Neither run presented the former second save confirmation.

## Security outcome

- The only automatic provider call follows an authenticated administrator save
  and can target only the configuration already persisted server-side.
- No draft configuration data or provider output is exposed by the status
  messages.
- Strict verification remains fail-closed; a successful probe is still
  required before candidate-bound verification calls AI.
- Runtime drift remains explicit and manual rather than becoming a retry loop.

## Next item

Run the local compose UI flow with the user-selected Ollama model, confirm the
saved capability changes from testing to its final server-projected state, and
then run the full release gates before tagging `v0.48.4-beta`.
