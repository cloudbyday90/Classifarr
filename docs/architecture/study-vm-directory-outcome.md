# Private study VM directory outcome

## Delivered change

Implemented the user's approved
[private-directory refinement](study-vm-directory-design.md). The exact observed
parent-only ACE is recognized without adding All Virtual Machines to trusted
principals. Other entries still undergo independent checks; extra write,
delete, permission/ownership, inheritance and inherited flags refuse. The
exception never applies to owned child directories.

A small separate ESM module contains the fixed Windows native boundary.
`CreateDirectoryW` receives a protected descriptor during exclusive creation;
the previous `New-Item` then `Set-Acl` sequence is gone. The system library search
is limited to System32. Existing targets and missing parents refuse without
repair/adoption, and descriptor memory is released in `finally`. The created
child's protection, ownership, path and grants are checked before later work.
Unexpected child read-only/inherit-only grants also refuse.

No dependency, database/table, application API or CommonJS was added. Existing
parent ACLs, normal Classifarr, Unraid and shared Ollama are unchanged. No native
VM creation or power command ran during implementation. The on-demand/off-state
profile and no-automatic-retry contract remain unchanged.

## Verification so far

The observed parent-ACE regression failed before implementation with the same
`acl_review_required` refusal. It passed afterward. All 14 focused tests passed
on Windows, with no skips, including:

- Synthetic creator sequences with exact/hostile parent ACEs, child group
  grants, lost protection, native-boundary unavailability and a late collision.
  The entire native boundary and VM cmdlets are replaced in these scenarios.
- Actual production native-boundary compilation and Windows filesystem calls
  in new disposable fixtures. The children were protected immediately, without
  inheriting an untrusted inherit-only parent grant. Existing directories, files
  and a junction refused; existing ACLs/content and the fixture parent remained
  unchanged by those attempts. Missing parents and unprotected descriptors refused.
- Two concurrent native attempts produced one creation and one refusal. Fixture
  cleanup and absence were verified after both native tests.

The real filesystem fixtures deliberately use the current user's owner/grant,
not the production Administrators owner. This proves the native API boundary's
protection/inheritance/exclusion behavior without elevation. It does not qualify
the real VM directories, administrator owner setting, Hyper-V's SID resolution
or later provider-added permissions.

Full gateway/preflight checks passed: 207 of 209 tests, with the two existing
Windows symlink-privilege skips. Copyright checked 1789 files; both dependency
checks and static inventory ownership review passed with no unreviewed drift.
That ownership result is not permission for unresolved runtime paths.

Full server/client lint, both server/client type-check groups and static-import
checks passed. Markdown checked 2328 files with zero errors, and diff whitespace
checks passed. No real application API/runtime code changed; the full server and
client test suites were not rerun for this standalone Windows tooling change.
The small final native error-sanitization guard was separately rerun through all
three native-boundary tests, with no skips.

## No-cache image-only evaluation

Evaluated clean source: `fc47cbbaa76a93135580e84512bd4c236d9ec9c9`.
The protected Compose build completed with `--no-cache --require-provenance`
using the separate local `classifarr:archive-binding` tag. No normal container
was replaced and no image/release was published.

| Identity | Value |
| --- | --- |
| Local image/index ID | `sha256:d79a34779407a98d4ecbdddae508ca1909806a71e809d6bf87c08f1e5a740595` |
| Exported Linux/amd64 manifest | `sha256:6b4d1f624b071d50dba63a49aae414ef2fc7eb8710fdbef4bf66a9d304da733b` |
| Exported config | `sha256:a1b37ba409712fd832cae9d2967c5e82cba78b47c9a93b0830206f6cc1f3960b` |
| Committed source bundle SHA-256 | `48df4ee05170ade40ed5c4b1af50e5e17c5b3670bb0b0e27cd42d79d1cc22e94` |
| Native-boundary ESM file SHA-256 | `6d9f313e534d84ed496320fccc5ed9b60522786030c187445dfb5aff767b6c05` |

The 80,803,840-byte committed source bundle was extracted separately into `/work`,
not mounted over application files or dependencies. The image's revision matched
the selected source, and both changed production ESM modules matched the bundle
byte-for-byte. The source-bundle hash and native-boundary hash were also verified
inside the exact image. These are local identities/checks, not a signed source
authentication or a published registry digest rehearsal.

In that image, **204 of 209 gateway tests passed**, with five Windows-only cases
skipped; the Windows checks above passed locally. Both existing Unix symlink
tests ran on Linux. Sequential tests completed in 24.81 seconds. The inspected
container ran as UID/GID 1000, without network/socket, privileged mode or writable
root, with all capabilities dropped and no-new-privileges. Limits were one CPU,
512 MiB with no additional swap, 64 PIDs, 256-MiB `/work` and 128-MiB `/tmp`
tmpfs. Both input mounts were read-only. The exact temporary container
`classifarr-vm-directory-fc47cbbaa76a` was absent before creation and after
automatic cleanup. No database, inference, VM or study ran.

Normal Classifarr retained container
`560a828dc2123f066acfee0d309731b9a405a7a086065ddf7310a49ca6830a2e`, image
`sha256:82a6025389df3ebfddb4ff47f4ee7f375cd7281e0d66b8b903c0acd733154baa`
and start time `2026-10-20T15:56:46.339240429Z`, healthy with zero restarts and
no OOM kill. Rollback-image protection was verified by the build wrapper.
The ordinary `/health`, `/ready` and `/` endpoints returned HTTP 200 during the
evaluation. None of this proves native Hyper-V creation or study readiness.

At recording time the exact code commit's Copyright, Gitleaks, OSV, Trivy and
CodeQL workflows had succeeded. Its
[CI/CD run](https://github.com/cloudbyday90/Classifarr/actions/runs/39589453726)
and Resource Capacity Regression remained in progress; no all-CI-green claim
is made. This evidence-only documentation update is separate from the evaluated
code/image subject above.

## PR and next step

GitHub MCP enumeration on 21 October 2026 again returned only
[open PR #568](https://github.com/cloudbyday90/Classifarr/pull/568). Its ESLint
10.13.0 change is already present in the server manifest/lockfile on main, so
there is no eligible unapplied PR to select. No PR was merged or closed.

After final checks, the next native step is a separately reviewed, single
administrator-run powered-off creation attempt, followed by the already-planned
verified Ubuntu installer and private network/SSH preparation. Do not infer
study readiness or automatic startup/shutdown qualification from these tests.
No release or normal-container replacement is part of this change.
