---
description: Prepare, verify, and explicitly authorize a Classifarr release
---

# Classifarr release runbook

Reviewed 2026-10-03. Commands run from the repository root unless noted.
The checked-in workflow and validators are authoritative; this document does not
authorize publication, live deployment, or a version bump.

## 1. Establish the candidate

Stay on `main` unless the maintainer requests otherwise. Inspect the worktree,
remote tags and published releases before choosing an unused version:

```bash
git status --short --branch
git fetch origin main --tags
gh release list --repo cloudbyday90/Classifarr --limit 10
git tag --sort=-v:refname
```

Use the saved GitHub CLI login. Do not print or copy tokens into commands, logs,
Markdown, or artifacts. A local tag list alone cannot establish release state.
Do not reuse a published version or silently carry unrelated changes.

Use Node from `.nvmrc` and npm from `package.json#packageManager`. Install from
the three committed lockfiles with `npm ci`, `npm --prefix server ci`, and
`npm --prefix client ci`. Do not run an unpinned NPX tool to prepare a release.

Ordinary development keeps changes under **Unreleased**. Only after explicit
release approval, choose a new SemVer tag such as `vX.Y.Z-beta` and align:

- Root, client, and server `package.json` versions.
- Each corresponding lockfile's root version and `packages[""].version`.
- `client/src/constants/appVersion.js`, README badge and source-version marker.
- The first `RELEASE_NOTES.md` entry and dated `CHANGELOG.md` entry; retain a
  fresh Unreleased section. Follow the [changelog conventions](../../docs/CHANGELOG-CONVENTIONS.md).

Prefer standard SemVer. Historical letter-qualified tags have a compatibility
mapping in `scripts/lib/releaseCandidateVersion.mjs`; do not invent another.
Refresh lockfile metadata with `npm install --package-lock-only --ignore-scripts`
in each package and review the diff for unintended dependency changes.

Validate the selected tag using the direct ESM command, which avoids npm flag
forwarding differences on Windows:

```bash
node scripts/check-release-candidate-version.mjs --tag vX.Y.Z-beta
```

Keep release notes short: user-visible changes, required action, known limits,
and a changelog link. Include charts or percentages only when measured, with a
denominator and evidence. Do not invent reliability or speed scores. Compose's
documented `latest` update channel is separate from the source-version marker;
do not automatically replace every image reference during a version bump.

## 2. Pass source and image checks

Run the current checks; a prior successful run is not evidence for new changes:

```bash
npm run lint
npm run test:ci
npm audit
npm --prefix server audit
npm --prefix client audit
```

`test:ci` includes preflight, type checking, backend/frontend CI tests, ESM
checks and the coverage ratchet. Both coverage reports must be fresh. Targeted
tests alone do not replace the full release suite. Inspect advisory findings;
do not blindly apply `npm audit fix --force`, suppress a scanner, or lower a
coverage threshold to make a release green.

For schema changes, build a uniquely tagged **local verification image**, then
use `IMAGE_NAME` with `db:dump-schema:container`, review and commit the resulting
`database/schema/current.sql`, and run `db:check-schema:container`. Do not generate
the release snapshot from a long-running live database. On PowerShell set
`$env:IMAGE_NAME`; on Bash prefix the command with `IMAGE_NAME=<local-image>`.

Run `docker:smoke:pgss` against that verification image. Require fresh startup,
extension-file recovery, the supported PostgreSQL upgrade path and cleanup.
Never attach live appdata to these tests. Container verification and host schema
checks are distinct; use the same image identity throughout an image claim.

For installation and routing evidence, use the existing isolated runners:

Commit any fixes before the frozen run: it requires a clean checkout throughout.
Do not edit the source during a rehearsal or reuse receipts after changing it.

```bash
node scripts/run-runtime-installation-acceptance.mjs
node scripts/run-frozen-release-rehearsal.mjs --no-cache
```

Review both receipts, not just exit codes. CI installation acceptance requires
same-source, same-run/attempt, same-candidate-image evidence, all installation
checks and all eight routing phases. Frozen installation rehearsal covers the
saved-template/resource-soak contract in its runner. Require cleanup; disclose
unsupported architectures or skipped scenarios. Local results are not signed
published-image evidence. Do not fabricate GitHub environment variables to
turn local evidence into a CI receipt.

When relevant, also run the production-policy browser check
(`npm --prefix client run test:browser:production-policy`) and the isolated
AI provider-fault check (`npm run test:integration:ai-provider-fault-compose`).
For model-quality changes, follow [local AI evaluation](../../docs/local-ai-policy-sweep.md)
and the [comparison contract](../../docs/architecture/ai-classification-evaluation-trend-baseline.md).
Paid or live-provider evaluation needs separate authority. Never publish raw
evaluation payloads, credentials, local media metadata, or operator reports.

Complete the [security checklist](../../docs/SECURITY_CHECKLIST.md), including
route authorization under `server/src/routes/`, sanitized errors, no tracked
secrets, and restricted workflow permissions. Record the exact source SHA,
image IDs, commands, outcomes and remaining gaps in a separate outcome document.

## 3. Review main and publication controls

Commit reviewed changes on `main`, push only that branch, and check the runs for
the exact pushed SHA. Use `gh run list --commit <sha>` and
`gh run watch <run-id> --exit-status`. Require applicable CI, OSV, CodeQL,
secret-scanning and image-scanning checks to pass; identify any intentionally
skipped job rather than treating it as passed.

Before creating a tag, verify repository controls in GitHub:

- Immutable releases enabled.
- `release-publication` and `release-acceptance` environments restricted to
  `v*` tags, without administrator bypass.
- Independent approval where a second maintainer is available. Do not claim
  reviewer separation for a single-maintainer setup.
- Required registry credentials available to the tag workflow only; read-only
  verification jobs do not receive registry publication credentials.

These are repository settings, not guarantees made by YAML. Record what was
actually inspected. Green tests do not grant permission to tag or publish.

## 4. Publish only the approved tag

Only after explicit approval, all pre-tag gates pass and the chosen version is
unused, tag the exact reviewed commit and push that one ref:

```bash
git tag -a vX.Y.Z-beta <approved-source-sha> -m "vX.Y.Z-beta: concise release title"
git push origin refs/tags/vX.Y.Z-beta
```

Do not push all local tags. Do not manually run `gh release create` or publish
a replacement image to bypass the workflow. Tag CI performs this chain:

| Gate | Required evidence |
| --- | --- |
| Source and installation | Full CI plus same-image installation/routing receipt |
| Provider fault | Fresh bounded disposable provider-fault receipt |
| Image publication | GHCR/Docker Hub index digest with verified provenance |
| Published consumers | Digest-only health smoke and native AMD64/ARM64 routing |
| Evidence assembly | v3 record bound to source, digest and current run/attempt |
| GitHub publication | Attested evidence asset, draft publication, release verification |

Published routing independently verifies the signed index, selected child
manifest and pulled image identity, then reuses the isolated upgrade/crash
fixture. Both architecture jobs must pass. Missing, stale (over six hours),
wrong-run, failed-cleanup or unexpected-provider-write receipts block evidence
assembly. An approval delay that ages evidence out requires fresh tests, not
editing timestamps. Historical v1/v2 assets remain readable but cannot replace
new v3 evidence. See [published routing design](../../docs/architecture/published-routing-acceptance-design.md).

`docker-release` publishes the version tag only (`latest=false` explicitly).
After both published-consumer gates and verified immutable GitHub publication,
`promote-published-latest` advances the original digest in GHCR and Docker Hub.
Both registry graphs and current-alias provenance must pass before any write.

**Current limitation:** the registries cannot update atomically. A partial
failure blocks success and retains per-registry progress; it does not undo a
successful write. Version tags remain pullable before the consumer checks.
See [promotion design](../../docs/architecture/release-image-promotion-design.md).

## 5. Verify or stop

Watch the exact tag run. Require the attached evidence JSON, its provenance,
the immutable GitHub release verification, and both `latest` aliases to pass
before announcing it:

```bash
gh run watch <tag-run-id> --exit-status
gh release verify vX.Y.Z-beta --repo cloudbyday90/Classifarr --format json
```

Download the evidence asset into an ignored directory and independently run
`gh attestation verify <evidence.json>` with `--repo cloudbyday90/Classifarr`,
`--signer-workflow cloudbyday90/Classifarr/.github/workflows/ci.yml`,
`--source-ref refs/tags/vX.Y.Z-beta`, `--source-digest <approved-source-sha>`,
`--predicate-type https://slsa.dev/provenance/v1` and
`--deny-self-hosted-runners`. Retain default public trusted roots; do not use
`--no-public-good`. Inspect both routing receipts and their image identities in
the v3 asset. A signature establishes provenance, not correctness by itself.

On failure, stop announcement and inspect the exact failed job. Do not delete
or retarget a tag just because GitHub release publication failed: registry
images may already be public. Rerun unchanged transient failures with fresh
same-attempt evidence, or fix on `main` and use a new approved version.
Rerun the full tag workflow when receipts must be refreshed; retrying only the
publication job retains earlier-attempt artifacts and must fail validation.
Never modify an immutable published release or reuse its tag.

For a failed or partial promotion of a verified v3-evidence release, use
**Promote Published Release Image Alias** only with explicit promotion approval.
Dispatch from that release tag (`--ref vX.Y.Z-beta`) with matching
`source_tag=vX.Y.Z-beta`, not from `main`: the protected environment admits tags.
The retry verifies immutable release/asset provenance and the full v3 record,
preserves the exact indexes, and checks both registries. It skips already-correct
writes. A newer current source, missing alias, broken graph, unknown provenance,
or historical v1/v2-only evidence is a hard stop. Do not force or rebuild an
image to bypass it; missing-alias bootstrap needs a separately reviewed repair.
For incomplete image graphs follow the
[retirement assessment](../../docs/architecture/published-image-release-retirement.md).
GHCR retention is read-only inventory plus review, not generic package-version
deletion: [manifest retention](../../docs/architecture/ghcr-manifest-retention-inventory.md).

## 6. Deployment is a separate decision

After an approved deployment, dispatch **Release Installation Evidence** from
the exact deployed release tag and follow the
[installation acceptance procedure](../../docs/architecture/release-acceptance-assembly.md).
This is operator evidence, not an automatic inspection of every NAS or permission
to retire compatibility code.

If a local no-cache rebuild is explicitly requested, first inspect the active
Compose project, overrides, mounts, backups and working-tree provenance. Use:

```bash
node scripts/docker-compose-smart.mjs build --no-cache --require-provenance
node scripts/docker-compose-smart.mjs up -d --no-build --force-recreate --wait
```

Run the second command only if the build succeeded and the selected project is
the intended deployment. Do not run `down` first, delete volumes, or reset
ownership to silence warnings. Recheck health/readiness, startup logs, resource
limits and relevant recovery behavior afterward. A local build is not the
published release digest and must be reported as such.

## References

- [GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
- [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- [Docker image digests](https://docs.docker.com/dhi/explore/security-concepts/digests/)
- [Native GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
