# v0.49.3-beta release outcome

## Status

**Preparation in progress; not published.** The maintainer selected v0.49.3-beta
on 2026-10-23 and requested the full [runbook](../../.agent/workflows/release.md).
See the [design](release-0.49.3-beta-design.md) for scope and safeguards.
Publication remains gated by fresh candidate evidence and the unresolved npm
residual-risk decision. No release tag, registry write, alias promotion, live
deployment, VM operation or provider recovery has occurred during preparation.

Development baseline: `0025d37802cf2c0c997f0d4819e617c6f68106ca`, initially
clean and synced on main. Previous published source:
`2eb62e0e2390ac837d79e0421d3ac3a1d3a8f98e` (v0.49.2-beta).
Remote v0.49.3-beta was absent when checked on October 23. The eventual frozen
candidate/source/image identities are not yet established.

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
**21,340 Docker Hub image pulls** at **2026-10-23T09:25:30.3103107Z**.
Source: [Docker Hub repository statistics](https://hub.docker.com/v2/repositories/cloudbyday90/classifarr/).
README and release notes use that observation/date and explicitly exclude GHCR
and unique users/installations. The research connector could not retrieve this
JSON endpoint; a direct read-only HTTPS request to the runbook-provided URL
verified its repository identity and non-negative integer count.

## Verification ledger

| Gate | Observed status |
| --- | --- |
| Pinned Node 24.22.1 / npm 12.2.1 | Versions verified; no global tooling change |
| Three strict lockfile installations | Passed; root 80, server 631 and client 296 audited packages, zero reported vulnerabilities |
| Version contract and lockfile metadata review | Passed; version metadata only, no dependency-graph changes |
| Archive fidelity, categories, links, docs/language checks | Passed before the preparation checkpoint; recheck after subsequent edits |
| Fresh lint, full CI and coverage ratchet | Pending |
| Root/server/client and separate CLI audits | Pending refresh; CLI finding remains separately tracked |
| Candidate-image schema dump/check and pg_stat_statements | Pending; use isolated data, never the live database |
| Production-policy browser and isolated provider-fault checks | Pending |
| Local installation/routing receipt | Pending |
| Complete frozen no-cache image/soak/profile matrix | Pending |
| Exact candidate main CI/security checks | Pending; earlier-source green runs are not substitutes |
| Manual security checklist A–N | Pending; no blanket security sign-off claimed |
| Final live publication controls and credential scope | Pending recheck for the candidate |
| Approved exact source and residual npm decision | Pending |
| Native AMD64/ARM64 published routing and digest consumers | Not run; require tag workflow |
| Attested v3 asset, immutable release and aliases | Not published or verified |

The existing migration/upgrade fixtures pin v0.48.4-beta, not the latest release.
They cannot be described as explicit v0.49.2-to-v0.49.3 upgrade proof. Separate
gateway ledgers/services are optional and are not ordinary application migrations.

## Remaining npm finding

The server's `ip-address` override is 10.7.4; npm 12.2.1 separately bundles
10.7.2. The [moderate advisory](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5)
affects that CLI copy, including files retained in the production image.
The fresh registry/release review identified no newer patched npm candidate.
No scanner suppression, vendor patch or residual-risk acceptance is recorded.
Version approval is not treated as a security exception. Publication must stay
blocked until this decision is explicitly settled.

## Next item

Complete current-source release qualification and resolve the npm publication
decision before tagging. After a verified release, resume the bounded
representative-refresh investigation; retained VM fixture cleanup and the
isolated archiving comparison still require their separate safeguards/authority.
