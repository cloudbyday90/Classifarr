# Documentation-Lint Dependency Remediation — Design

Status: implemented, unreleased. Sources were checked on 10 September 2026
against the requested August 2026 best-practice baseline.

## Decision

Raise the workspace-root `smol-toml` npm override from `1.6.1` to `1.8.0`.
`markdownlint-cli2` is deliberately retained at its current compatible
release. The override is the narrowest place that corrects the affected
transitive dependency without changing application runtime dependencies,
server/client behaviour, media routing, AI, RAG, policy evaluation, or the
reviewer-study workflow.

The npm advisory reports `smol-toml` versions through `1.7.0` as affected by a
malformed-TOML denial of service. The root lockfile previously resolved the
explicit override to `1.6.1`; version `1.8.0` is the currently published fixed
release identified from the npm registry during this change.

## Scope and threat model

The dependency is used by the root documentation-lint tooling rather than by
the server or browser application trees. A malicious or malformed TOML input
processed during local documentation linting or CI could consume unnecessary
resources. This is not an AI/RAG prompt, library item, or routing input, and
the remediation intentionally does not broaden those systems' authority.

The root manifest and lockfile are both updated. The client and server package
trees are intentionally left untouched because their direct audits are already
clean and they each maintain their own lockfile.

## Validation plan

1. Regenerate only the root lockfile with lifecycle scripts disabled.
2. Run the root audit and verify no vulnerable `smol-toml` remains.
3. Run the documentation linter to prove the resolved parser remains compatible
   with the existing documentation corpus.
4. Run the root static ESM check and the server/client audits to ensure the
   maintenance change did not alter source/module or application dependency
   state.

## Research basis

- [GitHub Dependabot Alerts](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-alerts)
  says alerts identify the affected file, severity, and fixed version where
  available, and recommends remediating the dependency graph rather than
  ignoring known vulnerable dependencies.
- The [GitHub advisory for GHSA-7w5x-hrqm-74c2](https://github.com/advisories/GHSA-7w5x-hrqm-74c2)
  identifies the affected `smol-toml` range and its malformed-input denial of
  service condition.
- [W3C WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  was considered because the application has asynchronous UI work. This
  dependency-only maintenance change creates no user-visible state, so no new
  live region or notification is appropriate; adding one would be unrelated and
  unnecessarily noisy.

## Options and trade-offs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Remove the override | Small diff | Resolves to the linter's vulnerable `1.7.0` dependency | Rejected |
| Downgrade `markdownlint-cli2` | Potential audit workaround | Loses current tooling fixes and changes more than required | Rejected |
| Raise only the root override to `1.8.0` | Direct remediation, minimal dependency graph change, preserves tooling contract | Requires lockfile regeneration and lint verification | Selected |
| Replace the documentation linter | Removes this package path | Broad developer-experience and CI change with no evidence it is needed | Deferred |

## Final recommendation stack

1. Keep the fixed root override and lockfile together.
2. Retain root, server, and client audit checks as routine dependency hygiene.
3. Enable or maintain Dependabot alerts and security updates so future advisory
   fixes are visible in the repository rather than discovered after a push.
4. Return product work to genuine independent reviewer submissions and
   consensus measurement; do not manufacture labels or widen AI/RAG routing
   authority until that evidence exists.
