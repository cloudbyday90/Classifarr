# GitHub Actions PR 569 design

Date: 2026-10-27. Open PRs ordered by creation were 569 and 570. PowerShell
`Get-Random -Minimum 0 -Maximum 2` returned index 0, selecting
[PR 569](https://github.com/cloudbyday90/Classifarr/pull/569). The immutable
reviewed head is 448411f504713b581cb471585b3cc7581df68ec2; its base is
6bcaea15c36d09919fd57ffa13f602ae2eace971. Implement its action updates locally
on main and test them without merging or triggering a release.

## Exact update and research

Connected GitHub/search MCP services supplied the PR diff, official release
links and the action metadata at the candidate commits. Official Git tag
references independently resolve to the same commits, including the peeled
CodeQL annotated tag.

| Action | Previous | Candidate | Exact candidate commit |
| --- | --- | --- | --- |
| Docker Login | 4.6.0 | 4.7.0 | 81c6f93d4bc991e510b342a00b419b3bb4efc5c6 |
| CodeQL init/analyze/upload-sarif | 4.39.0 | 4.39.1 | 9b3254085494b55a0f7c4c2b3d2d52cc712ce370 |

- [Docker Login releases](https://github.com/docker/login-action/releases)
  describe scoped credential host handling, explicit ECR settings and dependency
  updates. Existing GHCR/Docker Hub inputs remain unchanged. The exact
  [candidate metadata](https://github.com/docker/login-action/blob/81c6f93d4bc991e510b342a00b419b3bb4efc5c6/action.yml)
  declares Node 24 and a post-action cleanup entry point.
- [CodeQL 4.39.1](https://github.com/github/codeql-action/releases/tag/v4.39.1)
  updates the default bundle to 2.27.3. Exact candidate metadata for init,
  analyze and SARIF upload declares Node 24. Existing affected jobs use hosted
  Ubuntu runners. This metadata check is not a remote runner execution receipt.
- [GitHub secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use?learn=getting_started&learnProduct=actions)
  recommends full commit pinning and least privilege. Keep 40-character commits,
  existing token permissions, event gates, artifact identity checks and failure
  propagation. Do not replace them with mutable major tags.

## Alternatives and recommended stack

| Option | Benefits | Costs / risks | Decision |
| --- | --- | --- | --- |
| Apply exact reviewed commits | Reproducible upstream credential/analyzer updates | Analyzer output and bundled dependencies can change | Recommended |
| Switch to mutable major tags | Less pin maintenance | Future code changes without a reviewed diff | Reject |
| Rewrite workflow permissions or receipt gates | Could redesign CI | Unrelated security/acceptance changes | Keep separate |
| Run release publishing to test login | Exercises registry credentials | External publishing is outside this task | Exclude |

Final stack: exact upstream pins, unchanged least-privilege/event boundaries,
existing workflow mutation and receipt-validation tests, then actionlint.
No application dependency, lockfile, route, API, database or client change is
required by this PR. Update the existing pin assertion as part of its contract;
retain the rejection tests for privileged events, masked failures and mismatched
source/image/run/attempt evidence. No second workflow validator is added.

W3C interaction guidance adds no controls to this workflow-only change. The
separate classification design applies W3C provenance to evaluation evidence.
Local tests do not establish registry login, hosted CodeQL execution, published
image provenance or release readiness. Record actual results separately in the
[outcome](actions-pr569-outcome.md).
