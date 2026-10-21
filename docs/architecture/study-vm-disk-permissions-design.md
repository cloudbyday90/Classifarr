# Study VM disk inheritance validation

Approved through grill-me on 21 October 2026. Recognize only the independently
observed CREATOR OWNER template on the protected, owned disk folder, with disk
owner/access and unexpected-child checks. This changes validation, not existing
filesystem permissions. It does not authorize completion apply, VM power or
network operations, resource adoption, a general resume mode or a new admin UI.

## Contract and weaknesses

Keep fixed read-only disk permission functions in a small ESM module shared by
the creator query and the temporary, exact-target completion. The creation
invocation starts expecting an empty disk directory. Only successful New-VHD
return advances its in-memory expectation to one disk. There is no persisted
retry/reset state or automatic retry; uncertain creation still requires review.
The private completion starts expecting the independently observed existing disk.

Before accepting a template, require the existing trusted directory owner,
protected DACL and safe path tree. Only the owned disk directory itself at depth
one can qualify. Require an explicit Allow rule for SID S-1-3-0, exact mask
268435456 (GENERIC_ALL), inheritance flags 3 (objects/containers), propagation
flags 2 (inherit-only), and not inherited. The VM directory, selected parents,
other identities and every altered field remain outside the exception.

Inventory only direct children, including hidden items, with a two-item cap and
the existing overall command timeout/output limit. An empty directory must have
no children. Once a disk is expected, require exactly the expected VHDX path,
not a directory or reparse point. Reject an unreadable/null file DACL, an
untrusted file owner, excessive rules or any Allow grant outside trusted
principals and the GUID-resolved current VM. No CREATOR OWNER or all-VM-group
exception applies to the file itself. Unexpected children fail without recursive
enumeration or cleanup. Disk permissions are checked even without a template.
Re-read and compare the root security descriptor after descendant checks, so
an observed ACL change during inventory cannot reuse the earlier trusted view.

CREATOR OWNER does not grant access to the carrying directory, but may grant
full control to the resulting child owner. Protected DACLs stop incoming
inheritance, not outgoing templates. Checking descendants is therefore necessary;
neither inherit-only status nor a protected parent alone proves privacy. A null
DACL permits access despite having no listed Allow rules, so reject it explicitly.

Keep the completion's repeated off/identity/disk binding and permission checks
before every settings command and its complete final read-back. This is not an
atomic handle-based filesystem transaction and cannot fence a concurrent trusted
administrator from replacing resources between observations. Preserve the
administrator-reviewed, nonconcurrent operating requirement and stop on drift.
Do not claim provenance for the template or universal Hyper-V behavior.

## Options and recommendation stack

| Option | Benefit | Cost or risk |
| --- | --- | --- |
| Leave refusal unchanged | No policy expansion | Blocks the approved partial VM completion |
| Edit/remove the ACL rule | Could match the old shape | Unauthorized mutation and uncertain native behavior; rejected |
| Exact template plus independent disk validation | Preserves permissions, resources and narrow authority | More read-only checks and native qualification; chosen |

Use exact template matching, protected/trusted roots, bounded expected-only
inventory and independent leaf ACL validation together. Retain current target,
off-state, SID, disk identity and no-retry safeguards. Test native inheritance,
then the real production guards and rejection cases, then complete synthetic
creator/completion flows. Finally request a fresh administrator read-only
inspection. A passing inspection is not permission to apply or study readiness.

## Unresolved disk-file capability boundary

Attribution of a refused file capability remains read-only diagnosis, not a new
allow rule. Cache membership, a capability-family prefix, token comparison or a
matching name-derived SID cannot establish who added the grant or restrict it
to the current VM. Never remove an unknown native capability grant to satisfy
the validator, and never infer its purpose solely from a permission mask.

For the temporary diagnostic, prefer one finite comparison against actual
registry-observed capability names to repeated guessed-name probes. Read only
the fixed direct member lists, separate literal SIDs and class-reference labels,
validate/bound names, derive through the documented native API outside the
administrator process, and freeze the reference with an integrity check. Report
exact matches, ambiguity or no match without emitting the refused raw SID.
This local registry format is an observed diagnostic input, not a stable public
contract or source of authorization. Preserve the file guard's refusal and
require a separate grill-me agreement before any trust-policy expansion.

The administrator comparison has identified vmWorkerProcess. Recommended next
step, not yet authorized: qualify the native create/attach sequence on exclusive
disposable resources while leaving the real study VM untouched and off. Record
the file ACL at each stage, never start a guest or connect networking, and allow
cleanup only after exact fixture identity/path/off-state checks. Stop and retain
uncertain resources for review; never retry native mutations automatically.
Reproduction would not prove effective isolation or justify a general allowlist.

| Next option | Benefit | Remaining cost or risk |
| --- | --- | --- |
| Keep refusal only | No trust-policy change or native test writes | Completion stays blocked without additional evidence |
| Accept the exact observed rule now | Could unblock settings without editing ACLs | Name and mask do not establish native provenance or effective access; deferred |
| Native fixture qualification, then policy review | Tests the create/attach sequence without touching the study VM | Needs explicit resource/cleanup approval; does not prove runtime token isolation; recommended |

Do not delete the capability ACE, accept a whole capability prefix/cache, add it
to trusted directory principals or weaken other owner/path/disk/VM checks. Any
future exception must specify its exact file-only scope, SID, rights and flags,
and qualify changed/wrong-target/foreign-principal cases before fresh inspection.

## Verification and official sources

Use exclusive new disposable Windows fixture directories, not real VM storage.
Demonstrate the exact parent template, child-owner substitution, generic-right
mapping and exclusion by protected children. Test the production functions with
real file metadata/ACLs and separately bounded synthetic negative cases, including
all template fields, wrong targets, unprotected roots, owner/grant drift, null
DACLs, hidden/unexpected children, symlinks/junctions and failed reads.
All VM/native writers remain mocked in creator and completion tests.

Official Microsoft sources located/opened through the search MCP on 21 October 2026:

- [ACE inheritance rules](https://learn.microsoft.com/en-us/windows/win32/secauthz/ace-inheritance-rules)
  explain effective versus inheritance-only entries and generic mapping.
- [CreatePrivateObjectSecurityEx](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-createprivateobjectsecurityex)
  specifies substitution of the resulting child's owner for CREATOR OWNER.
- [Generic access rights](https://learn.microsoft.com/en-us/windows/win32/secauthz/generic-access-rights)
  defines the exact GENERIC_ALL mask.
- [Security descriptor control](https://learn.microsoft.com/en-us/windows/win32/secauthz/security-descriptor-control)
  distinguishes protected DACLs and null DACL access semantics.

Record exact native, portable, image and remote CI results in a separate outcome.
No production service, Unraid or shared Ollama is in scope.
