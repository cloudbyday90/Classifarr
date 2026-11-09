# GitHub Actions PR 582 local adoption design

Date: 2026-11-09 Eastern. Status: agreed; observed results are recorded separately.
No PR merge, release, publication login, promotion or deployment is authorized.

## Selection and immutable subject

Fresh open-PR intake found five candidates, 582 through 586, all mergeable with
UNSTABLE checks. A uniform node:crypto.randomInt selection at
2026-11-09T09:59:30.290Z chose [PR 582](https://github.com/cloudbyday90/Classifarr/pull/582),
head 69f898ef61193ebe90a2f25d47977d34e80b257c. The connected GitHub service
retrieved its exact patch. A general issue-search wrapper returned ordinary
issues despite PR qualifiers, so repository-specific PR intake used the GitHub
CLI fallback rather than treating that response as the PR population.

The patch changes eight references across four workflows:

| Action | Old release | Candidate | Exact candidate revision |
| --- | --- | --- | --- |
| docker/login-action | 4.7.0 | 4.8.0 | 8aa5831fb8d48d8f76594c7ddde61ae58019f550 |
| github/codeql-action init/analyze/upload-sarif | 4.39.1 | 4.39.3 | 33d7b85da1a04171e211befe2c739303b9a4c066 |

Official MCP tag/source reads establish these revisions in their upstream
repositories. The CodeQL annotated tag dereferences to the proposed commit, but
its tag object is unsigned; this is not signed-provenance verification.

## Reviewed upstream changes and local applicability

- [Docker Login 4.8.0](https://github.com/docker/login-action/releases/tag/v4.8.0)
  updates its Docker Hub OIDC lifetime default and upstream toolkit/AWS packages.
  Its exact [Docker Hub implementation](https://github.com/docker/login-action/blob/8aa5831fb8d48d8f76594c7ddde61ae58019f550/src/dockerhub.ts)
  selects OIDC only with a configured connection-ID environment variable, no
  password and a Docker Hub registry. All four affected Classifarr login steps
  pass explicit credentials; retain that behavior. An empty/missing secret is
  not assumed to be a configured nonempty token.
- [CodeQL 4.39.2](https://github.com/github/codeql-action/releases/tag/v4.39.2)
  changes the default bundle to 2.27.4 and includes deprecation/compatibility
  changes. Classifarr uses Linux JS/TS and Actions analysis, with no selected old
  tools version, macOS tracing or removed TRAP-cleanup option.
- [CodeQL 4.39.3](https://github.com/github/codeql-action/releases/tag/v4.39.3)
  fixes diff-informed filtering for paths containing spaces, special characters
  and non-ASCII characters. Check the exact candidate's own remote scan; local
  YAML tests cannot prove upstream analysis results.

## Proposed local batch

Adopt the four workflow patches on main with full immutable SHAs and exact
release comments. Update only the corresponding reviewed SHA expectations in
checkReleaseImagePromotionWorkflow.mjs and securityScanWorkflows.test.mjs.
Preserve their assertions and mutation tests; do not weaken a validator to make
the new workflow pass.

Keep every trigger, permissions object, credential expression, runner, environment,
concurrency setting and publication dependency unchanged. In particular retain
tag-only release publication, tag/input binding for promotion, the protected
release-publication environment, digest/provenance acceptance and the local
Docker Hub pull-auth action used by normal main CI. Updating the four publication
logins does not update that separate pull-auth action.

Retain CodeQL's language matrix, security-extended queries and SARIF categories;
retain Trivy's exit-1 severity gate, upload conditions and least-privilege scopes.
Add no continue-on-error, scanner exclusion, new secret or id-token permission.
No npm manifest, lockfile, install policy or application runtime is changed.

## Verification and limits

Run the existing release-provenance and release-candidate-publication contract
checks and the security/promotion/publication/provenance/pull-auth mutation suites.
Verify all eight reference changes and exactly the two assessed expectation changes.
Keep wrong digest, extra permissions, changed credentials, missing admission and
failure-bypass mutations rejected. Run affected quality and fresh backend coverage
with the independent runtime batch. Reuse client evidence only after unchanged
source, installed graph and report hashes; do not claim a fresh client run.

After the authorized main push, inspect the exact new commit's CodeQL, Trivy,
OSV and CI receipts. Main CI intentionally skips publication login steps, so it
cannot establish live authentication/logout success for those updated steps.
Do not publish a tag or trigger a publication login/promotion to obtain such
evidence. Normal CI's existing pull authentication stays separate and unchanged.
Record that limitation in the separate outcome.

Leave all PRs unmerged. Recheck actual mergeability at delivery and rebase only
genuinely stale applicable branches. An advancing base or UNSTABLE checks alone
does not prove a conflict. Other package/action groups remain separate.

## Security research, alternatives and recommendation

[GitHub's current secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use)
requires attention to action source and secret exposure; direct SHA pinning is
the existing boundary retained here. Its newer
[workflow dependency lockfiles guidance](https://docs.github.com/en/actions/concepts/security/workflow-dependency-lockfiles)
describes a stronger, machine-generated inventory covering transitive action
dependencies and repository identity. Assess that separately with existing exact
workflow validators; this patch does not adopt a lockfile or relax SHA pins.

| Option | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Retain current pins | No changed action behavior | Misses current scanner fixes and action updates | Baseline only |
| Adopt exact reviewed PR pins | Refreshes dependencies and fixes scanner filtering | New default bundle; live publication logins remain unexecuted | First batch |
| Replace pins with floating major tags | Less manual pin churn | Mutable execution reference | Reject |
| Introduce workflow dependency lockfiles now | Covers transitive action identity | Separate onboarding and contract changes | Assess in a later CI security batch |

Recommend the bounded exact-pin adoption, existing contract checks and exact-source
remote scans. Document design/outcome separately, update Unreleased and commit/push
on main together with the agreed runtime correction. No release or deployment.
