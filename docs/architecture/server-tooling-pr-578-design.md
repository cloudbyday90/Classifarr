# Server tooling PR 578 local adoption design

Date: 2026-11-02 (America/New_York). Status: agreed; implemented and locally verified.
Outcome: [local adoption, verification and maintenance](server-tooling-pr-578-outcome.md).

## Random selection and boundary

GitHub MCP found two open PRs: 578 and 579. A uniform PowerShell Get-Random
selection chose [PR 578](https://github.com/cloudbyday90/Classifarr/pull/578),
reviewed at immutable head b59635c071250cf3c7751c53100749f28e158db1 against
base f89e35b68c4420ef03d7d06b459d853d420f0fee. Current main is
e30310479f98a984bd446269d6f5ba01226bca23. The receipt is under .tmp.

Locally adopt only its server development-tool changes, with exact direct pins:
eslint-plugin-security 4.2.0 to 4.2.1 and Knip 6.42.1 to 6.44.0. Review their
coupled lock changes, including OXC parser 0.154.0 to 0.155.0 and its platform
bindings/types. Preserve the current smol-toml override, all other overrides,
strict installation decisions, ESLint severities and Knip configuration/exclusions.
No runtime dependency or application behavior change is intended.

Both intake PRs are fresh and mergeable. PR 578's older base alone does not make
it stale. Recheck at delivery and rebase only genuinely stale applicable branches;
leave provider PRs unmerged. PR 579's independent client-tooling changes remain
outside this batch. Knip 6.44.1 is already available; keep it separate from the
immutable selected 6.44.0 update rather than silently adding a different release.

## Behavior and verification

The security-plugin patch adds RegExp call expressions without new to the existing
non-literal/unsafe regex rules. Its exact source change and upstream tests cover
that missing syntax. Test the installed plugin through actual ESLint, first
showing the old missed diagnostics, then requiring equivalent constructor/call
diagnostics plus safe literal controls. Test snippets are parsed, not executed.
Keep existing application rule configuration and warning/error severities.

Knip's release changes script resolution, namespace member tracking, Windows path
handling and warm-cache behavior. Reuse the existing isolated real-CLI fixtures
and native subprocess helper. Verify genuine findings remain visible in normal
and production modes, entry/export rules and cold/warm results, with focused
controls for relevant new behavior. Preserve actual findings; do not weaken
exclusions, assertions or gates to obtain a pass. Both existing repository Knip
gates pass at baseline.

Registry metadata declares compatible Node engines and no package installation
script for these direct tools. Review every added/removed/changed lock node and
all native optional-package flags before the strict clean server install. Do not
globally allow scripts, bypass peers or upgrade the toolchain. Exact runtime
package nodes must remain unchanged, or stop and investigate the scope expansion.

Run targeted real plugin/Knip tests, existing server lint/typecheck and both Knip
gates, full server npm ls/audit, dependency tooling and appropriate repository
quality gates. Obtain fresh full backend coverage for the changed server tree.
Reuse current client coverage only when source, manifests, installed tree and
report remain unchanged, then run the ratchet. No database-driver or production
image change warrants a new live database/image rehearsal in this tooling batch.
The client report consumed by the ratchet is client/coverage/index.html. A fresh
client run is included; an initial check for an unconfigured JSON summary did
not establish that coverage evidence was missing.

Baseline full server audit reports zero high, 29 moderate and three low findings;
report identities and changed counts after installation, including developer
dependencies. Do not mix those results with the separate root RE2JS advisory or
claim that a passing lint run clears package advisories.

## Alternatives and recommendation stack

| Choice | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Exact local adoption of selected PR | Fixes missed lint syntax and updates dependency analysis with attributable evidence | Native parser and analysis behavior require real fixtures | Recommend |
| Merge provider PR | Standard provider workflow | Conflicts with requested local adoption/no merge | Exclude |
| Adopt every open tooling update | Broad freshness | Mixes client bundler/types changes with this server batch | Defer |
| Relax lint/Knip or installer policy | Avoids new failures | Removes the protection being assessed | Reject |

Final stack: immutable PR/release review, exact direct pins, reviewed coupled lock,
strict install, failing-before/passing-after plugin diagnostics, real CLI controls,
full audits and fresh affected coverage. Keep the independent
[RE2JS remediation](re2js-tooling-fix-design.md) separately attributable.

## Research and delivery

Primary sources discovered/read through MCP on November 2, 2026:

- [PR 578](https://github.com/cloudbyday90/Classifarr/pull/578): immutable diff
  and current mergeability, independently checked against registry metadata.
- [Security-plugin exact fix](https://github.com/eslint-community/eslint-plugin-security/commit/affbfc0d7b83434434551f128335d04400e554bb):
  call/constructor handling and legitimate diagnostic controls. The general
  release page was cached behind registry/PR data; do not treat its absence as
  evidence that 4.2.1 is unpublished.
- [Knip maintainer releases](https://github.com/webpro-nl/knip/releases):
  separate 6.43/6.44.0 changes and the newer 6.44.1 release boundary.

After scope agreement, keep design and observed outcome separate, update
Unreleased and relevant follow-ups, perform artifact maintenance and staged
secret/diff checks, then commit/push all changes on main. Add no release,
deployment, service restart, schema, UI, job, operator CLI trigger, routing or
learning change.
