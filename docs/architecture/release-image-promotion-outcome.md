# Release image promotion outcome

Date: 2026-10-03. Implementation on main; no release, tag or registry write.

## Delivered

Version-tag publication no longer advances latest. Both registry aliases are
promoted by one shared, bounded ESM implementation after consumer gates and
verified immutable release publication. Manual retries use the same checks from
the selected approved tag. The release runbook, Unreleased changelog and existing
release-evidence skill describe the new boundary and its limitations.

Design, pros/cons and official research are in the separate
[design document](release-image-promotion-design.md).

## Validation

- Targeted promotion, publication, provenance, evidence, documentation and
  installation-contract tests: 227 passed across 11 suites; no skips.
- Repository lint, server/client type checks and CI preflight: passed.
- Actionlint validated the changed workflow pair (ShellCheck disabled).
- Read-only GHCR inspection confirmed structured index/config output works with
  the existing published v0.48.4-beta digest and source label.
- The real immutable v0.48.4-beta release and its evidence asset were read through
  the saved CLI login; the promotion authority correctly rejected its older
  schema before any registry access. No release or asset was changed.
- An independent read-only registry-graph probe passed for GHCR and Docker Hub at
  `sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
  Both aliases and all child manifests were intact; CI provenance verification
  passed. This graph-only check does not override the old release's schema refusal.
- Markdown checks, skill metadata validation, and release/installation workflow
  contract commands passed. The skill scenarios are covered by the fault and
  mutation tests; no extra agent or external skill deployment was used.
- GitHub MCP and saved CLI login both returned zero open Classifarr PRs. No random
  PR could be selected; none was merged or represented as implemented.

## Existing CI finding

Run [37134626818](https://github.com/cloudbyday90/Classifarr/actions/runs/37134626818),
for the previous commit `4cc040e5bf748176e87343a39c976606f480db8c`, failed the
installation routing rehearsal after `routing_arm-crash`. Its bounded receipt
reports `failureStage: routing_rehearsal` and no verified routing result. Database
and build/test jobs passed; release acceptance correctly failed downstream. The
evidence does not identify the exact failed assertion; this
work does not claim to resolve that pre-existing failure or certify a release.

The gate remains required. No routing expectation, timeout or skip was loosened.

## Limits and follow-up

No new v3 release was created, so end-to-end remote promotion is unexecuted.
Fault-injected tests prove code behavior, not production registry availability.
Both registries cannot update atomically. Missing-alias bootstrap, historical
v1/v2 promotion, backward/divergent source promotion and unknown provenance are
deliberately unsupported; there is no override flag.

Resume dependency and tooling maintenance next, with blocking CI failures resolved
before a batch is accepted. The release-evidence skill now prompts for all alias
writers, tag-only environment restrictions, stale-source rejection and honest
per-registry partial outcomes.
