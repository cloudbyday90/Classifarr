# PR #531: local CodeQL action update

## Selection and source

On 2026-09-19, the GitHub MCP service listed open PRs #531, #532, #535 and #536.
A uniform `node:crypto.randomInt(4)` draw selected
[PR #531](https://github.com/cloudbyday90/Classifarr/pull/531).
Its inspected head was `bd15cc6129e90256ba1f80a8c214e10ed4a4fd4f`.
The patch was applied locally; no PR merge, close or comment was requested or made.

## Design and implementation

Update four action uses in `codeql.yml` and `trivy.yml` from
`cdf488f595d80d6e07e03d4674febd5ab45fa938` to
`b96794f015dfd88f77b49b1c93e0fa7110f94c63`:
CodeQL initialization, analysis and two SARIF uploads.

The official [CodeQL v4.38.0 release](https://github.com/github/codeql-action/releases/tag/v4.38.0)
was published on 2026-09-09. Following its tag through the official GitHub API
resolved annotated tag `4bd7200e1f146b1c937cae12d258b50f41a53cf8` to that exact
commit. This verifies upstream origin; the tag itself is unsigned, so this is not
a claim of cryptographic signature verification.

Full-SHA pins follow [GitHub Actions security guidance](https://docs.github.com/en/actions/reference/security/secure-use).
All existing triggers, scan gates, JavaScript/TypeScript and Actions analysis,
timeouts, and job-level permissions remain unchanged. No runtime dependencies,
application version, releases or tags change.

## Pros, cons and recommendation

- Benefit: upstream scanner improvements with an immutable, verified repository
  revision and one consistent version for analysis and uploads.
- Cost: scanner/runtime behavior changes cannot be fully reproduced by parsing
  workflow YAML locally; hosted CodeQL/SARIF execution still needs GitHub Actions.
- Recommendation: retain the update, run the local workflow contract regression
  alongside application tests, and check the pushed commit's security workflows.

## Outcome

The new workflow regression verifies all four full-SHA references agree, job
permissions remain limited, no `pull_request_target` trigger appears, both CodeQL
languages and extended queries remain enabled, and the Trivy failure gate remains.
It passed locally. Full application and Compose results are recorded in the
[neighborhood backfill outcome](neighborhood-backfill-outcome.md).

The preceding commit's CI/CD, CodeQL, Gitleaks, Copyright, OSV and Trivy push runs
all succeeded. A separate Dependabot dependency-update maintenance run failed;
it is not an application CI failure or evidence that this scanner patch failed.

Rollback is a new commit restoring the previous four pins. No data restoration
or database migration is required. Applying the code locally does not merge the
original PR, even if Dependabot subsequently recognizes the equivalent changes.
