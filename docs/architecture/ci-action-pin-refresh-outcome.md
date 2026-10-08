# CI action pin refresh outcome

Date: 2026-10-08. [Design, upstream sources and tradeoffs](ci-action-pin-refresh-design.md).

## Implemented and locally verified

Updated 32 action references across five workflows: setup-node 7.1.0,
upload-artifact 7.0.2 and download-artifact 8.0.2. Six existing ESM contract
validators now require the reviewed immutable commits. No runtime dependency,
memory policy, permission, cache input, receipt path, promotion gate or schema
was changed. The dependency-update and release-evidence skills kept action review
and artifact-contract verification separate from deployment/publication authority.

Before implementation, seven workflow suites passed 105 tests. New regression
cases failed in seven places against the old references. After the update,
seven suites passed 124 tests; the broader workflow/receipt/routing run passed
12 suites and 219 tests. Coverage includes all 32 references and stale, floating,
branch and absent action references on the installation receipt path. Existing
wrong-run/image, skipped download, masked failure and privilege mutations remain.
All four directly executed workflow validator CLIs also passed.

The 40 tooling/install-policy tests, backend test/security lint, typecheck,
copyright and Markdown checks passed. This CI-only batch did not rerun complete
backend/client application coverage locally; hosted CI remains required. Before
the change, implementation [run 37856102748](https://github.com/cloudbyday90/Classifarr/actions/runs/37856102748)
was successful; the later documentation commit's CI was still running when checked.
No earlier run is evidence for the new action pins.

## Open PR trial

Fresh enumeration found two open PRs. `Get-Random` selected
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Its exact client manifest/lockfile
diff was applied locally: Node declarations 24.19.1 to 26.6.4 and undici-types
7.24.6 to 8.9.0. The existing runtime-major check passed 8/8 before, failed 1/8
with the diff and passed 8/8 after reverting only the trial. No packages were
installed for this incompatible trial; no PR was merged or dependency retained.

## Build and hosted verification

Pending clean-source no-cache build, isolated schema dump/check, installed-package
comparison and local-container observation. Hosted execution must establish actual
Node setup and artifact transfer; unit tests alone do not do that. Tag-only release
jobs will remain skipped, and no release is authorized by this batch.

## Added warning investigation

The newly supplied comparison memory warning was found in the local database and
recovered automatically after about three minutes. See the separate
[read-only investigation](comparison-warning-2026-10-08-outcome.md). No memory
fix or capacity improvement is claimed. Next add sanitized decision-time memory
budget evidence to future warnings while retaining all safeguards, then complete
the exact-source release-readiness review before considering a release.
