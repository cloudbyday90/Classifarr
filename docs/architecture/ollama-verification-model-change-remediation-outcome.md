# Ollama verification model-change remediation outcome

## Delivered behavior

**Settings → AI → Candidate-Bound Verification** now presents a
**Recommended next step** only when the saved Ollama capability has the exact
server-projected status `model_changed`. Its **Re-test saved Ollama
verification** control emits the existing manual test action. The action stays
disabled while testing and therefore cannot start concurrent tests from this
view.

The card says explicitly that the operator-initiated test runs once against
the saved configuration, does not retry automatically, does not route media,
and does not change routing. For context it displays only the normalized
aggregate mismatch count and last observation time already provided by the
admin-only metrics resource. It does not render model names, digests, hosts,
endpoints, raw errors, prompts, media identifiers, or any unexpected response
property.

Every other capability state keeps the ordinary **Test Ollama Verification**
action. This makes remediation prominent only when it is applicable without
removing the deliberate diagnostic action from normal states.

## Failed GitHub Actions run

Run `33246437717` failed because Knip found one unused named export:
`ollamaVerificationRuntimeMismatchSummaryService`. That singleton was not
needed: the stats route already creates a scoped service with
`createOllamaVerificationRuntimeMismatchSummaryService`. Removing the dead
export resolves the source failure. The release-acceptance readout had then
correctly marked itself blocked because its required repository-validation
dependency had failed; it was not a release-policy problem.

## Verification outcome

- Component tests cover exact `model_changed` gating, manual event emission,
  aggregate normalization, and non-disclosure of injected provider details.
- AI Settings coverage verifies that the contextual action calls the existing
  bounded test API without client-supplied configuration and that the prior
  generic action is replaced only for `model_changed`.
- The local server Knip command covers the removed dead export that failed CI.
- Focused client coverage passed: 3 files / 28 tests. The complete client
  suite passed: 243 files / 3,568 tests.
- The complete server suite passed: 864 unit suites / 25,092 tests and 71
  integration suites / 861 tests; one existing integration suite and test were
  skipped.
- Root lint, server and client type checks, the production client build,
  documentation lint, migration/schema integrity, static ESM imports, both
  Knip modes, and the coverage ratchet all passed locally.
- A completed security diff scan reviewed all five changed executable/test
  files and the supporting authorization/event path. It found no reportable
  vulnerabilities; it did not contact a live Ollama deployment.
- No live Ollama instance, configuration change, migration, tag, or release is
  required for this work.

## Security outcome

- The shortcut is presentational only; it creates no bypass around the
  existing server-side authorization or tested-capability admission path.
- Retesting is explicit rather than automatic, so a mismatch cannot turn into
  uncontrolled provider traffic or an implicit re-admission.
- The UI receives and renders only normalized aggregate context, preserving the
  identity-free operational boundary.

## Open PR check

GitHub MCP was queried on 2026-08-29 for open pull requests in
`cloudbyday90/Classifarr`. It returned none, so no unrelated PR was applied
locally or merged.

## Release status

No release, tag, or version change is created by this work.

## Next recommendation

Add a server-projected, identity-free **queue admission reason** that
distinguishes “no eligible worker” from “strict Ollama verification is blocked
because the saved model changed.” Render it beside a queued classification with
a link to **Settings → AI**. It must remain diagnostic only: no provider call,
automatic retry, model detail, or routing decision change.
