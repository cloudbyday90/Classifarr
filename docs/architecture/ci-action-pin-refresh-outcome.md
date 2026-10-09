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

The 40 tooling/install-policy tests, both Knip modes, backend test/security lint, typecheck,
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

Clean-source no-cache build of `c56297b61a312234fe686864eb01898fdecd1cd3`
produced image `sha256:8134a2c8f2def87301ef88ad93a93dbb402da906786e2b7ce70c3f87d08b8fba`.
All 172 npm and 58 APK package versions matched the prior local image. Isolated
filesystem, networking and HTTP/2 probes passed. Schema dump and independent check
ran afterward in disposable databases; the tracked schema stayed unchanged and
the fixture containers were removed.

Local Compose was replaced with that exact image at 23:30:32 UTC after a private,
checksum-verified 76,142,800-byte backup and rollback image tag. The backup's archive
listing was checked, not a full restore rehearsal. All 71 served JS/CSS assets and
the HTML matched the image. Nineteen readings from 23:31:06 to 23:36:04 UTC stayed
healthy with zero memory-limit failures or OOM flag. Sampled raw cgroup usage ranged
from 400,343,040 to 881,827,840 bytes; the observed kernel peak was 885,805,056 bytes.
No warnings/errors appeared in the current-start database log query. This is a
five-minute health observation, not a retention benchmark. Unraid was untouched.

For implementation [run 37859276234](https://github.com/cloudbyday90/Classifarr/actions/runs/37859276234),
Node setup succeeded in all three jobs; the complete pipeline passed, including
database tests, fresh-install/published upgrade and Build and Test. The installation
receipt upload, same-run download and acceptance-readout upload all succeeded on
the new pins. Exact-source OSV, Trivy, Gitleaks and copyright runs passed.
Do not infer a release-artifact receipt
from these checks: tag-only jobs remain skipped and no release was created.

## Added warning investigation

The newly supplied comparison memory warning was found in the local database and
recovered automatically after about three minutes. See the separate
[read-only investigation](comparison-warning-2026-10-08-outcome.md). No memory
fix or capacity improvement is claimed. The subsequent user request authorized
[decision-time evidence and reference points](comparison-memory-evidence-design.md)
as a separate implementation slice. Retain all safeguards, then complete
the exact-source release-readiness review before considering a release.
