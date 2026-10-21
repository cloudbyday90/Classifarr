# Powered-off study VM creation outcome

Native follow-up: the first administrator invocation returned an uncertain
capture result, followed by a reviewed manual attempt blocked before writes at
the parent ACL check. See the [capture follow-up](study-vm-capture-outcome.md) and
[private-directory outcome](study-vm-directory-outcome.md). Earlier
mock/image evidence below did not qualify real Windows module-loading output,
and does not establish the state left by that invocation.

## Delivered scope

The grill-me workflow settled the existing resource profile and the user's exact
local target choice before implementation. The recovery guidance preserved
uncertainty after side effects, and the evidence guidance keeps synthetic tests,
image checks and actual administrator creation separate.

Delivered a pure ESM plan/CLI, a fixed PowerShell query module and one-shot
execution using the existing bounded asynchronous command primitive. Added
automated tests and the high-level Unreleased entry. No app API, database,
credential, scheduler, inference or production deployment is changed.

Planning checks observed by the user in Administrator PowerShell reported about
27 GiB free RAM, 16 logical processors and 727 GiB available on the shared
VM/disk volume, with proposed names and child directories unused. These are
point-in-time prerequisite observations, not reservations or live qualification.
The creator repeats its own checks immediately before writing.

The temporary preflight initially mishandled backslashes through two language
layers. That was reproduced and corrected locally, with positive Windows-path
and negative UNC/relative-path tests. The committed creator uses a raw fixed
PowerShell template and transports parent paths as base64 JSON data instead.
Its fixed stdin bootstrap also avoids Windows' command-line length ceiling.

## Verification and limits

Final Windows checks passed:

- Creator: nine tests passed, no skips, including 20 fully synthetic PowerShell
  scenarios, real child timeout/output termination, and the native token guard
  with all infrastructure cmdlets mocked. SID lookup is replaced only in those
  synthetic scenarios; the production creator still resolves the actual VM SID.
- Gateway/preflight: 202 of 204 tests passed; two existing Windows symlink
  privilege skips remain explicitly disclosed. Copyright and both dependency
  checks passed; inventory ownership review has no unreviewed static drift.
- Full lint, server/client type checks, static-import check and Markdown
  validation passed. Markdown checked 2325 files with zero errors.
- Real application server/client code is unchanged; their full test suites were
  not rerun for this standalone tooling-only change.

Creation has not been invoked from the agent's non-administrator process. No VM, fixed disk,
switch, installer, network setting or permission has been changed by this work.
PowerShell positive-path tests use synthetic cmdlets, not real provisioning;
administrator-token and new VM SID resolution remain native qualification work.
No safe lifecycle, SSH handoff or study-readiness claim is made.

## No-cache image-only evaluation

Evaluated clean code/test subject: `3801d051df65c5d3af98f60365b8bb363933a996`.
The protected Compose build completed with `--no-cache --require-provenance`.
It built the separate local `classifarr:archive-binding` tag, without replacing
the normal container or publishing a release.

| Identity | Value |
| --- | --- |
| Local image/index ID | `sha256:ca2d8c17f79848c740180330ca62bbcde561eca2b27534d9d8bed20798a46aef` |
| Exported Linux/amd64 image manifest | `sha256:b0f3a7d0de7a8842dd28d7cd134900c105e11683dd358b3707c376a94b27f324` |
| Exported image config | `sha256:a52683c873b11d3be27e0b9a2341ddcb822802b20d786ff6acf602f9c2d0ea2a` |
| Matching committed source bundle SHA-256 | `e4489b95a5c48f2ebc5173392ace99799b8d6d1d2ee675a2b104bf299a8fd8c6` |

The local image revision matched the evaluated source. These are local build
identities, not published registry verification or signed source authentication.

In that exact image, **203 of 204 gateway tests passed**, with one disclosed
Windows-only PowerShell test skipped. Both existing symlink tests ran on Linux.
The full matching committed bundle was extracted separately into `/work`; it did
not replace image application source/dependencies. Tests ran sequentially as
UID/GID 1000 with no network/socket, read-only root, all capabilities dropped,
no-new-privileges, one CPU, 512 MiB with no extra swap and 64 PIDs. The `/work`
and `/tmp` tmpfs limits were 256 MiB and 128 MiB. All tests completed in 25.46 s.
The exact test container `classifarr-vm-creation-3801d051df65` was absent before
creation and after automatic cleanup. No database, inference, VM or study ran.

Normal Classifarr retained container
`560a828dc2123f066acfee0d309731b9a405a7a086065ddf7310a49ca6830a2e`, image
`sha256:82a6025389df3ebfddb4ff47f4ee7f375cd7281e0d66b8b903c0acd733154baa`
and start time `2026-10-20T15:56:46.339240429Z`. It remained healthy with zero
restarts/OOM kills; `/health`, `/ready` and `/` returned HTTP 200. Candidate unit
tests are not evidence of a new application deployment or native Hyper-V creation.

At recording time, source-commit Copyright, Gitleaks, OSV, Trivy and Resource
Capacity workflows had succeeded. The exact source's
[CI/CD run](https://github.com/cloudbyday90/Classifarr/actions/runs/39584056386)
and CodeQL were still running; no all-CI-green claim is made. This documentation
follow-up is separate from the evaluated code/image subject above.

## Open PR

GitHub MCP enumeration on 21 October 2026 returned only
[PR #568](https://github.com/cloudbyday90/Classifarr/pull/568). Its server ESLint
10.13.0 change is already present in both manifest and lockfile on main. There
is no unapplied eligible PR to implement; it was not merged, closed or reapplied.

## Next item

Run the creator once in the user's already-authorized administrator window and
inspect its result. If blocked/uncertain, review the exact targets before any
further action. If `created_off`, verify the official Ubuntu Server LTS amd64
installer signature/hash, install the guest and configure the separately
reviewed Internal network and SSH handoff. Keep the VM off outside explicit
setup/test jobs. The four-arm study remains gated on real guest and lifecycle
qualification; no release is created.
