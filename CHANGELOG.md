# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [November 2026 v0.49.5 Development](docs/changelog/CHANGELOG-2026-11-pre-release-0.49.5.md) | [November 2026 v0.49.4 Development](docs/changelog/CHANGELOG-2026-11-pre-release-0.49.4.md) | [October 2026 v0.49.1–v0.49.2 Releases](docs/changelog/CHANGELOG-2026-10-releases-0.49.1-through-0.49.2.md) | [October 2026 v0.49.3 Release](docs/changelog/CHANGELOG-2026-10-release-0.49.3.md) | [October 2026 v0.49.3 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.3.md) | [October 2026 v0.49.2 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.2.md) | [October 2026 through v0.49.0](docs/changelog/CHANGELOG-2026-10-releases-through-0.49.0.md) | [October 2026 v0.49.1 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.1.md) | [October 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-10-pre-release.md) | [August 2026 Release Details](docs/changelog/CHANGELOG-2026-08-releases.md) | [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Changed

- **Queue evidence verification** — PostgreSQL regression coverage verifies
  that exact task IDs and attempts stay bound through question reduction.

### Fixed

- **Queue decision evidence** — The witness endpoint and queued evaluation
  report preserve exact History IDs above the JavaScript safe-integer limit.
- **Queue task actions** — Retry, dismiss, cancel, and manual classification
  target exact BIGINT task IDs and refuse invalid task selectors.
- **Queued evaluation** — Decision witnesses and sweep reports preserve large
  queue task IDs, and polling requires evidence tied to the submitted task.
- **Queue identity repair** — Metadata checks, repair commands, and selected
  backfill preserve exact BIGINT task IDs and readiness cursors.
- **Classification diagnostics** — Metadata-failure details, bug reports, and
  exports retain exact queue task IDs above JavaScript's safe-integer limit.
- **Historic route-safety refresh** — Retry receipts bind exact BIGINT queue
  task IDs so valid retries can commit and reconcile at large IDs.
- **Classification intake** — Lifecycle receipts retain exact BIGINT queue
  task IDs for private reporting after queue cleanup.
- **Request-import outcomes** — Terminal queue results retain exact BIGINT
  History references in their event keys and outcome summaries.
- **Discord pending-answer intake** — Derived event keys preserve exact
  History IDs and complete native fingerprints within the existing limit.
- **Manual corrections** — Correction outcomes, evidence, and receipts stay
  bound to the selected History row for exact BIGINT IDs.
- **pgvector recall audit** — Target exact BIGINT History IDs and reject
  malformed or conflicting selectors before querying embeddings.
- **Web-search provider diagnostics** — Keep large health-event and route
  decision IDs exact so distinct records retain their own row identity.
- **Native-intent reversion** — Bind new reconciliation holds to the exact
  rollback event for their policy and preserve large event IDs during reentry.
- **Native-intent rollback snapshots** — Restore the requested snapshot and
  its intended authority with exact BIGINT IDs in replay and audit records.
- **Initial native intent establishment** — Preserve exact BIGINT receipt
  IDs in establishment, replay, and readiness, and read the declared rules
  for the saved intent.
- **Library rebuild rollback evidence** — Carry exact snapshot IDs through
  cutover and removal readiness, and refuse ambiguous historical
  numeric audit references.
- **Library rebuild execution evidence** — Preserve exact gate IDs through
  replacement and removal readiness, and verify the gate acknowledgement
  before replacement commits.
- **Library rebuild replacement events** — Keep event IDs exact through
  replacement and removal readiness, and verify the saved event link
  before replacement commits.
- **Library rebuild capture events** — Preserve exact event IDs in capture
  and replay receipts, and verify the saved event link before committing.
- **Library rebuild verification runs** — Keep exact receipt IDs from claim
  through removal readiness and require capture evidence before using a
  large pending verification link.
- **Native policy loading** — Load rules, templates, validation, routing,
  and evidence for exact BIGINT intent IDs in the policy engine's bulk read.
- **Library rebuild replacement intents** — Keep generated intent IDs
  exact through dependent writes, replay, and removal readiness.
- **Library rebuild original intents** — Preserve exact intent IDs
  from acceptance through verification, capture, and removal readiness.
- **Rollback snapshot retention** — Preserve exact BIGINT snapshot, intent,
  and source event IDs, and keep redacting expired payloads when capture
  provenance is unavailable.
- **Observed-evidence retention** — Preserve exact BIGINT snapshot, intent,
  and establishment IDs and verify the saved marker before redaction commits.
- **Policy-change outcome observation** — Accept exact BIGINT source receipts
  and verify the private receipt link before saving an observation.

## [v0.49.5-beta] - 2026-11-24

[Full development record](docs/changelog/CHANGELOG-2026-11-pre-release-0.49.5.md) preserved on 2026-11-24.

**TL;DR** — Pending reviews now use the current policy evidence, retries
preserve verified request links, and History IDs remain exact across supported
workflows. The suggestion dashboard loads bounded pages and checks uncertain
review outcomes. The production image uses the patched runtime and excludes npm.

### Added

- **Suggestion APIs** — Add an authenticated list page and bounded proposal read,
  plus administrator-only saved feedback pages. Manual analysis offers an opt-in
  summary for up to 24 policies with explicit continuation and per-policy
  outcomes. See the [API guide](docs/api/suggestions.md).
- **Release evidence** — Native arm64 rehearsals exercise scheduled recovery.
  Release publication and image promotion require fresh signed v4 evidence from
  both architectures, including scheduled recovery on the tested arm64 child.
  The read-only verifier checks the tagged attempt and live registry digests.
  See the [release verifier](docs/architecture/published-release-verifier-outcome.md).

### Changed

- **Policy Tuning Suggestions** — Browse one page at a time, filter all statuses,
  and open proposals and authorized evidence on demand. Apply and Reject submit
  once. After an uncertain response, Check status reads the saved outcome.
- **Policy purpose and ranking** — Preserve explicit identity and compatibility,
  saved review settings, and exact receipt recovery. Require supported positive
  declarations on fresh writes and count only genuinely matched, bound rules
  as native intent support. Corrected evidence can change ranking.
- **AI purpose and verification** — Category-neutral prompts distinguish
  observed data from declared policy. Local adjudication may receive bounded
  declared terms from the current evaluation. Other providers receive fixed
  aggregates. Verification advice and context use fresh proof; unresolved and
  unavailable suggestions stay neutral when proof is absent. Scoring, provider
  accounting, routing and learning authority retain their existing gates.
- **Upgrade and restore** — Five existing startup migrations add retry lineage
  proof and refusal fields and widen History links for intake receipts, routing
  checks and reclassification. Back up appdata, database and encryption keys,
  and stop older writers sharing the database before upgrading.
- **Tooling and CI** — Update Vue, Vite, Tailwind/PostCSS, JSDOM, Playwright,
  Vitest, ESLint, Knip, Testcontainers, Supertest and root documentation tools.
  Use native npm patches for Vue compiler diagnostics and strict lock installs.
  Restore dependency-free synthetic replay, isolate compiler-generated watcher
  files and Playwright JSON, and gate pgvector browser contracts in Chromium.
- **Capacity and UUIDv7 groundwork** — Measure suggestion analysis and inventory
  corpus reads in isolated PostgreSQL. Preserve current query limits and
  deadlines. Inventory UUIDv7 readiness without changing the identifier scheme.

### Deprecated

- **Legacy suggestion detail** — Existing authenticated detail keeps its
  response during a support window of at least 90 days from the first public
  release with the new reads and migration notice. The response uses
  `Cache-Control: no-store` and an explicit field list. No removal date is set.

### Removed

- **Legacy clarification submission** — The authenticated HTTP write responds
  with 410 and Command Center guidance. Old generic and index-only Discord
  buttons respond privately with that guidance. Current fingerprinted
  pending answers and completed correction controls remain supported.

### Fixed

- **Command Center pending reviews** — Use row-bound current evidence when an
  adopted or non-adopted RAG result is retained, including eligible automatic
  holds. Adopted select still requires explicit choice. Clear inherited
  verification/advice for new candidates. Invalid references, destination
  changes or lost handoff proof keep review safe and retryable. Distinguish
  unavailable reads from an empty queue and expose a read refresh.
- **Exact History IDs** — Preserve BIGINT links through intake and original
  snapshots, routing, retry and historic refresh, reclassification, answer and
  learning receipts, cleanup, diagnostic logs and evidence collectors. Preserve
  safe IDs as numbers where supported and larger IDs as decimal strings.
  Keep saved replay checks, provider/library limits and the separate safe limit
  on the legacy completed Discord selector.
- **Discord decisions** — Bind fingerprinted pending and completed verification
  and correction controls to the saved notification and offered actions.
  Preserve exact BIGINT IDs in supported buttons and correction flows.
  Completed and pending controls retain separate authority.
- **Retry and notification integrity** — Capture current lineage when queuing,
  transfer verified request and webhook links atomically with the replacement,
  and recover committed results without repeating provider writes. Queue
  details show missing proof and when a saved local replacement has unverified
  routing. Malformed notification metadata no longer blocks valid cleanup.
- **Scheduled and diagnostic work** — Keep policy-library evidence loads
  compatible with the History schema. Attribute source-pair failures to their
  stage and distinguish a verified size or feature limit from an unavailable
  operation. Preserve cancellation, cooldown, and publication boundaries.

### Security

- **Review and analysis permissions** — Require administrators on prompt
  responses, suggestion Apply/Reject and manual analysis. Restrict manual
  analysis to one in-flight request per API process, and preserve authenticated
  reads, exact actor/target checks, saved receipts and existing write authority.
- **Production stack** — Ship Node 24.22.3 with bundled Undici 7.30.2 on Alpine
  3.24.4 and signed system zlib 1.4-r0. Keep npm/npx out of shipped layers.
  Source, builders and CI use npm/npx 12.2.2 with bundled ip-address 10.7.5.
  The historical npm 12.2.1 exception is retired for this release.
- **Dependency and workflow safeguards** — Update server HTTP, rate limiting,
  Discord and dotenv dependencies and scoped client test transport. Keep known
  builder-only advisory findings visible. Pin GitHub Actions and OSV Scanner,
  and retire the expired server-only deepmerge exception without weakening scans.

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
