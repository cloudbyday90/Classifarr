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
reporting only fixed categories and numeric flags. The administrator's subsequent
result identified a disk-file Allow grant: `principalKind: other`, rights mask
1180063, inheritance/propagation flags zero, not inherited. It was not a null
DACL or observed root descriptor drift. This is separate from the already
qualified folder template, and the file policy correctly continues to refuse it.

The mask is `0x12019f`, exactly Read, Write and Synchronize, confirmed against the
installed enum and [Microsoft's FileSystemRights definitions](https://learn.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.filesystemrights?view=net-10.0).
It includes data modification, but not FullControl's delete, ACL-change,
take-ownership or execute rights. The diagnostic's `other` category is a
remainder, not identification of an account, VM or standard native principal.
The mask alone cannot establish identity or provenance.

A direct non-elevated metadata read was unavailable; no elevation or permission
bypass was attempted. The same temporary probe was extended to report only a
fixed SID family, native well-known type number, account-SID flag and equality
with the invoking native token's user/groups. It performs no name translation,
account lookup or network discovery. Well-known-type iteration is capped at
128 and token groups at 256; token handles are disposed. A type of -1 means no
match in that runtime's enum, not proof that Windows universally lacks a type.

Five tests passed: actual read-only PowerShell AST, bounded sanitized projection
and rejection of malformed/private fields, synthetic production guards for
VM-group/file grants, null DACL and descriptor drift, plus native SID-family,
well-known-type and current-token comparisons without identity output. The
native cases accommodate enum types absent from installed Windows PowerShell.
Literal anchored patterns are tested after source interpolation, which uses
replacement callbacks so JavaScript replacement tokens cannot corrupt them.

Token-group presence is not proof of enabled membership or current effective
access. Neither a well-known category nor token equality establishes that
New-VHD installed the grant, binds it exclusively to this VM or authorizes it.
[SecurityIdentifier.IsWellKnown](https://learn.microsoft.com/en-us/dotnet/api/system.security.principal.securityidentifier.iswellknown?view=netframework-4.7.2)
provides classification;
[TOKEN_GROUPS](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-token_groups)
separately defines enabled, deny-only and logon-group attributes. No official
creation contract was found that explains the observed principal from this
mask alone. No production code, allowlist, ACL or VM setting was changed in this
diagnosis.

## Capability classification and finite comparison

The next administrator capture reported `sidFamily: capability`,
`wellKnownType: -1`, `isAccountSid: false`, `matchesTokenUser: false` and
`matchesTokenGroup: false`, with the same file grant mask/flags. This identifies
the S-1-15-3 capability family, not a particular capability or ordinary account.
It excludes the earlier logon/account hypotheses; no identity was assumed from
the mask. The specific capability is still unverified.

Microsoft documents that capability SIDs intentionally do not resolve to friendly
names and warns that removing their grants can break features. Its
[capability SID troubleshooting guidance](https://learn.microsoft.com/en-us/troubleshoot/windows-server/windows-security/sids-not-resolve-into-friendly-names)
points to Windows' local capability cache, which may not contain every
third-party capability. Cache membership is therefore an observation, not a
purpose, provenance or trust guarantee. No grant was removed.

Read-only local registry inspection found the documented AllCachedCapabilities
as a REG_MULTI_SZ value on CapabilityClasses, not a subkey, with 358 SID-only
entries. Native 64/32-bit parent views were checked; no names or SID inventory
were emitted. No recursive registry discovery or registry writes were used.
The probe reads only the 64-bit value with a non-writable key handle, checks
its type, count (at most 2,048), individual length (192) and aggregate length,
and reports absent/invalid/limited/unavailable separately from registered false.
All registry handles close on completion/refusal. The managed value's size is
checked after reading it; this is bounded processing/capture, not a preallocation
bound on a hostile registry value. The cache remains outside the trust policy.

Static read-only inspection found the exact literal VirtualDisk in installed
Microsoft vhdmp.sys and vmcompute.exe. This supports one finite comparison
candidate; string presence alone is not a published capability-purpose contract.
Microsoft's [DeriveCapabilitySidsFromName API](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-derivecapabilitysidsfromname)
was then used in an isolated non-administrator preparation process to derive
the reference for that exact name. A built-in internetClient derivation matched
its published SID; each derivation returned one group SID and one capability
SID, with both arrays and their individual SIDs freed. The fixed wrapper loads
only the documented System32 native DLLs and performs in-memory derivation,
not resource creation or VM/ACL access. No capability-name guessing loop ran.

The administrator disk probe contains only the resulting exact-reference
comparison, not native compilation or capability derivation. It now returns
virtualDiskCandidateMatch, capabilityCacheStatus and registeredCapability with
the earlier bounded categories/booleans, never the refused raw SID. No prefix or
cache match is an exception to the file permission guard. Seven temporary tests
passed, including the actual native derivation/reference binding, rejection of a
different capability SID, ten cache success/failure/limit cases with verified
handle closure, native SID/token classification and the unchanged read-only
PowerShell AST and production refusal paths.

Traditional token-user/group comparisons do not inventory capabilities. Microsoft
documents separate capability information in the token and AppContainer's
combined user/capability access model:
[AppContainer overview](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer),
[TokenCapabilities](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ne-winnt-token_information_class).
The negative comparisons therefore do not prove that no Windows component can
use the grant. Even an exact name-derived match would establish identity
correspondence, not who added the ACE or that its reach is limited to this VM.
The administrator comparison subsequently reported `registeredCapability: true`
and `virtualDiskCandidateMatch: false`, with cache status observed. This rules
out that exact candidate; the grant must not be attributed to VirtualDisk from
the earlier installed-file strings. Any proposed trust-policy change still
requires a separate grill-me decision; no existing permission was changed.

## Complete local name-catalog comparison

Read-only Registry64 inspection then identified a finite direct name catalog:
the MemberCapability REG_MULTI_SZ values in the General, Restricted and Windows
classes. Their 360 entries contain 319 distinct capability names and 39 distinct
literal SIDs; two literal entries are duplicates. The other classes contain
class-reference labels and flattened caches, not additional direct names.
The direct union matched the Windows and DevUnlock_Internal flattened caches.
These are observed local structures, not a documented stable registry schema.

The ignored preparation helper reads only those three fixed values, excludes
literal SIDs before name validation, rejects class labels and derives each of
the 319 actual names through Microsoft's native API. It does not guess names or
query the protected VHDX. Names are bounded to 128 ASCII grammar-checked
characters and 512 distinct entries; each value is limited to 1,024 entries,
with aggregate count/character checks. Handles close in finally blocks. As with
the earlier cache read, managed allocation precedes size validation. Preparation
uses ten-second, 256 KiB captures and a filtered environment, not elevation.

All 319 native derivations succeeded with one group and one capability SID each,
and explicit native memory cleanup. The internetClient reference check still
passes. A frozen, SHA-256-bound local reference keeps named derivations and the
39 literal SIDs separate. The administrator probe performs equality comparisons
only; it does not compile native code or call the derivation API. Its output
adds derivedCapabilityStatus, derivedCapabilityNames and catalogLiteralMatch,
plus the fixed catalog count/fingerprint. Only names in the frozen catalog can
appear. No match, multiple matches and an excessive match count remain distinct;
there is no fallback to an account lookup, broader discovery or policy acceptance.

Twelve temporary tests pass without skips. They re-derive the complete reference,
check all named/literal comparisons, foreign-SID refusal, ambiguity and match
limits, invalid/duplicate/SID/class-label name input, capture limits/failures and
sanitized projection. The actual PowerShell AST remains read-only. A synthetic
vmWorkerProcess grant with the observed mask exercises the complete production
guard and public projection; it remains blocked with no mutation. This synthetic
case alone did not attribute the real grant. No tracked runtime code or
permission policy changed, so the earlier exact-source no-cache image
qualification is not relabeled as a build
of these later documentation updates.

## Administrator match and remaining policy decision

The subsequent administrator screenshot on 21 October 2026 reports
derivedCapabilityStatus matched and derivedCapabilityNames containing only
vmWorkerProcess. Its catalog fingerprint matches the frozen 319-name reference.
Cache status is observed and registeredCapability true; catalogLiteralMatch is
false, meaning it matched a derived name rather than one of the separate 39
literal catalog entries. That is consistent with the positive overall cache
observation. VirtualDisk remains a negative comparison. The file rule still has
mask 1180063, no inheritance/propagation flags and not inherited. The guard still
refuses it; readOnly is true and studyReady false. No completion apply ran.

The exact name-to-SID correspondence is now established. Because the documented
[derivation API](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-derivecapabilitysidsfromname)
takes a capability name and no VM GUID, this is a named capability, not the
VM-specific SID. This conclusion follows from the API contract, not an observed
worker token. It does not prove which operation installed the ACE, which
processes possess an enabled capability, or effective cross-VM access.

Official sources researched through the search MCP on 21 October 2026 do not
provide a definition of vmWorkerProcess or a contract for this exact VHDX grant.
Microsoft's [disk access troubleshooting guidance](https://learn.microsoft.com/en-us/troubleshoot/windows-server/virtualization/hyper-v-virtual-machine-not-start-0x80070005)
documents a distinct per-VM disk identity, not an exception for this capability.
The [AppContainer dual-principal model](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer)
and [restricted token access checks](https://learn.microsoft.com/en-us/windows/win32/secauthz/restricted-tokens)
show why a shared named capability alone cannot establish effective access.
Those general models do not establish the actual worker token on this host.
Do not infer that the grant is harmless, malicious, VM-exclusive or usable by
every VM. Preserve it and keep the current validator refusal.

The next recommendation is a separately approved, bounded native qualification:
observe permissions around creation and attachment of a small blank disk to an
exclusive disposable, powered-off VM. Never start or connect it; leave the real
study VM and existing ACLs unchanged. Cleanup must be limited to
positively identified fixture resources, with uncertainty preserved for review.
This would establish reproducibility and the stage at which the rule appears,
not universal provenance or runtime access isolation. Preparation and execution
are not yet approved; no such fixture has been created. A subsequent exact-rule
policy proposal, if warranted, still requires grill-me agreement before code.

## Recommendation and next step

Use the exact predicate, protected/trusted root, bounded expected-only inventory,
independent leaf validation and drift refusal together. This preserves existing
permissions at the cost of additional read-only checks and a deliberately narrow
accepted disk layout. Keep the VM off and require a fresh administrator inspection
of the current source before any completion apply. Installer authenticity,
guest setup, host-only networking and real on-demand shutdown qualification
remain later work; the environment is not study-ready.
