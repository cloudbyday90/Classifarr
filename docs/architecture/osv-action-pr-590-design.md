# OSV Scanner Action PR 590 assessment

November 21, 2026 Eastern. Approved design assessed at `5c4bfe7b5`.
Random selection from open PRs 590, 592 and 594 chose
[PR #590](https://github.com/cloudbyday90/Classifarr/pull/590).
Its reviewed head was `fcee2fbaab98ae3aadf4cf7d60c3f9449dad880b`.

## Recommended changes

Qualify the published OSV Scanner Action 2.7.1. The upstream annotated tag
resolves to `32d3cd482bdadfb38b186c0ad1b031902d55d932`. Update the direct
Dependabot action, the PR and merge-group reusable workflow references, and
the full-scan workflow reference to that exact commit. Update the reviewed
SHA in the existing security-workflow contract test.

Keep the triggers, invocation arguments, vulnerability gates, permissions and
SARIF paths. Dependabot retains its contents-read-only direct scan. Upstream
also updated pinned artifact actions within the reusable workflows. Its scanner
and reporter still refer to a version-tagged container. The pinned workflow
source alone cannot establish container immutability.

The registry identified the 2.7.1 OCI index as
`sha256:3fa25659351c9a5527b30d73b6f3c2ee0bcac106d6220948211d87379d08f243`.
The Linux amd64 image manifest was
`sha256:46564b2ffec78c2c668afbbb09ff1b6ed4605caeb27d02df9894809cb5b02653`.
Use the exact reviewed platform digest for local scanner controls.

| Approach | Benefit | Cost or limit |
| --- | --- | --- |
| Adopt all four reviewed pins together | Keeps related jobs on the published patch and updates the existing gate contract | The hosted event and SARIF paths still need their own CI observations |
| Retain 2.7.0 | Preserves the previously tested scanner graph | Defers the current publisher patch |
| Move to floating workflow tags | Simplifies dependency updates | Weakens reproducibility and review of the exact workflow source |

## Prior PR results and qualification

- The old Dependabot scan reported an advisory for the server development
  dependency deepmerge. OSV now marks it withdrawn. Keep the repository's
  existing scanner settings and require a fresh result.
  [PR scan log](https://github.com/cloudbyday90/Classifarr/actions/runs/43828981969/job/133169425785)
  · [OSV advisory record](https://osv.dev/vulnerability/GHSA-gcqx-w48m-w2h4)
- The historical build failed the old OSV SHA assertion. The separate synthetic
  replay job failed because its isolated job could not resolve pino. Rebasing
  cannot fix the missing dependency setup. The existing SHA assertion must
  advance with the reviewed version.
  [Build log](https://github.com/cloudbyday90/Classifarr/actions/runs/43828981357/job/133169423848)
  · [Synthetic replay log](https://github.com/cloudbyday90/Classifarr/actions/runs/43828981357/job/133169423729)
- Run the focused security-workflow tests and affected repository quality gates.
  Compare parsed configuration so only the coordinated pins change. Run the
  reviewed scanner image against the current repository lock inputs in an
  isolated local fixture. Report that separately from the exact pushed commit's
  hosted scan. A hosted full scan confirms that path for the push event.
- Leave PR #590 unmerged. Rebase an open Dependabot branch only when the current
  conflict defeats an applicable update. Keep releases and deployments separate.

## Official references

Reviewed through MCP on November 21, 2026 Eastern.

- [Published release](https://github.com/google/osv-scanner-action/releases/tag/v2.7.1)
  · [Immutable action definition](https://github.com/google/osv-scanner-action/blob/32d3cd482bdadfb38b186c0ad1b031902d55d932/osv-scanner-action/action.yml)
- [OSV GitHub Action guide](https://google.github.io/osv-scanner/github-action/)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
  · [Managing Dependabot PRs](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/manage-dependabot-prs)
