# Release Acceptance Assembly

## Status

Phase 10R.4 tooling is complete as of 2026-08-09. This document defines the
release-acceptance boundary for Classifarr source revisions and active
installations. It deliberately keeps ordinary policy conversion,
classification, routing, and provider use independent from release evidence
collection.

## Problem

Earlier Phase 10R work proved the application boundary with isolated,
database-backed acceptance tests. A passing test run alone cannot prove which
source revision is running in a particular installation. Conversely, an
installation observation cannot replace repeatable repository acceptance.

The release boundary therefore needs to answer three separate questions:

1. Did the checked-out source and required isolated acceptance suites pass?
2. Is a specific installation observation bound to the deployed artifact and
   a protected approval workflow?
3. Is there a comparable, privacy-bounded measurement showing whether the
   open operator-review workload changed?

No answer to these questions authorizes an AI result, a policy change, a route,
or compatibility-code retirement.

## Research Basis

- [GitHub Actions workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts)
  describes artifacts as persistent workflow output and documents attestation
  metadata that ties an artifact to a repository, commit, workflow, and event.
  The CI manifest is an artifact, not a replacement for source control or a
  deployment record.
- [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
  documents required reviewers, branch restrictions, self-review prevention,
  and environment-scoped secrets. A workflow file can reference an
  environment, but repository administrators must configure its protection
  rules; code cannot truthfully infer that configuration.
- [SLSA provenance](https://slsa.dev/spec/v1.2/provenance) defines provenance
  as verifiable information about where, when, and how an artifact was made.
  The deployment fingerprint and source revision are kept as distinct values
  because a container digest and a Git revision are not interchangeable.
- [GitHub supply-chain security](https://docs.github.com/en/code-security/concepts/supply-chain-security/supply-chain-security)
  describes dependency review, Dependabot alerts, and artifact attestations as
  complementary controls. The release manifest does not claim a clean
  dependency state unless the existing CI and GitHub security workflows pass.

## Options Considered

### CI pass as the release claim

Pros:

- Repeatable and fast.
- Does not require an installation credential or configuration export.

Cons:

- Does not identify the deployed image or compose build.
- Cannot record an approval boundary or a production workload signal.

Decision: insufficient by itself.

### Query a live installation from CI

Pros:

- Could combine code and installation state in one job.

Cons:

- Requires network access and secrets.
- Couples a reusable repository gate to a specific operator's configuration.
- Makes ordinary CI less reliable and expands the blast radius of credentials.

Decision: rejected.

### Selected: layered, artifact-bound acceptance

Pros:

- The normal CI manifest is deterministic and installation-agnostic.
- A separate protected-environment workflow binds an installation attestation
  to an immutable deployment fingerprint and exact source revision.
- The workload signal reads five aggregate counters only and never changes
  runtime authority.
- A missing baseline becomes `not_applicable`, rather than a fabricated
  reduction claim or a block on normal policy automation.

Cons:

- Administrators must configure the `release-acceptance` GitHub environment.
- The metric needs two equal-duration snapshots before it can compare change.
- Artifact retention must be managed according to the repository's release
  record policy.

Decision: selected.

## Recommendation Stack

1. Keep `CI/CD Pipeline` as the source and isolated-runtime acceptance gate.
   `Release Acceptance Readout` executes after its repository and database
   jobs, writes a `policy-release-acceptance-readout` artifact in every run,
   and blocks tag image publication when a required component did not pass.
2. Keep live installation evidence in the manual `Release Installation
   Evidence` workflow. Configure its `release-acceptance` environment with
   required reviewers, protected tag or branch rules, and self-review
   prevention where the GitHub plan supports those controls.
3. Bind every installation artifact to both an immutable deployment fingerprint
   and the checked-out source revision. The evidence also records the
   protected workflow-run URL and a bounded change reference, but no operator
   identity, configuration, title, library, identifier, or secret.
4. Capture the operator-review metric from the installation only. Compare it
   only to a fingerprint-valid baseline with the same aggregate scope and
   exact measurement-window duration.
5. Treat an increased review rate as an operational review signal, not an
   automatic release veto and never as a routing or policy-authority input.

## Implemented Contract

### CI Readout

`policyReleaseAcceptanceManifest.mjs` defines four components:

| Component | CI | Installation Readout |
| --- | --- | --- |
| `repository_validation` | Required | Passed only through matching CI evidence |
| `isolated_runtime_acceptance` | Required | Passed only through matching CI evidence |
| `installation_evidence` | Not applicable | Required |
| `operator_decision_signal` | Not applicable | Informational; passed, blocked, or not applicable |

The CI manifest names the required acceptance suites for AI authority,
deterministic route outcomes, provider recovery, existing-installation
lifecycle, bounded diagnostics, recovery/restart behavior, decision
recommendation projection, and Command Center action binding.

The CI readout is valid only when both required components pass. It explicitly
marks active-installation evidence and the workload signal `not_applicable`.
That is intentional: a repository run has not observed an installation and
must not claim that it has.

### Installation Evidence

`policyReleaseInstallationEvidence.mjs` creates a SHA-256 fingerprint over:

- deployment fingerprint;
- source revision;
- protected environment name;
- GitHub Actions workflow-run URL;
- bounded change reference; and
- attestation timestamp.

The manual workflow uses the `release-acceptance` environment. Configure the
environment in GitHub before relying on this workflow for approval. The
artifact proves that the workflow ran under that environment name; only
GitHub's environment configuration enforces required reviewer and
self-review protections.

### Operator-Decision Signal

`policyOperatorDecisionMetricRepository.mjs` performs one read-only aggregate
query over `classification_history` for an explicit time window. It returns:

- classified outcome count;
- open `awaiting_decision` count;
- `pending_retry` count;
- automatically routed count; and
- completed or routed deterministic policy outcome count.

The comparison is the **open operator-decision rate**:

```text
open awaiting_decision rows in the window / classifications in the window
```

This is a bounded backlog/workload signal, not a claim that all historical
human decisions were reconstructed. Resolved rows retain current state, so a
historical decision-event rate cannot be inferred safely from this table. A
signal is only `improved`, `unchanged`, or `increased` when both aggregate
artifacts have the same scope and duration. Without a valid comparable
baseline, it is `not_applicable`.

## Operator Workflow

1. Allow normal CI to produce a passing `policy-release-acceptance-readout`
   artifact for the exact source revision.
2. Deploy the immutable image or compose build.
3. Run `Release Installation Evidence` from that deployed source revision and
   approve it through the configured protected environment.
4. Download the CI and installation evidence artifacts.
5. Capture an aggregate metric from the active installation, using an explicit
   time window. Capture a comparable baseline before claiming a reduction.
6. Build the combined installation readout. It validates the CI source
   revision, installation-evidence fingerprint, and optional metric pair.

Example commands are intentionally local-file based and contain no endpoint,
credential, or policy configuration assumptions:

```bash
npm run policy:release:operator-decision-metric -- \
  --scope-id all_classification_history \
  --window-start 2026-08-01T00:00:00.000Z \
  --window-end 2026-08-08T00:00:00.000Z \
  --output .tmp/release/current-operator-decision-metric.json

npm run policy:release:acceptance-readout -- \
  --mode installation \
  --source-revision <deployed-git-sha> \
  --ci-readout .tmp/release/policy-release-acceptance-readout.json \
  --installation-evidence .tmp/release/policy-release-installation-evidence.json \
  --operator-decision-metric .tmp/release/current-operator-decision-metric.json \
  --baseline-operator-decision-metric .tmp/release/baseline-operator-decision-metric.json \
  --output .tmp/release/policy-release-installation-readout.json \
  --require-passed
```

For the bundled Docker Compose deployment, run the same collector inside the
existing container so it uses the embedded PostgreSQL connection rather than a
host-specific database address:

```bash
docker compose exec -T classifarr \
  node /app/src/scripts/generatePolicyOperatorDecisionMetric.mjs \
  --scope-id all_classification_history \
  --window-start 2026-08-01T00:00:00.000Z \
  --window-end 2026-08-08T00:00:00.000Z \
  --output /tmp/current-operator-decision-metric.json
```

The metric collector is read-only. It does not restart Docker, run a policy
conversion, call AI, communicate with a media server, or alter a pending
decision.

## Security And Scope Boundaries

- No new runtime route, scheduler, client API, or mutable database action was
  added.
- The collector selects aggregate counts only. It does not select titles,
  library names, metadata, prompts, provider output, or classification IDs.
- Evidence artifacts are integrity-checked with deterministic SHA-256
  fingerprints. These fingerprints detect accidental mixing or alteration;
  they are not a substitute for GitHub artifact attestation or protected
  environment controls.
- The normal CI readout does not require a running Classifarr installation.
  This preserves platform and configuration agnosticism.
- The separate 8R.36.11 compatibility-removal artifact remains an
  installation-specific prerequisite for retiring compatibility code only. It
  does not block normal classification or native policy reads.

## Validation

- Unit coverage verifies fingerprint integrity, aggregate-only privacy
  boundaries, metric comparability, malformed evidence rejection, and CI versus
  installation status composition.
- The repository test and isolated PostgreSQL acceptance jobs are inputs to
  the CI readout. A failed prerequisite produces a blocked readout artifact.
- The current audit found no open pull requests and no open Dependabot alerts,
  so there was no dependency PR to implement locally for this component.

## Next Task

**10R.4.2 Published Digest Consumer Smoke Acceptance** and **10R.4.3 Release
Candidate Publication And Evidence Recording** are implemented. The tag path
now runs the digest-only consumer smoke in a separate job, validates its bounded
evidence against the CI readout, attaches that evidence to a draft GitHub
release, publishes only through the tag-restricted `release-publication`
environment, and verifies the immutable release attestation. A release-specific
execution still requires an intentionally selected tag and source revision.
Immutable releases and the `v*` environment policy are configured. See [Release Candidate
Publication And Evidence Recording](release-candidate-publication-and-evidence-recording.md).
The parallel **8R.36.11 Compatibility-Removal Evidence Regeneration** task
still requires a current approved active-installation completion artifact and
remains separate from routine policy automation.
