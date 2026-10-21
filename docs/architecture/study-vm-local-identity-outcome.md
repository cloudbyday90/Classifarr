# Study VM local-identity correction outcome

## Cause and correction

On 21 October 2026 the administrator's read-only precreation check reached
`collisions`, then failed at the `Get-VM` inventory call. No writer was included
in that probe. A matched experiment using fresh Windows PowerShell children,
fixed read-only queries, built-in module lookup and restricted environments found:

| Child | Administrator | Result |
| --- | --- | --- |
| Original filtered environment | Yes | Inventory failed; inner `ArgumentNullException`, HRESULT -2147467261 |
| Same environment plus OS-derived process-local hostname | Yes | Inventory succeeded, zero VMs |

The non-administrator control similarly changed from the null-argument failure
to the expected permissions refusal. This establishes a process-environment bug,
not a VM collision or evidence requiring Hyper-V service/ACL repair. Raw errors,
hostnames, VM names and identities were not emitted by the diagnostic.

Implemented the [local-identity design](study-vm-local-identity-design.md):
derive the child hostname from Windows, retain environment filtering and stop on
identity errors before reading/executing input. The same change set includes the
separately documented [hidden-metadata correction](study-vm-hidden-path-outcome.md).
No privileged mutation, VM creation, restart, shared permission change,
Unraid/shared Ollama change, study or release was performed by these tests.

## Verification

The new Windows bootstrap regression failed before the fix: its nonempty/native
identity observations were both false. It passed afterward, with caller-provided
identity ignored, private variables absent and the parent environment unchanged.
A synthetic native-identity failure prevented the input marker from executing.
The test replaces the entire input, so cannot execute the production writer.

All 16 committed creator/directory tests passed on Windows with no skips, along
with six temporary read-only diagnostic/preflight tests. Full CI preflight passed
209/211 tooling tests; the two existing Windows symlink-privilege cases remain
skipped. Copyright (1,789 files), static ownership inventory (no unreviewed drift,
not runtime authorization), both dependency checks, full lint, server/client type
checks, static ESM imports and Markdown (2,332 documents) passed. No dependency,
schema, application HTTP contract or security baseline was changed.

The administrator experiment verifies inventory only; a complete read-only
preflight and actual production-owner/native VM configuration remain separate
checks. The full fixed preflight was requested; its administrator result has not
yet been received. A successful observation never grants study readiness.

## No-cache image evaluation

Built with the existing protected smart-Compose path, `--no-cache`,
`--require-provenance` and `--protect-running-image`, from clean source
`55d5ebaf44f21a80796d124852b61854bf77e75d`. No `up`, deployment or release ran.

| Subject | Identity |
| --- | --- |
| Local image/index ID | `sha256:e522600dfad3cb47aacd27781b2017bf712f963e8973f15d58073b234000df93` |
| Linux amd64 child manifest | `sha256:4923a6e98babef6c3454043122b71ca457bf94e594314cc09de98c33f1ca3c72` |
| Image config | `sha256:fcaf527a7df5e5e313874da0ef447412f4f5cbfab067d84b4193ab46efead807` |
| Source archive SHA-256 | `2c530797d059252b07cf9ecc21c82df9fd3a7c92f93d57131051fc5dcfc0d63c` |

The 80,834,560-byte `git archive` source bundle was extracted into a disposable
tmpfs, not over `/app`. The fixed ESM driver verified its hash and byte equality
of the packaged creator, creation query and native-directory query with the
exact committed source. The image's revision label matched the source; this is
local image evidence, not signed published/multi-platform provenance.

The gateway suite reported 211 cases: **204 passed, seven Windows-only skips**, zero
failures, 24.65 seconds. `docker wait` returned zero. Native Windows behavior is
supported by the separate tests above, not by these Linux skips. The default
application entrypoint, databases and inference were not started.

The exact test container `classifarr-vm-identity-55d5ebaf44f2` was absent before
and after the run. Actual inspection confirmed UID/GID 1000, network `none`,
read-only root, nonprivileged, all capabilities dropped, no-new-privileges,
512-MiB memory/no extra swap, one CPU and 64 PIDs. Inputs were read-only binds;
working/tmp storage was bounded tmpfs (256/128 MiB). No live appdata, credentials,
Docker socket or host VM directories were mounted. Its `--rm` cleanup completed;
no live history was deleted.

The normal Classifarr container remained
`560a828dc2123f066acfee0d309731b9a405a7a086065ddf7310a49ca6830a2e`, on image
`sha256:82a6025389df3ebfddb4ff47f4ee7f375cd7281e0d66b8b903c0acd733154baa`,
started `2026-10-20T15:56:46.339240429Z`, healthy with zero restarts and no OOM.
Its verified rollback reference still resolved to that original image.
`/health`, `/ready` and `/` each returned HTTP 200 afterward.

## Remote checks and PR scope

At recording time, copyright, Gitleaks, OSV and Trivy workflows for the exact code
commit succeeded. [CI/CD](https://github.com/cloudbyday90/Classifarr/actions/runs/39593227534),
CodeQL and resource-capacity workflows were still in progress; no all-green CI
or release-readiness claim is made. Local staged secret scanning found no leaks.

The GitHub MCP found only open [PR #568](https://github.com/cloudbyday90/Classifarr/pull/568).
Its ESLint 10.13.0 change is already present in the server manifest and lockfile
on `main`. There was no eligible unapplied open PR to select. No PR was merged,
closed or modified, and no dependency update was repeated.

## Next step

Repeat the complete read-only precreation check with the fixed bootstrap. Only
after every check passes should the administrator consider one reviewed creation
attempt; the creator must repeat fresh checks itself. Preserve uncertain results
for independent review, with no automatic retry, adoption or deletion. Following
verified powered-off creation, authenticate the official guest installer before
adding a guest or networking.
