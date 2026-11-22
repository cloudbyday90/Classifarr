# Published arm64 scheduled crash rehearsal outcome

November 22, 2026 Eastern.

The [design](published-arm64-recovery-design.md) adds a read-only native
rehearsal for an existing immutable release. The implementation is
`9f1424507e0c5a08bb9687f3a4ff74ceb6298af4`. The release, promotion and deployment
workflows were outside this change.

## Artifact verification

The existing GitHub release, its evidence asset and the asset's CI provenance
verified for `v0.49.4-beta`. The source revision is
`ef5b50ed1b1d24c9407f669eb11b4c35646bc620`. It is distinct from the harness
revision. Independent registry reads matched the index and arm64 child bytes
on GHCR and Docker Hub. GitHub CLI verified the index attestation against the
release-tag ref in both registries and rejected a branch-ref mismatch control.
[Immutable release](https://github.com/cloudbyday90/Classifarr/releases/tag/v0.49.4-beta)

| Identity | Digest |
| --- | --- |
| Index | `sha256:21d75a2940ffaa49aabc9ec94bad9e44cbb1b8dc7ba8b4a7f1689126146eacc2` |
| arm64 manifest | `sha256:ce630c865a15fb063c6c74271ab3ac80dd091207e005b50342b92aea6059db23` |
| arm64 config | `sha256:e9ae7ec554bfe5d667759fc15089eecddcb05b58498f8facf55b6403fb75de18` |

## Local verification

The 32 focused Node tests and 420 installation, provenance, promotion and
workflow tests passed. The real x64 entry point failed closed before image
resolution. Workflow lint, server test lint, static imports, Markdown and
repository preflight passed. The coverage ratchet reused the verified
reports for unchanged application inputs. The existing local Classifarr
container remained healthy with the same image and start time. GitHub
listed no open pull requests.

## Native rehearsal

The [published arm64 job](https://github.com/cloudbyday90/Classifarr/actions/runs/45062881655/job/137332504264)
passed on `ubuntu-24.04-arm` at 14:50 Eastern. The downloaded receipt matched
`main`, the harness revision, workflow run `45062881655`, attempt `1`,
immutable release ID `432125400`, and the independently verified image
graph. Docker used the config digest above as the local image ID.

The job verified fresh installation and the durable scheduled crash boundary,
then confirmed exit 137 without OOM. The replacement container recovered the
checkpoint on the same disposable volume. Ingestion and inventory stayed
unchanged, profiles became current, four backfill tasks completed and no
routing tasks were queued. Owned resources were removed. PostgreSQL's PID
lock refusal did not recur. The origin of the earlier emulated failure
remains unknown.

The automatic branch workflow also passed at the same harness revision
after the shared validation extraction. Its receipt identifies a separate
locally built image. [Native branch run](https://github.com/cloudbyday90/Classifarr/actions/runs/45062874377)

This qualifies the already published beta on the synthetic fresh-install
profile. No new release or deployment occurred. Future releases have
their own source and image identities.

## Next recommended item

Decide whether scheduled crash recovery should be required for future
publication. The existing release job already verifies published routing on
the exact arm64 child. A separate scheduled result bound to that same child,
run and attempt would add roughly one minute based on this run. Settle the
failure and receipt contract before making the new evidence mandatory.
