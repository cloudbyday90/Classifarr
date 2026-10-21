# Powered-off study VM creation outcome

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

The separate no-cache image-only evaluation is pending at this code checkpoint;
this is not a claim that a VM was created or the study ran.

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
