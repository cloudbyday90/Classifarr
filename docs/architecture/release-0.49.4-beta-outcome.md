# v0.49.4-beta release preparation outcome

Date: 2026-11-02. Status: candidate preparation; publication blocked pending gates.
Design: [release qualification](release-0.49.4-beta-design.md).
Runbook: [release workflow](../../.agent/workflows/release.md).

## Intake and current decisions

The maintainer requested v0.49.4-beta. The live published-release list ends at
v0.49.3-beta, published 2026-10-23T13:55:46Z; no local/remote v0.49.4-beta tag
exists at intake. Main began clean at 46ba1290dfb644293b657f77021c7716b3a89dc1.
The changelog review was committed separately as bfc4a67c4 before candidate
qualification. Its [review record](release-0.49.4-beta-changelog-review.md)
documents system coverage, historical fidelity and navigation checks.

Fresh live Docker Hub statistics identify cloudbyday90/classifarr with exactly
21,997 image pulls at 2026-11-02T21:04:30.4829176Z (server Date header
Mon, 02 Nov 2026 21:04:32 GMT), from
[the repository endpoint](https://hub.docker.com/v2/repositories/cloudbyday90/classifarr/).
README and new notes record this count/date, excluding GHCR and unique-install
inferences. No unverified growth percentage is used.

Package/UI/README/notes/changelog versions are aligned to v0.49.4-beta / package
0.49.4-beta. The direct version validator passes. Each lock delta changes only
its top-level and root-package version; that initial preparation changed no
dependency artifacts. The later approved [CI/security follow-up](release-0494-ci-security-outcome.md)
repairs failing integration fixtures and applies the coherent glob/minimatch
tooling patches with separate lock and real-library evidence.

## Accepted npm residual finding for this release only

At 2026-11-02T21:01:29Z the official registry returned E404 for npm 12.2.2;
latest/next-12 remain 12.2.1. Its official release PR is still open/unmerged,
head 50873228b2c5b63204608b2ea0164fb8cc675dca, despite the proposed bundled fix.
The active pinned CLI's socks dependency physically resolves npm's own
ip-address 10.7.2; the separate server application copy is 10.7.4.

The moderate advisory and source/Docker inheritance are recorded in the design.
Fresh inspection of the f9d753267 production image
sha256:c8e988b8d65829d229f71c5796b5ca365588ba4a4b45a254ea57fa0d8cd1cbd4
physically resolves npm's copy to 10.7.2 and the application copy to 10.7.4.
The maintainer explicitly accepts that moderate residual finding for
v0.49.4-beta only, conditional on every other fresh gate passing. This is a new
exact-release decision, not automatic reuse of the earlier exception. Subsequent
releases remain blocked pending verified remediation. No vendor patch or claim
of remediation is made. Reinspect the final candidate after the security fixes.

## Live repository controls

The immutable-releases API reports enabled=true, enforced_by_owner=false.
Both release-publication and release-acceptance environments have the single
custom deployment rule v* of type tag and can_admins_bypass=false. No required
reviewer rule is configured; the collaborator list contains only the owner/admin.
No independent reviewer separation is claimed. Docker Hub credential secret names
are present; no value or capability configuration was printed or altered.

The saved GitHub CLI login works. An invalid inherited GITHUB_TOKEN override was
omitted process-locally for these calls, following the existing provenance
diagnostic's supported remedy. Stored credentials/accounts, persistent environment
and network settings were not changed. Local checks must use this intended saved
identity without fabricating GitHub Actions context.

## Qualification status

| Gate | Current evidence |
| --- | --- |
| Changelog/history/system review | Committed; docs, product-language and whitespace passed |
| Version contract | Passed for v0.49.4-beta |
| Three strict installs | Aligned installs passed; patched server/client clean installs and complete tree checks passed |
| Fresh full lint/test:ci/coverage and audits | Baseline full CI/ratchet passed; patched lint and 97 dependency controls passed; fresh full coverage/integration running; audits root/client 0, server 5 low rejected-advisory wrapper records, production 0 |
| Local schema/extension/upgrade verification image | Baseline f9d753267 image schema check and four pgss smoke scenarios passed; final patched subject pending |
| Production browser and synthetic provider-fault checks | Patched rebuilt browser 8/8 passed; provider-fault pending |
| Frozen no-cache soak and saved deployment profiles | Pending |
| Final exact-SHA remote source/security checks | Pending |
| Security checklist and npm decision | Explicit v0.49.4-only npm acceptance recorded; real OSV scope/expiry controls passed; remaining checklist gates pending |
| Tag/publication/native consumers/attestations/latest | Not started; no release created |

Local artifact intake records the same Docker desktop-linux daemon, three existing
containers and 425 image-tag rows, with the original local Classifarr identity,
image/start time and healthy state. Recovery assets, worktrees, current evidence,
backups, shared cache/volumes and other projects remain protected. Only disposable
synthetic verification resources may be created/cleaned by their owning runners.

No live Unraid cleanup, restart, migration, deployment or provider operation is
authorized or performed by release preparation. Private raw receipts remain under
.tmp; this document will distinguish final tested subjects, skips and remaining
gaps before any publication claim.
