# Published Image Release Retirement

## Status

Implemented as a read-only assessment for a retained image tag whose OCI graph
is incomplete. It establishes evidence and an operator boundary; it does not
remove a package version, retag an image, update a GitHub release, or publish a
replacement image.

## Problem

The previous `v0.48.0b-beta` incident left a tagged OCI index present in GHCR
while two child manifests referenced by that index returned `404`. The linked
GitHub release is immutable. Retagging or rebuilding that version would make a
published release claim change after publication, while generic package-version
deletion can remove more manifest children from any retained multi-platform
index.

## Research And Options

GitHub Packages supports listing and deleting container package versions, and
its documentation warns that deleting a package can affect project consumers.
GitHub Releases are independently managed resources, and the release API
exposes whether a release is immutable. Docker documents that a multi-platform
image is an OCI index or manifest list with platform-specific child manifests.
Each conclusion below follows from keeping the release record and every child
manifest independently intact. [GitHub Packages lifecycle](https://docs.github.com/en/packages/learn-github-packages/deleting-and-restoring-a-package)
[GitHub Packages REST API](https://docs.github.com/en/rest/packages/packages)
[GitHub Releases REST API](https://docs.github.com/en/rest/releases/releases)
[Docker multi-platform images](https://docs.docker.com/build/building/multi-platform/)

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Republish the affected tag | Restores a familiar tag quickly | Changes the image behind an immutable release and invalidates the original evidence trail | Rejected |
| Generic package-version deletion | Simple implementation | Cannot prove a child manifest is orphaned; can make retained images unpullable | Rejected |
| Immediate remote retirement | Removes a known-bad user path | Destructive, not reversible by this repository, and needs an incident communication decision | Deferred pending explicit approval |
| Read-only retirement assessment | Binds a fresh graph inventory to the exact GitHub release; preserves all evidence; grants no mutation authority | Does not remove the broken tag by itself | Selected |

## Final Recommendation Stack

1. Run the graph-aware GHCR retention inventory with a token limited to package
   read access.
2. For any incomplete retained tag, fetch only its GitHub release record and
   generate a bounded retirement plan.
3. If the release is immutable, do not republish or edit it. Publish an
   external advisory that names the exact release and root digest instead.
4. Require separate, recorded operator approval for any remote retirement.
   Re-run the inventory immediately before and after that action, then verify
   retained image pulls on all supported platforms.

## Implemented Contract

`scripts/generate-published-image-release-retirement-plan.mjs` is a narrow CLI
wrapper over `scripts/lib/publishedImageReleaseRetirementPlan.mjs`. It accepts
only one value, `--tag`, and writes its report only to
`.tmp/published-image-release-retirement/`. The implementation makes a fresh
inventory request and a GitHub Releases request. Both paths allow only `GET`.

The generated plan includes:

- the named tag, tagged root digest, and unresolved child references;
- the release's immutable, draft, prerelease, source, and URL fields;
- a hard recommendation not to republish the tag or use generic package
  deletion; and
- an explicit false value for package, registry, and release mutation
  authorization.

No GitHub token or GHCR bearer token is written to the plan.

## Operator Procedure

Use an operator-owned token with package read access and repository read access.
A token without `delete:packages` is preferred.

```powershell
$env:GH_TOKEN = '<GitHub token with read:packages and repository read access>'
npm run release:assess-image-retirement -- --tag v0.48.0b-beta
Remove-Item Env:GH_TOKEN
```

Read the report before taking any other action. A recommendation of
`immutable_release_requires_external_advisory` means that this repository has
intentionally stopped. The required next approval is a separately scoped,
remote incident-retirement decision, including the advisory location, exact tag
and digest, approved operator, rollback stance, and post-action inventory and
pull evidence.

## Verification

`server/src/__tests__/scripts/publishedImageReleaseRetirementPlan.test.mjs`
checks the GET-only boundary, immutable-release recommendation, inventory
fail-closed behavior, missing-release handling, token redaction, and narrow CLI
contract.
