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

The no-cache image evaluation remains a separate next check; this document does
not claim it has run or that a VM was successfully created.

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
