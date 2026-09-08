# Held-out semantic policy source-screen outcome

Status: implemented, unreleased. See the separate
[design](held-out-semantic-policy-source-screen-design.md) for the rationale,
research, alternatives, and recommendation stack.

## Delivered

- Added `heldOutSemanticStudyPolicySourceScreen.mjs`, a pure ESM source-boundary
  service that excludes only rules that are both `media_server_library_profile`
  and `inferred`.
- Corrected held-out preparation so an operator-declared native rule with an
  `inferred` contract lifecycle state remains eligible for the restricted
  deterministic screen.
- Added the private `policySourceScreen` aggregate to the v2 eligibility audit
  and its configuration-drift check. It reports fixed counts and a status ID;
  no library, policy, rule value, metadata, title, identity, score, prompt, or
  semantic output is retained.
- Its terminology and the enclosing audit version are corrected by the
  separate [contract outcome](held-out-semantic-policy-source-contract-outcome.md).
- Added focused regression tests for profile exclusion, operator-declared rule
  retention, receipt redaction, and audit integration.

## Real local audit

The rebuilt local Compose image at `fa241a9b` completed the private read-only
audit on 8 September 2026. It found 6,639 canonical identities beneath the
8,000-case cap: 331 documentary, 5,232 genre-overlap, 833 ordinary, and 243
reality records.

The aggregate source screen reported ten active policies and 15 declared
purpose rules. All 15 were inferred profile rules, zero purpose rules remained
after the study boundary, and all ten policies had no retained purpose rule.
Its fixed status was `all_purpose_rules_excluded_as_inferred_profile`.

Consequently, the decision audit remained `manual:none` and
`not_pending_policy_decision` for all 6,639 records, with zero ready cases in
every stratum. The result contains no evidence that retained policy rules failed
against metadata: none existed under the intentionally restricted screen.

The command used PostgreSQL read-only defaults and performed no semantic
retrieval, provider call, policy edit, database write, routing, label
collection, readiness check, or frozen-study preflight. Its redacted local
receipt remains ignored under `.tmp/`.

## Verification

- Focused service and audit tests: 21 tests passed.
- Backend typecheck, security lint, test lint, documentation lint, static ESM
  import check, and client production build passed.
- Full backend unit suite: 1,118 suites and 32,057 tests passed.
- A no-cache Compose rebuild from clean `fa241a9b` completed, recreated the
  service, and passed its health check. The running container's OCI revision is
  `fa241a9bc8b180e9dad056862f520204dcf1489a`.

The repository-wide copyright check still flags four pre-existing files outside
this change: one Vue component and three 5 September migrations. All files
introduced here contain the project copyright header.

GitHub's public pull-request page showed no open pull requests on 8 September
2026. There was no random open PR to implement locally, and no closed or merged
PR was substituted.

## Next item

Extend the existing administrator-only policy-purpose coverage review with the
same count-only provenance distinction: profile-only purpose, retained declared
purpose, and absent purpose. It should reuse the current server-side static
review, expose no rule values, and remain advisory. That gives policy authors a
low-input explanation before any separately approved explicit-purpose revision.
After such a revision, rerun the private audit before attempting cohort capture;
independent labels, readiness, frozen-study preflight, and review-only semantic
counter-evidence remain separate gates.
