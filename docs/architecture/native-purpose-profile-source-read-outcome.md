# Native Purpose Profile Source Read Outcome

Status: verified locally on 8 September 2026. See the separate
[design](native-purpose-profile-source-read-design.md) for rationale,
research, alternatives, and the recommendation stack.

## Delivered

- Added the ESM `policyNativeIntentPurposeChangeStoredRuleAdapter` service to
  whitelist only editable purpose fields from stored active rules.
- Updated the narrow administrator purpose-change read service to canonicalize
  that server-side projection and omit `source` and `inference_state` from the
  returned draft.
- Preserved the existing administrator authorization, advisory coverage
  preflight, revision check, idempotent transaction, audit event, and
  server-owned native-intent provenance write.
- Added unit and PostgreSQL integration coverage that starts from a
  profile-derived stored rule and proves an explicit later change persists the
  existing canonical native provenance without replaying profile provenance.

## No-Cache Compose Verification

`npm run docker:smart:provenance-rebuild` rebuilt the image with
`docker compose build --no-cache`, required image provenance, recreated the
service, and waited for health. The healthy container carried OCI revision
`5d38dc5d591233fec4d8d19e9ffed09bdd024e9e`.

A private in-container check read the count-only purpose coverage review, then
asked the purpose-change read service for each profile-only policy. It printed
only aggregate counts, response status IDs, and redaction flags. It did not
print rule values, policy or library names, profile observations, media,
identifiers, provider data, or user data.

| Measure | Result |
| --- | ---: |
| Reviewed policies | 10 |
| Profile-only purpose policies | 10 |
| Available purpose-change drafts | 10 |
| Drafts that withhold stored provenance | 10 |
| Database writes | 0 |
| Routing changes | 0 |
| Coverage response version | `policy_purpose_coverage_review.v3` |

The repair makes the existing low-input maintenance path available: an
administrator sees a typed current-purpose draft, reviews it, may request the
existing advisory preflight, and must explicitly submit a new revision. It
does not convert profile evidence into a declaration and it does not change
any policy during read or preflight.

## Verification

- Focused purpose-change adapter, read-service, and preflight tests: 14
  passing tests across 3 suites.
- PostgreSQL native-purpose-change integration test: 1 passing suite.
- Full backend unit suite: 1,120 suites and 32,096 tests passed.
- Server lint and typecheck, repository Markdown lint, static ESM import
  check, and client production build: passed.
- Fresh no-cache Compose rebuild and health check: passed.

GitHub's public pull-request page showed zero open pull requests on 8 September
2026. No random pull request was available to implement locally, so no closed
or merged pull request was substituted.

## Next Item

Use the existing administrator purpose-change surface only where an operator
can explicitly stand behind the displayed purpose. Rerun the count-only
coverage review and private eligibility audit after any approved revision. A
real 24–32-case frozen cohort remains the next evaluation work only when those
gates report policy-only eligibility; it still requires independent labels,
readiness, and frozen-study preflight. Measured semantic counter-evidence may
then refer ambiguous cases to review, never route them automatically.
