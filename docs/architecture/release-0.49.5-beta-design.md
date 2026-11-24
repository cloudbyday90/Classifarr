# v0.49.5-beta release design

The maintainer approved publishing this exact beta on 2026-11-24 and
choosing GitHub's full-release status so the repository displays its
Latest badge. Use the [release runbook](../../.agent/workflows/release.md).
The package version, UI label, Git tag and public notes retain the beta
identifier. The CI publication step sets Latest only when publishing the
verified draft for this exact tag. Future beta tags retain their normal
pre-release flag.

## Candidate and upgrade

- Base the release on clean main. Use the previous published v0.49.4-beta
  as the changelog comparison, and preserve the detailed development
  archive. See the [changelog review](release-0.49.5-beta-changelog-review.md).
- Align the three manifests and lockfile roots, UI, README and notes.
  Verify the assembled publication text and all strict lock installs.
- Five startup migrations add retry lineage and widen the saved intake,
  routing-check and reclassification History links. Test the checked-in
  schema and supported upgrade against an exact local verification image.
  Leave live databases and media volumes outside the rehearsals.
- Docker Hub reported 22,338 image pulls for `cloudbyday90/classifarr` at
  08:38:25 Eastern on 2026-11-24. This count excludes GHCR.
  [Repository statistics](https://hub.docker.com/v2/repositories/cloudbyday90/classifarr/)

## Security and verification

The historical release exception covered npm 12.2.1's bundled parser. Check
the actual `socks` resolution of `ip-address` 10.7.5 in the pinned npm 12.2.2
toolchain and builder, plus absence of the package manager from the production
image. Inspect both CI toolchain and Docker pins. Keep independent development
and runtime advisory findings visible. [npm qualification](npm-12-2-2-security-outcome.md) ·
[Production image design outcome](production-image-package-manager-outcome.md)

Require fresh source and coverage gates, application audits, security review,
schema and recovery smoke, real installation/routing, provider faults,
production-policy browser checks, and the frozen no-cache rehearsal. Keep
exact source/image identity and owned-resource cleanup with the results.
Verify the protected GitHub settings and exact pushed SHA before tagging.
Tag CI signs the multi-platform index and v4 evidence, runs both native
routing consumers and arm64 scheduled recovery, publishes the immutable
release and promotes the original digest in both registries.

## Release-page retention

Retain the newest 30 published GitHub releases including v0.49.5-beta.
The approved deletion set contains 158 older pages, from v0.46.2b-beta
through v0.12.1-alpha. Inventory found zero immutable releases, uploaded
assets or attached discussions in that set. Archive their original notes and
metadata and verify the archive before deletion. Recheck exact IDs, tags
and retention boundaries after verifying the new release. Preserve Git
tags and registry versions. The automatic Docker Hub retention job skips
this exact release as part of that scope.

GitHub ties its Latest badge to full-release status. GitHub's immutable
release flow preserves the tag and signed assets. The project uses the
usual attested draft flow for this status decision.
[GitHub Releases API](https://docs.github.com/en/rest/releases/releases) ·
[GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
