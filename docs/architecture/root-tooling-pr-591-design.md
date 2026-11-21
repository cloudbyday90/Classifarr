# Root tooling PR 591 assessment design

November 21, 2026 Eastern. Approved assessment. PR #591 was drawn at random
from open PRs 590, 591, 592 and 594. Its head at review was
`09da0622138d49bc121e81aa8251931bc5f80adb`. The diff is limited to the root
manifest and lockfile. [Dependabot PR #591](https://github.com/cloudbyday90/Classifarr/pull/591)

## Recommendation

Assess the PR's exact Axios 1.21.1 and Markdownlint 0.42.1 pins. Compare the
published Markdownlint 0.42.2 patch too, and prefer it if the real runner
controls pass. The newer patch updates MD052 and accepts null-prototype
configuration objects. Both updated Markdownlint versions declare exact
RE2JS 2.9.1 and require Node 22 or later. Installed Node 24.22.1 and npm
12.2.2 fit the reviewed dependency engines. Leave server and client
manifests and their independent graphs alone.

Root Axios 1.21.0 already resolves follow-redirects 1.16.2 via an exact
override. Axios 1.21.1 raises its upstream minimum to 1.16.2 and has timing
and declaration changes. Keep the existing redirect override. Apply the
Markdownlint update and retirement of its 2.8.7 RE2JS override together
only after the declared 2.9.1 graph passes dependency and runner checks.
Retain all other overrides, installer policies and scanner settings.

| Option | Benefit | Cost or limit |
| --- | --- | --- |
| Adopt tested PR pins | Matches Dependabot's proposed versions | The PR holds RE2JS below Markdownlint's declared version and the Markdownlint patch has been superseded |
| Adopt the PR's Axios and tested Markdownlint 0.42.2 | Uses the current compatible root patch graph and retires a narrow workaround | Requires explicit lockfile and lint-diagnostic review |
| Keep current packages | Preserves previously tested tooling and both overrides | Delays upstream fixes and requires keeping the workaround |

## Sources and verification

Use official sources retrieved through MCP and the public npm registry.
The root audit at intake reported zero findings across production and
development dependencies. The registry identified Markdownlint 0.42.2 as
latest on November 21. Audit each proposed graph before adoption.

- [Axios 1.21.1 release](https://github.com/axios/axios/releases/tag/v1.21.1)
- [Markdownlint 0.42.1 changelog](https://github.com/DavidAnson/markdownlint/blob/bf7bd390f813485e46d0386af8e2d7f99781272f/CHANGELOG.md)
- [Markdownlint 0.42.2 changelog](https://github.com/DavidAnson/markdownlint/blob/92992da11c2da77f8c4261378563098f3dc77f80/CHANGELOG.md)
- [RE2JS 2.9.1 publisher commit](https://github.com/le0pard/re2js/commit/5a112c6290dd6c9a10d6ccaa84ed38d9dd6ecfa2)
- [npm override contract](https://docs.npmjs.com/cli/configuring-npm/package-json/)
  · [npm clean install](https://docs.npmjs.com/cli/commands/npm-ci/)

Generate a scoped lock and inspect every changed package before a strict clean
install. Run the real Axios transport controls, the Markdownlint runner
and changed rule controls, package-tree and full audits, and affected
quality gates. Preserve Markdownlint rule settings and failure thresholds.
Defer an incompatible candidate. Keep PR branches unmerged and review
whether any failures are actually addressed by a rebase before touching
a Dependabot branch.
