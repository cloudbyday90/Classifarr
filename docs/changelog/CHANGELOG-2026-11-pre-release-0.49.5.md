# Changelog Archive: November 2026 v0.49.5 Development

> Preserved verbatim from revision `9634c39418755ac882d67d3212e017910e7a29ae` on
> 2026-11-24. Historical relative links are interpreted from the repository root.

[Root changelog](../../CHANGELOG.md) | [Release notes](../../RELEASE_NOTES.md)

## [Unreleased]

### Fixed

- **Source-pair worker budget reporting** — Report a verified learned-profile
  feature overflow as an evidence-budget failure after the worker receives
  its complete snapshot. See the
  [outcome](docs/architecture/source-pair-profile-budget-transport-outcome.md).

- **Source-pair budget classification** — Reserve evidence-budget failures
  for verified limits. Keep unrelated publication failures actionable through
  their existing stage and unavailable reason. See the
  [outcome](docs/architecture/source-pair-budget-classification-outcome.md).

- **Scheduled source-pair failure diagnostics** — Record the failed operation
  in the existing scheduler error, including the original stage if saving the
  failure also fails. See the
  [outcome](docs/architecture/source-pair-failure-stages-outcome.md).

- **Native question handoff ownership** — Verify that native review evidence
  belongs to the selected library after stored reads and before use. When
  the binding fails, keep the item in operator review without a proposed
  destination or new native question. See the
  [outcome](docs/architecture/native-question-handoff-binding-outcome.md).

- **Native question destination selection** — Validate the selected library
  before native lookups and question creation. A malformed selection keeps
  the item in operator review without a proposed destination. See the
  [outcome](docs/architecture/native-question-selected-library-outcome.md).

- **Pending review reads** — Require saved native destinations to match their
  resolve options. Isolate failed freshness lookups and show a read refresh
  when pending reviews are unavailable. See the
  [outcome](docs/architecture/pending-review-read-resilience-outcome.md).

- **Pending question freshness** — Keep the pending queue visible when a saved
  policy or library reference is invalid. Affected questions stay retryable,
  and cleanup queues fresh evaluation before an answer can replay. See the
  [outcome](docs/architecture/pending-question-context-id-outcome.md).

- **Pending answer destinations** — Validate exact positive INTEGER library
  IDs before lookup. The web client follows the same rule, and saved cleanup
  receipts keep their existing decoding. See the
  [outcome](docs/architecture/pending-answer-destination-id-outcome.md).

- **Pending question resolution** — Require a versioned answer at the shared
  transaction boundary and use exact BIGINT History IDs throughout. Saved
  replays keep their existing receipt checks. See the
  [outcome](docs/architecture/contract-only-pending-resolution-outcome.md).

- **Discord index-only clarification** — Old option buttons now reply privately
  with directions to the Command Center. New legacy confidence notices show
  review guidance without decision controls. See the
  [outcome](docs/architecture/discord-indexed-clarification-retirement-outcome.md).

- **Pending-question cleanup** — Preserve exact BIGINT History IDs from dry-run
  inventory through apply. Stale or unavailable policy context queues fresh
  evaluation before a saved answer can replay. See the
  [outcome](docs/architecture/pending-question-cleanup-history-ids-outcome.md).

- **Policy-library evidence collection** — Use History creation timestamps and
  preserve exact BIGINT IDs in evidence keys so neighboring rows remain
  distinct. See the
  [outcome](docs/architecture/policy-library-evidence-history-ids-outcome.md).

- **History IDs in web-search diagnostics** — Keep exact BIGINT links in
  route decisions and provider health events. Invalid IDs leave the event
  unlinked. See the [outcome](docs/architecture/web-search-history-ids-outcome.md).

- **History IDs in RAG stage logs** — Preserve exact BIGINT IDs in the
  standard log write and the older-schema fallback. Invalid IDs leave the
  diagnostic event unlinked. See the
  [outcome](docs/architecture/rag-stage-history-id-outcome.md).

- **History IDs in logs** — List and export filters match exact IDs through
  PostgreSQL's BIGINT limit. Large IDs stay exact in the log list, and
  malformed saved IDs no longer break it. See the
  [outcome](docs/architecture/log-history-bigint-outcome.md).

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

- **Description corpus profiler** — Exercise synthetic season mappings and
  measure concurrent reads of the production SELECT in disposable PostgreSQL.
  See the [study outcome](docs/architecture/description-corpus-season-load-outcome.md).

- **Suggestion reviews** — Apply and Reject send one request per confirmation.
  If the response is uncertain, the dashboard checks the saved status and
  offers a read-only Check status action. See the
  [outcome](docs/architecture/suggestion-review-acknowledgement-outcome.md).

- **Policy Tuning Suggestions** — The dashboard now shows one bounded page at
  a time, supports All statuses, and loads a proposal when Details opens. Page
  counts, keyboard navigation, and proposal review use the current results.
  See the [outcome](docs/architecture/suggestion-dashboard-pagination-outcome.md).

- **Suggestion list API** — Added an opt-in authenticated page with up to 20
  summaries, exact ID continuation, and an explicit all-status filter. Existing
  list callers can continue using their current contract. See the
  [API guide](docs/api/suggestions.md) and
  [outcome](docs/architecture/bounded-suggestion-list-outcome.md).

- **Legacy suggestion migration** — Documented at least 90 days of compatibility
  after the first public release with the replacements and migration notice.
  Legacy detail now uses `no-store` and returns an explicit set of shipped fields.
  See the [outcome](docs/architecture/legacy-suggestion-support-window-outcome.md).

- **Suggestion detail API** — Added a bounded proposal read for signed-in
  callers and a deprecation notice on legacy full detail. See the
  [migration guide](docs/api/suggestions.md) and
  [outcome](docs/architecture/legacy-suggestion-detail-migration-outcome.md).

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
