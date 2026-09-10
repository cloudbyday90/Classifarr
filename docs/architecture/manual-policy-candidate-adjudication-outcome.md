# Manual Policy Candidate Adjudication Outcome

Status: implemented and locally verified on 10 September 2026. No release is
created by this change.

## Delivered

- Extended the existing candidate-adjudication contract to admit a `manual`
  policy outcome only when it already has two or three server-owned, active,
  same-media candidates.
- Extended deterministic AI-mode selection so an eligible weak manual outcome
  calls the existing `adjudicate` path. A hard manual-review diagnostic or an
  insufficient contract remains provider-free.
- Reused the existing minimized current-library RAG evidence, provider
  response validation, persistence projection, concise decision presentation,
  and operator-confirmation flow. No new API, storage, migration, browser
  action, or routing authority was added.
- Recorded a distinct mode reason,
  `manual_candidate_adjudication_ready`, so telemetry distinguishes an
  advisory comparison for weak evidence from an ambiguous
  `prompt_select` comparison.

## Local finding addressed

The live Compose database had ten active policies, all with profile-derived
purpose rules. *Deep Water* had a weak manual policy outcome after its own
same-item semantic identity was correctly excluded from corroboration. Before
this change, manual mode stopped before the existing bounded candidate
comparison. Eligible future retries now reach that comparison while preserving
the manual routing safeguard.

## Verification

Focused backend tests passed locally:

```text
6 test suites passed
38 tests passed
```

The coverage includes manual candidate-contract admission, manual-mode
adjudication, insufficient-candidate refusal, hard-manual-safeguard refusal,
bounded candidate delivery to AI, and preservation of
`needs_clarification: true`.

The complete backend suite also passed:

```text
1,168 unit suites passed; 33,365 unit tests passed
132 integration suites passed; 1 integration suite skipped
1,582 integration tests passed; 1 integration test skipped
```

Type checking, the server security lint, documentation lint, static ESM import
check, and the production client build passed. A no-cache Compose build was
then recreated successfully. The container reported healthy and an in-image
probe confirmed that a manual result with two policy-owned movie candidates
produces `mode: adjudicate` and `shouldInvoke: true`.

## Pull request check

GitHub's official pull-request API returned no open pull requests for
`cloudbyday90/Classifarr` on 10 September 2026. There was therefore no random
open PR to implement locally; no closed, merged, or invented change was
substituted.

## Next item

The next high-value component is a compact **library purpose bootstrap**:
present one clear, revision-checked “what belongs in this library?” declaration
for each policy, with profile-derived terms as optional suggestions rather than
as the main editor. That gives RAG and AI a real policy-owner baseline,
reduces the current UI density, and avoids treating current contents as the
definition of the collection.
