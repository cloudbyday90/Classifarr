# PR #539: local CodeQL update outcome

Date: 2026-09-22. Independent of the
[production-company learning change](production-company-learning-outcome.md).

## Selection and design

GitHub MCP listed open PRs #542 and #539. A local random selection chose
[PR #539](https://github.com/cloudbyday90/Classifarr/pull/539).
Its actual current diff contains four CodeQL action references across
`.github/workflows/codeql.yml` and `.github/workflows/trivy.yml`; the broader PR
title is not a reason to change unrelated dependencies.

Apply that exact diff locally: replace
`b96794f015dfd88f77b49b1c93e0fa7110f94c63` with
`1c5b675653bb5c22dbe9b12b556ec555138e09fd` for init, analyze and the two SARIF uploads.
GitHub MCP verified the target in the upstream
[CodeQL action repository](https://github.com/github/codeql-action/commit/1c5b675653bb5c22dbe9b12b556ec555138e09fd),
the September 18 update to v4.38.1. Do not merge the PR or create a release.

## Research and tradeoffs

[GitHub's secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use)
recommends pinning actions to a full commit SHA and verifying its upstream origin.
Keep the existing narrowly scoped workflow permissions, triggers and scanner
failure gates. Do not switch to a floating version tag or broaden token access.

Benefit: current upstream maintenance while retaining immutable action versions.
Cost: action runtime behavior must still be verified on GitHub-hosted runners;
local YAML and contract tests cannot execute the hosted CodeQL service. The
upstream release includes experimental smaller language bundles; this patch does
not opt into an additional experimental feature.

## Local outcome

The exact four references were updated. Actionlint passed, and the security
workflow tests verify the pinned revision, matching action refs, permission
boundaries and retained failure behavior. Application dependencies, runtime
versions, API contracts and user-facing UI are unchanged by this PR patch.

Recommendation: retain immutable pins and the existing security gates. Validate
this commit's hosted CI after push; the preceding main commit's CI completed
successfully, which is not a substitute for this commit's own result.
