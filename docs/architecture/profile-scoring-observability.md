# Profile Scoring Observability

## Scope

This design covers profile scoring observability for policy classification. The goal is to make profile contribution explainable end to end: rating normalization, profile distribution matches, genre/keyword contributors, and exclusion hits should be visible from the persisted classification record without rerunning scoring against a later profile state.

## Research Basis

Official references reviewed for the May 2026 design pass:

- OpenTelemetry semantic conventions: https://opentelemetry.io/docs/concepts/semantic-conventions/
- OpenTelemetry logs data model: https://opentelemetry.io/docs/specs/otel/logs/
- W3C Trace Context: https://www.w3.org/TR/trace-context/
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework
- GitHub Dependabot version update guidance: https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-version-updates
- npm install and lockfile behavior: https://docs.npmjs.com/cli/v11/commands/npm-install/
- GitHub Actions secure use guidance: https://docs.github.com/en/actions/reference/security/secure-use
- GitHub Actions Node 20 deprecation notice, updated May 19, 2026: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/

## Recommendations

### 1. Persist Score Explanations With the Decision

Record profile scoring diagnostics in `classification_history.metadata.classification_details.candidate_diagnostics.profile_scoring`.

Pros:

- The operator sees the exact rating normalization and score deltas used at classification time.
- Later profile regeneration does not rewrite the explanation of an older decision.
- It aligns with OpenTelemetry's model of structured event attributes and with the NIST AI RMF expectation that AI-assisted decisions remain governable and reviewable.

Cons:

- Classification metadata grows slightly.
- The diagnostic schema must stay stable enough for older history rows to remain readable.

Final recommendation: persist a bounded, versioned diagnostic object with scalar values and short arrays only.

### 2. Keep Diagnostics Structured and Sanitized

Do not write prompts, raw overviews, full metadata payloads, secrets, headers, or unbounded distributions into diagnostics. Keep fields limited to normalized rating, profile percentages, score deltas, contributor lists, and exclusion hits.

Pros:

- Keeps logs and persisted metadata safe to inspect in support workflows.
- Reduces accidental sensitive-data disclosure and log injection risk, consistent with OWASP logging guidance.
- Keeps the History view fast and predictable.

Cons:

- Deep forensic analysis may still require database access to library profile snapshots.

Final recommendation: use `schema_version`, `available`, `media_type`, `raw_score`, `final_score`, `rating`, `genres`, `keywords`, and `exclusions` only.

### 3. Use Correlation Later, Not a New Telemetry Stack Now

The current implementation should persist decision diagnostics first. A later pass can add request/trace correlation using W3C `traceparent` semantics and OpenTelemetry-compatible names.

Pros:

- Fixes the operator visibility issue immediately.
- Avoids adding a new runtime dependency or collector requirement before there is a stable event schema.
- Leaves a clear path to traces and structured logs.

Cons:

- Cross-request tracing is still manual until correlation IDs are added.

Final recommendation: defer full OpenTelemetry instrumentation until after classification decision records have stable diagnostic schemas.

### 4. Maintain Supply-Chain Updates as Normal Code Changes

Open Dependabot PRs should be evaluated by reading their changed files, applying equivalent package and pinned workflow updates locally, and then running server/client verification.

Pros:

- Keeps dependency updates visible in the same commit as compatibility fixes.
- Preserves pinned GitHub Action SHAs.
- Follows GitHub's recommendation to review release notes/changelogs and verify tests before merging automated updates.

Cons:

- Requires manual lockfile reconciliation when multiple Dependabot PRs touch the same workspace.

Final recommendation: apply dependency PR equivalents locally when the worktree already contains related changes, then validate with package-manager lockfiles and CI-equivalent tests.

## Implemented Outcome

- `libraryProfileComputations` now computes profile score diagnostics from the same pass that computes `rawScore` and `finalScore`.
- `libraryProfileService.getProfileScoreDetails()` returns the numeric score plus a bounded diagnostic object. Existing `getProfileScore()` remains compatible and returns only the final score.
- `SignalCollector` attaches `profile_diagnostics` to profile signals when available.
- Policy evaluation records `candidate_diagnostics.profile_scoring` for each ranked candidate when the profile scorer runs.
- The History detail modal renders a Profile Scoring Detail panel from persisted classification metadata.
- Open Dependabot PR equivalents were applied locally:
  - Server tooling: `eslint` 10.4.1 and `knip` 6.15.0.
  - Client tooling: `@vitest/coverage-v8` 4.1.8, `eslint` 10.4.1, `vite` 8.0.16, `vitest` 4.1.8, and `vue-tsc` 3.3.3.
  - Client runtime: `vue` 3.5.35 and `vue-router` 5.1.0.
  - GitHub Actions: refreshed pinned SHAs for QEMU setup, CodeQL, SARIF upload, and Gitleaks.

## Diagnostic Schema

```json
{
  "schema_version": 1,
  "available": true,
  "media_type": "tv",
  "raw_score": 45,
  "final_score": 95,
  "rating": {
    "input": "16",
    "normalized": "TV-MA",
    "distribution_percent": 72,
    "score_delta": 30,
    "matched": true
  },
  "genres": {
    "input_count": 2,
    "matched": [
      { "value": "Comedy", "distribution_percent": 30, "score_delta": 9 }
    ],
    "unmatched": ["Workplace"]
  },
  "keywords": {
    "input_count": 1,
    "matched": [
      { "value": "office", "distribution_percent": 18, "score_delta": 5 }
    ],
    "unmatched": []
  },
  "exclusions": {
    "ratings": [],
    "genres": [],
    "keywords": []
  }
}
```

## Security Notes

- Diagnostic arrays are capped to avoid unbounded metadata growth.
- Profile diagnostics avoid raw prompt text, full metadata payloads, auth data, URLs, headers, and free-form model output.
- Values rendered in Vue remain normal escaped template values.
- GitHub Actions updates preserve pinned SHA usage rather than switching to mutable tags.

## Follow-Up Design Items

1. Post-upgrade task observability: add an admin-visible post-upgrade task ledger with task id, version gate, guard result, affected rows, and last error so data repairs are auditable without PostgreSQL access.
2. Profile health dashboard: expose stale profile detection, profile age, item count, enriched count, rating bucket health, and one-click profile regeneration per library.
3. Policy decision replay: build an offline replay endpoint or CLI that re-evaluates a classification from persisted metadata and shows pass/fail drift against current policies, profiles, RAG matches, and history evidence.
