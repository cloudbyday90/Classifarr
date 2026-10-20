# Read-only VM handoff checks: outcome

Date: 20 October 2026. Code subject:
`0bf68bc71304928d0b4afa691b1be3aed15edc85` on `main`. This outcome is a
documentation-only follow-up to the exact code/image tested below. See the
[approved design, official sources and tradeoffs](vm-handoff-checks-design.md)
and [administrator guide](../operations/gateway-hyperv-setup.md).

## Delivered

- Version-2 preparation profile/results require no host-boot automatic startup,
  graceful host-stop policy and host shutdown-service enablement. The fixed
  PowerShell query remains read-only, targeted and bounded to 10 seconds/64 KiB.
- A separate guest-local module observes the Linux shutdown VMBus class and its
  `hv_utils` binding twice, bounded to 128 devices and 40 bytes per class read.
  Missing, malformed, duplicate, changing or unreadable observations cannot match.
- An explicit local-file mode checks a version-1 handoff record, UUIDv7 record ID,
  independently selected VM/switch IDs, private literal SSH endpoint and Ed25519
  public-key/fingerprint consistency. It rejects unknown/approval fields,
  duplicate JSON keys, unsafe links, changed files, bad UTF-8 and oversized input.
  Unix owner/mode checks are distinct from unverified Windows ACL privacy.
- All modes keep authentication, live operations and study readiness false.
  No table, dependency, server/client API, scheduler, admin UI or background
  service was added. Unreleased and the setup guide were updated.

## Challenges addressed and remaining weaknesses

Testing and review caught a mistaken test close-count assertion and a key-parser
weakness: ASCII decoding can conceal a high-bit byte. Algorithm names now require
exact bytes, with a regression case whose malformed key has a consistent hash.
The reader also tests replacements, changed metadata, growth, short/failed reads,
close failures, links and permission failures without printing private input.

Configuration is not behavior. Host shutdown enablement and a bound guest channel
do not demonstrate protocol negotiation, draining, power-off or identity. Two
reads are not an atomic snapshot. A valid UUIDv7, private address or public-key
hash cannot authenticate the record's author or its target. Windows ACL/directory
privacy and local-filesystem suitability still need administrator review; file
reads have byte/count limits, not a remote-filesystem wall-clock guarantee.

The actual Hyper-V target remains unverified: current-user VM management was
denied during read-only planning, and no real administrator handoff was supplied.
No permissions, VM power, network settings, SSH keys or known-hosts files changed.
No Unraid, shared Ollama, production data or real study was touched. The existing
lifecycle model remains simulation-only; no automatic power control was enabled.

## Verification

Windows Node `24.21.0`, npm `12.2.0`:

| Check | Result |
| --- | --- |
| CI preflight | Passed: copyright, ownership drift and both dependency inventories |
| Full gateway tooling | 193 passed, 0 failed, 2 Windows symlink skips |
| Focused VM coverage | 100% lines across nine VM modules; 98.60% aggregate branches |
| Dependency tooling | 58/58 passed; installed root/client redirect checks retained |
| Type checks, lint, static ESM imports | Passed |
| Markdown | 2323 documents passed, including this outcome |
| Staged secret scan and diff whitespace | Passed |

Coverage is synthetic contract evidence, not Hyper-V or SSH qualification. Native
Linux testing below exercised both real symlink cases skipped on Windows.
The full backend/frontend suites were not rerun for this scripts/docs-only change;
their application source and dependencies are unchanged.

The clean code commit was built using the existing smart Compose wrapper with
`--no-cache --require-provenance --protect-running-image`. Build completed,
including the production frontend bundle. Local Linux/amd64 identities:

| Identity | Value |
| --- | --- |
| Local index/image ID | `sha256:63efb84ca0dbcfd66b5d5c20a88fdcbdac3e51a4784ff7902d2d979adcac5a48` |
| Platform manifest | `sha256:1293a8e1580727f3ed4a26e8f15dd1c63b71710524b65ce113c163ca63a4da63` |
| Image config | `sha256:759974738c51096ae600c2d197f9522023e1b11939e0c122b57cec75243d443d` |
| Committed tooling bundle SHA-256 | `9924e82717ed6db41de54ef3ba9df190f6f8643c1efbad61f23540edcf805d93` |

That immutable image ran all **195/195 gateway tests**, zero skips/failures,
exit 0, in 24.924 seconds. The 37,632,000-byte Git archive was hash-checked before
extraction under `/work`, not mounted over application code. Launch restrictions:
UID/GID 1000, network none, read-only root, all capabilities dropped,
no-new-privileges, 512 MiB memory/no extra swap, one CPU, 64 PIDs, bounded private
tmpfs work/temp/data, no Docker socket or production mounts. The temporary
fixture's absence was verified after automatic removal. No Docker prune ran.

This is committed tooling exercised in the rebuilt runtime, not a fresh-install,
upgrade, published multi-platform or signed-provenance qualification. No real
guest shutdown, SSH session, inference/archive comparison or latency claim follows
from these tests.

The normal Classifarr container retained its exact image and start time, remained
healthy with zero restarts/OOM, and returned HTTP 200 for `/health`, `/ready` and
`/`. Its rollback image reference was preserved. It was not replaced by the
candidate. No Git tag, release or registry publication was created.

## Open PR and final recommendation

GitHub MCP enumeration found only [PR #568](https://github.com/cloudbyday90/Classifarr/pull/568),
the server ESLint `10.13.0` update already present on `main` in both manifest and
lockfile. Current lint checks passed. There was no eligible unapplied open PR;
nothing was re-applied, merged or closed, and no unrelated dependency update was
substituted.

Keep these repeatable read-only gates: they catch configuration/input mistakes
without new operating authority, at the cost of leaving real lifecycle readiness
unproven. The recommended stack remains private reviewed handoff → independent
target checks → authenticated host/guest binding → native image/isolation/shutdown
qualification → durable job ownership, admission/drain and bounded lifecycle
executor. Next is the real administrator-reviewed handoff and native qualification,
not enabling power commands or another shared-host timing attempt. A later change
must agree execution authority and verify those prerequisites before operating
the as-needed VM.
