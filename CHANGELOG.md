# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [November 2026 v0.49.4 Development](docs/changelog/CHANGELOG-2026-11-pre-release-0.49.4.md) | [October 2026 v0.49.1–v0.49.2 Releases](docs/changelog/CHANGELOG-2026-10-releases-0.49.1-through-0.49.2.md) | [October 2026 v0.49.3 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.3.md) | [October 2026 v0.49.2 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.2.md) | [October 2026 through v0.49.0](docs/changelog/CHANGELOG-2026-10-releases-through-0.49.0.md) | [October 2026 v0.49.1 Development](docs/changelog/CHANGELOG-2026-10-pre-release-0.49.1.md) | [October 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-10-pre-release.md) | [August 2026 Release Details](docs/changelog/CHANGELOG-2026-08-releases.md) | [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Fixed

- **Manual suggestion analysis** — Both analysis routes share one slot per API
  process. An overlapping request receives `503` before analysis starts. See
  the [outcome](docs/architecture/manual-suggestion-analysis-admission-outcome.md).

- **Suggestion rejection and manual analysis** — Both actions require an
  administrator. Rejection records the exact reviewer, and manual analysis
  logs who requested it. See the
  [outcome](docs/architecture/suggestion-review-mutation-authority-outcome.md).

- **Policy suggestion application** — Both Apply endpoints now require
  administrators, validate exact suggestion IDs, and record the authenticated
  actor. See the
  [outcome](docs/architecture/suggestion-application-authority-outcome.md).

- **Prompt response authority and identity** — Prompt detail and response
  use exact BIGINT History IDs. Prompt responses now require an administrator
  session. See the
  [outcome](docs/architecture/prompt-response-identity-authority-outcome.md).

- **Retired HTTP clarification submissions** — The legacy response endpoint
  now returns `410 Gone` with Command Center guidance. See the
  [outcome](docs/architecture/legacy-http-clarification-retirement-outcome.md).

- **Retired Discord clarification buttons** — Clicking an old generic
  clarification button now replies privately with directions to the Command
  Center. See the
  [outcome](docs/architecture/discord-generic-clarification-retirement-outcome.md).

- **Discord completed decision buttons** — Confirm and reclassify completed
  items with exact BIGINT History IDs through the existing bound buttons. See
  the [outcome](docs/architecture/discord-completed-buttons-bigint-outcome.md).

- **Original-decision snapshots** — Preserve exact BIGINT History IDs in
  snapshot capture, bounded intake recovery, and evaluation. See the
  [outcome](docs/architecture/original-decision-snapshot-bigint-outcome.md).

- **Discord completed corrections** — Carry exact BIGINT History IDs through
  the verification opener, correction menu, saved receipt, and routing. See
  the [outcome](docs/architecture/discord-completed-correction-bigint-outcome.md).

- **Discord verification and direct corrections** — Bind the existing
  buttons to the saved completed notification and record verification status
  and outcome together before routing. See the
  [outcome](docs/architecture/discord-legacy-completed-buttons-outcome.md).

- **Discord library decisions** — Keep the shared library menu for completed
  corrections. Older pending menus direct operators to Classifarr. Compact
  answer buttons must be offered on the saved notification and match the
  current question under the row lock. See the
  [outcome](docs/architecture/discord-selector-decision-separation-outcome.md).

- **Legacy Discord controls** — Require exact safe History IDs and a matching
  saved notification before applying a clarification button or library
  selection. Recheck the message under the write lock. See the
  [outcome](docs/architecture/discord-legacy-control-boundary-outcome.md).

- **Discord compact answers** — Preserve exact BIGINT History IDs and full
  fingerprints in fingerprinted answer buttons. Keep stored-message checks
  and completed replay. See the
  [outcome](docs/architecture/discord-compact-answer-bigint-outcome.md).

- **Web pending-answer admission** — Enable single and bulk web answers
  for exact History IDs through the BIGINT maximum. Preserve numeric safe
  IDs and require an exact row binding for large-ID replay.
  See the [outcome](docs/architecture/pending-web-bigint-admission-outcome.md).

- **Pending-answer History IDs** — Preserve exact IDs in single and bulk
  web requests, reject mismatched answer contracts, and validate exact row
  identity in the shared outcome writer. Existing answer limits still apply.
  See the [outcome](docs/architecture/pending-web-bigint-readiness-outcome.md).

- **Learning receipt identity** — Require exact History row bindings before
  exact-item memory or destination evidence uses a saved answer. See the
  [outcome](docs/architecture/learning-answer-receipt-identity-outcome.md).

- **Pending-answer replay** — Preserve exact History IDs in fingerprints,
  bind new receipts to their row, and validate cleanup selections before
  locking. See the [outcome](docs/architecture/pending-answer-fingerprint-replay-outcome.md).

- **Manual exact-item memory IDs** — Validate the complete History ID before
  learning and preserve exact BIGINT row targeting and receipt replay. See
  the [outcome](docs/architecture/manual-exact-item-memory-id-outcome.md).

- **Resolution learning IDs** — Preserve exact BIGINT History IDs in
  outcome-only resolution evidence and automatic exact-item learning. See
  the [outcome](docs/architecture/resolution-learning-bigint-outcome.md).

- **Native pending provenance** — Preserve exact BIGINT History IDs in
  resolution and routing outcome evidence. Pending answers retain their
  current safe-integer limit. See the
  [outcome](docs/architecture/native-pending-provenance-bigint-outcome.md).

- **Pending resolution IDs** — Validate exact History IDs before web and
  Discord lookup, and hide pending-answer controls for IDs outside the
  current safe range. See the
  [outcome](docs/architecture/pending-resolution-id-admission-outcome.md).

- **Historic route-safety refresh** — Preserve exact BIGINT History IDs in
  pagination, controlled retry, and protected receipts. Invalid stored
  lineage ends at the last valid record. See the
  [outcome](docs/architecture/historic-refresh-bigint-outcome.md).

- **Classification retry IDs** — Preserve exact BIGINT History IDs in
  ordinary retry, scheduled recovery, and notification cleanup. Command
  Center bulk retry sends each loaded ID unchanged. See the
  [outcome](docs/architecture/classification-retry-bigint-outcome.md).

- **Reclassification History links** — Preserve exact BIGINT History IDs
  through move preview, batch execution, and receipt recovery. See the
  [outcome](docs/architecture/reclassification-history-bigint-outcome.md).

- **Routing outcome persistence** — Preserve exact BIGINT History IDs in
  manual and automatic outcomes and the queued admission marker. See the
  [outcome](docs/architecture/routing-outcome-bigint-outcome.md).

- **Manual routing checks** — Keep exact Classification History IDs through
  manual and scheduled checks, including IDs above JavaScript's safe integer
  range. Reject partial or noncanonical paths before selecting a row. See the
  [outcome](docs/architecture/manual-routing-check-bigint-outcome.md).

- **Classification intake links** — Preserve exact History IDs in intake
  receipts and recovery witnesses up to the PostgreSQL BIGINT maximum. Larger
  IDs can be linked even when the existing decision snapshot is unavailable.
  See the [outcome](docs/architecture/classification-intake-bigint-outcome.md).

- **Vite development reloads** — Ignore temporary Vue compiler projects in
  the client watcher to preserve browser drafts during parallel validation.
  Keep reloads for watched TypeScript configs. See the
  [outcome](docs/architecture/vite-compiler-fixture-watcher-outcome.md).

- **Code-health JSON inputs** — Exclude the two generated Playwright output
  roots from the client JSON inventory while keeping authored validation.
  See the [outcome](docs/architecture/code-health-json-inputs-outcome.md).

- **Synthetic replay CI** — Restore the offline replay command in a clean
  checkout by sharing dependency-free candidate viability rules. See the
  [outcome](docs/architecture/synthetic-replay-dependency-boundary-outcome.md).

- **Queue retry evidence** — Explain when a stopped retry saved its local
  replacement and routing remains unverified. Use the exact task's completion
  record in the existing Queue disclosure. See the
  [outcome](docs/architecture/retry-lineage-routing-evidence-outcome.md).

- **Retry refusal details** — Record which verification stopped a classification
  retry and show the saved explanation in the existing Queue. Keep retry and
  routing safeguards intact and use general wording for older tasks. See the
  [outcome](docs/architecture/retry-lineage-refusal-details-outcome.md).

- **Atomic retry lineage** — Keep original request and webhook links in place
  while a retry waits. Transfer verified links with the replacement History
  and recover a committed result without replaying automatic routing. Explain
  terminal lineage refusals in the existing queue. See the
  [outcome](docs/architecture/retry-lineage-consumption-outcome.md).

- **Fresh retry lineage** — Build new retry tasks from the current captured
  references or explicit absence, preventing older History lineage from being
  forwarded after an empty capture. Preserve source metadata, fresh populated
  captures and existing retry/transaction behavior. See the
  [outcome](docs/architecture/retry-lineage-producer-outcome.md).

- **Exact retry targets** — Share bounded ID validation across public, batch,
  direct and historic-refresh retry commands. Reject coercible or out-of-range
  targets before retry work or new historic receipts, preserving valid execution,
  authorization and uncertain-commit handling. See the
  [outcome](docs/architecture/retry-target-admission-outcome.md).

- **Retry notification cleanup** — Prevent oversized or malformed notification
  classification IDs from blocking valid retries. Preserve either-key deletion
  and the existing target INTEGER contract. See the
  [outcome](docs/architecture/retry-notification-id-matching-outcome.md).

- **Pending notification matching** — Allow valid pending replacement to finish
  when unrelated notifications contain oversized or malformed classification
  IDs. Compare exact validated targets without casting notification data;
  preserve leading-zero matches and leave malformed records unchanged. See the
  [outcome](docs/architecture/pending-notification-id-matching-outcome.md).

- **Pending replacement IDs** — Preserve exact large History IDs during
  supersession and notification read tracking. Keep new lifecycle links precise
  through JSON readback while retaining small numeric IDs. Reject invalid
  transaction identifiers before completion. See the
  [outcome](docs/architecture/pending-replacement-bigint-outcome.md).

- **Automatic result ownership** — Give new adopted automatic-policy candidates
  fresh proven policy context or explicit absence, and clear the earlier
  candidate's AI advisory. Preserve top-level evidence, routing holds and
  accounting; missing optional proof adds no routing hold. See the
  [outcome](docs/architecture/adopted-auto-result-context-outcome.md).

- **Pgvector browser contracts** — Verify the concise System Information facts,
  stale/unknown handling and CPU warning without restoring removed diagnostics.
  Check narrow layouts and run these cases automatically in the existing
  Chromium CI step. See the
  [outcome](docs/architecture/pgvector-browser-contract-outcome.md).

- **Review-held automatic policy evidence** — Tie new retained automatic-policy
  reviews to the current evaluation through a bounded v3 frame or explicit gap.
  Preserve saved routing holds and existing operator actions; completed automatic
  and retry rows do not receive this frame. Clear inherited verification status
  on new adopted automatic candidates. See the
  [outcome](docs/architecture/review-held-auto-policy-outcome.md).

- **Select result ownership** — Give new adopted selection candidates fresh
  proven policy context or explicit absence, and clear the earlier candidate's
  AI advisory. Preserve explicit destination choice, current review evidence,
  provider accounting and routing/learning safeguards. See the
  [outcome](docs/architecture/adopted-select-result-context-outcome.md).

- **Select-policy review evidence** — Keep new retained adopted selection
  reviews tied to their fresh policy evaluation, using a bounded v2 frame or an
  explicit evidence gap. Show the technical candidate and score while requiring
  an explicit destination choice; primary and bulk confirmation remain
  unavailable. Clear inherited verification status prospectively. See the
  [outcome](docs/architecture/adopted-select-policy-review-outcome.md).

- **Retained policy result ownership** — Give new adopted prompt-confirm
  candidates fresh minimal policy context or explicit absence, and clear the
  earlier candidate's AI advisory. Preserve top-level evidence, provider
  accounting and routing/learning safeguards; later saved-review validation
  remains independent. See the
  [outcome](docs/architecture/retained-adopted-result-context-outcome.md).

- **Retained policy review evidence** — Keep the adopted prompt-confirm
  evaluation's bounded review frame when verification is skipped or genuinely
  fails, using an explicit gap when proof is unavailable. Clear inherited
  verification status on the new candidate without changing provider accounting
  or routing/learning authority. See the
  [outcome](docs/architecture/retained-adopted-policy-review-outcome.md).

- **Adopted verification input** — Use the fresh evaluation's ranking,
  destination and overall confidence together. Missing or changed private proof
  retains the adopted policy candidate with an explicit review gap, preserving
  charged invocations and genuine provider observations. See the
  [outcome](docs/architecture/adopted-rag-verification-input-outcome.md).

- **Vue compiler diagnostics** — Adopt vue-tsc/language-core 3.3.14 with a
  native npm patch for slot defaults and parser-aware comment handling, preserving
  URL/regex/template inference and exact semantic diagnostics. Patch application
  runs automatically during installation. See the
  [outcome](docs/architecture/vue-compiler-backport-adoption-outcome.md).

- **Adopted RAG result ownership** — Return the actual adopted verification
  invocation context and its current advisory. Fresh confirmations clear the
  inherited advisory, with review fingerprints following the current result.
  See the [outcome](docs/architecture/adopted-rag-result-context-outcome.md).

- **Adopted RAG review evidence** — Use the accepted adopted verification
  recheck's row-bound policy frame for pending recommendations, scores and
  evidence. Record missing or changed proof as an explicit review gap. See the
  [outcome](docs/architecture/adopted-policy-review-frame-outcome.md).

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

- **Suggestion review** — The tuning dashboard opens the proposal from the
  list and shows supporting evidence to administrators in pages of up to 20
  references, with keyboard focus and status announcements preserved. See the
  [outcome](docs/architecture/suggestion-dashboard-evidence-outcome.md).

- **Saved suggestion evidence** — Administrators can read up to 20 linked
  feedback references at a time, with explicit continuation and unavailable
  entries for missing or mismatched feedback. See the
  [outcome](docs/architecture/saved-suggestion-evidence-read-outcome.md).

- **Manual analysis summaries** — Administrators can opt into a bounded
  response for up to 24 policies at a time, with explicit continuation and
  per-policy outcomes. See the
  [outcome](docs/architecture/manual-suggestion-analysis-result-outcome.md).

- **Manual analysis capacity tests** — Added isolated measurements of
  all-policy response size, memory, and overlap with queue and ingestion work.
  See the [outcome](docs/architecture/manual-suggestion-analysis-capacity-outcome.md).

- **Server HTTP dependency** — Pin standalone Undici to 8.13.1 and verify
  its supported redirect/cache composition and existing transport safeguards.
  See the [outcome](docs/architecture/server-undici-pr-596-outcome.md).

- **Server tooling** — Adopt Knip 6.46.1 and the aligned Testcontainers
  12.2.2 packages after strict install, dependency audit, tooling and isolated
  PostgreSQL checks. See the
  [outcome](docs/architecture/server-tooling-pr-597-outcome.md).

- **Published release verification** — Check signed v4 evidence, the exact
  tagged attempt and both registries' current version and `latest` digests
  together with a read-only command. See the
  [outcome](docs/architecture/published-release-verifier-outcome.md).

- **Release arm64 recovery gate** — Require the current release attempt's
  scheduled crash receipt for the exact published arm64 child before GitHub
  publication or `latest` promotion. See the
  [outcome](docs/architecture/published-arm64-recovery-gate-outcome.md).

- **Published arm64 recovery evidence** — Rehearse scheduled crash recovery
  against an immutable existing release's exact arm64 image on a native
  runner. See the [outcome](docs/architecture/published-arm64-recovery-outcome.md).

- **Native arm64 recovery CI** — Run the fresh-install scheduled crash drill
  on native arm64 after relevant pushes to `main`. Record the source, image,
  recovery and cleanup without involving publication. See the
  [outcome](docs/architecture/native-arm64-recovery-outcome.md).

- **Server runtime dependencies** — Qualify dotenv 18.0.10 from PR #592 and
  the publisher-patched express-rate-limit 8.7.5. Run dotenv CLI tests through
  the package's declared executable. See the
  [assessment](docs/architecture/server-runtime-pr-592-outcome.md).

- **Dependency tooling** — Align the client minimatch override with the
  reviewed 11.0.9 server version and qualify the Knip 6.46.0 update from
  PR #595. See the [client outcome](docs/architecture/client-minimatch-11-0-9-outcome.md)
  and [server outcome](docs/architecture/server-knip-pr-595-outcome.md).

- **Server tooling** — Adopt ESLint 10.15.0 and compatible minimatch 11.0.9
  from the PR #594 assessment. Check exact over-budget refusal and preserve
  existing positive matching coverage. See the
  [assessment](docs/architecture/server-eslint-pr-594-outcome.md).

- **OSV Scanner workflows** — Pin all four OSV calls to the reviewed 2.7.1
  revision from PR #590 and update the workflow contract check. See the
  [assessment](docs/architecture/osv-action-pr-590-outcome.md).

- **Root tooling** — Adopt Axios 1.21.1 and Markdownlint 0.42.2 with its
  declared RE2JS 2.9.1. Keep the follow-redirects pin and retire the temporary
  RE2JS override after qualifying the new graph. See the
  [outcome](docs/architecture/root-tooling-pr-591-outcome.md).

- **Server development tooling** — Pin Knip 6.45.1 and Supertest 7.3.2 from
  PR #593's reviewed graph. Verify enum analysis, actual retry HTTP behavior and
  a strict clean install. See the
  [outcome](docs/architecture/server-tooling-pr-593-outcome.md).

- **Classification identity groundwork** — Document the UUIDv7 preliminary
  assessment, verified catalog/reference inventory, compatibility gaps and
  recovery prerequisites. Keep the current identifier scheme; see the
  [assessment](docs/architecture/classification-uuidv7-readiness-outcome.md).

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

- **Production image toolchain** — Keep npm and npx in the builders.
  Assemble production from the matching Alpine base and pinned Node
  binary so the global npm bundle is absent from the shipped layers.
  See the [outcome](docs/architecture/production-image-package-manager-outcome.md).

- **OSV advisory triage** — Remove the expired server-only exception for the
  withdrawn deepmerge advisory. The pinned scan still checks all three
  lockfiles and rejects active advisories. See the
  [outcome](docs/architecture/osv-withdrawn-exception-outcome.md).

- **Node.js runtime** — Pin Node.js 24.22.3 and Alpine 3.24.4 across
  development, CI, the application image, and test fixtures. This includes
  November's Node.js security fixes and bundled Undici 7.30.2. Retain npm/npx
  12.2.2 and the existing system zlib and pgvector pins. See the
  [outcome](docs/architecture/node-24-22-3-runtime-outcome.md).

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
