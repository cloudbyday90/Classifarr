# Published-image routing acceptance: design

Date: 2026-10-03. Scope: release verification, not runtime routing changes.

## Decision

Require the existing eight-phase routing upgrade/crash rehearsal against each
native platform of the exact published GHCR index before GitHub release
publication. Do not rebuild the candidate or accept a mutable tag. Keep the
fixed historical baseline build and synthetic, isolated fixtures.

The identity chain is:

`workflow source → signed index → verified child manifest → pulled image → routing receipt`

Docker distinguishes the multi-platform index digest from each platform's
manifest digest. Verify the raw index and child bytes with SHA-256; do not hash
reserialized JSON. Select exactly one Linux AMD64 or ARM64 descriptor. Docker's
classic store uses the config digest as image ID; our local containerd store
instead returns the manifest digest for a directly pulled child. Accept only
those two identities, verify platform/revision/repository digest, and require
the matching descriptor for a manifest ID. An index ID cannot substitute for
a selected child. This behavior was exercised locally, not inferred solely
from the revision label. [Docker digests](https://docs.docker.com/dhi/explore/security-concepts/digests/),
[Buildx inspection](https://docs.docker.com/reference/cli/docker/buildx/imagetools/inspect/).

Attestation verification requires the Classifarr repository, CI signer workflow,
expected source commit and hosted runner. A label alone is insufficient;
attestation establishes provenance, not correct behavior.
[GitHub attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations),
[signer constraints](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/increase-security-rating).

## Components and boundaries

- `publishedRoutingSubject.mjs`: bounded shell-free attestation/registry/Docker
  inspection; reject unsupported or ambiguous identities before container work.
- `publishedRoutingAcceptance.mjs`: borrow the verified candidate ID, build only
  the fixed historical baseline, reuse the existing rehearsal and require cleanup.
- `publishedRoutingReceipt.mjs`: exact bounded schema, two-platform completeness,
  same source/index/run/attempt, six-hour freshness and five-minute clock skew.
- `run-published-routing-acceptance.mjs`: strict flags, actual GitHub context,
  clean matching checkout before/after, fixed private artifact path, sanitized
  blocked receipt on failure. No live-volume or provider override.
- `published-routing-acceptance`: read-only tag job with a fixed native matrix,
  40-minute deadline, at most two concurrent jobs, no continue-on-error, no QEMU.
- Release evidence v3 embeds only validated bounded routing receipts. Creation
  uses trusted workflow context; historical v1/v2 records remain verifiable.
  Public hashes are integrity checks, not signatures; existing asset attestation
  remains required.

Native `ubuntu-24.04` and `ubuntu-24.04-arm` runners avoid calling an emulated
test native-platform coverage. [GitHub runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

The fixture retains production entrypoint, migrations, auth and scheduler;
containers use 2 CPUs, 2 GiB, 128 PIDs, no network/host ports, no capabilities,
non-root UID and read-only root. It verifies preserved retry allowance across
SIGKILL, provider pause/repair, history preservation, legacy non-enrollment,
two movie and two TV GETs, and zero attempted provider writes. Fixture deadline
adjustments do not prove real wall-clock cooldowns elapsed. Only labelled,
randomly named owned resources are deleted; published images are borrowed.

## Options and recommendation stack

| Option | Benefit | Cost / limit | Decision |
| --- | --- | --- | --- |
| Health smoke only | Fast, already implemented | Cannot prove routing recovery | Keep, insufficient alone |
| Rebuild then test | Easy local development | Not the published artifact | Local feedback only |
| Native digest routing matrix | Tests both shipped architectures | Two baseline builds; registry/runner dependency | Implement now |
| Promote `latest` after tests | Keeps failed candidates off the update channel | Needs separate promotion/alias-smoke redesign | Immediate next item |

The existing image job still writes the version tag and `latest` before consumer
tests. This round gates **GitHub release publication**, not registry publication
or all user pulls. No release is created to test this change. Full native
published-candidate evidence must come from an explicitly authorized tag run.

## AI skill and runbook modernization

Extend `classifarr-release-evidence` with a focused published-digest reference;
do not duplicate the skill or turn it into release authority. It must distinguish
local, signed, native, emulated and historical evidence, and surface the early
`latest` exposure. Small task-focused instructions and linked references follow
the official [skill guidance](https://learn.chatgpt.com/docs/build-skills).

Modernize `.agent/workflows/release.md` into six operational stages. Remove its
stale planned version, illustrative unmeasured percentage scores, automatic
execution hints, push-all-tags command and delete/retag recovery recipe. Require
fresh evidence and explicit tag/deployment authority. GitHub's immutable release
rules protect published tags/assets; additionally, our runbook avoids reusing
failed tags because registry artifacts can precede a GitHub release.
[Immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).

These edits do not change the UI, database, NAS templates, runtime permissions,
background recovery policy or release version. No W3C UI claim is made.
