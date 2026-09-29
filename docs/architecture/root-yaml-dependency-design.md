# Root YAML dependency remediation design

Research and decision date: September 29, 2026.

## Problem and boundary

Dependabot alert 112 identifies GHSA-r3ph-w7gj-g6xm in the root development
dependency tree. The root override forces `js-yaml` 5.2.2 even though
`markdownlint-cli2` 0.23.3 requests patched 5.4.1. Updating the linter alone cannot
remove that downgrade. The server independently resolves 5.4.2; the client has no
copy. Docker installs the client/server trees, not root development tooling.

The vulnerable parser can iterate empty merge sources without spending its
configured merge-work budget. Every source must consume budget when merges are
enabled, including empty aliases reused across multiple targets. Exceeding that
budget must raise an error, not silently truncate or accept the document.

Exposure is narrower than the upstream library's general impact: the linter's
public YAML parser calls `load(text)` with the default core schema. That schema
does not enable merge keys, even with a YAML 1.1 version directive. The current
repository configuration is JSONC. No root-copy HTTP input path or merge-enabled
project caller was found. This is a confirmed vulnerable dependency and a
reproduced optional-mode budget bypass, not a demonstrated production exploit.

## Official research

- The [upstream advisory](https://github.com/nodeca/js-yaml/security/advisories/GHSA-r3ph-w7gj-g6xm)
  identifies affected versions 5.0.0 through 5.4.0 and first patched version 5.4.1.
  The [fix](https://github.com/nodeca/js-yaml/commit/6a8e05f9a485188ed730ac81e81ae221352ef480)
  accounts for previously uncharged empty merge sources.
- The authenticated upstream tag comparison from
  [5.4.1 to 5.4.2](https://github.com/nodeca/js-yaml/compare/e5a3ba0efee53629b979f784cd53736f89ea61b6...494400bd45cad078123cfc057e674a9a0a8d9983)
  shows a scalar-quoting correction and release metadata. npm registry metadata
  confirms 5.4.2 and its integrity; the server already uses this version.
- npm documents [root overrides](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/)
  and [clean lockfile installs](https://docs.npmjs.com/cli/v12/commands/npm-ci/).
  An override controls transitive resolution; verification must use the installed
  root tree after `npm ci`, not the independently patched server tree.
- [W3C error identification guidance](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
  supports specific textual error descriptions. There is no UI change in this
  dependency-only correction. Preserve parser error behavior; do not claim a
  dashboard accessibility improvement or hide errors behind success messages.

URLs were discovered through GitHub/MCP, official search results and upstream
metadata. The upstream advisory page and GitHub alert feed report different
publication dates; version ranges and the fixed version agree. This document
records the research date, not an inferred publication date.

## Options and recommendation

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Pin root override to 5.4.2 | Covers root transitive copies; matches the server's patched version; very small dependency change | Exact overrides require review on dependency upgrades | Selected |
| Remove the override | Restores the linter's patched 5.4.1 and reduces pin maintenance | Relinquishes the root-wide version constraint | Reasonable later simplification after dependency review |
| Replace the YAML parser or linter | Could remove this dependency entirely | Larger configuration/API compatibility surface without evidence it is necessary | Not justified |
| Add a runtime service or increase CPU limits | None for this root-only parser defect | Does not repair budget accounting; adds unrelated operational work | Reject |

Recommended stack: existing Node ESM tooling, patched upstream parser, native
`node:test` regression checks, existing root-install CI job and npm lockfile.
No new runtime service, dependency framework, schema mode or user setting.

## Implementation and verification contract

1. Write small in-memory regression cases against the root installed parser.
   Confirm the test and linter resolve the same package. Never substitute the
   server's already-patched parser or use a long-running denial-of-service input.
2. Demonstrate failures before changing the pin: direct empty mapping, aliased
   source sequences and work accumulated across targets. Exercise YAML 1.1 and
   the core schema with the merge tag explicitly enabled.
3. Preserve valid merges below budget, explicit-key precedence, ordinary linter
   configuration parsing, literal default-schema `<<` keys and malformed-input
   errors. Use deterministic results/errors rather than timing thresholds.
4. Change only the root pin and generated lock entry. Clean-install root tooling,
   rerun the same tests, lint documentation and inspect/audit the resolved tree.
5. Run the tests after the root install in the existing Copyright Compliance job.
   Keep workflow permissions, triggers and job identity unchanged. No separate
   CI installation or runtime startup is needed for these bounded tests.
6. Record exact results in a separate [outcome document](root-yaml-dependency-outcome.md).
   Update Unreleased without changing the release version or deploying a container.

## Next application component

Return to an actionable retry-readiness summary after this security fix: show
cached-ready, waiting, disabled/rejected and future-due counts with one corrective
action. Use bounded aggregate reads and existing polling. Preserve disabled
providers, ownership checks and quota limits; waiting is not automatically failure.
This follows the observed backlog rather than introducing another recovery engine.
