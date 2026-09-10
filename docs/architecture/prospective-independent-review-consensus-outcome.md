# Prospective independent-review consensus outcome

Status: implemented and locally verified on 10 September 2026. No release is
created by this change. See the separate
[design](prospective-independent-review-consensus-design.md) for the research,
trade-offs, and recommendation stack.

## Delivered

- Added a small, pure ESM consensus service for two opaque reviewer
  submissions and a third adjudication submission only where the first two
  disagree.
- Added a strict submission contract: SHA-256 fixture binding, bounded opaque
  IDs, one decision per fixture, no reviewer identity, no media/library text,
  no candidate detail, and no arbitrary fields.
- Composed a completed decision set into the existing independent reference-set
  document, including correct `unanimous` two-reviewer and `adjudicated`
  three-reviewer provenance.
- Added a private offline command that reads project-contained JSON, writes a
  fresh completed artifact exclusively beneath ignored `.tmp/`, and prints an
  aggregate-only receipt. Disagreement or invalid input writes no file.
- Added focused unit and command-level regression tests for agreement,
  disagreement, bounded adjudication, binding mismatch, duplicate submission
  identity, content-field rejection, temporary-output containment, and
  non-writing pending state.

## Result

Classifarr can now receive a real prospective study's independently reviewed
decisions without manually constructing its final reference set. This makes the
existing offline evaluator operational once the current policy lifecycle has
enough genuine candidate comparisons to capture a cohort. It does not claim
that current local policy outcomes, library contents, AI output, or RAG output
are ground truth.

The composer itself was not run against live library cases: the last local
eligibility audit correctly reported zero policy-only eligible comparisons, so
there is no valid cohort to label yet. Synthetic labels were used only in
regression tests and are not evidence of RAG quality.

## Verification

- Focused service and command tests: 2 suites, 8 tests passed through the
  repository's ESM-aware Jest runner.
- The direct Jest binary was intentionally not used for final validation: it
  bypasses the project's ESM bootstrap and fails before tests load. This is a
  test-runner invocation constraint, not an application result.
- Server and client type checks, the production client build, static ESM import
  validation, ESM test-mock-shape validation, server lint, and Markdown lint
  passed.
- The full repository lint completed with no errors. It retains 33 pre-existing
  Vue formatting warnings in the unrelated
  `PolicyPurposeDeclarationWorklist.vue` component.
- The coverage ratchet passed: server coverage is 89.91% statements, 81.13%
  branches, 92.01% functions, and 89.91% lines; the existing client report also
  remains above its ratchet baseline.
- `docker compose build --no-cache` completed, followed by
  `docker compose up -d --no-build --force-recreate --wait`. The local
  `classifarr` service reached `healthy`; unauthenticated
  `/api/system/health` correctly returned `401`.

## Pull-request check

GitHub's official pull-request API returned zero open pull requests for
`cloudbyday90/Classifarr` on 10 September 2026. There was no random open PR to
implement locally, so no closed or merged pull request was substituted.

## Next item

The next high-value component is to make the already automatic passive
eligibility audit surface a **cohort-ready handoff** once native declared
purpose produces enough real two- or three-candidate comparisons. It should
then invoke the existing read-only cohort capture once per fresh eligible state
and present only a compact status in Command Center; it must not call a model,
auto-label, or route media. This turns policy/lifecycle progress into a
hands-off study-ready signal while retaining human independent labelling.
