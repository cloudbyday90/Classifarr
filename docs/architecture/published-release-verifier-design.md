# Verify a published release by its signed evidence and current registry digests

November 22, 2026 Eastern.

The first v4 release needs a check that connects the approved source to the
signed asset, the completed tag workflow attempt and both registries. The
promotion dry run answers whether a write could proceed. It can pass with
an older digest at `latest`. The previous release used a manual digest
comparison to verify the current registry state.
[Beta outcome](release-0.49.4-beta-outcome.md)

| Option | Benefit | Cost |
| --- | --- | --- |
| Manual comparison | Uses existing CLI commands | Requires separate checks and manual matching |
| Promotion dry run | Checks release identity, graph and ancestry | A valid older alias can pass |
| Dedicated read-only verifier | Checks the exact attempt and both registry tags together | Adds bounded GitHub and registry reads |

Use a dedicated verifier from the existing release runbook. The caller
supplies the approved tag, source, index digest, run and attempt. Read that
attempt and its required jobs from GitHub. Check native routing on both
architectures, arm64 scheduled recovery, publication and automatic
promotion. Authenticate the release and its v4 asset through the existing
immutable-release and attestation verifier.
[GitHub run attempts](https://docs.github.com/en/rest/actions/workflow-runs)
· [GitHub job metadata](https://docs.github.com/en/rest/actions/workflow-jobs)
· [GitHub release integrity](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/verify-release-integrity)
· [SLSA verification](https://slsa.dev/spec/v1.2/verifying-artifacts)

Read the version tag and `latest` in each registry. Require all four
references to match the signed index, verify both copies of the index and
its child manifests, and match the signed native subject digests to the
observed children and configs. Recheck the references. This reports what the
verifier observed at inspection time. The registries cannot provide a
transactional snapshot, and a later promotion can change the aliases.
[Docker registry inspection](https://docs.docker.com/reference/cli/docker/buildx/imagetools/inspect)

Keep publication, promotion, manual retry and historical verification on
their existing paths. The verifier uses only reads and emits a bounded JSON
result. It stops on missing, duplicate, skipped, failed or mismatched proof.
Use fixture-based tests for v4 success and refusal. A signed v3 release can
exercise the real registry reads and demonstrate strict v4 refusal. Only an
approved tagged v4 run can exercise the full path against production records.

This check covers release evidence and registry state. It includes no
product-interface evaluation. [W3C evaluation methodology](https://www.w3.org/TR/WCAG-EM/)
