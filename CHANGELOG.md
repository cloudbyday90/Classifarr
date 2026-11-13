# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [November 2026 v0.49.4 Development](docs/changelog/CHANGELOG-2026-11-pre-release-0.49.4.md) | [October 2026 v0.49.1–v0.49.2 Releases](docs/changelog/CHANGELOG-2026-10-releases-0.49.1-through-0.49.2.md) | [October 2026 v0.49.3 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.3.md) | [October 2026 v0.49.2 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.2.md) | [October 2026 through v0.49.0](docs/changelog/CHANGELOG-2026-10-releases-through-0.49.0.md) | [October 2026 v0.49.1 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.1.md) | [October 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-10-pre-release.md) | [August 2026 Release Details](docs/changelog/CHANGELOG-2026-08-releases.md) | [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Fixed

- **RAG result context ownership** — Assemble accepted non-adopted verification
  results with their current invocation context and advisory. Clear inherited
  advisory after a fresh confirmation, while fulfilled review outcomes retain
  their current advisory. See the
  [outcome](docs/architecture/nonadopted-rag-result-context-outcome.md).

- **Current pending-review evidence** — Save the selected non-adopted RAG
  recheck's bounded policy view with the actual History row. Use it consistently
  for recommendations, scores, evidence, web/bulk answers and Discord; require
  explicit selection when current proof is unavailable. Preserve original
  policy evidence and completed-answer replay. See the
  [outcome](docs/architecture/current-policy-review-frame-outcome.md).

- **Fresh RAG verification context** — Use the successful non-adopted recheck's
  destination and overall confidence together. Retain baseline when private
  proof is missing or changes, preserving charged invocations and actual provider
  observations without a guessed fallback, refund or replay. Keep existing gates,
  rollout and routing/learning safeguards. See the
  [outcome](docs/architecture/nonadopted-rag-verification-context-outcome.md).

- **RAG verification advice** — Bind adopted recheck advice/profile to the
  successful fresh evaluation through a private stage handoff. Omit missing or
  changed optional evidence while preserving verification admission/parsing,
  call budgets, adoption and routing/learning safeguards. See the
  [outcome](docs/architecture/rag-recheck-advice-provenance-outcome.md).

- **Verification advice provenance** — Qualify initial policy verification's
  optional destination/confidence and profile attachment with private live
  evidence. Omit unbound or changed context while preserving the separate
  verification target/admission, scoring and routing/learning safeguards. See the
  [outcome](docs/architecture/verification-advice-provenance-outcome.md).

- **Policy recovery evidence** — Bind AI-unavailable policy advice to the actual
  live item/evaluation and loaded destination. Use existing neutral review when
  proof is unavailable or changed, preserving retry decisions/counts, normal AI
  context, scoring and routing/learning safeguards. See the
  [outcome](docs/architecture/policy-recovery-suggestion-binding-outcome.md).

- **Recovery destination advice** — Keep AI-unavailable recovery without a
  suggestion neutral instead of choosing the last library, including an empty
  library pool. Preserve existing retries, signal advice, explicit resolution
  and routing/learning safeguards. See the
  [outcome](docs/architecture/recovery-unresolved-advice-outcome.md).

- **Unresolved AI advice** — Keep fresh generic invalid and clarification results
  without a primary destination; library names, list position and raw hints no
  longer become recommendations. Keep bounded explicit choices and fix JSON
  clarification's mode dispatch, preserving valid proposals, replay and routing
  authorization. See the
  [outcome](docs/architecture/generic-classify-unresolved-advice-outcome.md).

- **Generic classification guidance** — Remove the built-in Family exception
  and blanket rating prohibition from initial AI advice. Require supplied
  destination support and keep observed placements separate from declared
  policy, preserving scoring and routing/learning permission. See the
  [outcome](docs/architecture/category-neutral-classify-prompt-outcome.md).

- **Initial purpose semantics** — Preserve explicitly declared identity or
  compatibility on future initial/native-create writes, with the existing
  identity default for omitted/null values. Preserve historical records and
  exact old receipt recovery; fresh scores and ranking can change. See the
  [outcome](docs/architecture/initial-purpose-semantics-outcome.md).

- **Native purpose authoring** — Refuse unsupported fresh purpose declarations
  before writes across individual, initial, create and bulk paths, while
  preserving exact recovery of older receipts and unrelated edits. Offer four
  positive choices while retaining saved legacy values and actionable validation
  guidance in the existing editor. See the
  [outcome](docs/architecture/native-purpose-declaration-validation-outcome.md).

- **Native purpose operators** — Execute canonical positive genre, keyword,
  studio and media-type declarations consistently, with shared declared-match and
  overlap evidence. Preserve legacy, observed and exclusion behavior; repaired
  rules can change scores and ranking. See the
  [outcome](docs/architecture/native-purpose-positive-operators-outcome.md).

- **Native policy edits** — Preserve saved matching mode, decision thresholds
  and evidence-source settings across native revisions unless an explicit
  review-settings command replaces them. Purpose edits use the same preservation
  boundary for every category; see the
  [outcome](docs/architecture/category-agnostic-purpose-maintenance-outcome.md).

- **Policy ranking** — Count only matched, bound declarations as native intent
  support, including within mixed policies. Profile observations no longer
  receive duplicate intent weight or an extra agreement vote; existing admission
  and decision safeguards remain, while scores and ranking can change. See the
  [design](docs/architecture/policy-provenance-scoring-design.md) and
  [verification](docs/architecture/policy-provenance-scoring-outcome.md).

- **Pending classification reviews** — Cards, headers, scores, bulk confirmation
  and Discord share one server-derived destination reference. Policy/AI
  disagreement, tied leaders and invalid current proposals require an explicit
  destination choice while preserving named policy evidence, stale safeguards
  and completed-answer replay. See the
  [design](docs/architecture/review-recommendation-reference-design.md) and
  [verification](docs/architecture/review-recommendation-reference-outcome.md).

### Changed

- **Compiler PR review** — Reassess open PR #589's immutable compiler graph and
  retain the previously qualified versions because the proposed artifact is
  unchanged from the demonstrated incompatible candidate. No dependency edit or
  PR merge; see the [outcome](docs/architecture/client-compiler-pr-589-outcome.md).

- **Client DOM tooling** — Locally adopt PR #588's exact JSDOM 31.0.0 subset
  with real DOM, CSS, parser and transport controls. Preserve the deferred
  compiler graph, scoped Undici patch and strict installation policy; see the
  [outcome](docs/architecture/client-jsdom-pr-588-outcome.md).

- **Adjudication purpose evidence** — Give existing local AI comparisons bounded,
  live-bound declared purpose for their selected candidates, preserving identity
  and compatibility meaning. Keep remote evidence aggregate-only and preserve
  numeric scoring, routing and learning authorization; see the
  [outcome](docs/architecture/provider-purpose-adjudication-outcome.md).

- **Client CSS tooling** — Locally adopt PR #587's exact Tailwind/PostCSS 4.3.5
  subset with compiler, native/WASI scanning and published-type controls.
  Preserve the DOM/compiler graph, runtime dependencies and install policy; see
  the [outcome](docs/architecture/client-tailwind-pr-587-outcome.md).

- **Server tooling** — Locally adopt PR #585's exact Globals 17.14.0 and Knip
  6.44.1 pins, with real controls for unused exports behind promise-based imports.
  Preserve the parser graph, runtime dependencies and analysis policy; see the
  [outcome](docs/architecture/server-tooling-pr-585-outcome.md).

- **Purpose evidence planning** — Correct the queued task description to
  distinguish post-choice learning provenance from new provider-prompt evidence.
  Preserve runtime behavior and historical receipts; see the
  [consumer trace](docs/architecture/compatibility-purpose-consumer-boundary.md).

- **Vue runtime/compiler** — Locally assess PR #583's exact Vue 3.5.45 and
  coherent compiler/runtime graph, with real disposal, static boolean, lexical
  scope, async-unmount and directive controls. Preserve language tooling and
  existing type diagnostics; see the
  [outcome](docs/architecture/vue-pr-583-outcome.md).

- **Client tooling** — Locally assess and adopt PR #584's exact Vite 8.3.6,
  Vitest/coverage-v8 5.1.0, Playwright 1.65.0 and globals 17.14.0 subset, preserving
  compiler, jsdom and Tailwind versions and strict install policy. Keep the
  remaining grouped changes deferred; see the
  [outcome](docs/architecture/client-tooling-pr-584-outcome.md).

### Security

- **System compression library** — Pin signed Alpine zlib 1.4-r0 in the shared
  application base and provider fixture, with automated native compression and
  PostgreSQL archive checks in the existing image-verification job. Preserve the
  Node/base pins and keep Node's separate transport/compression gaps explicit.
  See the [outcome](docs/architecture/runtime-zlib-security-outcome.md).

- **Client test transport** — Locally adopt PR #587's compatible Undici 8.12.4
  subtree through a JSDOM-scoped override, retaining the DOM/compiler/Tailwind
  graph. Verify real transport and JSDOM consumer boundaries; existing CORS
  fidelity limitations remain explicit. See the
  [outcome](docs/architecture/client-undici-pr-587-outcome.md).

- **npm toolchain** — Coordinate npm/npx 12.2.2 across builds, CI and workspace
  contracts, preserving strict installer decisions. Verify the actual bundled
  ip-address 10.7.5 and Undici 6.29.1 fixes plus real CLI/cache/signature behavior.
  Remaining npm Glob/Minimatch and Node transport findings stay explicit; the
  published beta is unchanged. See the
  [outcome](docs/architecture/npm-12-2-2-security-outcome.md).

- **Server runtime dependencies** — Locally adopt PR #586's exact Undici 8.12.4,
  express-rate-limit 8.7.3 and discord.js 14.28.1 updates, preserving nested
  Undici 6.29.1 overrides and transport policy. Real-library controls cover
  integrity, redirects/cache replay, error forwarding and SDK permission scope.
  Node's bundled Undici remains a separate toolchain issue; see the
  [outcome](docs/architecture/server-runtime-pr-586-outcome.md).

- **CI action updates** — Locally adopt PR #582's exact Docker Login 4.8.0 and
  CodeQL 4.39.3 revisions while preserving publication, credential and scanner
  gates. No publication login or release is triggered by this update; see the
  [outcome](docs/architecture/github-actions-pr-582-outcome.md).

- **Dependency scan triage** — Renew the exact server-only rejected-CVE advisory
  entry through November 16 UTC, with fresh scope/expiry controls and all other
  findings and severities preserved. This addresses advisory-data lag and claims
  no package remediation; see the
  [outcome](docs/architecture/deepmerge-triage-renewal-outcome.md).

## [v0.49.4-beta] - 2026-11-02

**TL;DR:** Clearer movie/TV purpose evidence, explicit History assessments and
compact automatic evaluation summaries make classification disagreements easier
to investigate. Database-failure handling, bounded background reads, capture
ownership and logging are hardened. These changes do not establish an accuracy
rate or retroactively turn current media placements into confirmed labels.

Development entries were consolidated on 2026-11-02. The
[complete original record](docs/changelog/CHANGELOG-2026-11-pre-release-0.49.4.md)
preserves intermediate implementation details, decisions and dependency reviews.

### Added

- **Automatic evaluation visibility** — Independent provider-free evidence-gap
  and destination-review jobs save bounded aggregates in existing administrator
  Evaluation progress. Missing, empty, deferred, failed and stale states remain
  distinct; protected status reads never trigger work. Routine use needs no CLI
  command or extra dashboard.
- **History assessment** — Eligible completed automated decisions can be assessed
  against their preserved original destination through an actor-bound,
  ten-minute administrator reference and one atomic feedback receipt. Exact
  replay recovery preserves statistics semantics without moving media,
  reclassifying, creating rules or granting additional learning authority.
- **Prospective evidence** — Freeze typed ranking identity, successful explicit
  choices and the retained complete live policy pool, including matched purpose
  proof. Immutable classification/event binding, conflict checks and holdouts
  preserve separate confirmation/change cohorts and explicit legacy gaps.
- **Private developer diagnostics** — Optional bounded aggregate, disagreement
  and policy-context modes retain separate original/policy/experimental meanings.
  Whole-window validation precedes the 50-case / 1-MiB display cap; titles, raw
  contracts, actor identifiers and credentials remain excluded.
- **Development housekeeping** — A discoverable maintenance skill inventories
  local growth and removes only verified stale Classifarr artifacts while
  protecting recovery assets, current evidence, worktrees and other projects.

### Changed

- **Upgrade and retention** — Eight startup migrations add prospective evidence,
  review references, aggregate checkpoints and private capture claims. Back up
  database/appdata/encryption keys and stop older shared-database writers before
  upgrading. Thirty-day evidence payloads expire without refilling tombstones;
  portable exports omit diagnostics, restores clear transient checkpoints and
  invalidate claims, and History deletion cascades applicable child evidence.
- **Runtime dependencies** — Root/client Axios is 1.21.0 and server dotenv is
  18.0.9, preserving authentication, CSRF, cancellation, environment precedence
  and explicit no-replay behavior. Node 24.22.1 and npm 12.2.1 remain pinned.
- **Build and analysis tooling** — Client Vite 8.3.5/PostCSS 8.5.32 and both ESLint
  10.14.0 graphs have real-tool controls; updated Vue/server lint plugins and
  Knip preserve rule policy. Retain vue-tsc 3.3.13 after five 3.3.14 regressions.
  Ownership parser review preserves bindings, classifications and unresolved debt.
- **CI publication controls** — Docker Login 4.7.0 and CodeQL 4.39.1 use full SHA
  pins, retaining workflow permissions, event restrictions, promotion provenance
  and failure checks.

### Fixed

- **Purpose authority and explanations** — Shared provenance checks and v2
  evidence cards distinguish declared, inferred, mixed and unknown purpose.
  Declared specialized support requires genuine bound declared-rule matches;
  inferred rules keep ranking/comparison roles. Saved policies, numeric scores,
  thresholds and legacy statistics are not silently rewritten.
- **Refresh storage failures** — Database-proven disk-full failures retain safe
  incident diagnostics, preserve completed database caches and delay heavy work
  for one hour. Bounded readiness warnings distinguish genuine database evidence
  from provider errors or local cancellation. Holds are process-local; no file
  deletion, restart or proven storage recovery is implied.
- **Background read lifecycle** — Three-second readiness/workload budgets cover
  pool wait and result acceptance, with bounded cancellation cleanup and fixed
  admission slots held through actual acquisition settlement. Preserve fresh
  reservation checks and existing provider limits; cooperative stop does not
  promise immediate SQL/provider termination or whole-worker shutdown.
- **Capture durability** — Acknowledged owner claims guard reservations,
  checkpoints, publication, rotation and finalization. Cleanup remains admitted,
  valid longer cooldowns and charged attempts survive, and uncertain commits are
  not replayed or refunded. Serialized maintenance protects time-sensitive
  pruning; permanent stop is rechecked after outer maintenance settles.
- **Publication regression protection** — Real PostgreSQL tests verify healthy
  capture/evaluator exclusion through queued writes, rollback and delayed/lost
  acknowledgements. Runtime progression SQL stays unchanged because the shared
  admission boundary prevents the hypothesized healthy-worker interleaving.
- **Logging resilience** — Logging-only bounded data projection preserves safe
  context, redaction and record identity without invoking accessors or hooks.
  Persistence failure emits fixed text at most once a minute while every normal
  INSERT is still attempted. Native stack/record limits remain separate.

### Security

- **HTTP parser patches** — body-parser 2.4.0 and qs 6.16.1 address decoder-crash
  and coercion defects, retaining normal/restore HTTP limits, CSRF and maintenance
  restrictions. Zstandard support is available on the pinned Node runtime.
- **Redirect credentials** — Both root/client follow-redirects copies are exactly
  1.16.2, fixing cross-realm custom-header filtering across origins while retaining
  legitimate same-origin and Axios behavior.
- **Request counting and lint parser** — express-rate-limit 8.7.2 fixes upstream
  cross-window un-counting without changing application policy. Markdownlint's
  scoped RE2JS 2.8.7 override patches lookbehind-scanning work; the inspected lint
  path did not enable that vulnerable condition.
- **Tooling traversal patches** — Pair exact glob 14.0.3/minimatch 11.0.4
  overrides in server/client, with cancellation, bounded expansion and real
  consumer controls. Repair integration setup through supported parent deletion
  while preserving immutable evidence guards and release gates.
- **Advisory triage and residual risk** — Keep full development audits visible.
  A server-local deepmerge OSV entry expires November 9 and cites the official
  rejected CVE; it does not claim remediation. The maintainer explicitly accepts
  npm's separately bundled moderate ip-address finding for v0.49.4-beta only,
  conditional on all other fresh gates. Verified remediation is required before
  later releases; workspace overrides do not patch npm.

## [v0.49.3-beta] - 2026-10-23

**TL;DR:** Check and repair missing media identities with explicit review, control
this installation's background AI work, and retain safer recovery diagnostics.
Optional Ollama gateway/history/archive tools expand without changing existing
routing. The Node security baseline and dependency/tooling checks are refreshed;
gateway activation, VM operations and unfinished timing studies remain separate.

The [complete development record](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.3.md)
preserves the original Unreleased entries, consolidated on 2026-10-23.

### Added

- **Classification recovery** — Command Center can check a failed movie or TV
  task's saved TMDb ID, preview and confirm a supported identity repair, retain a
  durable receipt, and separately retry up to five explicitly selected reviewed
  repairs atomically. Ordinary administrator sessions and fresh evidence are
  required; API keys cannot authorize repairs. Original source evidence and retry
  budgets survive, repaired tasks stay outside automatic recovery and Retry All,
  and older writers must be stopped before shared-database repairs.
- **Missing-record checks** — Eligible existing and new failures receive durable,
  spaced same-ID checks and one requeue if that original record returns. Checks
  are bounded and cancellable; no replacement guessing, remapping, exhausted
  budget reset or source-library change occurs.
- **Background AI controls** — Command Center offers Off, When idle and daily UTC
  windows with persistent request safety limits. Fresh installs remain off;
  upgrades preserve existing opt-in ceilings. Foreground work or setting changes
  cancel local waits, not necessarily dispatched provider work. Controls cover
  one installation, not every application using shared Ollama.
- **Optional Ollama gateway** — Explicitly configured generation, embeddings,
  verification, health, warming and streaming share admission and cancellation,
  durable UUIDv7 request/task history, credential rotation and an administrator
  history view. Uncertain work stays blocked without direct fallback or reset
  attempts; existing installations keep direct routing.
- **Optional gateway recovery tools** — Separate offline reports, reviewed
  maintenance holds/resume, bounded provider assessment and one-shot provider
  stop preserve uncertain work and attempts. These do not enable unattended
  restart/replay, expose Docker to the application or change shared Ollama.
- **Optional gateway archives** — Separately configured archive, catalog,
  scheduling and bounded history-cleanup services retain verified recovery
  copies, protected records, legacy formats, retry budgets and audit history.
  Ordinary application startup does not enable these services or delete history.

### Changed

- **Gateway resource handling** — Bound history queries before large metadata
  reaches Node, read full dependencies only when needed, reuse hashes only
  inside the same read-only snapshot, and verify recovery evidence one record
  at a time. Limits, fresh safety checks, restore verification and retry budgets
  remain enforced.
- **Synthetic qualification** — Source/image-bound archive, inference, restore,
  memory, transaction and rotation studies verify owned cleanup and preserve
  incomplete observations. Shared-host interference invalidates timing; the
  isolated four-arm archiving comparison remains unfinished. These tools do not
  establish production latency, memory-leak or AI-accuracy guarantees.
- **On-demand study VM preparation** — Fixed 4-vCPU / 8-GiB / 64-GiB Hyper-V
  planning, explicit administrator creation and bounded read-only checks use
  protected paths and stricter local identity, SID, adapter and capture guards.
  Startup/drain/shutdown remains modeled or disabled; no always-on service or
  usable study guest is claimed. Retained fixtures and consumed cleanup authority
  remain unresolved; file-only journals and simulations do not authorize retries.
- **Runtime and dependencies** — Source installs require Node 24.22.1 and
  npm/npx 12.2.1; the container base is digest-pinned Node 24.22.1 / Alpine 3.24.3.
  Refresh Vue/Pinia, configuration/validation and direct/Discord HTTP clients,
  PostgreSQL test tooling, browser/build/coverage, lint and Markdown tooling while
  preserving strict lifecycle-script decisions and deliberate compatibility pins.
- **Repository and CI** — Source-sealed fixtures, bounded shutdown/recovery
  diagnostics, complete preflight contracts and pinned scanner actions retain
  failure propagation, cleanup, coverage and least-privilege gates. Repository
  change planning now uses the documented grill-me workflow.

### Fixed

- **AI readiness** — First-time Ollama verification remains pending through busy
  periods and gets staggered background opportunities without an open page.
  Configuration-bound waits survive restart; status refresh is distinct from a
  real test, and existing results are not automatically retested.
- **Identity and failure diagnostics** — Supported legacy/nested media identities
  are normalized consistently and conflicting declarations rejected. Metadata
  failures retain typed lookup outcomes and safe support references; queue status
  distinguishes stopped retries from exhausted budgets without declaring a record
  permanently gone.
- **Representative refresh reporting** — Fixed failure stage/category and incident
  references survive scheduler logging without raw SQL/provider errors, endpoints,
  descriptions or vectors. Better attribution does not establish or repair the
  original provider failure, reset retries or authorize live recovery.

### Security

- **Dependency patches** — Patch the server IPv6 parser to `ip-address` 10.7.4
  and root/client redirect-header handling, retaining bounded real-package
  regressions, quota compatibility and unchanged proxy trust.
- **Residual npm finding** — npm 12.2.1 separately bundles affected
  `ip-address` 10.7.2. Application overrides do not patch that CLI copy; zero
  workspace audit findings do not establish an advisory-free production image.
  The maintainer accepted this finding for v0.49.3-beta only; remediation is
  required before the next release. Release handling remains recorded in the
  [release outcome](docs/architecture/release-0.49.3-beta-outcome.md).
- **Gateway deployment boundary** — Gateway use requires explicit credentials,
  TLS identity and network isolation appropriate to its deployment. Private
  upstream HTTP is supported only within its documented boundary; TLS alone
  does not establish isolation. No existing provider route is activated by upgrade.
