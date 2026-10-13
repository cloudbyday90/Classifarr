# v0.49.2-beta release outcome

## Status and scope

Release preparation started on 2026-10-13 under the maintainer's explicit request
to follow the complete release runbook. Publication is not yet verified. No tag
has been created at this checkpoint. Work stays on main; live local, Unraid,
Plex and shared Ollama deployments are outside this release preparation.

Development baseline: `6c85e7938cf7ebac898a77448cc7c2d99ffaa77b`.
Previous release: `v0.49.1-beta`, source
`7d94ef136c7a4b8d77ab0f4c10e38b271bb98268`.
The remote tag and published release list were checked: `v0.49.2-beta` was unused.

## Changelog and release notes review

Reviewed the changes since v0.49.1-beta against Unreleased. The summary covers
identity mapping and consent, mixed-media/season evidence, classification recovery,
comparison incidents, scheduler/database diagnostics, embeddings, evaluation,
provider health and quotas, settings/navigation, HTTP/configuration behavior,
local rollback protection, dependencies and CI security.

The original Unreleased block is preserved verbatim in the
[development archive](../changelog/CHANGELOG-2026-10-pre-release-0.49.2.md).
Published v0.49.0-beta and older blocks were moved unchanged into the
[release archive](../changelog/CHANGELOG-2026-10-releases-through-0.49.0.md).
v0.49.1-beta remains unchanged in the root. Exact block comparisons passed;
the root is 171 lines with unique ordered categories and working archive links.
Original root-relative links within historical blocks remain verbatim, with
working companion links supplied outside those blocks.

The new notes retain backup/migration requirements, stop-older-writers guidance,
explicit approval, incomplete groups, optional evaluation limits, separate
placement/learning authority, memory and quota safeguards, and the distinction
between image rollback and data restoration. No measured accuracy, speed or
leak-free claim is made. No changed system was intentionally omitted.

The publication assembler successfully selected the new notes; its local preview
uses a clearly marked placeholder, not fabricated publication evidence.
Package versions, three lockfile root records, UI, README, changelog and notes
validate as v0.49.2-beta. Lockfile changes are version metadata only.
Documentation lint and product-language audit passed before this checkpoint.

## Download milestone

Docker Hub API repository identity was checked as `cloudbyday90/classifarr`.
Observed **20,872 Docker Hub image pulls** at **2026-10-13T11:33:07.6720737Z**.
Source: [live repository statistics](https://hub.docker.com/v2/repositories/cloudbyday90/classifarr/).
README and release notes record the date/count, explicitly excluding GHCR and
not representing users or unique installations.

## Validation ledger

- Exact Node 24.21.0/npm 12.2.0; all three committed lockfiles installed with npm ci.
- Root, server and client npm audits: exit 0, zero vulnerabilities in each.
- Version contract, archive fidelity, category order, root links and diff whitespace: passed.
- Full lint/tests/coverage, schema, image startup/upgrade, frozen soak and routing,
  browser and provider-fault checks: pending for the committed candidate.
- Security checklist manual sign-off and exact-SHA CI scans: pending.
- Tag workflow, native AMD64/ARM64 published consumers, release/asset attestations
  and both latest aliases: pending. Local image IDs cannot establish these claims.

## Publication controls observed

GitHub reports immutable releases enabled. Both release-publication and
release-acceptance environments allow only v* tags and disallow administrator
bypass. The collaborator list contains one administrator, cloudbyday90; there
is no independent reviewer separation, and none is claimed.

The publishing and promotion jobs are tag-gated; published-image consumer jobs
have read-only permissions and do not receive registry publication credentials.
Repository secret names for the publishing token, dedicated pull token and
username exist; secret values were neither retrieved nor printed. The older
manual Docker Hub retention job also references the publishing secret and needs
separate scrutiny against the runbook's tag-only credential requirement before
publication can be marked ready.

## Remaining gates

Complete and record every pending check before tagging. A failed gate blocks
publication; do not weaken it, retarget a public tag, manufacture CI context or
reuse receipts from another source. Deployment remains a separate decision.
