# v0.49.3-beta release outcome

## Status

**Publication authorized subject to remaining gates; not yet published.** The maintainer selected v0.49.3-beta
on 2026-10-23 and requested the full [runbook](../../.agent/workflows/release.md).
See the [design](release-0.49.3-beta-design.md) for scope and safeguards.
The maintainer initially held publication and requested a fix/official research,
then explicitly accepted the npm finding for **v0.49.3-beta only** on October 23
and requested continued publication. **This finding must be fixed before the next
release.** No other security or release gate is waived. Publication still requires
fresh candidate evidence, final controls, native consumers and provenance.
No release tag, registry write, alias promotion, live
deployment, VM operation or provider recovery has occurred during preparation.

Development baseline: `0025d37802cf2c0c997f0d4819e617c6f68106ca`, initially
clean and synced on main. Previous published source:
`2eb62e0e2390ac837d79e0421d3ac3a1d3a8f98e` (v0.49.2-beta).
Remote v0.49.3-beta was absent when checked on October 23. The eventual frozen
image identity is not established. Preparation commit
`e1a2083290d9238aad33f0bb213a54973c81102a` passed the source checks below with
a clean checkout. This later outcome update is documentation only and does not
retroactively bind those results to its own source or establish a frozen image.

## Changelog and release notes

The new [development archive](../changelog/CHANGELOG-2026-10-pre-release-0.49.3.md)
preserves the original Unreleased block. The root summary covers classification
checks/repair/retry, automatic same-ID recovery, background AI controls/readiness,
gateway routing/history/provider operations, archives/catalogs/cleanup, bounded
resource handling and synthetic studies, on-demand VM preparation, scheduler
diagnostics, dependencies, CI and security. Historical archives remain reachable.
Exact comparisons against the baseline passed: the archived block is verbatim,
published changelog blocks and prior release notes are unchanged, all three
lockfiles differ only in root/package version fields, categories are uniquely
ordered and local links resolve. Root changelog length is 278 lines. The actual
publication-note builder selected the new section in a preview explicitly marked
as containing no publication evidence. Documentation lint (2,360 files, zero
errors), product-language audit and the version contract passed. An archive EOF
blank-line lint error was resolved with a footer outside the preserved block;
the historical text itself was not edited.

Notes retain backups, four normal application migrations, stop-old-writers
guidance, preserved attempts/source evidence, ordinary admin-session repair
requirements, fresh-install evaluation defaults, optional gateway activation,
source runtime minimums, private-upstream/network limits and incomplete VM/study
work. No production speed, accuracy or leak-free claim is made.

## Docker Hub milestone

Live API response identity matched `cloudbyday90/classifarr` and reported
**21,344 Docker Hub image pulls** at **2026-10-23T10:05:08.8108181Z**.
Source: [Docker Hub repository statistics](https://hub.docker.com/v2/repositories/cloudbyday90/classifarr/).
README and release notes use that observation/date and explicitly exclude GHCR
and unique users/installations. The research connector could not retrieve this
JSON endpoint; a direct read-only HTTPS request to the runbook-provided URL
verified its repository identity and non-negative integer count.

## Verification ledger

| Gate | Observed status |
| --- | --- |
| Pinned Node 24.22.1 / npm 12.2.1 | Versions verified; no global tooling change |
| Three strict lockfile installations | Passed before version alignment; root 80, server 631 and client 296 audited packages, zero reported vulnerabilities; subsequent lock differences are version metadata only |
| Version contract and lockfile metadata review | Passed; version metadata only, no dependency-graph changes |
| Archive fidelity, categories, links, docs/language checks | Passed before the preparation checkpoint; recheck after subsequent edits |
| Fresh lint, full CI and coverage ratchet | Passed on e1a208329; 1,880 backend suites / 60,385 tests passed, one skipped; 477 frontend files / 7,374 tests passed |
| Root/server/client and separate CLI audits | All four trees exit 0; workspace audits 0 each, separate CLI audit exit 1 with one moderate, no high/critical |
| Candidate-image schema dump/check and pg_stat_statements | Pending resumed qualification; use isolated data, never the live database |
| Production-policy browser and isolated provider-fault checks | Pending; not passed on this candidate |
| Local installation/routing receipt | Pending; no current-candidate receipt |
| Complete frozen no-cache image/soak/profile matrix | Pending; no current-candidate image or receipt |
| Exact candidate main CI/security checks | Pending; earlier-source green runs are not substitutes |
| Manual security checklist A–N | Pending; no blanket security sign-off claimed |
| Final live publication controls and credential scope | Pending recheck for the candidate |
| Approved exact source and npm exception | One moderate finding accepted for v0.49.3-beta only; next release blocked until remediation; remaining source/image gates pending |
| Native AMD64/ARM64 published routing and digest consumers | Not run; require tag workflow |
| Attested v3 asset, immutable release and aliases | Not published or verified |

The existing migration/upgrade fixtures pin v0.48.4-beta, not the latest release.
They cannot be described as explicit v0.49.2-to-v0.49.3 upgrade proof. Separate
gateway ledgers/services are optional and are not ordinary application migrations.

Full CI included the existing preflight, types, policy gates, backend/frontend
coverage, ESM static/mock-shape checks and unchanged coverage ratchet. Preflight
had two Windows symlink-privilege skips; backend had one skipped test. No threshold,
timeout or assertion was relaxed. Coverage: server 89.18% statements/lines,
86.47% branches, 90.75% functions; client 87.79% statements, 81.84% branches,
87.50% functions, 89.47% lines. Standalone database integration, image and manual
security sign-off remain separate unfinished gates, not implied by full CI.

Development-inclusive audits completed at 09:35:37–09:35:45 UTC on October 23.
These counts apply to the three application scopes and separate private CLI
prefix, not every historical tool or base-image layer. Host-global and retained
historical tooling were not changed. The live application remained untouched.

## Remaining npm finding

The server's `ip-address` override is 10.7.4; npm 12.2.1 separately bundles
10.7.2. The [moderate advisory](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5)
affects that CLI copy, including files retained in the production image.
The fresh registry/release review identified no newer patched npm candidate.
No scanner suppression or vendor patch was applied. The maintainer initially
held publication, then explicitly accepted the residual finding for
v0.49.3-beta only. The affected files remain; no remediation or claim of
non-exploitability follows from that decision. The runbook and Unreleased block
every subsequent release until an actual fix and fresh verification are recorded.

### Official-source research and bounded experiments

- The parser maintainer's [advisory and patch](https://github.com/beaugunderson/ip-address/security/advisories/GHSA-rxp7-6hxx-x8q5)
  identify 10.7.4 as fixed. npm's [published 12.2.1 release](https://github.com/npm/cli/releases/tag/v12.2.1)
  explicitly includes 10.7.2; the [current upstream lockfile](https://github.com/npm/cli/blob/52f30938bd372dac25667f38fb771f5fe825e6e6/package-lock.json)
  still uses 10.7.2. No supported patched npm release was verified.
- A disposable consuming project with an exact 10.7.4 override installed npm's
  actual 10.7.2 bundle and retained the moderate finding. The lock-only command's
  initial zero count did not prove the subsequently unpacked bundle safe.
- Updating a copied npm package directory with scripts disabled, development
  dependencies omitted and workspaces disabled failed with E404 for unshipped
  `@npmcli/docs`. Its complete 1,969-file inventory remained unchanged except
  the generated diagnostic log. Neither experiment changed the active CLI.
- A 64-MiB bounded regression probe replaced the legacy matcher with a refusing
  sentinel rather than performing expensive work. Four line-terminator classes
  reached it four times in 10.7.2 and zero times in the released 10.7.4 control.
  Legitimate zoned/CIDR and canonical IPv6 controls passed. This was a comparison
  against a patched control, not proof of a remediated active CLI.
- npm's [documented bundle exception](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/#overrides)
  and [repair implementation](https://github.com/npm/cli/blob/v12.2.1/workspaces/arborist/lib/arborist/build-ideal-tree.js)
  advise updating the bundling package. The supported path is a refreshed npm
  release, followed by exact adoption and qualification. A private package overlay
  would be a downstream distribution change; it was not approved or applied.
- Live GitHub MCP queries found related open issues
  [#10120](https://github.com/npm/cli/issues/10120) (bundled overrides) and
  [#9949](https://github.com/npm/cli/issues/9949) (installed npm manifest).
  [#10062](https://github.com/npm/cli/issues/10062) was closed October 14 after
  the earlier refresh to 10.7.2. Exact advisory/CVE, 10.7.4 and description searches
  found no public npm issue/PR specifically tracking this remaining advisory;
  search absence is not proof that no private or unindexed report exists.

No issue or comment was created. npm's current bug template expressly excludes
dependency-CVE-only bump requests, and its security policy directs vulnerability
reports privately; the requested public report could not satisfy that required
declaration. No private message was sent. Sanitized investigation evidence was retained
separately; raw package/debug output and temporary dependency trees are not
published in the repository. The original issue remains present in the active
CLI. No remediation or clean-image claim is made.

## Next item

Complete every remaining release gate and publish only the qualified
v0.49.3-beta source. Before the next release, remediate the npm finding across
the relevant toolchain/image copies and verify closure; this is mandatory, not a
recommendation to reuse the exception. Any private upstream report needs its own
reviewed channel/payload approval. After a verified release, resume the bounded
representative-refresh investigation; retained VM fixture cleanup and the
isolated archiving comparison still require their separate safeguards/authority.
