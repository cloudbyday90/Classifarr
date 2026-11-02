# Changelog Archive: November 2026 v0.49.4 Development

> Original Unreleased record preserved verbatim from source
> `46ba1290dfb644293b657f77021c7716b3a89dc1` on 2026-11-02.
> The root changelog consolidates current system outcomes for release review.
> Intermediate observations and approvals below are historical, not new authority.
> Historical relative links retain their original repository-root interpretation.

Working related link: [runtime parser design](../architecture/runtime-parser-security-design.md).

## [Unreleased]

### Added

- **Report publication admission regressions** — Verify capture/evaluator
  exclusion through queued writes, rollback and delayed/lost commit replies using
  isolated PostgreSQL and the production database factory. Preserve valid
  unpublished progress and charged reservations; document that shared admission
  prevents the hypothesized healthy-worker race. Keep runtime SQL unchanged and
  retain the selected compiler PR's previously demonstrated deferral.

- **Local artifact maintenance skill** — Add routine agent-operated Classifarr
  housekeeping with verified stale-file and unused-image selection, explicit
  recovery-asset protection and measured cleanup receipts. Keep shared cache,
  application data and unrelated projects outside the default policy; no new UI
  or operator CLI trigger is required.

- **Automatic destination review summary** — Evaluate retained explicit choices
  automatically through existing background ownership, resource limits and
  backoff. Save bounded aggregate counts and show one quiet, expandable summary
  in administrator Evaluation progress. Distinguish unavailable, empty, stale,
  deferred and failed evidence without a manual CLI trigger. Keep original,
  policy and choice comparisons separate; routing and learning remain unchanged.

- **Optional frozen policy context** — Add `--include-policy-context` to the
  private purpose-case CLI. Inspect complete retained policy pools with exact
  item/time/leader/proof binding, distinct raw and ranked scores, and explicit
  optional evidence gaps. Keep current report bytes and eligibility unchanged
  without the option. Bound combined read-only input before transfer and omit
  whole cases at the output ceiling. No routing or learning changes.

- **Private purpose disagreement cases** — Add the exclusive read-only evaluation
  CLI mode `--prospective-purpose-cases`. List bounded eligible cases with
  separately named frozen policy/choice, original/choice and policy/original
  comparisons, preserving recorded confirmation/change meaning and independent
  History-review original references, including BIGINT IDs. Share whole-window
  validation and holdouts with the unchanged aggregate; cap private numeric
  output at fifty cases / 1 MiB with omissions and evidence gaps. Disagreement
  does not establish error, accuracy or cause; routing and learning are unchanged.

- **Prospective purpose-choice cohort** — Freeze new live purpose matches in
  immutable policy capture v2 and atomically associate existing explicit choices
  with the retained policy leader or a commit-time evidence gap. Preserve event
  deduplication, source expiry and replay tombstones. Add the bounded private
  aggregate CLI mode `--prospective-purpose`, with separate action/reference
  meanings and explicit historical gaps. Legacy statistics, inventory cohorts,
  scores, routing and learning authority remain unchanged; agreement is not accuracy.

- **Frozen policy evaluation evidence** — Preserve new retained live policy
  evaluations in immutable History-bound child records: the complete compatible
  pool up to 64 candidates, final policy ranking, closed exclusions, and separate
  storage authority, purpose provenance and runtime admission. Expire payloads
  after thirty days while retaining tombstones; keep evidence outside portable
  backups. Extend the bounded private disagreement CLI with validated context
  and explicit gaps. Classification survives capture failures; cohort scoring,
  routing and learning remain unchanged. Historical intent is not reconstructed.

- **Private prospective disagreement report** — Add the explicit evaluation CLI
  mode `--prospective-disagreements`. Compare frozen original references and
  experimental rankings against validated assessments through shared cohort
  eligibility, preserving existing aggregate results and connected holdouts.
  Bound read-only inputs and private numeric/ID output; show missing historical
  intent/policy evidence, abstentions and display omissions explicitly. No new
  routing, learning, saved report, API/UI or scheduled job.

- **Explicit History feedback review** — Assess a preserved original automated
  destination through an active-administrator, ten-minute server reference.
  Atomically record one existing feedback/statistics transaction and frozen
  confirmation/change evidence, with stale-state rejection and scoped receipt
  recovery after a lost response or expiry. Keep legacy selections and historical
  gaps explicit. This assessment does not move media, reclassify, create policy
  rules or add learning authority; it does not establish classification accuracy.

- **Frozen feedback selection provenance** — Capture exact classification binding,
  selection action and the server shortlist reference in new feedback receipts.
  Protect provenance and replay clocks against replacement while preserving
  expiry and feedback tombstones. Audit v2 separates selection-only diagnostics
  from unknown legacy actions; neither becomes a frozen prospective
  confirmation/change label. Existing retrospective statistics, calibration,
  routing and learning behavior remain unchanged.

- **Automatic comparison evidence audit** — Independently inspect bounded retained
  evidence with existing scheduler ownership, resource admission, cancellation and
  backoff. Save only a replaceable aggregate and show it in administrator
  Evaluation progress through a protected read-only status API. Separate capture
  exclusions from overlapping observation diagnostics; withhold failed or stale
  counts even while presentation is paused. Historical recovery remains
  unassessed; placement does not become a label, and routing/learning are unchanged.

- **Prospective comparison provenance** — Freeze typed identity in new ranking
  captures and recheck it before persistence. Read canonical authorized choices
  and provably bound correction snapshots through strict, modular adapters.
  Preserve legacy gaps, unknown action kinds, unavailable conflicts and connected
  holdouts before separate confirmation/change scoring. Exact BIGINT IDs and
  bounded overflow aliases cannot select a favorable retry. Current placements
  do not become confirmed labels; routing and learning remain unchanged.

- **Frozen authorized-outcome evaluation** — Atomically retain prospective typed
  identity, destination, action and decision context for successful authorized
  operator choices. Shared evaluation readers deduplicate event aliases, separate
  confirmations from changes, reject conflicts and report historical evidence
  gaps. Database observation times, thirty-day expiry and replay guards prevent
  late receipts from refreshing old evidence. Routing and learning authority are
  unchanged; this does not establish classifier accuracy or repair past labels.

### Fixed

- **Capture stop after maintenance** — Recheck permanent stop after the outer
  budget read settles, before returning readiness or entering discovery
  admission. Keep awaiting the transaction and preserve committed maintenance,
  caches, charges and existing retry rules without replay or a new timeout.

- **Serialized capture-budget maintenance** — Lock the budget singleton before
  UTC reset and progress pruning so a contended read cannot erase a newly
  committed capture using an older timestamp. Keep maintenance independent of
  flight claims, preserve retention and charges, and distinguish absent-row
  deferral from malformed results without adding retries or replay.

- **Owner-bound automatic rotation** — Require the acknowledged capture
  revision/UUID before advancing rotation or clearing retained progress.
  Serialize ownership, preserve same-flight authority and distinguish proven
  refusal from ordinary zero, malformed results and uncertain commits. Keep
  existing cooldown, charge and stop behavior without replaying advance.

- **Owner-bound automatic checkpoints** — Require the acknowledged capture
  revision/UUID for open, record and the existing atomic progress/cache publish.
  Serialize ownership before retention checks and guarded writes; only proven
  owner absence defers and suppresses stale cleanup. Preserve charged attempts,
  leases, stop handling and uncertain-commit boundaries without replay.

- **Fence automatic capture reservations** — Verify the private owner claim before
  resetting the UTC quota day or charging another call. Roll back refused work,
  distinguish proven ownership loss from exhausted budgets and unknown failures,
  and defer stale attempts without a cleanup write, refund or replay. Preserve
  already accepted charges, workload limits and existing automatic workflows.

- **Fence capture finalization** — Require an acknowledged private claim from the
  discovery-lock-owning database session before saving capture outcomes. Reject
  older claims after a replacement attempt commits, invalidate authority on
  configuration changes/restores, and preserve cooldowns, charged work and saved
  caches. Existing automatic schedules and UI remain unchanged.

- **Keep capture cleanup owned** — Await admitted failure finalization before
  releasing discovery admission. Use local fallback for rejected admission and
  post-callback failures, preserve the first failure/cooldown through later
  boundary errors, and avoid late cleanup overwriting a cooperating newer run.
  Keep saved caches, charged attempts, schedules and UI unchanged.

- **Acknowledge capture finalization** — Defer an automatic capture whose primary
  finish acknowledges zero affected rows, retain its local cooldown and avoid a
  second finish. Keep published caches and charged attempts intact, preserve
  earlier failure outcomes during best-effort cleanup, and leave lost commit
  replies uncertain. Existing schedules and UI remain unchanged.

- **Preserve capture cooldowns** — Prevent later five-minute outcomes from
  shortening a valid longer cooldown. Serialize finalization before calculating
  the database-time deadline, preserve the existing one-hour validity horizon
  and cooperative stop handling, and replace ignored future timestamps. Keep
  status semantics, budgets, automatic schedules and UI unchanged.

- **Capture failure shutdown** — Pass the permanent stop signal to failure
  finalization and recheck stop after the awaited write settles. Prevent finalizer
  DML when stop arrives during pool wait, and return the stopped lifecycle result
  without claiming rollback of an already-dispatched commit. Preserve quotas,
  cooldown timing, transaction handling and automatic schedules.

- **Bound capture workload checks** — Cancel automatic capture's initial,
  periodic and fresh reservation checks within one shared three-second budget.
  Preserve separate read-only transactions and current isolation; prevent
  queued acquisitions from accumulating across runtime replacements. Cancel and
  drain owned checks when the callback settles, preserving its result and
  existing inference budgets. Keep automatic schedules and UI unchanged.

- **Bound automatic evaluation readiness** — Reuse a shared three-second,
  read-only preflight for automatic source-pair evaluation and capture. Retain
  one database-scoped admission slot through cancellation cleanup and queued
  acquisition drain, fencing late work across runtime replacement. Preserve
  refresh diagnostics and separate evaluation/inference permissions; existing
  automatic schedules and UI remain unchanged.

- **Bound automatic refresh readiness** — Cancel description and representative
  preflight reads on stop, caller abort or a three-second probe deadline. Keep
  scoped admission through read cleanup and late pool acquisition, preventing
  abandoned requests from accumulating across runtime replacement. Preserve
  genuine database diagnostics, worker caches/cooldowns and normal ownership
  checks; local cancellation cannot become SQL failure evidence. Existing
  automatic schedules continue without a new UI or operator command.

- **Bound primary log data** — Preserve log events and safe context when data is
  cyclic, hostile or oversized. Project own data properties without invoking
  accessors or serialization hooks, retain sensitive-key redaction, and bound
  traversal and encoded metadata. Protect root log identity and share the
  projection with ordinary database logging. Keep native stacks, existing retry
  boundaries and durable comparison evidence separate; no operator action is needed.

- **Safe logging persistence fallback** — Replace raw error-text fallback output
  with one fixed notice and a shared one-minute output limit. Hostile failures or
  a failed console cannot turn an already caught persistence failure into a
  rejection. Preserve primary logs, persistence attempts and ID/null results.

- **Refresh readiness diagnostics** — Explain failed preliminary database checks
  for description and representative refreshes through safe, rate-limited
  warnings in existing logs. Keep failed checks deferred, preserve cache and
  retry state, and resume normal admission automatically after readiness returns.
  No new cooldown, recovery claim, interface or operator command is added.

- **Inventory refresh disk-full recovery** — Recognize PostgreSQL-reported
  storage exhaustion in description and representative refreshes, retain safe
  incident diagnostics in existing logs, and automatically wait one hour before
  retrying heavy work. Keep completed database cache entries and ownership
  safeguards; provider changes cannot erase a storage cooldown. No automatic
  file deletion, restart, routing or learning change is introduced.

- **Verified purpose explanations** — Distinguish declared, inferred, mixed and
  unknown purpose on pending and library-comparison evidence cards. Require a
  bound, server-derived declared-rule match with existing specialized/conflict
  checks before showing declared support. Preserve actual card versions and
  neutral numeric labels; isolate legacy correction/statistics heuristics.
  Historical gaps, scores, routing and learning authority remain unchanged.

- **Purpose authority consistency** — Use the same declaration-provenance checks
  in specialized destination evidence and policy API projections. Inferred
  template or profile rules retain ranking and comparison roles without being
  presented as declared purpose or receiving specialized declared-purpose proof.
  Preserve native storage authority, explicit constraints and fresh learned-route
  checks; this does not rewrite saved policies or establish an accuracy rate.

### Changed

- **Assessed server ESLint update** — Locally adopt randomly selected PR #580's
  exact ESLint 10.14.0 with real-rule regression controls. Verify identical
  ownership analysis on unchanged source before updating only the reviewed
  parser pin; preserve all review bindings, classifications and unresolved debt.
  Keep strict install policy, independent dependency trees and the PR unmerged.

- **Compiler semantic regression guards** — Add bounded real-CLI model/event,
  slot-default and independent semantic-error controls. Locally assess PR #581
  and retain vue-tsc 3.3.13 after reproducing five 3.3.14 compiler regressions;
  preserve the complete compiler graph, typecheck scopes and strict install
  policy without application workarounds or diagnostic suppression.

- **Assessed client tooling updates** — Locally apply PR #579's exact ESLint
  10.14.0, eslint-plugin-vue 10.12.0 and PostCSS 8.5.32 subset with real tooling
  regression coverage. Retain vue-tsc 3.3.13 and its compiler graph pending a
  separate compatibility batch. Keep npm pinned until the bundled parser fix
  is published and verified; the PR remains unmerged.

- **Root Axios update** — Locally adopt randomly selected PR #574 with exact
  Axios 1.21.0 and real Node GET/JSON POST compatibility checks. Preserve
  application authentication/retry behavior and strict install policy.

- **Client Axios update** — Locally adopt PR #575 with exact Axios 1.21.0, preserving
  explicit CSRF, credentials and no-replay controls. Verify header compatibility
  and production browser assets. Root Axios and the subsequent redirect patch
  have separate design and verification records.

- **Client build tooling** — Locally implement randomly selected PR #570 with
  exact PostCSS 8.5.31 and Vite 8.3.5 pins and the reviewed coupled lock changes.
  Preserve install-script policy and overrides; verify client coverage, types,
  production build and real browser route/asset checks. No PR merge or release.
- **Pinned CI actions** — Locally implement PR #569's Docker Login 4.7.0 and
  CodeQL 4.39.1 updates with full commit SHAs. Update the existing promotion
  allowlist and security contract assertion while preserving permissions,
  publication/event gates and failure checks. No PR merge or release is included.
- **Server lint tooling** — Locally implement PR #572's `eslint-plugin-n` 18.5.0
  and PR #578's exact `eslint-plugin-security` 4.2.1 / `knip` 6.44.0 updates.
  Verify real RegExp call diagnostics and Knip analysis, retaining severities,
  exclusions, install-script policy and overrides. No provider PR merge or release.
- **Server environment tooling** — Locally implement randomly selected PR #571:
  pin `dotenv` 18.0.9 and cover the empty `DOTENV_PATH` CLI fix with isolated
  synthetic environment and precedence checks. No provider PR merge is included.

### Security

- **RE2JS tooling patch** — Scope exact RE2JS 2.8.7 beneath Markdownlint 0.42.0
  for GHSA-gg6h-894w-4m9c. Reproduce repeated lookbehind scanning with a bounded
  real-library input observer and verify exact results plus legitimate lint
  behavior. The inspected Classifarr lint path does not enable the advisory's
  lookbehind condition; application behavior and lint protections stay unchanged.

- **Cross-realm redirect filtering** — Patch both independent root/client
  follow-redirects overrides to exact 1.16.2 for GHSA-mrwp-f3q8-3g9p. Reproduce
  the foreign-array failure on both old copies, then verify custom credential
  stripping across origins and legitimate same-origin behavior with actual
  Node HTTP requests. Keep remaining development-tool advisories visible.

- **Rate-limit dependency patch** — Adopt and locally test express-rate-limit
  8.7.2 from Dependabot PR #577, pinning the exact version. Fix the upstream
  cross-window un-counting behavior without changing application limit policy.

- **Required next-release remediation** — Block the next release until npm's
  bundled `ip-address` finding is fixed and verified across local, CI and Docker
  tooling. The maintainer's acceptance applies only to v0.49.3-beta.
- **Runtime parser remediation** — Pin `body-parser` 2.4.0 and `qs` 6.16.1 to
  address trailing-byte decoder crashes and comma-serialization coercion errors.
  Add isolated process probes and actual normal/restore HTTP compatibility
  checks, retaining decoded limits, CSRF and maintenance restrictions. The parser
  also adds upstream Zstandard support on the pinned Node runtime; see the
  [design](docs/architecture/runtime-parser-security-design.md).
- **Development dependency follow-up** — The full server audit retains the
  unpatched `deepmerge` advisory through Jest. No remote production path was
  established; avoid the audit-suggested unsupported Jest major downgrade.
