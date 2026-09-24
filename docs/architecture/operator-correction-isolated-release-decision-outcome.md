# Isolated release decision replay — outcome

The companion [design](operator-correction-isolated-release-decision-design.md)
records the contract, alternatives, security boundary, sources, and
recommendation stack.

## Delivered

- Strict ESM input validation and SHA-256 fingerprinting for a bounded,
  score-level movie/TV decision cohort. Correction labels never enter the
  worker payload.
- A dedicated ESM worker that invokes the archived or current policy
  evaluator's decision path with precomputed candidate scores, no provider
  retrieval, and no live evidence source. Failures become typed dispositions
  without echoing private errors.
- A disposable Docker runner that verifies the pinned tag and clean checkout,
  stages archived release source, executes two no-network/read-only/non-root
  containers, validates their output, writes private pair artifacts, and
  reports aggregate changes only. No live data, routing settings, learning
  records, schema, or release was changed.
- A committed synthetic fixture and unit tests for input rejection, label
  separation, one-to-one pairing, output validation, and container flags.

## Verification and limits

The synthetic two-case run executed successfully in separate local containers:
one movie destination agreed with its synthetic label in both versions, and
one TV case abstained in both. This is a mechanics smoke, not a measured
improvement. The local image ID is reported but dependency equivalence to the
release remains unverified. Scores were supplied to the worker, not produced
by either classifier; no real correction cohort was evaluated. The existing
pair report deliberately retains `fullPipelineAccuracy: null` and
`promotionAllowed: false`.

The full backend unit suite passed (1,401 suites; 41,039 tests). The
disposable-database integration suite passed (149 suites; 1,718 tests;
one skipped). Server lint, type checking, dependency checks, static-import
checking, copyright, Markdown lint, diff whitespace, and the coverage ratchet
passed. None of these tests is interpreted as classification-quality evidence.

The connected GitHub repository search returned no open pull requests on
September 24, 2026, so there was no random PR to implement or merge.

## Next high-value item

Version and freeze the **evidence inputs**, not just candidate scores: build
an isolated, read-only release-schema adapter for policy scoring, fold-local
inventory evidence and held-out correction cases, then run both actual
classifiers on the same provenance-screened private cohort. The adapter must
verify released dependency versions, protect against provider and write
fallback, and report coverage and failures before any quality claim.
