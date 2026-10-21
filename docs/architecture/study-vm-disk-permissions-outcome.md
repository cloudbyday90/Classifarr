# Study VM disk permission correction outcome

## Observation and approved scope

On 21 October 2026, administrator read-only inspection refused one explicit
CREATOR OWNER template on the protected owned disk folder. It reported mask
268435456, inheritance flags 3, propagation flags 2 and not inherited. It did not
establish which operation installed the rule. The VM remained off and no
completion apply was run. The user approved the
[exact-template design](study-vm-disk-permissions-design.md), not an ACL repair,
general resume/adoption feature, power/network action or automatic retry.

## Implemented validation

Small shared ESM disk permission functions now require the exact template and
owned disk context. The creator still refuses existing targets and starts by
requiring an empty disk folder. Successful New-VHD return advances its in-memory
expectation to exactly one disk. It checks disk permissions before VM creation,
again before settings and during final verification. The private pinned
completion reuses the same functions and repeats its complete target checks
before each settings write. Read-only inspection physically omits settings.

An expected disk must be the sole direct child, including hidden children,
with the exact approved path, not a directory or reparse point. Its owner must
be trusted and its non-null DACL must grant access only to trusted identities or
the Windows-resolved current VM. Rules are capped at 256; inventory stops after
two items without recursion. The disk file never accepts CREATOR OWNER or the
all-VM group. Unknown Allow rules, including read grants, remain refusals.

A drift regression exposed a stale-root view during descendant inspection.
The guard now captures an immutable descriptor before inventory, then reads
and compares it afterward. Observed changes fail rather than relying on the
earlier ACL. This is not an atomic filesystem fence against another trusted
administrator; nonconcurrent administration remains required.

There are no existing-ACL writers, permission repairs, new databases/tables,
API changes, application admin features, VM starts, network connections or
automatic retries. Actual VM identifiers and paths stay in ignored temporary
completion material. Its source hash was explicitly re-reviewed for this
correction; no ownership/security baseline was refreshed.

## Verification

The complete mocked creator regression first reproduced refusal of the real
template shape before the correction. Native Windows fixtures demonstrated
that the parent entry remains inherit-only, child ownership is substituted with
mapped FullControl, and an exclusively created protected child excludes it.
Only disposable fixture permissions changed; no real VM storage was used.

Actual file metadata and ACLs qualified the production owned-root guard, while
excluding ancestor traversal in that one fixture. A small ordinary text file
stood in for the leaf; this is not native VHD-format evidence. Hidden extra files,
an untrusted read grant, an unprotected root and a real junction were refused.
Fixture cleanup was checked. Synthetic Windows cases separately covered all
template fields/contexts, null DACL, owner/group/foreign-VM grants, excessive
rules, missing or wrong observations, failed reads, bounded inventory and ACL
drift during the guard. Full creator tests retain the real ancestor policy with
infrastructure and native/VM writers mocked.

The five disk permission tests and three temporary completion tests passed with
no skips. Completion tests include exact-template success, extra children,
untrusted owners/grants, wrong-root templates and protection loss before writes,
plus template, file ACL, extra-child and disk-identity drift after the first
settings write. Each drift stops further writes and preserves partial state.
An actual PowerShell AST allowlist verifies no creator, ACL, power or networking
writer, and no settings command in inspection. Cancellation and malformed,
oversized, failed or timed-out capture retain conservative outcomes and no retry.

Full Windows CI preflight passed: 220 gateway tests, 218 passed and two existing
Windows symlink-privilege skips. All 25 creator/directory/identity/disk permission
focused cases ran on Windows without skips. Copyright checked 1,793 files;
static ownership review found no unreviewed drift (not runtime authority), both
dependency checks, full lint and server/client type checks passed. Backend and
client application test suites were not rerun for this tooling-only change.

The GitHub MCP found only open PR #568, ESLint 10.13.0, already present in the
server manifest and lockfile on main. There was no eligible unapplied PR to
implement; none was merged or closed.

Static ESM imports and Markdown (2,336 files) passed, as did whitespace and staged
secret checks. No security/ownership baseline was refreshed.

## Exact-source image evidence

The protected Compose no-cache build succeeded from clean committed source
`48d6e86b96de9a0154ef3ef16b07b69a6d76a921`, with provenance required and running
image rollback protection enabled. No Compose up or application replacement ran.

| Identity | Value |
| --- | --- |
| Local image/index ID | `sha256:4eae47bca3832630820fe70d1ca8128c8d6ca3a8588427209bcc84861b3ca57a` |
| Linux amd64 child manifest | `sha256:07e7d542983908279497d6dd0cbe040a1622ade51402c18f5350dac738ebe0e7` |
| Image configuration | `sha256:7507d38c02226a67d003610655085eaed3731adb2c0a3320e95a9bd911dbf496` |
| Source archive SHA-256 | `f43e1084d8f2ee17f329ee34e3b5260dea86e2d37ec70d1f742012f8a897597c` |

The committed-source archive was 80,896,000 bytes. An isolated driver checked
its digest, Node 24.21.0 and byte-identical copies of all five relevant packaged
and archived ESM modules, including the new disk permission functions. The full
gateway list ran sequentially in the exact candidate: 220 tests, 206 passed,
14 Windows-only skips, no failures, exit zero. Duration was 25.49 seconds.
Those skips are not Windows proof; native qualification is recorded separately.

Actual container inspection verified UID/GID 1000, network none, read-only root,
not privileged, all capabilities dropped, no-new-privileges, 512 MiB/no extra
swap, one CPU and 64 PIDs. Source/driver mounts were read-only; work and temporary
directories were bounded noexec/nosuid tmpfs. No live data, credentials, VM
folders or Docker socket were mounted and the app entrypoint was not started.
The exact disposable container was absent before and after the test. The normal
Classifarr container kept its original image, start time and zero restarts,
remained healthy and retained its verified rollback image. Its health, readiness
and root HTTP probes returned 200. No TLS or permission bypass was needed.

At recording time the source's secret, copyright, OSV and Trivy workflows passed;
[CI/CD](https://github.com/cloudbyday90/Classifarr/actions/runs/39603817184),
CodeQL and resource-capacity workflows were still running. Full remote success
is not claimed. This local build/test is not published signed provenance or
release evidence for deployment; no release was created.

## Administrator inspection remains blocked

The administrator ran the updated private completion's read-only inspection
against the actual partial VM. It returned `blocked`, `prechecks`,
`acl_review_required`, `mutationAttempted: false`. Therefore the correction's
tests do not prove this VM now qualifies and no completion apply was run.

The same temporary attribution probe was updated to instrument the five exact
ACL rejection points without changing their decisions. It distinguishes a
directory/file Allow rule, null file DACL and observed root descriptor drift,
reporting only fixed categories and numeric flags. Four tests passed: actual
read-only PowerShell AST, bounded sanitized projection, and synthetic production
guards for VM-group/file grants, null DACL and descriptor drift. It cannot change
ACLs or VM settings. A fresh administrator attribution result is pending; no
further exception, identity trust or permission repair has been inferred.

## Recommendation and next step

Use the exact predicate, protected/trusted root, bounded expected-only inventory,
independent leaf validation and drift refusal together. This preserves existing
permissions at the cost of additional read-only checks and a deliberately narrow
accepted disk layout. Keep the VM off and require a fresh administrator inspection
of the current source before any completion apply. Installer authenticity,
guest setup, host-only networking and real on-demand shutdown qualification
remain later work; the environment is not study-ready.
