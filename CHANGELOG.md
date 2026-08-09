# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

Detailed engineering history is retained in the [August 2026 pre-release archive](docs/changelog/CHANGELOG-2026-08-pre-release.md).

### Added

- **Native policy authoring and maintenance** — Delivered a library-first, accessible workflow for creating, inspecting, changing, and recovering native policy intent with profile-backed suggestions, bounded readiness guidance, optional templates, and revision-safe writes.
- **Native intent lifecycle and storage** — Added automatic policy conversion, explicit migration planning, one-active-intent authority, transactional rollback/rebuild records, reconciliation state and alerts, and forward-only compatibility-preserving storage migrations.
- **Evidence, decisions, and learning controls** — Added canonical evidence envelopes, provenance-aware candidate evaluation, bounded policy questions and resolutions, duplicate-safe pending decisions, and guarded learning from request, import, Discord, and manual-correction outcomes.
- **Classification and RAG observability** — Added sanitized evidence snapshots, decision traces and stage timing, policy-candidate calibration, strict constraint evaluation, retrieval-recall audits, and canonical classification-history lifecycles.
- **Provider-neutral web search** — Added provider configuration and settings for Tavily, Brave Search, and Serper with safe result normalization, quota-aware routing, cache and usage accounting, retention, health history, and calibration controls.
- **Operator setup and notifications** — Added guarded Discord decision notifications plus consistent Radarr and Sonarr setup, connection testing, library mapping, and removal flows.
- **Release and installation acceptance evidence** — Added CI and post-deployment acceptance artifacts that bind a release source revision, image digest, bounded operator attestation, and optional aggregate workload metric without reading installation configuration.

### Changed

- **Deterministic policy authority** — Policy evidence and current library context determine routing; AI output is normalized, schema-validated, privacy-bounded advisory input and cannot veto a deterministic match or auto-route on its own.
- **Pending decision experience** — Command Center now presents one unambiguous active item, a policy-confirmation recommendation with score and safe evidence sources, collapsed alternatives, idempotent retries, and scoped bulk confirmation.
- **Existing-installation upgrades** — Supported legacy policies reconcile automatically to native authority, unsupported input becomes bounded maintenance state, and normal runtime policy reads remain available while compatibility retirement is separately gated.
- **Compatibility-retirement controls** — Replaced speculative mutation paths with read-only, fingerprint-bound evidence, approval, review, and closure contracts; retirement remains blocked until an approved active-installation chain exists and never interrupts normal automation.
- **Release trust chain** — Tag releases now verify package-version alignment, publish and attest immutable multi-architecture images, smoke the exact digest from a consumer boundary, attach bounded evidence to a draft release, and verify the resulting immutable release attestation.
- **Installation acceptance hardening** — The manual acceptance workflow is restricted to exact `v*` tags, has no reviewer fiction for the single-maintainer model, disables administrator bypass, validates the tag contract, and prevents manual inputs from reaching shell evaluation.
- **Platform baseline and database upgrades** — Standardized Node.js 24.18.1 and npm 12.0.2, Alpine 3.24, PostgreSQL 18 upgrade coverage, pgvector 0.8.6 extension upgrades, and authoritative schema-snapshot verification.
- **Runtime performance and delivery** — Optimized canonical history paging and outcome aggregation; database timeouts now return bounded retryable responses, and retired content-hashed client assets return true 404 responses instead of the SPA shell.
- **Workflow and dependency maintenance** — Updated client and server dependencies, hardened action SHA pinning and CodeQL maintenance, restored dependency-declaration checks, and retained Markdown, ESM, and product-language quality gates.

### Removed

- **Retired compatibility and authoring paths** — Removed unreachable compatibility source-mutation tooling, browser migration previews, legacy authoring diagnostics and controls, and obsolete verifier surfaces so normal policy work has one server-admitted native path.

### Fixed

- **Policy and classification reliability** — Fixed stale or duplicate pending decisions, AI disagreement veto behavior, unsafe weak-evidence promotion, stale profile/recovery handling, classification-history query timeouts, and native policy change persistence gaps.
- **Fresh-install and upgrade reliability** — Fixed schema-snapshot drift, pgvector index and extension upgrade handling, PostgreSQL startup fallback behavior, profile normalization repairs, and migration/reconciliation restart safety.
- **Provider and media-server resilience** — Fixed provider failure classification and retry recovery, sanitized malformed provider data, protected media-server route outcomes, and corrected setup, library removal, and enrichment-state synchronization edge cases.

### Security

- **Authority and input hardening** — Enforced server-owned policy, routing, learning, reconciliation, and rebuild authority; protected provider boundaries, shell-facing workflow inputs, bounded diagnostics, and Discord mentions from unsafe or sensitive data flow.
- **Supply-chain maintenance** — Resolved workspace dependency alerts, updated runtime and tooling dependencies, preserved full-SHA GitHub Action pinning, added image provenance verification, and restricted release actions to least-privilege tag-only environments.
