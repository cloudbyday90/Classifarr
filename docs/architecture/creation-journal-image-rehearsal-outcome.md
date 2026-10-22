# Creation journal image rehearsal outcome

## Requested evaluation

On 22 October 2026 invoked the approved existing frozen rehearsal with
`--no-cache` against clean source
a6724e0d2d902903bd82f609a58ef7101649c7e1 on main. Docker Engine 29.8.2 and
Compose 5.6.0 were available. The intended evaluation was one immutable local
candidate, a 30-minute synthetic soak plus settled idle, and standard/saved
Unraid/custom installation fixtures. No default live Compose recreation was
selected. See the [design](study-vm-creation-journal-design.md).

## Observed result: blocked before build

The required published-baseline attestation verification failed authentication
using the inherited GITHUB_TOKEN override. The subsequent bounded, read-only
gh auth status check with unchanged credential precedence also reported
authentication rejection, not a timeout. No token, account, raw response or
credential was printed, changed, removed or substituted.

The runner's v2 receipt retains preflight/authentication_failed, disabled build
cache, null candidateImageId, unverified soak/profiles and unverified cleanup.
No build/candidate callback ran and no generated image/project/volume ownership
was acquired; there was nothing from this run to delete. Its worktreeClean field
is set true only after complete success: false in this blocked receipt does not
contradict the clean initial Git admission. Do not edit that flag or promote
unverified gates to passed.

The pinned baseline remains v0.48.4-beta at immutable manifest digest
sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f,
source a0e417fd714919bb4ca30e20f9cd2380136ca74e. No digest, signer workflow,
source constraint or other gate was weakened. This is not a completed no-cache
build, image/runtime evaluation, published-image attestation or release receipt.

Private local receipt/summary are under .tmp/release-rehearsal. Previous local
receipt/summary were copied to a separate ignored backup directory before the
existing runner wrote its output. No old VM binding/receipt was read or changed.
The existing local Classifarr container remained running and healthy afterward;
all newly owned Windows journal test roots were absent.

## Required next step

Correct the intended GitHub credential externally, or explicitly agree omission
of the inherited override for this local invocation using the intended stored
CLI identity. Do not switch accounts or retry with another identity silently.
Then rerun the complete existing rehearsal on a new clean committed checkout;
do not splice earlier checks into a synthetic pass. No release, image push,
production deployment, old cleanup retry or actual Unraid/Ollama access follows
from this blocked evaluation.
