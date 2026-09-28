# Runtime installation acceptance in CI

September 28 follow-up: [scheduled installation acceptance](scheduled-installation-design.md)
adds real startup-scheduler progress to both scenarios. Version 2 receipts require
these additional checks; the original nine-check outcome remains historical evidence.

## Decision

Run fresh-install and published-upgrade acceptance in a read-only GitHub-hosted
CI job before release acceptance can pass. Reuse the existing disposable
published-upgrade runner, build the candidate once, and use separate empty
volumes for the fresh and upgrade scenarios. No release, deployment, production
data mutation, or new application dependency is part of this change.

## Acceptance contract

- Fresh install: real image entrypoint, healthy HTTP service, complete migration
  ledger, initial restore-admission gate, sampling singleton, bootstrap provider
  configuration, and security defaults. No users, libraries, or restore receipts.
- Upgrade: verified immutable v0.48.4-beta baseline; published export, persisted
  volume migration, interrupted restore, fail-closed normal startup, explicit
  verified retry, movie/TV recovery into learning, music exclusion, and restart.
- Teardown: verify only this random project's containers, networks, volumes, and
  candidate image are removed. Failure or incomplete cleanup blocks acceptance.
- Evidence: bounded allowlisted JSON and a concise text-status Markdown summary;
  no backups, provider payloads, credentials, database contents, or raw logs in
  uploaded artifacts. Include source revision, dirty-worktree status, candidate
  image ID, baseline digest, database versions/counts, and named check results.
- CI requires the expected checkout SHA and a clean worktree. Local dirty-tree
  runs remain useful diagnostics but are explicitly not CI acceptance evidence.
- A failed or skipped installation job must make release acceptance fail, not
  silently turn into a green readout. Existing tag-only image/publication and
  protected-environment gates remain in force.

## Security and research (2026-09-27)

Sources were discovered through online search and opened before implementation.

- [GitHub secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use):
  minimum token permissions, SHA-pinned actions, no persisted checkout credentials,
  no privileged pull-request trigger, and no untrusted expression interpolation
  into shell code. The new job needs contents/attestations read only; no production
  credentials, registry write access, environment approval, or OIDC token.
- [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations):
  retain mandatory baseline signature, signer workflow, and source-revision checks.
  A locally built candidate image ID is **not** published-image provenance.
- [GitHub expression semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions?ref=blog.mergify.com):
  upload bounded results on failure; do not use an unconditional success override
  for release gates. An absent receipt or nonzero runner exit fails the job.
- [GitHub artifact retention](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/remove-workflow-artifacts):
  explicitly retain this job's small result files for 90 days; no raw-log glob.
- [Docker Compose trust model](https://docs.docker.com/compose/trust-model/):
  Compose is trusted executable configuration, not a sandbox. Keep the fixed
  reviewed file, internal network, non-root user, read-only root filesystem,
  dropped capabilities, no host binds/ports/socket, and collision-safe ownership.
- [W3C table guidance](https://www.w3.org/WAI/tutorials/tables/):
  use a titled, simple table with headers and explicit Passed/Blocked text in the
  GitHub summary. No color-only result, misleading percentage, or UI accessibility
  conformance claim is introduced.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Manual upgrade drill only | Fast normal CI | Release safety depends on remembering to run it |
| One isolated job, two scenarios (selected) | One candidate build, same image, automatic gate | Adds Docker build/startup time; upstream attestation availability is required |
| Full release/architecture matrix now | Wider coverage | Multiplies build time and baseline maintenance before the first automated boundary is established |

Recommended stack: existing Node ESM runner + Docker Compose + bundled PostgreSQL
+ GitHub-hosted Actions + strict JSON receipt + existing release acceptance gate.
Keep the current pinned baseline explicit; expand architectures and published
baselines as separate follow-up work. This tests one same-major PostgreSQL upgrade
and synthetic metadata recovery, not arbitrary backups or live provider quality.

## Verification plan

The streamed baseline fixture deliberately imports three absolute `/app/src/`
modules from the published image, not from this checkout. Knip has exact,
anchored unresolved-import exceptions for those three paths only; no files or
general unresolved-import checking are disabled. The real published-startup
probe validates them in their actual runtime. See
[Knip configuration](https://knip.dev/reference/configuration) for this narrow
container-only resolution case.

Test fresh seed checks, missing/duplicate/malformed receipt data, failed provenance,
clean-worktree enforcement, secret-free failure evidence, CI dependency bypasses,
resource cleanup and the real two-scenario container run. Record measured outcomes
separately in the accompanying outcome document.
