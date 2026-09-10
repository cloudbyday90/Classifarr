# Confirmed-Outcome Purpose Suggestion Outcome

Status: implemented and locally verified on 2026-09-10.

## Delivered

- Added modular ESM server persistence, contract, service, and route modules
  for `GET /api/policies/:id/native-intent/confirmed-outcome-purpose-suggestion`.
- The route requires an administrator, validates the policy ID, uses `no-store`,
  maps missing or non-authoritative policy state safely, and exposes a compact
  read-only result.
- The database read accepts only same-library, same-media-type `genre` evidence
  created by the existing policy-authorized manual-outcome writer. It requires
  at least three confirmations, reads no media items or classification history,
  and limits the source to five rows.
- Added a small client composable that validates the complete allow-listed
  contract. It is automatically loaded only after the existing native-purpose
  authority read succeeds.
- Added one concise card within the existing purpose-review form. It tells the
  administrator that confirmed choices support extra terms and provides one
  action to add those terms to the unsaved draft. Applying the suggestion alone
  cannot call AI, route media, or write a policy.
- The existing coverage review and revision-checked purpose-change workflow
  remain the only mutation path.

## Verification

Passed locally:

- `node ./scripts/run-jest.mjs --runInBand --no-coverage --testPathPatterns="policyNativeIntentConfirmedOutcomePurposeSuggestion|policies-native-intent-confirmed-outcome-purpose-suggestion"` — 4 suites, 11 tests.
- `node ./scripts/run-vitest.mjs run src/__tests__/PolicyNativeIntentPurposeChangeSurface.test.js src/__tests__/api/policiesApi.test.js` — 2 files, 29 tests.
- `npm --prefix server run typecheck`.
- `npm --prefix client run typecheck`.
- `docker compose up -d --build` followed by `GET /health` — healthy with the
  database connected.
- Focused security diff review of the 14 executable changed files — no
  reportable findings. The review confirmed administrator authorization,
  parameterized provenance-filtered reads, minimized response projection, and
  the absence of a suggestion-to-routing or suggestion-to-mutation path.

## Trade-offs

The feature intentionally does not suggest a term for a new or sparsely
confirmed library. That restraint is preferable to reusing library inventory or
policy-generated patterns as independent semantic proof. The UI is simpler
because no result is shown when there is no qualified suggestion; detailed
evidence remains out of the routine workflow.

No GitHub pull request was incorporated: the official repository query found no
open pull requests on 2026-09-10. This satisfies neither a merge nor a local
implementation substitute, so no unrelated code was imported.

## Follow-up

The next high-value component is the measured semantic library-fingerprint
study described in the design document. It is the correct place to make
descriptions, current library context, and RAG embeddings useful—first as
candidate-scoped counter-evidence with independent labels and calibration, not
as an unmeasured automatic routing authority.
