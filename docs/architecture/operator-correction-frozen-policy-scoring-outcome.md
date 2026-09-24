# Frozen policy-scoring replay — outcome

The companion [design](operator-correction-frozen-policy-scoring-design.md)
records the security boundary, alternatives, research and recommendation.

## Delivered

- Added a v2 private input contract for allowlisted resolved policies,
  query metadata and fold-local profile distributions. Labels are removed
  before the worker boundary; source identities and correction narratives are
  not exported.
- Added read-only, provenance-screened correction capture and a private `.tmp`
  output command, reusing existing grouped holdout and profile construction.
- Extended the isolated pair runner to execute the pinned release and current
  deterministic policy-scoring paths with the same frozen evidence. Preserved
  the v1 score-only replay. Pair reports distinguish these scopes and keep
  full-pipeline accuracy and promotion unavailable.
- Added a synthetic v2 fixture and tests for validation, label separation,
  fold binding, scoring execution and diagnostic-only comparison.

## Verification and limits

The synthetic fixture verifies mechanics only; it is not a correction cohort
or quality benchmark. A private read-only capture depends on a configured,
available local database and embedding representation. No live media was
captured for this change, no threshold changed, and no release was created.
The archived scoring path remains limited to features supported by the
published version. The paired image uses the same dependencies for both
versions, so released-dependency equivalence remains unverified. The report
continues to state `policyAndTrainingProvenanceVerified: false` because a
hand-authored JSON file cannot attest its own training isolation.

The backend unit suite passed with coverage (1,402 suites; 41,096 tests),
the disposable-database integration suite passed (149 suites; 1,718 tests;
one skipped), and the coverage ratchet passed. Capture-specific tests added
after the coverage run also passed in a targeted run. Server lint and
typecheck, dependency checks, static-import checks, copyright, Markdown lint
and whitespace checks passed. These checks establish implementation mechanics,
not classification quality.

From the clean commit, both no-network containers completed the v2 synthetic
fixture with zero worker failures and one review/safety block in each version.
The retained v1 synthetic fixture also completed in both containers: one
matching destination and one abstention. Neither fixture estimates real movie
or TV routing accuracy. The local image ID was recorded in the private runner
report, but dependency provenance was not verified.

The connected GitHub PR search returned zero open pull requests in
`cloudbyday90/Classifarr` on September 24, 2026; no PR was selected or merged.

## Next high-value item

Freeze **retrieval and inventory evidence** per held-out case, attest the
published dependency set, and add a no-network release-schema adapter so both
versions can execute their complete deterministic classification path. Keep
AI/provider behavior separately controlled and compare on real,
provenance-screened movie and TV correction cases before making any routing
quality claim.
