# Clean-Host AI Provider-Fault Release-Candidate Receipt

## Outcome

Every version-tag release candidate now runs the disposable AI provider-fault
Compose integration in its own GitHub-hosted `ubuntu-latest` job before image
publication. The job writes and uploads exactly one short-lived JSON receipt:
`ai-provider-fault-compose-receipt`.

The job has only `contents: read`, persists no checkout credential, reads no
repository secret, has no workflow outputs, and uploads no test logs, prompts,
provider responses, ports, project names, database records, queue payloads, or
fixture content. `docker-release` and release-candidate publication both depend
on the job, so a failed or missing receipt blocks image and GitHub-release
publication.

GitHub documents that each GitHub-hosted job receives a freshly provisioned
virtual machine. That makes this a clean-host confirmation of the existing
disposable local boundary rather than a second model-quality evaluation. See
[Using GitHub-hosted runners](https://docs.github.com/en/actions/how-tos/manage-runners/github-hosted-runners/use-github-hosted-runners).

## Receipt Contract

The root ESM modules `scripts/lib/aiProviderFaultComposeContract.mjs` and
`scripts/lib/aiProviderFaultComposeReceipt.mjs` own the fixed vocabulary,
schema validation, and fixed output path. A receipt has only these fields:

```json
{
  "completed_at": "2026-08-22T12:34:56.789Z",
  "outcome": "passed",
  "schema_version": "classifarr.ai-provider-fault-compose-receipt.v1",
  "source_revision": "<40-character-git-sha>",
  "status_id": "passed",
  "test_contract": "isolated_provider_fault_compose_v1"
}
```

For `failed`, `status_id` is limited to one of the named lifecycle states:
`invalid_input`, `loopback_port_failed`, `compose_configuration_failed`,
`compose_start_failed`, `test_failed`, or `teardown_failed`. The writer rejects
unknown keys and arbitrary failure text. The verifier reads only the fixed
`.tmp/ci/ai-provider-fault-compose-receipt.json` path and requires the source
revision to equal the tag workflow revision before upload. The writer creates
that temporary file exclusively, so a local or CI invocation will not silently
replace an existing receipt.

The test runner writes a receipt for both outcomes when the dedicated source
revision environment variable is supplied. The workflow deliberately allows
the test step to complete first, validates and uploads the receipt with
`always()`, then fails the gate if the test outcome was not successful. That
retains bounded failure evidence while keeping a failure release-blocking.

## Workflow Boundary

```text
release-acceptance
        |
        v
fresh hosted provider-fault job
  -> fixed Compose stub + isolated test database
  -> fixed-schema pass/fail receipt (14 days)
        |
        +------------------------+
        |                        |
        v                        v
docker-release          release-candidate-publication
        |
        v
published digest consumer smoke
```

The receipt job is intentionally separate from the local policy-to-AI sweep:
it configures no real model and does not inspect installation-specific policy
or media data. Its fixed test provider succeeds at availability and returns a
transient generation failure, so the existing integration verifies retry
persistence and no-route behavior end to end.

`server/src/scripts/checkAiProviderFaultReceiptWorkflow.mjs` treats the YAML as
a security contract. Its tests reject a changed runner, credential persistence,
secret references, extra or broad artifact uploads, a missing receipt-first
failure path, or an altered enforcement command. The existing release workflow
contract checker also rejects Docker or release publication paths that omit the
gate.

## Research, Options, and Decision

GitHub recommends least-privilege `GITHUB_TOKEN` permissions and pinning
actions to full commit SHAs in its [secure use reference](https://docs.github.com/en/actions/reference/security/secure-use?learn=getting_started&learnProduct=actions).
The workflow syntax reference explains that omitted token permissions become
`none`, enabling a narrow explicit `contents: read` job
[workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).
GitHub also supports per-artifact retention through `upload-artifact`; public
repositories may retain artifacts from one to 90 days
[artifact retention](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/remove-workflow-artifacts).

### Full logs or broad Compose artifacts

Pros:

- easiest immediate debugging after an intermittent failure.

Cons:

- can retain endpoint, test, provider, or database-adjacent material;
- makes artifact review and retention harder to audit;
- creates a larger disclosure surface than the release decision needs.

Decision: rejected.

### Pass-only artifact

Pros:

- very small release record.

Cons:

- loses the exact bounded reason when a candidate is blocked;
- encourages maintainers to recover detail from unbounded logs.

Decision: rejected.

### Selected: fixed-schema pass/fail receipt on a clean hosted job

Pros:

- verifies the real recovery, persistence, and no-route path before publishing
  a candidate image;
- retains a small diagnosis code for either outcome without raw inputs or
  outputs;
- gives the job no mutation authority, secrets, credential persistence, or
  broad artifact path;
- bounds resource use with Compose cleanup and a 15-minute job timeout.

Cons:

- depends on Docker availability on the hosted runner;
- the 14-day receipt is operational evidence, not a permanent signed release
  attestation;
- intentionally does not measure real model quality.

Decision: selected. Fourteen days matches other short-lived CI readouts while
remaining substantially below the repository default described by GitHub.

## Final Recommendation Stack

1. Keep deterministic offline fault scenarios as the fast no-side-effect
   contract layer.
2. Keep the local disposable Compose test for developer diagnosis and changes
   to provider recovery, retry persistence, or routing admission.
3. Require the clean-host receipt gate for every version tag before images are
   published.
4. Keep the independent published-digest consumer smoke test after image
   publication.
5. Use reviewed local policy-to-AI sweeps only for installation-specific model
   quality; never upload their reports as release evidence.

## Next Recommended Item

Bind a validated SHA-256 fingerprint of this fixed receipt into the existing
release-candidate evidence schema. That would preserve a permanent,
candidate-bound record without embedding provider data or extending the
short-lived artifact's retention. It should be designed as a separate schema
revision with compatibility tests before it is made a release asset.
