# GHCR Manifest Retention Inventory

## Status

Implemented as a read-only operational inventory. It is not a deletion tool,
a release gate, or a replacement for published-digest smoke verification.

## Problem

Classifarr publishes multi-platform images. A release tag resolves to an OCI
image index, whose child manifests include at least the AMD64 and ARM64 image
variants and may include attestation manifests. GitHub Packages can list those
child manifests as untagged package versions even while a retained tag still
needs them. Generic package-version deletion can therefore leave a tag visible
but unpullable on one or more platforms.

## Research And Options

The design uses the GitHub REST Packages API version `2026-03-10`, the June
2026 API baseline. GitHub documents that container images use package type
`container`, package-version listing is paginated with a maximum `per_page` of
100, and package metadata requires `read:packages`. Package deletion requires
the additional `delete:packages` scope. The inventory deliberately accepts no
delete-capable input and issues no mutation request. [GitHub Packages REST
API](https://docs.github.com/en/rest/packages/packages)

Docker documents that a multi-platform image is a manifest list or index whose
children are platform-specific manifests. Registries store both the index and
the child manifests, then choose the appropriate child when an image is
pulled. [Docker multi-platform image structure](https://docs.docker.com/build/building/multi-platform/)

GitHub's recommended image-publishing pattern uses `GITHUB_TOKEN` with only
the package permission needed for publication. This supports keeping the
regular release workflow write-scoped while an operator-owned inventory uses a
separate read-only token. [GitHub Actions Docker image
publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Generic package-version deletion | Simple and can reclaim storage quickly | Cannot distinguish a child manifest from an orphan; already caused a broken multi-platform release | Rejected |
| Automated graph-aware deletion | Can eventually reclaim demonstrably orphaned artifacts | Requires durable graph-completeness, retention, rollback, and approval controls across registry and package APIs | Deferred |
| Read-only manifest-aware inventory | Verifies the actual retained graph, prevents automatic deletion, and produces an auditable review set | Does not reclaim storage by itself | Selected |

## Final Recommendation Stack

1. List active `container` package versions through the GitHub API using a
   token with `read:packages` only.
2. Collect every tag from that metadata, acquire a pull-only GHCR bearer token,
   and `GET` each tagged manifest.
3. Recursively `GET` every manifest descriptor reachable from each tag. A
   tagged index and every reachable child is protected.
4. Mark an untagged package version as `manual_review_required` only. If any
   tag or child cannot be read, mark the graph incomplete and do not identify
   any artifact as eligible for removal.
5. Keep deletion out of this tool and out of the release workflow. Any future
   removal design needs a separate approved proposal, a fresh complete graph,
   and post-removal pull verification on every supported platform.

## Implemented Contract

`scripts/generate-ghcr-manifest-retention-inventory.mjs` is the CLI wrapper.
The logic lives in
`scripts/lib/ghcrManifestRetentionInventory.mjs` so graph traversal and the
output contract have focused tests.

The command accepts only `--owner` and `--package`. It gets credentials from
`GH_TOKEN` or `GITHUB_TOKEN`; neither token nor the short-lived registry bearer
token is written to the report. The report is written only beneath
`.tmp/ghcr-manifest-retention/` with owner-only filesystem modes.

The only allowed request method is `GET`:

- `GET /users/{owner}/packages/container/{package}/versions`
- `GET /token?scope=repository:{owner}/{package}:pull`
- `GET /v2/{owner}/{package}/manifests/{tag-or-digest}`

The report states `deletionEligibleArtifacts: 0` unconditionally. Its useful
states are:

- `protected`: a tagged package version, tagged root digest, or child reachable
  from a tagged root;
- `manual_review_required`: an untagged digest that is not in a complete
  retained graph, a version without a usable digest, or any untagged artifact
  observed while graph resolution is incomplete.

## Operator Procedure

Use a separate GitHub token with package read access. Do not reuse a token that
has `delete:packages` when a least-privilege token is available.

```powershell
$env:GH_TOKEN = '<GitHub token with read:packages>'
$env:GHCR_ACTOR = '<GitHub account that owns the token>'
npm run ghcr:retention:inventory
Remove-Item Env:GH_TOKEN
Remove-Item Env:GHCR_ACTOR
```

Review the generated JSON before considering any storage action:

1. `manifestGraph.complete` must be `true`.
2. `unresolvedReferenceCount` must be zero.
3. `incompleteRetainedTags` must be empty. Any listed tag is a retained but
   broken image graph and needs incident follow-up, not storage cleanup.
4. Every retained release tag and `latest` must resolve to the expected root
   digest.
5. Every platform and attestation child must be listed as `protected`.
6. Treat `manualReviewRequired` as a queue for human investigation, not a
   deletion list.

## Validation

`server/src/__tests__/scripts/ghcrManifestRetentionInventory.test.mjs` covers a
complete index graph, an unresolved child manifest, CLI bounds, GET-only
requests, and credential exclusion from the report. Run it with:

```powershell
cd server
node scripts/run-jest.mjs --testPathPatterns="ghcrManifestRetentionInventory.test.mjs" --no-coverage
```

## Outcome

GHCR retention review now has a safe evidence source. It will detect the same
index-child relationship that generic package cleanup ignored, but it cannot
modify the package registry or publish a release.
