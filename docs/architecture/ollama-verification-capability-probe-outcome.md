# Ollama Verification Capability Probe Outcome

## Status

Implemented on 2026-08-28; included in the next unreleased commit. No release
was created by this work.

## Delivered Outcome

The platform can now admit a saved primary Ollama configuration to strict,
candidate-bound verification after it passes an explicit JSON-Schema probe. A
configuration that has not passed remains usable for ordinary AI proposals but
does not receive verification authority.

This fixes the prior confusing behavior where a confirmation policy stopped
before any Ollama request while AI Settings gave only a generic
provider-capability warning.

## Implementation

- Added modular identity, presentation, probe, repository, and orchestration
  services under `server/src/services/ollamaVerificationCapability*.mjs`.
- Added migration
  `20260828_100000_add_ollama_verification_capability_state.sql`. It adds only
  bounded status fields to the existing singleton provider configuration; it
  does not migrate or infer a successful result for existing installations.
- Added administrator-protected `POST
  /api/settings/ai/verification-capability/test`. It ignores browser-supplied
  provider configuration and tests only saved server state.
- Extended the existing `GET /api/settings/ai/verification-capability` result
  with an identity-free `ollamaVerificationCapability` presentation for the
  saved primary provider.
- Added a Settings action and accessible status card for existing Ollama
  configurations. A status refresh remains read-only; only the named test runs
  a generation.
- Extended provider authority to accept a server-built, current, tested Ollama
  evidence record. Fallback Ollama remains advisory even after a successful
  primary test.
- Corrected streamed Ollama generation so it preserves the requested JSON
  Schema. Strict verification additionally passes the expected model digest to
  preflight, preventing a changed model tag from reusing old capability proof.

## Security Properties Preserved

- The test prompt contains no media, library, policy, or user data.
- The test response is parsed in memory and discarded; only bounded result
  fields are persisted.
- No raw endpoint, model, credential, provider error, prompt, or response is
  emitted by the capability status API.
- A probe executes before, not inside, the persistence transaction. The write
  rechecks identity under lock and returns a conflict if settings changed.
- An expired, invalid, changed, unavailable, malformed, or fallback result
  never grants `verification` authority.
- Candidate-bound verification still only confirms or abstains on the
  deterministic server-selected candidate. It is not an automatic routing
  permission.

## Test Evidence

Focused automated coverage validates:

- current and stale identity resolution;
- fixed-probe schema parsing and no raw-output retention;
- no generation after failed endpoint/model preflight;
- remote probing outside the persistence transaction;
- provider authority admission only for tested non-fallback Ollama;
- current-capability preflight projection without provider identity leakage;
- schema and model-digest propagation through streamed Ollama generation;
- protected settings-route registration and bounded probe response;
- AI Settings action rendering and client API request shape.

The final validation run is recorded in the commit handoff rather than this
design outcome document.

## Operator Workflow

1. Save Ollama as the primary AI provider with its intended model.
2. Open **AI Settings → Candidate-Bound Verification**.
3. Select **Test Ollama Verification**.
4. If it reports ready, retry a pending confirmation item; Classifarr can now
   invoke Ollama for the candidate-bound verification step.
5. If it reports classification-only or unavailable, ordinary classification
   remains available, while confirmation policies continue to require manual
   review.

Any AI settings save, model/endpoint change, stale result, or changed model
digest requires a new test before strict verification can run.

## Follow-On Item

Add an operator-visible runtime notice for a model-digest mismatch that occurs
between a successful test and a verification request, then aggregate these
bounded failures by status code. This will make model retags and repeated local
availability issues actionable without retaining media or model output.
