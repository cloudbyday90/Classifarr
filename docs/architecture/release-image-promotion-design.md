# Verified release image promotion

Date: 2026-10-03. Scope: release automation, not runtime services or deployment.

## Decision

Publish versioned images, verify the exact published digest, publish the immutable
GitHub release, then advance `latest` in both registries. No rebuild, new sidecar,
Compose edit or Unraid template change is needed. Existing installations keep
their current image until their normal update process pulls an accepted alias.
This preserves the existing policy allowing approved beta releases at `latest`.

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Write latest during build | Earliest availability | Failed candidates reach alias users | Remove |
| Independently rebuild after tests | Separate publishing step | Digest differs from the tested artifact | Reject |
| Promote the verified index | Preserves tested bytes and shared checks | Extra verification; two registries are not atomic | Select |

## Recommendation stack

1. Keep versioned availability separate from default-alias availability.
2. Require immutable release, exact asset, CI attestation and v3 evidence.
3. Preflight both complete manifest graphs, including attestation children.
4. Serialize all automatic/manual writers and reject backward source ancestry.
5. Copy one same-registry index by digest; verify alias, graph and native pull.
6. Preserve per-registry failure evidence; explicitly retry without rebuilding.

## Implementation

The existing CI workflow disables metadata-generated latest tags explicitly.
`promote-published-latest` depends on Docker publication, consumer smoke, native
AMD64/ARM64 routing and immutable release publication. It calls the reusable
`promote-published-release-image.yml`; manual dispatch uses that same job.

The job uses the `release-publication` environment, one shared concurrency group,
30-minute deadline, pinned actions and contents/attestations read permission.
Only package writes and the existing Docker Hub credential are needed for aliases.
Checkout has full ancestry and no persisted credentials. No repository-content
write, new token, Docker socket mount or production data access is introduced.

Modular ESM responsibilities:

- `releasePromotionCommand.mjs`: shell-free bounded commands, sanitized errors.
- `releasePromotionAuthority.mjs`: release/asset metadata bounds, immutable
  release and asset verification, current evidence schema, exact CI provenance.
- `releaseImagePromotion.mjs`: graph hashes, both platforms, all children,
  ancestry guard, idempotent writes and per-registry receipt.
- `promote-release-images.mjs`: read-only default, explicit `--write`, automatic
  same-run/attempt identity and fixed public-safe receipt location.

The current alias's source label is accepted only after attestation verification
of its index. `git merge-base --is-ancestor` then rejects a delayed older source
or divergent history. This is source ordering, not semantic-version ranking;
same-source builds remain eligible. Registry aliases are rechecked before writes.
External writers with registry credentials can still race the workflow; restrict
those credentials to this publishing path. This is not a registry compare-and-swap.

## Failure and retry policy

Both registries must pass preflight before either write. A write timeout may
already have changed an alias: `write_started` is intentionally uncertain, not
"unchanged". The receipt retains a fixed phase and active registry, never raw
CLI output. Post-write digest/graph checks and native pulls must pass in each
registry. A failure never silently rolls back the other registry. Retry verifies
the same signed release again and skips an alias already at the expected digest.

GitHub's default concurrency may cancel an older pending job when another is
queued. That is safe but not a guarantee that every request runs; inspect job
status and explicitly retry the desired release if needed. Running promotions
are not canceled by this group. A later job still must pass the ancestry guard.

The repository's inspected environment policy allows `v*` tags only. Manual
dispatch must select the release tag and a matching `source_tag`. Running on main
cannot bypass environment policy. No environment policy was changed in this work.

Missing latest, an incomplete current graph, unknown attestation/ancestry or
historical v1/v2 evidence stops promotion. There is no force/bootstrap mode.
Those repairs need separate review; a transport error is never treated as proof
that an alias is absent. Older evidence remains readable for historical review.

## Research

Official sources discovered and checked through web search on 2026-10-03:

- [Docker Buildx imagetools create](https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/):
  a single existing manifest-list/index source produces a carbon copy. Use the
  already-published digest in each registry, not a rebuilt image.
- [Docker manifest inspection](https://docs.docker.com/reference/cli/docker/buildx/imagetools/inspect/):
  raw manifests and structured manifest/config output support identity checks.
- [Docker metadata action](https://github.com/docker/metadata-action):
  explicitly disabling latest generation avoids relying on tag-flavor defaults.
- [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency):
  shared groups serialize jobs; cancellation/queue behavior is not source ordering.
- [GitHub release asset verification](https://cli.github.com/manual/gh_release_verify-asset):
  verifies the asset digest against the selected release attestation.
- [OpenAI skill authoring](https://learn.chatgpt.com/docs/build-skills):
  extend the existing narrowly scoped skill with a focused reference rather than
  duplicating a broad release skill. Its guidance does not authorize publication.

## Verification and next work

See the separate [outcome](release-image-promotion-outcome.md). Unit tests exercise
rejection, partial failure, no-write dry runs and workflow mutations. Real registry
reads are not proof that a new release was promoted. No release is authorized here.

Next product-maintenance round: resume dependency and tooling review, prioritizing
security fixes and compatible updates. Resolve any blocking CI regression before
accepting a dependency batch; do not replace the installation gate with a skip.
