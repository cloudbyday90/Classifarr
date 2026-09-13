# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [August 2026 Release Details](docs/changelog/CHANGELOG-2026-08-releases.md) | [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Changed

- Load historical synopsis fallback only when inventory text is unavailable,
  reducing corpus sorting and database work while preserving library evidence,
  metadata precedence and fresh routing checks across live and background reads.
- Scope live library-description reads to the requested movie or TV type while
  preserving all same-media memberships, conflict checks and query exclusions.
  Avoid unrelated-media retrieval work and corpus-limit failures without changing
  global refresh jobs, learned scoring or routing safeguards.
- Reuse learned library profiles and description-match baselines when their exact
  training inputs remain current, refreshing automatically on use after changes.
  Bound in-memory reuse while preserving fresh inventory, vector expiry, query
  exclusion and routing checks without adding user settings or AI calls.
- Allow fresh AI, description and learned-library agreement to resolve ordinary
  soft-evidence reviews automatically, using a library-specific familiarity check
  and short-lived server routing authority without inflating policy scores.
  Preserve explicit restrictions, administrative confirmation, ambiguous matches
  and drift checks without adding another settings panel or AI call.
- Keep profile-inferred library traits as ranking evidence instead of admission
  requirements, allowing description retrieval to compare eligible destinations
  with incomplete metadata. Preserve explicit restrictions, media boundaries
  and zero scores without introducing new settings or routing authority.
- Learn per-library description-match baselines automatically during held-out
  evaluation, distinguishing familiar matches from merely the closest candidate.
  Keep calibration separate from test items, report sparse-library coverage,
  and compare review qualification without changing live routing or scores.
- Preserve frozen evaluation inputs when background metadata refreshes during
  preparation, while continuing to reject policy, library, vector and
  configuration drift and clearly reporting that the snapshot is not current.
- Add a paired, read-only learned-evidence review evaluation using full-pool
  description neighbors, contrastive library metadata and the existing AI
  proposal. Distinguish soft evidence reviews from hard policy conflicts and
  report potential review reduction without changing live routing or scores.
- Add a read-only fresh policy and AI evaluation across grouped movie/TV samples.
  Rebuild library observations and description evidence without held-out items,
  report placement agreement separately from accuracy, and preserve existing
  routing safeguards without adding settings or user acknowledgements.
- Align bounded AI comparison prompts, provider schemas and parsing around a
  minimal proposal-or-abstention JSON response. Remove generated confidence and
  clarification fields and the second-model repair step from this mode, while
  preserving policy thresholds, candidate boundaries and routing safeguards.
- Add a read-only comparison of metadata-only and description-preserving
  shortlists using production AI prompts, parsing and routing-eligibility checks.
  Reuse identical comparisons, report actual inference cost and review blockers,
  and distinguish retained policy cases from independent benchmark samples.
- Preserve the strongest usable library-description candidate when learned
  metadata would exclude it from AI comparison, while retaining the policy leader
  and three-candidate limit. Reuse same-snapshot retrieval and learned profiles,
  with local candidate-recall reporting and no additional user settings.
- Add a selective, library-name-independent inventory-conflict recheck to local
  evaluation, reusing learned metadata and description evidence with at most one
  extra comparison. Report gains, regressions and actual inference cost without
  adding user settings or changing live routing safeguards.
- Add a bounded full-cohort comparison of named and content-first library
  evidence, with paired per-library gains and regressions and canonical snapshot
  component fingerprints. Reuse local inference services without changing live
  routing or requiring additional user settings.
- Add bounded local investigation of classification disagreements, with matched
  agreeing controls, anonymous-library comparisons and contrastive description
  examples. Keep findings separate from verified labels and live routing, and
  require no new user declarations or settings panels.
- Add library-aware grouped evaluation folds and sequential cohort exclusions
  for 300 additional local benchmark items. Preserve small-library training
  coverage, isolate held-out description copies, and report per-library results
  without changing live routing, model settings or release versions.
- Make weak-evidence score discounts responsive to fresh, library-agnostic
  description comparisons and learned metadata. Preserve original policy scores,
  exclusions and thresholds; require existing local consensus checks for newly
  qualifying automatic routes. Explain retained scores within the existing UI.
- Allow fresh local AI and learned-library evidence to resolve threshold-qualified
  policy ambiguity automatically. Preserve manual-review vetoes and configured
  thresholds, revalidate before granting routing authority, restore expired
  decisions to review, and prevent automatic placements from becoming trusted
  history labels. No new settings or release.

- Use fresh learned library fit before the live three-candidate AI shortlist
  cutoff. Preserve hard eligibility, the policy leader, scores and routing rules;
  rerank alternatives automatically with safe fallback and no new UI controls.

- Feed organically learned library patterns into live AI candidate comparison,
  refreshed from current inventory without manual purpose declarations. Keep
  fit distinct from confidence, exclude the item's current and stored synopsis
  copies, and preserve routing constraints and provider privacy boundaries.

- Add library-agnostic profile learning to local candidate benchmarks, using
  contrastive inventory patterns without manual purpose declarations. Exclude
  held-out examples, downweight shared observations, and preserve live routing.

- Add a local metadata-aware candidate-selection benchmark using held-out genre
  and studio evidence alongside synopsis ranking, with coverage and shortlist
  comparisons. Preserve default selection and live routing pending evaluation.

- Add bounded local investigation of benchmark disagreements, including omitted
  destinations and blind content re-checks. Keep case evidence private and
  distinguish technical gaps from unresolved semantic differences without
  changing routing or creating labels from model agreement.

- Add a seeded 100-title, local-only description benchmark comparing 9, 30,
  and 100 retrieved examples. Report actual evidence counts, abstentions,
  latency, tokens, and observational agreement without changing live routing
  or treating existing library placements as verified correct answers.

- Feed maintained inventory descriptions into live AI candidate comparison,
  including competing libraries. Reuse cached vectors, report incomplete
  coverage, keep snippets local, and omit adjudication response excerpts from
  diagnostics without changing routing thresholds or adding user settings.

- Keep the inventory description cache current automatically after library sync
  and through periodic catch-up. Reuse unchanged descriptions, checkpoint small
  local-only batches, yield to queued work, and back off on failures without
  changing routing thresholds or adding user settings.

- Add inventory-wide description retrieval in shadow mode, with a separate
  versioned vector cache that reuses unchanged descriptions and resumes verified
  batches. Search current-library contents independently of historical embedding
  neighbors without changing live routing or adding user review screens.

- Add a local, label-free description comparison for the inventory sampler.
  It re-embeds sampled items and their fixed neighbors in bounded batches,
  verifies model consistency, and reports ranking changes without changing
  live routing or adding manual policy declarations.

- Add a read-only inventory semantic sampler that compares current-library
  neighbors without requiring manual policy declarations. It reuses stored
  embeddings, excludes the sampled cohort from retrieval, and reports coverage
  separately from correctness without provider calls or routing changes.

- Add one explicitly confirmed, fail-closed local command that completes a
  private retrieval evaluation after independent reviewer labels are ready. It
  chains consensus, the admitted scorer, paired artifact construction, and an
  aggregate report without adding browser state, learning, policy changes, or
  routing authority.

- Automatically prepare two distinct, content-free independent-review
  worksheets when a protected held-out study packet is captured, and reduce the
  Command Center semantic-evaluation card to its current status, one plain
  language explanation, and a details link. The workflow remains offline and
  cannot learn, change policy, or route media.

- Add a bounded private RAG retrieval-representation scorer that creates
  paired label-included and label-free evidence from the same held-out cohort.
  It requires verified self-hosted structured output, persists only a
  categorical study submission, and cannot route media, change policy, or
  learn from library contents.

- Replace the repetitive profile-derived purpose-declaration worklist with a
  compact, automatically refreshed proposal summary. Compatible drafts can be
  applied with one revision-pinned, all-or-nothing administrator action;
  mixed and unverified provenance remains in the individual exception queue.
  The flow neither calls AI/RAG nor changes routing.

### Performance
- Bound direct backend coverage runs to the existing two-worker, 512 MB idle
  recycle settings so local coverage verification cannot create an unbounded
  Jest worker fan-out.
- Add passive event-loop-delay observations that persist only a fixed p99
  bucket, aggregate count, and freshness timestamp; no raw performance value,
  process, operational, media, library, provider, configuration, policy, AI,
  decision, error, or routing data is retained.
- Bound backend CI coverage workers to the established 512 MB idle-memory
  recycle limit, preventing a long-running coverage process from accumulating
  unbounded worker memory.
- Prevent same-process scheduled work from overlapping by applying node-cron
  non-overlap protection to every core scheduler registration and guarding
  recurring, delayed-start, and direct invocations by task name.
- Add passive, coalesced scheduler execution receipts with fixed task-class,
  outcome, and duration buckets. They retain no task name, schedule, error,
  query, identifier, media, library, provider, configuration, policy, AI,
  decision, or routing data.
- Add an administrator-only, parameter-free database-health summary that reads
  fixed PostgreSQL aggregates and returns only bucketed I/O and table-health
  observations with reset-aware freshness. It cannot expose operational
  dimensions or trigger maintenance, policy, AI, or routing work.
- Add passive, coalesced queue-startup performance receipts with fixed duration
  and count buckets. They retain no query, media, library, provider,
  configuration, policy, AI, or routing data.
- Bound metadata-refill scans by stable item IDs before loading large item payloads, so ineligible pages progress automatically without repeated full-inventory scans.
- Split queue-worker health aggregation into active and recent-completion reads backed by focused indexes.

### Fixed

- Allow retrieval evaluations to retry after a provider failure by verifying
  an unchanged reviewer reference set, while preserving conflicting outputs.
  Correct cross-platform completion tests and reject equivalent input/output
  paths before study work begins.

- Preserve the intentional `not_applicable` exact-contrastive state in
  held-out semantic studies as a neutral offline-evaluation abstention instead
  of rejecting an otherwise valid redacted study bundle.

- Update the root documentation-lint dependency override to a non-vulnerable
  `smol-toml` release, removing the high-severity malformed-TOML
  denial-of-service advisory from repository and CI tooling.
- Configure the workspace ESLint language server to use the system Node runtime
  directly, avoiding Node DEP0190's unsafe shell-argument launch warning in
  current VS Code installations.
- Reconcile the policy-authoring component inventory with the native-purpose
  bootstrap surface so the repository inventory audit covers every component.

- Let a weak manual policy decision use one bounded, advisory AI/RAG
  comparison when the policy engine already owns two or three eligible
  destinations. Hard manual-review safeguards and insufficient candidate sets
  remain provider-free; every recommendation still requires operator
  confirmation before routing.

- When strict candidate-bound verification abstains (or the selected provider
  cannot satisfy its strict structured-output contract), make one bounded,
  advisory comparison among the same two or three policy-eligible libraries.
  The comparison cannot route media and still requires operator confirmation.

- Prevent a candidate-scoped semantic comparison from retrieving the incoming
  item's own same-media historical identity as current-library corroboration.
  The versioned v3 retrieval protocol now compares only other eligible
  library items and remains advisory; it cannot change policy or route media.

- Corrected source-identity replay-observation retention so its inclusive UTC
  date range contains exactly the documented 120 days.
- Automatically retain one bounded, aggregate-only daily source-identity
  evidence replay receipt after application readiness. Its database selection
  uses a short read-only repeatable-read transaction before external evidence
  calls, has no startup replay, and cannot select an identity, modify source
  metadata, invoke AI, or route media.
- Bound the source-identity external-evidence replay to a deterministic,
  daily rotating active-library window. The read-only aggregate study now
  reports its selected scope and shares the repair worklist's ESM selector,
  avoiding unbounded observation scans and permanent low-ID selection.
- Add a bounded, provider-neutral source repair worklist for current,
  complete-capture identity conflicts. It exposes only local repair context
  and a source-match-then-resync action; it cannot choose an ID, modify source
  metadata, persist an identity, invoke AI, or route media.
- Add a bounded, read-only replay of current conflicting source identities.
  It reads one source item per selected observation through a provider-neutral
  ESM adapter and reports aggregate evidence outcomes only; it cannot correct
  source metadata, persist an identity, invoke AI, or route media.
- Record repeated source-identity conflicts as one bounded, post-capture sync
  summary while retaining the existing strict identity guard and controlled
  unresolved-observation view.
- Expose the strict TMDb external-ID evidence decision through a
  source-independent ESM service, while preserving the queue compatibility
  export; it still rejects contradictory and incomplete evidence.
- Route every core delayed scheduler startup task through the cancellable
  scheduler lifecycle and stop local event-loop sampling before queue drain on
  controlled shutdown.
- Remove the Node 24 DEP0190 source from the cross-platform workspace test
  launcher by using explicit, allowlisted `cmd.exe` arguments with Node shell
  mode disabled on Windows.
- Restore backend dependency-declaration validation by removing an unused
  compatibility re-export, and make the source-inventory scanner report a
  staged deletion as a coverage gap instead of failing its scan.

### Added

- **Paired retrieval-representation artifacts** — Added an ESM-only,
  aggregate-only artifact producer for a historical-classification-label
  ablation. It pins both conditions to one held-out cohort, rejects raw source
  material and confounded non-history changes, and cannot invoke AI/RAG,
  learn, change policy, retry, or route media.

- **Low-touch purpose proposal workflow design** — Documented a revision-pinned,
  all-or-nothing grouped review model to replace repeated profile-derived
  purpose-declaration actions. It keeps profile evidence as a draft, refreshes
  readiness automatically, and reserves manual work for genuine exceptions.

- **Retrieval-representation study** — Added an ESM-only, aggregate-only
  comparison of media description, declared library purpose, and nearest-item
  history against the same independently labelled held-out cohort. Its strict
  fingerprint-bound artifact rejects raw context and partial variants; the
  local workflow cannot invoke AI/RAG, learn, change policy, retry, or route
  media.

- **Private reviewer aggregate results** — Added an ESM-only local handoff
  that combines the packet-bound redacted evaluation bundle and a completed
  independent reference set into the existing content-free semantic-study
  report. It writes only on valid independent evidence and cannot invoke
  AI/RAG, learn, change policy, retry, or route media.

- **Private reviewer evidence continuity** — Authorised private reviewer-packet
  creation now automatically writes a fingerprint-bound, content-free sibling
  semantic-evaluation bundle. The packet is withheld if that companion cannot
  be written, allowing later aggregate measurement without exposing private
  review context or granting AI/RAG, learning, policy, or routing authority.

- **Packet-bound reference-set completion** — A new ESM-only local study command
  now composes two finalized, content-free reviewer submissions into a
  packet-bound reference set without a manual identifier. It writes only after
  complete consensus, requests adjudication on disagreement, and cannot call
  AI/RAG, learn, change policy, or route media.

- **Bound reviewer submissions** — Private held-out review packets can now
  produce separate incomplete, content-free local worksheets and packet-bound
  finalized submissions. Expired, altered, incomplete, or malformed worksheets
  fail closed before existing independent consensus; no AI/RAG output, policy
  change, learning, or routing authority is added.

- **Controlled private reviewer packets** — Added an explicit, read-only local
  ESM workflow that creates a short-lived, content-minimized held-out review
  packet only after the aggregate capture handoff is current. Packets stay
  outside HTTP APIs under exclusive `.tmp` files, omit semantic/RAG output and
  current placement, and feed only the existing fingerprint-bound independent
  review path; they cannot learn, change policy, or route media.

- **Semantic evaluation results summary** — Added a content-free, offline ESM
  report for a fixed semantic snapshot and independent human reference set. It
  reports aggregate and stratum coverage, disagreement, precision/recall,
  abstention coverage, reviewer consensus, and 95% Wilson uncertainty; it
  explicitly does not claim calibration for a scoreless categorical signal and
  cannot call AI/RAG, learn, change policy, or route media.

- **Automatic private-capture handoff** — The existing passive, aggregate
  eligibility audit now recognizes a complete balanced cohort frame and
  exposes a compact, auto-refreshing readiness state. It neither selects nor
  retains media, calls AI/RAG, creates labels, changes policy, or routes
  content; the protected capture workflow remains separately controlled.

- **Prospective independent-review consensus** — Added a private ESM-only
  composer that turns two separately supplied, opaque, fingerprint-bound
  reviewer submissions into the existing offline reference-set format, while
  requiring a third bounded adjudication for every disagreement. It accepts no
  media/library or reviewer data, writes only a fresh `.tmp` artifact, and
  cannot invoke AI/RAG, learn, alter policy, or route media.

- **Command Center semantic-evaluation readiness** — Added an
  administrator-only, auto-refreshing, no-store summary of the existing
  protected semantic-evaluation prerequisite. It reports only the next
  aggregate evidence stage, links to detailed review, and cannot collect
  labels, invoke AI/RAG, tune learning, change policy, or route media.

- **Outcome-backed purpose quality** — Purpose health now includes a compact,
  no-store aggregate that compares repeated, policy-authorized manual outcomes
  with an already declared, distinct genre purpose. It exposes no identities or
  terms, fails closed on unavailable evidence, and only prioritizes review; it
  cannot change policy, AI/RAG, learning, or routing.

- **Command Center purpose health** — Added an administrator-only,
  auto-refreshing aggregate summary of declared library purpose and structural
  exceptions. It is bounded, no-store, identity-free, and links to the
  existing detailed review; it cannot invoke AI/RAG, learn, or change routing.

- Add a compact, accessible library-purpose bootstrap for profile-derived
  identity terms. Current contents are explicitly shown as suggestions, while
  the existing revision-checked server writer records only operator-selected
  purpose terms; advanced policy rules remain available separately.

- **Outcome-backed purpose drafts** — Native purpose maintenance now loads one
  compact, read-only suggestion from repeated, operator-originated genre
  outcomes. The suggestion is optional, excludes profile and self-reinforcing
  policy-pattern evidence, and still requires the existing revision-checked
  coverage review and purpose-change workflow; it cannot invoke AI, route
  media, or write a policy on its own.

- **Held-out study gate reconciliation** — Documented the current passive
  readiness and private-audit observations, including their intentionally
  separate authority boundaries. Existing automation remains library- and
  configuration-agnostic and cannot synthesize lifecycle or declared-purpose
  evidence, capture a cohort, invoke AI, or route media.

- **Current-intent evidence recovery** — A native purpose declaration and its
  matching durable lifecycle receipt can now restore passive evidence
  eligibility even when the policy has an older profile-derived receipt. The
  aggregate-only observation remains library-agnostic and cannot capture a
  cohort, label media, invoke AI, select semantic evidence, or route media.

- **Truthful bounded declaration review** — The purpose-declaration worklist
  now distinguishes a complete no-review result from an incomplete report
  window. It never claims that omitted active policies need no declaration;
  the read-only, redacted review still cannot change policy, select a cohort,
  invoke AI, or route media.

- **Server-generated purpose declaration worklist** — The existing
  administrator purpose-coverage review now groups matching profile-derived
  stored-purpose drafts without returning rule values. Each item opens the
  existing revision-checked declaration form; the worklist cannot mutate
  policy, select a cohort, invoke AI, or route media.

- **Governed native-purpose declaration provenance** — Native purpose
  maintenance now distinguishes declared, profile-derived, mixed, and
  unverified stored-purpose provenance using a fixed, private v2 contract.
  Profile-derived terms remain a review draft until an administrator records a
  revision-checked native declaration; the existing passive lifecycle
  re-audit observes that durable change without selecting a cohort, invoking
  AI, or routing media.

- **Measured held-out study readiness** — The administrator-only aggregate
  readiness contract now identifies one fingerprint-current, fixed next
  prerequisite from the existing lifecycle audit without exposing its receipt
  or operational data. It cannot create declared purpose, capture a cohort,
  collect labels, invoke AI, change policy, or route media.

- **Non-pending held-out decision partition** — The private eligibility audit
  now explains each non-pending policy-only comparison through a fixed,
  aggregate evaluator stage. It reconciles to the existing comparison count
  without exposing media, policy, library, provider, or configuration data and
  cannot create evidence, select a cohort, collect labels, invoke AI, change
  policy, or route media.

- **Declared-purpose provenance gate** — Policy-purpose evidence now accepts
  only server-recorded native declarations, keeps inferred profile observations
  descriptive, and fails closed for unknown sources. Versioned aggregate
  screens expose bounded unverified counts without creating policy evidence,
  selecting a cohort, collecting labels, invoking AI, changing policy, or
  routing media.

- **Held-out eligibility explanation partitions** — The private policy-only
  audit now reports fixed, mutually exclusive aggregate partitions for policy
  source provenance and candidate comparison availability. A zero-ready result
  is explainable without exposing library, policy, configuration, provider, or
  media identity; it cannot capture a cohort, collect labels, invoke AI,
  change policy, or route media.

- **Restore-safe held-out lifecycle state** — Every merge and replace backup
  restore now atomically clears the aggregate-only lifecycle source checkpoint
  and audit receipt. The passive re-audit therefore observes restored durable
  evidence without exporting stale cursors, creating study evidence, running
  AI, changing policy, or routing media.

- **Held-out source-transition checkpoint** — The passive held-out re-audit
  now stores changed aggregate source states independently of audit receipts.
  A temporary absence of lifecycle or declared-purpose evidence therefore
  cannot hide a later return to the same eligible source. Deferred states do
  not scan candidates, create a cohort, label media, invoke AI, change policy,
  or route media.

- **Prompt passive held-out re-audit** — The aggregate-only lifecycle gate now
  rechecks every five minutes instead of fifteen, matching the bounded visible
  readiness refresh. It still requires a source fingerprint change before the
  private audit can run, preserves the advisory lock and failure budget, and
  cannot create evidence, collect labels, invoke AI, change policy, or route
  media.

- **Automatic held-out study status refresh** — The reconciliation page now
  refreshes only the existing count-only study-readiness report every five
  visible-page minutes and after a visibility return. It retains no new data,
  cannot start study work or routing, and ignores stale reads.

- **Passive held-out study readiness** — Administrators and future automation
  can read a rate-limited, no-store, aggregate-only report explaining whether
  normal lifecycle receipts or complete declared-purpose evidence still defer
  the private eligibility audit. It exposes no library, policy, configuration,
  or media identity and cannot create evidence, capture a cohort, label media,
  invoke AI, change policy, or route media. Authorization precedes the
  per-IP limiter to preserve administrator availability.

- **Purpose-evidence re-audit preflight** — Receipt-triggered held-out
  eligibility re-audit now waits for fixed aggregate evidence that at least one
  current policy retains declared purpose and complete normal lifecycle
  provenance. This prevents a futile population scan while keeping the process
  library- and configuration-agnostic; it cannot capture a cohort, label media,
  invoke AI, alter policy, or route media.

- **Receipt-triggered held-out re-audit** — The private eligibility audit now
  rechecks automatically after aggregate verified normal policy lifecycle
  evidence changes. A durable count-only cursor, three-attempt failure budget,
  and advisory lock keep the work bounded across instances; it cannot capture a
  cohort, collect labels, invoke AI, alter policy, or route media.

- **Held-out source provenance terminology** — The private semantic-study audit
  now versions its receipt and distinguishes observed, profile-only, retained,
  and absent policy-purpose evidence. The aggregate remains library- and
  configuration-agnostic and cannot select a cohort, collect labels, invoke AI,
  change policy, or route media.

- **Passive verified rebuild lifecycle evidence** — The administrator-only
  policy-purpose review now counts an existing terminal library-rebuild
  replacement only when its execution gate, immutable verification run, event,
  and intent-revision bindings agree. The aggregate remains library- and
  configuration-agnostic; it exposes no configuration and cannot select a
  cohort, label media, invoke AI, or route media.

- **Library-agnostic policy evidence inventory** — The administrator-only
  policy-purpose review now reports fixed aggregate availability of current
  authoritative native intents, retained declared purpose, and matching normal
  lifecycle evidence without returning library identity or configuration. A
  stale receipt cannot qualify a newer unreceipted intent; semantic selection,
  labels, AI, and routing remain disabled.

- **Policy-linked lifecycle source readiness** — Held-out semantic-study source
  availability now requires current retained declared purpose and complete
  normal lifecycle evidence for the same active policy. The administrator-only
  aggregate distinguishes qualified, missing, and review-required evidence
  without exposing policy values or enabling cohort selection, labels, AI, or
  routing.

- **Policy-purpose lifecycle provenance receipt** — The administrator-only
  purpose review now measures whether durable normal policy establishment and
  change receipts retain declared specialized purpose, remain profile-only, or
  cannot be verified. The bounded aggregate exposes no rule values or receipt
  details and cannot select a cohort, collect labels, alter policy, or route
  media.

- **Cross-library common trait evidence** — Libraries now reports bounded,
  conflict-excluded trait values that recur across selected same-type libraries.
  Administrator-only aggregate purpose provenance provides context without
  exposing policy values or affecting policy, cohort selection, or routing.

- **Held-out policy-source readiness** — The administrator-only policy-purpose
  review now reports full-population aggregate availability of retained declared
  purpose for the private eligibility audit. It excludes inferred
  library-profile evidence and cannot select a cohort, collect labels, or
  affect routing.

- **Automatic library trait prevalence** — Libraries now compares bounded
  observed trait frequencies with same-type selected peers, names local and
  peer denominators, and excludes current source-identity conflicts before any
  trait analysis. The read-only view cannot change policy or routing.

- **Policy-purpose provenance review** — The administrator-only purpose
  coverage report now distinguishes profile-only, retained, and absent
  specialized purpose with fixed aggregate counts, without exposing policy or
  profile values.

- **Held-out policy source screen** — Corrected the study boundary to retain
  operator-declared native purpose rules and added a private aggregate receipt
  that explains inferred-profile exclusions without exposing policy or media
  data.

- **Held-out policy eligibility audit** — Added a private, read-only,
  configuration-bound canonical-population audit that reports only aggregate
  broad-policy decision availability before a semantic study cohort can be
  captured. It excludes source conflicts, detects source truncation and
  configuration drift, and cannot change policy, route media, or collect
  labels.

- **Prospective held-out semantic cohorts** — Added a private, read-only,
  broad-policy-first cohort capture that excludes source conflicts, freezes
  balanced candidate comparisons before semantic retrieval, and emits only
  opaque study artifacts and aggregate eligibility receipts. Independent human
  labels, readiness, and frozen-study preflight remain required; routing stays
  disabled.

- **Unresolved source visibility** — Automatically retain bounded source conflict
  observations and library membership, with capture coverage and recent examples
  in Libraries, without assigning IDs or adding operator steps.

- **Original candidate comparison** — Show how captured classifier proposals compare
  with recorded libraries in the recent UTC window, retaining missing evidence
  and unknown placements without implying accuracy or adding operator steps.

- **Original observation types** — Automatically distinguish imported membership,
  manual actions, classifier workflows and unknown origins within library UTC
  coverage, with complete totals and no additional operator input.

- **UTC capture by recorded library** — Automatically show recent provenance
  coverage and excluded recording times for bounded library groups, with complete
  global totals and accessible keyboard scrolling.

- **UTC provenance coverage** — Show a bounded daily view of known recording
  times, with unknown legacy times explicitly excluded and today marked partial.
  Shared accessible tables keep UTC and stored-calendar views distinct.

- **Reliable history recording times** — Automatically preserve an immutable
  recording instant for new history and show known/unknown coverage. Legacy
  timestamps stay unknown, with existing calendar reports preserved.

- **Daily provenance coverage** — Automatically show a bounded daily history
  window, including partial today, with captured/missing provenance, explicit
  date exclusions and database-calendar labels.

- **Original and recorded method attribution** — Automatically show how original
  classification methods and candidate sources relate to current history methods,
  with bounded library groups and explicit missing provenance.

- **Original candidate provenance** — Automatically retain bounded candidate
  proposals and their original method before routing, with visible missing-reason
  counts and explicit evidence coverage versioning.

- **Passive history lifecycle coverage** — Show completed, pending-decision,
  retry-pending and other observations by library and method, with reconciled
  totals and accessible labels. No operator input is required.

- **Suggestion evidence provenance** — Automatically capture complete analysis
  cohorts and revalidate policy, destination and feedback before application.
  Stale suggestions are preserved as superseded history during normal analysis;
  threshold and weight suggestions now retain their supporting feedback.

- **Retained request and feedback references** — Extended the bounded cleanup
  assessment to preserve request and feedback records with immutable library
  snapshots, transactional checkpoints and guards against late writes or
  reattachment. Added populated index measurements and recovery tests.

- **Inventory dependency planning and cleanup** — Added automatic foreign-key
  discovery and a disposable cleanup assessment that shares one mutation budget
  across items, dependents and retained history updates. Item reservations and
  schema checks protect interrupted cleanup from moves and uncounted cascades.

- **Bounded inventory cleanup prototype** — Added resumable pruning and parent
  removal assessments with complete-manifest checks, bounded transactions and
  database admission guards. Local tests verify concurrent writes, moves and
  interruption recovery; broader dependency validation still gates production use.

- **Inventory writer compatibility** — Added automatic source and cascade-writer
  discovery, read-only deployed catalog checks, and an isolated sync assessment
  that preserves identity and metadata retention through ordered transactions.
  Production adoption remains gated on bulk, cascade and restore compatibility.

- **Per-library repair prototype** — Added bounded row-count pages and ordered
  library locks to preserve single-visit coverage for sparse small libraries.
  Local assessments verify concurrent writes, automatic invalidation and recovery;
  production adoption remains gated on writer compatibility.

- **Repair lifecycle assessment** — Added read-only inventory range measurements
  and reproducible contention, reconnect and storage checks. The isolated repair
  prototype now reclaims idle and empty cache entries automatically and avoids
  the reader/truncate lock cycle.

- **Bounded page-repair prototype** — Added a local change-journal evaluation
  that reuses unaffected coverage summaries, repairs changed or expired ranges,
  and withholds complete counts when continuity or capacity cannot be established.
  Production adoption remains gated on contention and lifecycle evidence.

- **Scan recovery benchmark** — Added a reproducible local comparison of capped
  extra visits and frozen coverage projections, with explicit completion,
  consistency, storage and work-limit results. Production recovery remains gated
  on measured evidence.

- **Automatic scan diagnostics** — Libraries now explains retained complete
  measurements, repeated scan resets and active libraries without recorded
  visits. Prioritized summaries distinguish missing evidence from failure and
  require no additional collection steps.

- **Incremental large-library coverage** — Automatic sampling now resumes bounded
  pages across visits and publishes complete coverage for stable large libraries.
  Changed inventory or observation timestamps restart scans automatically, with
  partial progress and measurement times clearly shown.

- **Fair automatic library coverage** — Background sampling now visits active
  libraries in turn, including those beyond the first 12. Each library has its
  own capacity limit, so oversized inventories no longer hide smaller libraries'
  history. Accessible, paginated summaries show actual visit times and preserve
  earlier hourly history separately.

- **Per-library coverage trends** — Automatic hourly history now shows metadata
  progress by library, with explicit inventory changes, gaps and unchanged
  coverage intervals. Bounded samples avoid misleading comparisons when the
  population changes, including replacements with the same row count.

- **Automatic acquisition history** — Libraries now shows captured and unavailable
  metadata attempts alongside hourly coverage samples, with bounded seven-day
  history, explicit populations and no manual capture steps.

- **Automatic library observation health** — Libraries now explains metadata
  coverage, freshness, missing identities and retry backoff using attributable
  observations and existing clocks. Queue activity stays separate from capture
  success, with bounded, authenticated reads and no per-item setup.

- **Cross-library inventory comparison** — Libraries automatically shows shared
  movie and TV identities and common traits, with explicit coverage and overlap
  denominators. Duplicate placements count once, conflicting traits stay unknown,
  and bounded reads disclose limits without adding provider calls or routing.

- **Automatic inventory metadata observations** — Identified items now gain
  attributable TMDb keywords and original language through background enrichment,
  with cached reuse and bounded retries. Source tags stay separate, missing
  language stays unknown, and changed identities invalidate previous traits.

- **Library metadata coverage** — Library profiles and new history snapshots
  show known and missing trait counts with clear percentage denominators.
  Existing profiles refresh automatically after upgrading.

- **Administrator media-ID review** — Libraries now offers a filtered review
  queue for unresolved identities, with TMDb previews and explicit confirmation.
  Expiring previews, current account and source checks, and atomic audit receipts
  protect ID updates. This workflow does not trigger classification or routing.

- **Held-out semantic study capture** — A private offline runner freezes the
  complete cohort before preparing policy candidates and excludes every cohort
  identity from RAG comparisons. Versioned provenance binds the cohort and
  configuration to existing study gates; legacy inventory captures cannot pass
  held-out readiness. Study execution remains advisory with no routing or
  learning authority.

- **Private real-inventory study runner** — A local stdin-only ESM command can
  now execute one 24–32-case candidate-scoped semantic study without writing
  raw media metadata to the checkout. It verifies the same media-type and
  metadata prerequisites as the live retriever, accepts no file arguments,
  emits only the existing redacted snapshot document, and cannot change AI,
  policy, learning, retries, or routing.

- **Bounded real-inventory semantic-study capture** — Classifarr can now
  prepare one 24–32-case, candidate-scoped RAG study cohort sequentially in
  memory and immediately reduce it to the existing redacted snapshot format.
  Invalid requests make no retrieval call, per-case failures become study
  abstentions, and the output excludes media/library content, provider/model
  data, prompts, vectors, normal persistence, browser exposure, learning, and
  routing authority.

- **Real current-inventory semantic-study snapshots** — The offline AI/RAG
  study path can now evaluate a redacted leading-versus-strongest-alternative
  snapshot from Classifarr's real, candidate-scoped current-library retrieval,
  rather than synthetic vectors alone. The snapshot has strict bindings and
  excludes titles, descriptions, library/media IDs, prompts, vectors, provider
  data, and model output; it cannot change a policy, invoke AI/RAG, learn,
  retry, or route media.

- **Calmer pending-review evidence** — The review card now leads with a
  plain-language recommendation and reveals source checks, current-library
  comparison, and score/safeguard mechanics in separate, accessible
  disclosures. Existing-library wording now describes it as a useful clue, not
  proof that a new item belongs there.

- **Frozen candidate semantic-study preflight** — A new offline, aggregate-only
  CLI binds a complete independently labelled study bundle to one opaque
  candidate-scoped AI/RAG proposal cohort and a maximum 31-day review window.
  It detects document/configuration drift before a human study and cannot call
  AI/RAG, retain data, learn, modify policy, retry, or route media.

- **Complete redacted semantic-study bundles** — The offline semantic readiness
  command can now safely evaluate a complete 24–32 case, fingerprint-bound
  fixture/snapshot/manifest/independent-label bundle from project-contained
  JSON files. It rejects partial or escaping inputs, emits aggregate-only
  evidence, and remains unable to call AI/RAG, retain study data, learn, edit
  policy, retry, or route media.

- **Independent-label evaluation oracle** — Offline semantic readiness now
  measures the separately bound, independently reviewed reference decisions
  rather than requiring them to repeat a synthetic fixture baseline. Exact
  fixture binding, content minimization, aggregate-only results, and the
  existing no-routing/no-learning authority boundary remain in force.

- **Outcome-calibrated semantic evaluation** — Candidate Retrieval Monitoring
  now automatically compares later operator alignment for outcome-calibrated
  versus otherwise comparable semantic current-library matches within the
  latest opaque AI/RAG cohort. It keeps no-match and legacy records separate,
  retains only fixed aggregate state, and cannot tune RAG, change policy, learn,
  retry, or route media.

- **Authenticated outcome-weighted semantic retrieval** — Candidate-scoped RAG
  now gives a small, capped advisory boost only to already-relevant current
  library matches backed by an append-only authenticated final-outcome receipt.
  It does not change policy scores, thresholds, policy editing, or routing.

- **Automatic exact-item outcome learning** — An authenticated operator's
  successful runtime confirmation or destination change now records eligible
  stable item-to-library memory automatically through the existing locked,
  audited, idempotent learning command. Learning never rewrites a policy and a
  rejected or unavailable learning attempt cannot reverse routing.

- **Bound semantic reference-set artifacts** — Offline semantic readiness now
  requires a separate, SHA-256-bound, content-free reference-label artifact
  declaring independent double-blind review before it can reach human-review
  readiness. Synthetic or absent labels remain an explicit non-ready state;
  malformed or content-bearing input fails closed. The local read-only CLI and
  artifact cannot call AI/RAG, persist study data, change policy, learn, retry,
  or route media.

- **Frozen semantic-adjudication cohorts** — Candidate Retrieval Monitoring now
  automatically separates bounded AI and current-library semantic-retrieval
  comparisons by an opaque server-generated proposal fingerprint, then
  evaluates only the latest unchanged cohort against later validated operator
  destinations. The compact auto-refreshing disclosure retains no item text,
  library, model, prompt, response, embedding, or cohort identifier and cannot
  change AI, policy, RAG, learning, retries, or routing.

- **Semantic-context outcome evaluation** — Candidate Retrieval Monitoring now
  automatically distinguishes bounded AI comparisons where current-library
  semantic context was available, unavailable, or not retained by legacy
  records. It shows aggregate proposal, abstention, rejection, and subsequent
  operator-alignment outcomes behind progressive disclosure, without retaining
  titles, descriptions, prompts, responses, embeddings, libraries, models, or
  providers and without affecting AI, policy, RAG, learning, retries, or
  routing.

- **Automatic score-band calibration review** — Security Settings now turns
  the redacted future-corpus aggregates into a compact, continuously refreshed
  calibration report. It uses fixed 95% Wilson bounds to identify only
  human-review prompts for close-candidate boundaries or higher-margin
  evidence; it cannot alter policy thresholds, AI, RAG, learning, retries, or
  routing.

- **Automatic future-corpus evaluation** — Security Settings now shows one
  compact, auto-refreshing aggregate status for the redacted future operator
  corpus. It measures per-score-band baseline coverage for a later
  human-approved AI/RAG evaluation without exposing rows or affecting policy,
  AI, RAG, learning, retries, or routing.

- **Automatic redacted reviewed-corpus capture** — Eligible authenticated
  operator confirmations and corrections now create a future-only,
  time-limited evaluation row with only fixed outcome/evidence categories from
  a safe 30-day default. The optional acknowledgement selects a different
  bounded retention period and enables the separate historical-snapshot
  workflow; it is not required for capture or normal Classifarr operation.
  The data is automatically expired, audited, and has no policy, AI, RAG,
  learning, or routing authority.

- Added an offline-only semantic counter-evidence readiness gate that measures
  corpus coverage, precision, recall, abstention, and false positives before
  RAG could be considered for a future broad-policy review path. The gate is
  pinned to committed redacted artifacts and cannot change policy or routing.

- **Candidate-scoped current-library semantic retrieval** — Advisory AI
  comparison can now use bounded similarity to descriptions of current items
  in only the policy-eligible libraries, reusing stable current-inventory
  embeddings without changing policy scoring or operator routing authority.
- **Pull-request synthetic policy-candidate replay** — A separate
  least-privilege CI job now runs the fixed, aggregate-only candidate replay
  against each pull request without installing dependencies, reading live
  data, invoking AI/RAG, using secrets, retaining artifacts, or routing media.
- **Progressive pending-review summary** — Pending classification review now
  puts the recommended destination, review reason, and required operator action
  first, with deterministic evidence, score mechanics, inventory comparison,
  and advisory AI verification behind one accessible disclosure; it does not
  change policy, AI, RAG, or routing authority.

### Fixed

- **Policy evidence maintenance inventories** — Restored complete ownership for
  the read-only purpose-evidence and lifecycle-provenance components so the
  policy presentation audit tracks every current component and test. Regenerated
  the fresh-install schema snapshot so it tracks every current migration.

- **Profile-derived purpose maintenance** — The administrator native-purpose
  editor can now prepare profile-derived stored purpose as a clean typed draft
  without passing profile provenance through the browser or blocking an
  explicit declared-purpose change.

- **Backend test reliability** — Full and unit server tests now use bounded
  Jest workers with memory recycling, while database integration stays serial,
  preventing the former single-worker heap exhaustion.

- **Source-conflict authority** — Fresh unresolved source conflicts now suppress
  automatic existing-media evidence, awaiting-decision reconciliation and
  metadata/TMDb enrichment until valid source evidence clears the conflict or
  the existing retention period expires.

- **Inventory TMDb diagnostics** — Distinguish missing provider items from network,
  throttling and access failures, preserving safe correlation details and existing
  observation data without exposing credentials or changing retry behavior.

- **Embedding integrity** — Reject malformed vectors before success accounting or
  storage, and preserve stored embeddings when provider dimensions do not match.
- **Media sync diagnostics** — Explain rejected source identities with bounded,
  privacy-limited conflict details while retaining protection against ambiguous IDs.

- Bound text and image embedding responses during transfer, including compressed
  failures and warmup requests, while preserving cancellation and rejecting
  oversized responses before parsing or immediate retry.

- Buffered HTTP requests and embedding retry waits now honor caller cancellation,
  stopping cancelled work promptly while retaining request deadlines and response
  limits. Cancellation no longer enters transient retry handling.

- Stop oversized OMDb responses and image downloads while reading them, before
  buffering or parsing the complete body. Preserve interrupted JSON transfers as
  errors so unavailable evidence cannot appear as an empty response.

- OMDb lookups and health checks now distinguish missing titles from credential,
  quota and malformed-response failures, preserving reliable enrichment evidence
  and accurate service health without additional operator steps.

- **Atomic OMDb quota admission** — Reserve local quota before each lookup attempt,
  including retries and failures, so concurrent requests cannot overrun the limit.
  Reset accounting together at the UTC day boundary and preserve usage during
  configuration changes without adding operator steps.

- **Reliable metadata provider configuration** — Use consistent provider selection,
  prevent duplicate active settings on concurrent saves and repeated restores,
  preserve OMDb usage, and apply TMDb credential rotations immediately. Equivalent
  legacy duplicates consolidate automatically while retaining stored credentials.

- **Faster inventory summaries** — Reduce repeated metadata processing in library
  health, overlap and automatic sampling reads while preserving freshness,
  source validation, unknown states and existing capacity limits.

- **Local runtime reliability** — Restore Pino log delivery to multiple targets,
  exclude private runtime data from Docker build contexts, and isolate transport
  and router tests from queued mocks and unrelated page compilation.
- **Original observation capture** — Record trusted origin metadata for new
  source-library and manual queue history, replacing caller-supplied candidates.

- **Candidate evidence loss** — Preserve policy and signal context through AI
  retry/fallback paths, keep empty ranking positions from promoting later
  candidates, and retain original provenance after manual resolution.

- **Policy comparison accuracy** — Rate changes now use percentage points, and
  missing or invalid values remain N/A instead of becoming zero. Comparisons use
  a dedicated accessible table with explicit units and keyboard scrolling.

- **Custom TLS transport** — Fixed self-signed-server requests failing because
  the custom HTTP dispatcher used an incompatible fetch interface. Per-request
  connections are now disposed after use, with certificate verification enabled
  unless explicitly disabled.

- **Statistics reporting scope** — Replaced inactive date buttons with clear
  descriptions of retained feedback and recent activity windows. Policy details
  now label the 30-day breakdown and rolling seven-day periods accurately, and
  dashboard cards fit narrow screens while retaining automatic loading. Detail
  comparison text and evidence descriptions remain readable on the light modal.

- **Evidence coverage visibility** — Policy Statistics now separates imported
  library observations, recorded candidates, linked feedback and evaluated outcomes.
  The read-only breakdown loads automatically, preserves unknown states and reports
  when rows are capped. Leaving the dashboard now removes its visibility listener.

- **Feedback retry protection** — Standalone feedback now uses stored classification
  evidence and records each source event once. Matching retries return the saved
  result; conflicting submissions and duplicate prompt feedback are rejected.
  Source receipts preserve retry protection through history or feedback cleanup.

- **Feedback accuracy and coverage** — Accuracy now uses evaluated candidate
  evidence and reports unknown results as unavailable. Observations remain intact,
  evaluated coverage appears in policy statistics, and live metrics reflect current
  library eligibility. Older suggestion cohorts require regeneration; prompt
  timestamps are normalized to UTC for consistent feedback windows.

- **Prompt feedback persistence** — Pattern choices now use current database
  fields and commit with feedback, learning statistics and prompt completion.
  Counts reflect distinct saved patterns; invalid actions and repeated responses
  cannot leave partial or duplicate feedback. Prompt reads use persisted candidate
  metadata, and native-intent policies retain their legacy-write protection.

- **Feedback pattern confidence** — Repeated metadata values count once per
  feedback record, preventing inflated pattern support and confidence. Old
  suggestion cohorts require fresh analysis, and applying regenerated pattern
  suggestions now uses the correct database fields.

- **Suggestion review lifecycle** — Apply and reject now allow one terminal transition
  from pending, preserving review history during retries and concurrent requests.
  Application metadata and policy changes commit together; stale dashboard actions
  refresh the list after a conflict.

- **Duplicate policy suggestions** — Equivalent pending suggestions now share a
  structural configuration comparison and serialized storage per policy. Concurrent
  analysis runs avoid duplicate inserts, and failed batches roll back together.

- **Feedback suggestion eligibility** — Excluded detached, inactive and mismatched
  library references from policy suggestion evidence. Pattern, weight and threshold
  analysis now share the requested feedback window and count only eligible samples.

- **Feedback confidence eligibility** — Detached, unresolved and inactive library
  destinations no longer count as automatic-learning rejections. Confidence reads
  preserve historical feedback, validate candidate IDs and require positive evidence
  before learning can apply.

- **Bounded coverage reads** — Sampling uses indexed library ranges and item
  lookups to avoid reading unrelated inventory while measuring a page.

- **Sampling initialization** — Fresh installations and upgrades initialize the
  automatic library sampling cursor without resetting existing progress.

- **Observation validity in summaries** — Missing language fields remain distinct
  from explicitly unknown language, preventing malformed captures from inflating
  health, profile and overlap coverage. Affected profiles refresh automatically.

- **Automatic observation repair** — Background enrichment now repairs malformed
  or mismatched metadata observations after cooldown, including records with
  recent fetch timestamps. Bounded inventory passes reach later repairs, preserve
  valid empty captures and prevent overlapping refill work in the same process.

- **Stale enrichment cannot overwrite changed source items** — OMDb ratings,
  metadata observations, and source-library history now verify captured source
  fields when writing. Concurrent source changes produce a skipped result,
  while unrelated bookkeeping and valid enrichment continue normally.

- **Resolved inventory IDs survive source omissions** — Background and confirmed
  media identities now retain their provenance across matching source syncs.
  Changed or conflicting source identities invalidate stale enrichment, and
  concurrent updates or malformed provider IDs cannot silently replace them.

- **Automatic inventory profile refresh** — Synced inventory and observed
  metadata changes now refresh active-library profiles through the existing
  background worker, including libraries without policies. Unchanged syncs
  avoid extra refreshes, empty libraries lose stale profiles, and failed work
  can recover automatically without another inventory change.

- **Consistent library observations** — Stored profiles and AI statistics now
  use the same item-based prevalence calculation. Duplicate traits count once
  per item, missing data stays unknown, and observed absence no longer produces
  profile exclusion penalties. Refreshes clear empty profiles and protect
  newer observations from delayed writes.

- **Media-ID confirmation recovery** — A lost save response now recovers the
  original administrator's audit receipt without repeating confirmation.
  Recovery survives a page reload in the same tab, explains unknown outcomes,
  and offers an explicit receipt check. Confirmation retries are disabled and
  historical receipt reads remain bounded and read-only.

- **External-ID ambiguity requires review** — Queue enrichment now requires
  unique typed TVDB/IMDb results and agreement between supplied identifiers.
  Conflicting, malformed, duplicate, or unavailable evidence retains an unknown
  TMDb ID and a review reason; title search cannot override that uncertainty.

- **Conservative TMDb title resolution** — Queue enrichment now requires a
  unique exact title/year match from a complete bounded response before
  assigning an ID. Weak, ambiguous, incomplete, or unavailable matches retain
  an unknown ID and a review reason in item metadata. This adds no media routing.

- **Server quality gate** — Removed an unused corpus-capture version export
  reported by the dependency and export check, with no runtime behavior change.

- **Source identity through queue enrichment** — Refill now uses the item's
  movie/TV type, and provider lookups reject missing or conflicting types.
  IMDb resolution selects the matching media category and supports normalized
  OMDb IDs. Conditional ID/rating/metadata writes prevent stale enrichment from
  crossing types; skipped work no longer reports successful enrichment.

- **Typed source-library history** — Duplicate checks and inserts now share an
  explicit movie/TV identity, including the no-TMDb title fallback. Missing or
  conflicting media types and malformed IDs skip history creation instead of
  producing guessed movie records. Captured inputs keep lookup and insertion
  consistent across asynchronous checks.

- **History scoring respects media identity** — Movie and TV records sharing
  a TMDb ID no longer contribute to each other's history scores or consume
  each other's result limit. Missing or invalid identities contribute no
  history evidence, and valid matches retain the existing confidence cap.

- **Production query-string parser advisory** — Raised the server's ESM
  dependency override and lockfile resolution for `qs` to 6.16.0, eliminating
  the published moderate denial-of-service advisories in the previous 6.15.2
  resolution.

- **Container heap-cap detection** — Ignore unbounded cgroup memory sentinels
  rather than passing an invalid, impractically large heap cap to Node.js at
  startup.
- **Schema snapshot CI parity** — Refreshed the authoritative PostgreSQL 18
  schema snapshot so the containerized drift gate recognizes the current
  `classification_history.method` constraint.
- **Server CI dependency-declaration gate** — Removed three stale, unconsumed
  ESM exports from correction-review contracts so the Knip CI gate can run to
  completion without changing runtime behavior, policy, AI/RAG, or routing.
- **Offline synthetic policy-candidate replay** — A fixed, opaque fixture
  corpus now exercises the shared deterministic calibration, ranking,
  weak-evidence, ambiguity, and score-band projection before a proposed scope
  or calibration code change is accepted; it is CLI-only, aggregate-only, and
  cannot read live data, invoke AI/RAG, mutate policy, persist evidence, or
  route media.
- **Broad declared-policy review recommendation** — Correction Analytics now
  turns two comparable, review-ready 28-day aggregate correction periods for
  contextual declared-policy evidence into one human-only policy-scope review
  recommendation, with progressive disclosure of aggregate uncertainty and no
  policy, AI, RAG, learning, or routing authority.
- **Operator-first evidence review** — Pending classification review now leads
  with a plain-language decision summary and keeps bounded source evidence,
  exact-library cross-checks, and advisory AI candidate comparisons inside one
  labelled disclosure; it does not change AI, RAG, policy, or routing
  authority.
- **Progressive capability-telemetry details** — AI Settings now groups safe
  failure categories, completed-window coverage, and warning recency behind
  one automatically refreshed disclosure while keeping the current health
  state and protected Error Logs handoff visible.

- **Policy-scoped evidence digest** — Policy maintenance now opens a
  read-only, administrator-only digest of declared intent, stored-profile
  provenance, and fixed-window authorized evidence without exposing raw media,
  rule values, profile payloads, or model output.

- **Route-safety policy-maintenance handoff** — AI Settings now offers a
  read-only link to policy review only when a policy-owned route-safety gate is
  stable and representative across two completed aggregate windows.

- **Route-safety readiness** — AI Settings now automatically summarizes the three most frequent deterministic primary route safeguards from a fixed completed UTC-day aggregate, keeping provider capability separate from policy/routing follow-up.
- **Capability telemetry health** — AI Settings now automatically summarizes
  the administrator-only 24-hour aggregate of successful capability-metric
  streams and bounded persistence warnings, without exposing raw logs or
  affecting AI, policy, RAG, classification, or routing.
- **Capability telemetry health trend** — AI Settings now automatically
  compares three fixed completed UTC-day capability-telemetry aggregates,
  distinguishing persistent, newly observed, cleared, recurring, and no-data
  warning states without exposing raw diagnostics or affecting AI, policy,
  RAG, classification, or routing.
- **Capability telemetry Error Logs handoff** — Active, validated telemetry
  persistence-warning trends now offer one user-initiated route to a
  reason-code-filtered Error Logs view, without carrying provider, model,
  media, policy, raw diagnostic, or routing detail.
- **Capability telemetry safe failure categories** — AI Settings now
  automatically shows a compact administrator-only 24-hour aggregate of fixed
  metric-write and database-condition categories while persistence warnings are
  active, without exposing raw SQLSTATEs, diagnostics, provider, model, media,
  policy, or routing detail.
- **Capability telemetry category coverage** — AI Settings now automatically
  compares three completed UTC-day aggregates to show whether retained
  persistence warnings carry the fixed safe category contract, without
  exposing raw diagnostics or affecting AI, policy, RAG, classification, or
  routing.
- **Capability telemetry warning recency** — AI Settings now automatically
  distinguishes retained warnings in the latest completed UTC day, a newly
  cleared completed day, and older-only context through fixed aggregate bands,
  without exposing raw timestamps or affecting AI, policy, RAG,
  classification, retries, or routing.
- **Offline fixed-band calibration** — A versioned synthetic default-band corpus now verifies manual, selection, confirmation, and automatic-candidate boundaries before the calibration review packet can be prepared; it remains offline and human-gated.
- **Bounded candidate adjudication** — Ambiguous policy selections can now receive an AI advisory comparison of two or three server-selected eligible destinations, using observed library-profile and relevant historical evidence while retaining operator confirmation.
- **Current-library candidate retrieval** — Candidate adjudication now uses a bounded read-only lookup over the synchronized current library inventory, recognizing exact identifiers, title/year, and plain-text catalog matches without changing routing authority.
- **Current-library retrieval telemetry** — Statistics now reports aggregate lookup availability, fixed latency bands, catalog-match presence, and bounded AI-proposal/operator agreement without collecting media, provider, prompt, response, or destination detail.
- **Candidate-set outcome attribution** — Candidate Retrieval Statistics now distinguishes bounded candidate selections from an operator's validated outside-candidate choice, making policy candidate-set gaps measurable without retaining destination identity.
- **Candidate-set policy-review readiness** — Candidate Retrieval Statistics now marks when a representative attributed-decision cohort supports reviewing deterministic candidate eligibility, scope, and ranking evidence; it remains advisory and cannot alter policy or routing.
- **Deterministic policy-score explanation** — Pending classification review can now explain the contributing evidence categories, normalized weighting, corroboration adjustment, and evidence-safety calibration behind its displayed policy score.
- **Policy confirmation evidence readiness** — Candidate Retrieval Statistics now aggregates the fixed deterministic evidence categories behind recent confirmation-band candidates, advising declared-scope maintenance only after a representative cohort and without changing AI or routing behavior.
- **Policy-scope review handoff** — A declared-scope evidence review can now lead administrators to the existing read-only purpose-coverage review, with no policy, library, item, provider, or routing identity carried in the navigation.
- **Pending score explanation comparison** — Operators can compare two or three already-visible deterministic policy-score explanations locally, including bounded evidence contributions and calibration mechanics.
- **Policy confirmation-evidence uncertainty** — Aggregate policy-maintenance readiness now distinguishes a conclusively weak declared scope from a borderline sample using a fixed 95% Wilson interval.
- **Candidate evidence cards** — Pending policy confirmation now separates item identity, declared policy, contextual library-profile evidence, similar-item retrieval, and confirmed outcomes, flagging contextual-only support and deterministic conflicts without changing routing.
- **Library evidence profile** — Pending review can now compare up to three policy-eligible libraries by policy-score margin and fixed declared-intent, observed-content, metadata-identity, RAG, and confirmed-outcome evidence states.
- **Contrastive inventory evidence** — Pending policy confirmation and selection now compare a retained exact TMDb identity across up to three policy-ranked current libraries, showing fixed supporting, counter, shared, or neutral evidence without changing routing.
- **Contrastive outcome monitoring** — Statistics now aggregates the fixed cross-library identity-check status with later server-validated operator candidate-set outcomes, making counter-evidence observations measurable without retaining media or destination identity.
- **Offline candidate-evidence evaluation** — A bounded, versioned fixture corpus now compares deterministic candidate scope, exact contrastive evidence, and a proposed semantic-retrieval signal using review precision, recall, abstention, coverage, and agreement metrics before any semantic evidence can reach an operator workflow.
- **Pinned semantic snapshot evaluation** — A fixed-path, offline-only adapter now evaluates a redacted synthetic embedding snapshot across an expanded eight-case reviewed corpus and reports status-only semantic precision, recall, abstention, agreement, and provenance.
- **Policy correction analytics** — Statistics now associates fixed original policy-score margin bands and evidence states with later server-validated operator outcomes, so administrators can identify a policy-evidence area for review without changing routing.
- **Correction-analytics uncertainty readiness** — Statistics now applies a fixed minimum cohort and 95% Wilson intervals to aggregate changed-selection rates, distinguishing insufficient, inconclusive, review-worthy, and low-signal score/evidence buckets without auto-tuning policy, AI, RAG, or routing.
- **Correction-signal temporal stability** — Statistics now compares adjacent completed UTC-day aggregate windows and distinguishes persistent, emerging, diminishing, low-signal, and insufficient-data correction patterns before any policy-maintenance review; it remains advisory and cannot tune or route media.
- **Correction cohort-composition context** — Statistics now compares fixed score-margin and evidence-state mixes across adjacent completed windows, flagging material aggregate cohort shifts before a recurring correction signal is interpreted as policy behavior; it remains advisory and cannot tune or route media.
- **Long-horizon correction trend** — Statistics now compares two server-defined adjacent 28-day aggregate periods, requiring representative readiness and comparable cohort composition before showing a sustained correction-review or low-signal pattern; it remains advisory and cannot tune or route media.
- **Representative correction-review handoff** — A sustained, comparable 28-day correction signal now exposes one clear navigation link to the existing Needs Attention workflow, without selecting a record or triggering a policy, AI, RAG, learning, retry, or routing action.
- **Historical review-corpus preflight** — Sustained correction signals now clearly distinguish current decision review from a future historical corpus, with a fixed sample-frame proposal and explicit authorization, redaction, retention, and operator-audit safeguards.
- **Historic review-corpus control plane** — Administrators can now acknowledge the fixed future corpus purpose, safeguards, and retention limit through an automatically loaded Security Settings card, with revision protection and bounded recent audit history; historic records remain unavailable.
- **Redacted policy evaluation snapshot** — Administrators can now create a server-selected, expiry-bound representative correction sample that exposes only fixed margin, operator-outcome, and evidence-state categories for offline policy evaluation.
- **Offline correction evaluation report** — Security Settings now automatically summarizes the active redacted snapshot by completed period, score margin, and evidence state with fixed outcome counts and 95% Wilson intervals; refreshes are non-auditing and it remains descriptive without policy, AI, RAG, or routing authority.
- **Policy-change outcome follow-up** — Administrators can now start one receipt-bound, content-free before/after observation after an approved native policy change; Security Settings refreshes its fixed aggregate 28-day follow-up automatically and presents descriptive rates with 95% Wilson intervals.
- **Reviewed policy-change decision record** — After a bounded follow-up completes, administrators can automatically load, explicitly confirm, and record or revise one expiry-bound aggregate conclusion with a fixed rationale. It has no policy, routing, AI, RAG, learning, retry, or classification authority.
- **Policy-change review activity** — Security Settings now automatically summarizes recorded and materially revised reviewed conclusions across up to three completed fixed 30-day periods, retaining only coarse conclusion counts with no individual decision, policy, media, actor, outcome, provider, prompt, response, or RAG history.
- **Policy-change review-process consistency** — Security Settings now derives a fixed, aggregate-only consistency state from three completed review-activity periods, requiring a minimum cohort and remaining descriptive with no policy, AI/RAG, learning, or routing authority.
- **Policy-change calibration readiness** — Security Settings now retains only the bounded aggregate window needed to identify six complete, sufficiently active review periods and automatically states when a human threshold review may begin; it cannot calculate or apply a threshold, policy, AI/RAG, or routing change.
- **Offline policy-change calibration protocol** — Security Settings now automatically describes the fixed aggregate-and-synthetic human-review procedure only when bounded aggregate readiness and review-process consistency are both satisfied; it cannot export a snapshot, generate a proposal, change a threshold or policy, invoke AI/RAG, or route media.
- **Offline calibration evidence pack** — A checked-in synthetic status corpus now guards the fixed policy-change calibration protocol and produces a versioned, content-free human approval-packet format only after the suite passes; it remains offline and cannot approve or change policy, invoke AI/RAG, or route media.
- **Offline route-safety calibration** — A checked-in synthetic matrix now verifies that a high policy candidate remains behind provider recovery, evidence, AI-advisory, provenance, confirmation, fallback, low-confidence, and clarification safeguards before the human-only calibration packet is available.

### Changed

- **Client development tooling** — Adopt PR #528's Vitest 5, coverage, PostCSS,
  globals and Node declaration updates locally with full client test validation.

- **Client routing maintenance** — Adopt Vue Router 5.3.1 locally from PR #527,
  with auth/setup navigation and browser regression checks.

- **Server development tooling** — Adopt PR #530's Jest, Knip, globals and Node
  declaration updates locally, with ESM, database and container validation.

- **Pinned QEMU action maintenance** — Adopt the verified v4.3.0 action revision
  locally from PR #526, retaining the existing release trigger and full SHA pin.

- **Server runtime dependencies** — Locally applied and tested the
  express-rate-limit, Undici and Zod updates from PR #529, including a transport
  compatibility fix identified during validation.

- **Policy score-band resolution** — The ranker now uses a pure shared resolver for its existing ordered score actions, making the default 40/60/85 boundaries directly testable without changing route-safety authority.
- **AI readiness controller** — AI Settings now leads with one server-owned, self-updating readiness state; visible-page refreshes are pausable, while runtime evidence, history, compatibility checks, receipts, and preflight observations are lazy diagnostics.
- **AI evidence minimization** — Candidate adjudication sends bounded profile distributions and limited historical titles only to a syntactically trusted local Ollama endpoint; all other providers and hosts receive aggregate availability, size-band, and match facts.
- **Catalog evidence minimization** — Current-library lookup sends at most three title/year matches per candidate only to a syntactically trusted local Ollama endpoint; other providers receive aggregate retrieval facts only.
- **Comparison coverage precision** — Destination competition now distinguishes complete active-competitor coverage from a genuinely capped comparison, including the exact-cap case, without exposing an active-policy total or identity.
- **Shared-eligibility explanation** — Destination competition now explains possible overlap through allow-listed, anonymous declared-purpose category aggregates without exposing policy terms or changing routing authority.
- **Destination competition preview** — Existing-policy maintenance can now compare a proposed draft against bounded, anonymous active same-media-type competitors and report aggregate deterministic eligibility overlap before saving.
- **Policy cohort preview** — Existing-policy maintenance can now compare a saved policy and unsaved draft against a bounded recent deterministic cohort, returning aggregate native-eligibility deltas before the draft is saved.
- **Policy overlap precision** — Current-policy coverage and draft preflight now flag a shared `require_any` purpose alternative even when a sibling term is unique, preventing broad fallback matches from being presented as safely distinct.
- **Offline evaluation coverage** — The semantic evidence corpus now covers declared-scope conflict, semantic overreach, clear series, and low-margin uncertainty cases rather than only the original four examples.
- **Dependency maintenance** — Applied and locally tested the Axios 1.20.0 update from open PR #521 without merging the pull request or creating a release.
- **Dependency maintenance** — Applied the server-tooling updates from open PR #525 locally for validation without merging the pull request or creating a release.
- **Dependency maintenance** — Applied and locally tested the Morgan 1.12.0 runtime update from open PR #524 without merging the pull request or creating a release.
- **Dependency maintenance** — Applied the client-tooling updates from open PR #523 locally for validation without merging the pull request or creating a release.
- **Dependency maintenance** — Applied the client runtime updates from open PR #522 locally for validation without merging the pull request or creating a release.

### Fixed

- **Error Logs authorization** — Detailed Error Logs, exports, and log
  mutations now require administrator authorization in addition to
  authentication and rate limiting.

- **AI capability metric persistence** — Successful AI work no longer emits a
  misleading telemetry warning when recording a model-digest mismatch counter;
  the PostgreSQL upsert now preserves its `BIGINT` parameter type.
- **Capability telemetry failure-log minimization** — Metric-write persistence
  warnings now retain only a fixed stage and SQLSTATE-class category, rather
  than provider/model values, raw database exceptions, or stack traces.

- **Candidate-adjudication retry persistence** — The classification-history
  method contract now admits completed bounded candidate-adjudication results,
  preventing valid local retry work from repeatedly failing while it is saved.

- **Classification evidence retention** — Post-classification routing now
  patches only its owned metadata fields, preserving the policy, RAG,
  cross-library, and AI-advisory evidence persisted by the current decision.
- **Policy precision** — Broad genres inferred from a library profile no
  longer qualify as specialized destination identity evidence.
- **Migration constraint safety** — Migration preflight now rejects effective PostgreSQL constraint-name collisions before startup; the new review-history tables use concise identifiers and repair earlier local pre-release names.

### Security

- **Bounded policy-maintenance evidence** — The route-safety handoff is
  administrator-only, rate-limited, no-store, parameter-free, aggregate-only,
  and incapable of changing policy, routing, learning, retries, AI, or RAG.
- **Route-safety readiness boundary** — The administrator-only, no-store, rate-limited aggregate uses a fixed completed window and gate allow-list, exposes no media, library, policy, provider, prompt, response, or actor data, and cannot call AI/RAG or change policy, learning, retry, or routing behavior.
- **Capability telemetry health boundary** — The administrator-only, no-store,
  rate-limited status signal has no caller-selected dimensions, returns only
  fixed counts/timestamps and a server-owned status vocabulary, excludes raw
  logs/provider/model/media data, and cannot write telemetry or influence AI,
  policy, RAG, classification, or routing.
- **Capability telemetry trend boundary** — The completed-window trend is
  administrator-only, no-store, rate-limited, parameter-free, and
  aggregate-only. It exposes no provider/model/media/log dimension or raw
  diagnostic data, rejects incoherent contracts in the browser, and cannot
  call AI, write telemetry, retry, or influence policy, RAG, classification,
  or routing.
- **Offline fixed-band evidence boundary** — The fixed-path corpus pins the versioned default baseline, rejects unknown or authority-bearing data, reports only aggregate results, and cannot read live configuration, invoke AI/RAG, alter policy, or route media.
- **Offline route-safety evidence boundary** — The fixed matrix permits only bounded synthetic gate controls, exercises the existing server-owned safety resolver, returns aggregate-only results, and has no API, storage, provider, AI/RAG, policy, retry, approval, or routing authority.
- **AI readiness refresh boundary** — Automatic AI Settings refreshes call only the existing administrator-authorized saved-capability read at a visible-page bound; they cannot probe providers, discover models, write settings, route media, or expose raw scheduled-preflight errors.
- **Offline calibration evidence boundary** — The fixed-path synthetic corpus accepts only allow-listed aggregate status combinations and fixed procedures, returns aggregate pass/fail data only, rejects authority-bearing or live fields, and has no API, storage, provider, AI/RAG, policy, approval, or routing authority.
- **Adjudication authority boundary** — The server validates every proposal against the original policy-owned candidate set, discards model reasoning and confidence, persists only allow-listed status facts, and always keeps routing behind the operator decision.
- **Ollama endpoint trust boundary** — Detailed candidate profiles and historical titles now require a syntax-validated trusted-local endpoint; an arbitrary DNS name or public address receives aggregate-only evidence.
- **Current-library retrieval boundary** — Candidate-owned library IDs, media type, and result caps are fixed server-side; descriptions are never returned from the read-only query, unexpected library rows are discarded, and retrieval failure remains advisory and unavailable.
- **Retrieved-text containment** — Catalog title evidence is normalized to a bounded single line and retrieval labels are allow-listed before prompt construction, limiting prompt-shaped media metadata.
- **Retrieval telemetry boundary** — Candidate lookup observations use a server-built, allow-listed projection; the authenticated aggregate report omits media, library, provider, prompt, response, actor, and exact-duration data and cannot alter AI, policy, learning, or routing.
- **Candidate-set attribution boundary** — The server computes membership only from the validated runtime-question contract and persists a fixed status with no candidate, destination, operator, media, or provider identity.
- **Candidate-set readiness boundary** — Policy-review readiness uses only existing content-free aggregate counters and fixed thresholds; it returns no identities, introduces no new retention path, and has no AI, policy, learning, retry, or routing authority.
- **Policy-score explanation boundary** — Score explanations expose only allow-listed source and calibration IDs with bounded numeric mechanics; they exclude policy terms, media, identities, provider/model data, prompts, raw output, diagnostics, and routing controls.
- **Policy confirmation evidence boundary** — Confirmation-evidence readiness uses a static, parameterized aggregate query and fixed source/status vocabulary; it returns no history object, media, policy, library, actor, provider, model, prompt, response, or routing control and creates no new retention path.
- **Policy confirmation-evidence uncertainty boundary** — The confidence gate accepts only bounded aggregate counts and emits fixed method metadata and percentage bounds; it cannot expose identity, create retention, invoke AI, edit policy, retry work, or route media.
- **Policy-scope handoff boundary** — The evidence-review link accepts and recognizes one fixed focus token only; it cannot select a policy, expose telemetry identity, invoke AI, or alter policy, learning, or routing.
- **Score-comparison data boundary** — Pending-score comparisons are capped in browser memory, revalidate only allow-listed numeric mechanics, and expose no new identity, API, telemetry, AI, policy, retry, learning, or routing path.
- **Candidate-evidence card boundary** — Pending-review evidence cards use only fixed source/state identifiers, reject unknown client input, expose no raw metadata or retrieval text, and cannot invoke AI, alter scores, learn, or route media.
- **Library-evidence profile boundary** — Candidate comparisons are built server-side from the existing policy-owned candidate set, cap at three libraries, and expose only existing library names, rounded scores, score margins, and allow-listed evidence states; descriptions, catalog titles, policy terms, IDs, prompts, provider data, raw model output, and routing controls remain unavailable.
- **Contrastive inventory boundary** — Cross-library identity checks use a server-owned same-media candidate set and one parameterized exact-ID read; rows, identities, catalog text, and provider data are discarded before a fixed advisory status is persisted or displayed.
- **Contrastive outcome telemetry boundary** — The server derives both attribution axes from persisted fixed evidence and the validated runtime-question contract; static aggregate queries and an allow-listed client view retain no item, library, candidate, destination, actor, provider, prompt, response, or routing control.
- **Offline semantic-evaluation boundary** — The fixed local corpus accepts only allow-listed status identifiers, rejects raw runtime/provider fields, exposes no fixture names in reports, accepts no arguments or network input, and has no authority to invoke AI, learn, edit policy, retry, route, or affect an operator workflow.
- **Pinned snapshot boundary** — Semantic evaluation validates versioned local artifacts, SHA-256 manifest pins, and one-to-one fixture/snapshot IDs before scoring; it returns only allow-listed status IDs and never exposes vectors, similarities, retrieval text, or a live RAG path.
- **Correction-analytics boundary** — Versioned server snapshots, validated operator-outcome attribution, a static aggregate query, and strict client projections retain and expose only fixed score-margin, evidence-state, and selection-status dimensions; no media, policy, library, candidate, destination, actor, provider, prompt, response, raw RAG text, or routing control is added.
- **Correction-readiness uncertainty boundary** — Fixed 95% Wilson review signals accept only bounded aggregate counts, preserve the static read-only query and existing authentication boundary, and return no identity, configuration, AI, policy, RAG, learning, retry, or routing authority.
- **Correction temporal-stability boundary** — Adjacent-window monitoring reuses the authenticated static aggregate query with server-built dates and strict client revalidation; it returns only fixed aggregate dimensions and derived statuses, with no event history, identity, configuration, AI, RAG, policy, learning, retry, or routing authority.
- **Correction cohort-composition boundary** — The fixed TVD screen reuses existing count-only aggregates, validates every derived client value, and returns no item, destination, policy, library, provider, prompt, response, RAG text, configuration, or routing control; it cannot invoke AI, tune policy, learn, retry, or route media.
- **Long-horizon correction boundary** — The 28-day trend uses only server-built completed periods and existing aggregate reads, exposes a compact allow-listed cohort result, and is re-derived by the client; it adds no identity, configuration, AI, RAG, policy, learning, retry, or routing authority.
- **Representative review-handoff boundary** — The conditional handoff recognizes only the strict sustained-review status and navigates to one fixed existing Command Center anchor; it sends no request or filter and carries no media, policy, library, candidate, destination, actor, provider, prompt, RAG, configuration, or analytics identity.
- **Historical review-corpus boundary** — The new v6 preflight derives only fixed content-free readiness from the sustained aggregate state, rejects historical-record access in both server and client contracts, and adds no query, storage, export, selection, AI, RAG, policy, learning, retry, or routing authority.
- **Historic review-corpus control boundary** — The administrator-only control plane accepts only an exact acknowledgement contract, keeps response DTOs content-free and no-store, serializes writes with a transaction lock, and records only minimal append-only audit metadata; it cannot select, expose, or authorize historic records.
- **Redacted review-projection boundary** — The administrator-only snapshot uses a parameterized server-side allow-list, persists no history identity or content, exposes no-store fixed categories only, audits creation/view/expiry minimally, and deletes expired snapshots through a locked scheduled transaction; it cannot invoke AI/RAG, alter policy, or route media.
- **Policy-change outcome boundary** — The administrator-only outcome protocol accepts no policy, receipt, range, or hypothesis selector; it binds one short-lived server-generated aggregate baseline to a recent native receipt, uses fixed windows and no-store reads, rate-limits the explicit start flow, automatically deletes expired observations, and exposes no policy, media, library, provider, prompt, response, RAG, or routing authority.
- **Review-history data boundary** — The administrator-only summary uses fixed completed UTC periods, static aggregate reads, response allow-lists, no-store, rate limits, and bounded retention. It stores no individual activity, outcome, policy, media, library, actor, rationale, provider, prompt, response, or RAG data, and cannot trigger policy, AI, routing, learning, retry, or classification work.
- **Offline calibration-protocol boundary** — The existing administrator-only, no-store summary now exposes only a fail-closed fixed human procedure from already-redacted aggregate status; it creates no threshold, proposal, export, write, provider call, AI/RAG access, policy change, or routing authority.
- **Axios runtime hardening** — Updated Axios to 1.20.0, incorporating upstream hardened handling of runtime option objects relevant to prototype-pollution-style configuration reads.

- **Comparison-cap privacy boundary** — Coverage detection uses one server-only sentinel to identify omitted competitors; the sentinel, total active-policy count, configurations, identities, and routing authority remain unavailable to clients.
- **Explanation privacy boundary** — Shared-eligibility explanations expose only allow-listed category labels and anonymous configuration counts after a bounded shared result; they never return rule values, competitor identities, item outcomes, AI state, or routing control.
- **Competition-preview privacy and resource boundary** — The administrator-only competition preview derives competitors and fixed caps server-side, uses batched native-intent reads and parameterized SQL, returns no competitor or media identity, and cannot call AI, persist, learn, or route media.
- **Cohort-preview privacy and authority boundary** — The administrator-only simulation accepts only a validated draft, derives scope and fixed bounds server-side, uses a parameterized read-only query, returns aggregate counts only, and cannot call AI, persist a draft, learn, or route media.
- **Policy-review data boundary** — Disjunctive-overlap guidance remains administrator-only and aggregate-only: it returns counts and fixed guidance without exposing policy terms, draft contents, media data, AI output, or routing controls.

## [v0.48.4-beta] - 2026-08-29

### Added

- **Saved-model matrix coverage** — The Ollama compatibility matrix now explicitly states whether the saved primary model was among eligible locally installed models, with safe next-step guidance that does not expose provider configuration or change strict-verification authority.
- **Ollama compatibility matrix** — AI Settings can now run a bounded, serial, media-free strict-output check across up to six server-discovered local Ollama model builds, returning only advisory allow-listed results for the current response.
- **Ollama verification test history** — AI Settings now presents a fixed 30-day aggregate of saved Ollama verification-test outcomes, distinguishing intermittent results from recurring strict-output or availability failures without retaining configuration or test content.
- **Tested local Ollama verification** — AI Settings can now run a bounded, media-free JSON-Schema capability test for the saved primary Ollama configuration, present its current state, and admit only current successful results to candidate-bound verification.
- **Ollama runtime mismatch monitoring** — Classifarr now counts bounded strict-verification model-digest mismatches and records their last-observed time without storing provider text, media data, prompts, responses, or digests.
- **Ollama runtime operations panel** — AI Settings now provides an administrator-only, cached aggregate view of strict-Ollama digest mismatch count and last-observed time, without exposing model identity, endpoint details, errors, or event history.
- **Model-change remediation guidance** — When strict Ollama verification is invalidated by a model change, AI Settings now presents a contextual, administrator-initiated re-test of the saved configuration with aggregate-only runtime context.
- **Queue admission diagnostics** — The Command Center now separately explains unavailable classification-worker capacity and a saved Ollama model change that blocks only strict candidate verification, with an explicit path to AI Settings.
- **Queue decision-path telemetry** — When classification work is waiting, the Command Center now shows a cached, aggregate-only 24-hour summary of deterministic policy routes, AI attempts, AI-unavailable retries, and strict-verification abstentions.
- **Queue telemetry operational acceptance** — The integration suite now verifies the real queue telemetry path with transaction-scoped synthetic decision records that are always rolled back.
- **Queue telemetry HTTP acceptance** — The live-stats route now has transaction-scoped acceptance coverage that rejects unauthenticated requests before the queue service runs and confirms the authenticated response remains aggregate-only.

### Fixed

- **One-step Ollama verification** — Saving a changed primary Ollama target now automatically runs its bounded strict-verification test, visibly separates an unsaved selection from saved capability, and removes the redundant second save confirmation.
- **Qwen strict verification** — Fixed the documented top-level Ollama `think: false` control for bounded strict JSON-schema probes, allowing reasoning-model verification results to be validated from the response channel without changing normal classification behavior.
- **Ollama matrix type safety** — The server typecheck now validates the compatibility matrix's saved-configuration, probe, selection, and report contracts before CI can publish a release candidate.
- **Ollama matrix capacity selection** — Compatibility checks now keep the explicitly saved model but skip oversized, unknown-size, and clearly embedding-only alternative models before they can consume local inference resources; AI Settings shows only an aggregate skipped count.
- **Ollama verification fidelity** — Ollama generation now sends decoding controls in the documented runtime-options object, and AI Settings preserves and clearly reports completed-but-ineligible strict-verification results instead of showing them as untested or generically successful.
- **Ollama strict-output delivery** — Streamed Ollama generation now forwards strict response schemas and verifies the tested model digest before candidate-bound verification runs.
- **Ollama verification recovery** — A model digest mismatch now revokes only the matching saved strict-verification capability, explains the required re-test in AI Settings, and recognizes a current tested primary Ollama path in remediation readiness.
- **CI validation** — Removed an unused runtime-summary singleton that caused the server Knip quality gate and its dependent release-acceptance readout to fail.
- **Schema snapshot validation** — Regenerated the authoritative PostgreSQL 18 schema snapshot so container validation remains stable after the PostgreSQL 18.6 image update.

### Security

- **Ollama matrix capacity boundary** — Alternative probes now require a server-discovered, bounded artifact size and reject clear embedding indicators; no model-size, family, target, or provider output is returned to the browser.
- **Saved-model coverage privacy** — Matrix configuration coverage is an independently allow-listed boolean with no returned host, configured model name, prompt, raw provider output, or automatic configuration change.
- **Ollama matrix resource boundary** — The manual compatibility matrix accepts no browser-selected provider target or model list, excludes cloud-tagged models, caps and serializes probes, requests model unload, rate-limits administrator actions, rejects concurrent runs, and neither persists output nor changes strict-verification authority.
- **Ollama history privacy boundary** — Saved-test trend data is limited to three fixed daily counters and timestamps, pruned after 30 days, served through a parameter-free administrator-only rate-limited endpoint, and never affects capability authority or routing.
- **Local verification fail-closed controls** — Strict Ollama authority is bound to an explicit administrator test, current configuration fingerprint/revision, model digest, timeout-bounded preflight, and existing server-side candidate confirmation rules; fallbacks remain advisory.
- **Runtime re-tag containment** — A stale worker cannot invalidate a newer save or verification test, and a mismatch remains blocked even if runtime telemetry persistence is unavailable.
- **Runtime-observability access boundary** — The mismatch panel uses server-side administrator authorization, a dedicated post-authentication limiter, a parameterized fixed-dimension query, and an allow-listed response with no client-selected dimensions.
- **Ollama verification action boundary** — An administrator save of a changed primary target runs exactly one existing saved-target test; out-of-band runtime drift remains manually re-testable, and no path re-admits strict verification before a successful test.
- **Queue diagnostic privacy boundary** — Queue status exposes only fixed worker and strict-verification state IDs; it does not reveal provider configuration, model identity, digests, raw errors, media, or policy data.
- **Decision-path telemetry boundary** — Queue telemetry reads four fixed aggregate counters from existing history, is skipped without queued classifications, and never returns item, library, policy, provider, model, prompt, response, error, or decision identifiers.

### Changed

- **Ollama remediation guidance** — Added a safe, manual runbook for resolving compatibility-matrix outcomes through local inspection and explicit re-testing, without automatic pulls, deletions, provider targeting, or settings changes.
- **Client tooling** — Applied the locally tested dependency changes from open PR #520 (`@types/node`, ESLint, and `vue-tsc`); the pull request was not merged and no release was created.
- **Security automation** — Applied the locally tested pinned CodeQL Action update from open PR #518; the pull request was not merged and no release was created.

## [v0.48.3-beta] - 2026-08-28

### Changed

- **Second-pass candidate verification** — An adopted policy-recheck confirmation candidate now enters the same strict, candidate-bound AI verification admission path as a first-pass confirmation, while the policy engine remains the routing authority.
- **Client tooling** — Applied the Vite 8.2.2 development-dependency update from open PR #519 locally; no pull request was merged and no release was created.
- **Compatibility-policy maintenance** — Existing compatibility policies now provide a direct maintenance review action, and administrators can explicitly add a bounded library-profile purpose suggestion to an unsaved policy draft before normal review and save.
- **Release hygiene** — The product-language audit now recognizes the required fresh, empty `Unreleased` changelog section after a release is cut.

### Fixed

- **Policy recheck review safety** — AI-call budgets, resilience gates, and provider failures now retain the deterministic confirmation candidate for operator review rather than replacing it with an unrelated baseline result.

### Security

- **Verification boundary consistency** — Rechecked confirmation candidates use server-owned candidate binding, provider admission before generation, and bounded status-only outcomes.

## [v0.48.2-beta] - 2026-08-22

Detailed engineering history is retained in the [August 2026 release archive](docs/changelog/CHANGELOG-2026-08-releases.md).

### Added

- **Release evidence and provider-fault gates** — Tag publication now verifies bounded evidence provenance and a disposable provider-fault recovery receipt before publishing images or a GitHub release.
- **Local AI evaluation contract** — Reviewed fixtures, policy-context fingerprints, decision witnesses, and aggregate trend comparison make local classification evaluation reproducible without exposing raw local data.
- **Bounded policy maintenance** — Administrators can review purpose coverage, remediate unresolved policies, and safely resume an interrupted native-purpose change through narrow, receipt-backed controls.
- **Release and image assurance** — Added immutable image consumer smoke, release-attestation verification, installation-evidence assembly, and manifest-aware retention assessment.

### Changed

- **Policy-route delivery** — Split authoring, maintenance, and insight pages into independent production bundles and added a Chromium cold-load budget gate for every policy route.
- **Release metadata contract** — Package and lockfile versions, the UI label, README marker and badge, and top release-note heading now share a deterministic pre-tag validation.
- **AI evaluation access** — Local sweeps exchange narrowly scoped, short-lived tokens and preserve policy authority through direct and queued decision evaluation.
- **Toolchain maintenance** — Applied reviewed client/server dependency and pinned-workflow updates while retaining ESM, lint, test, coverage, and security gates.

### Fixed

- **Provider recovery safety** — Transient provider failures persist as retryable, no-route work rather than an unsafe destination decision.
- **Evaluation correctness** — Fixed scoped-route matching, API-key authentication, queued non-final grading, and temporary AI-settings ETag handling.
- **Policy and restore reliability** — Corrected native-purpose audit persistence, pending-decision replacement, backup/restore history protection, and schema-snapshot comparison noise.
- **Client test stability** — Isolated router initialization and bounded Vitest workers for reliable constrained-host test execution.

### Security

- **Policy and provider boundaries** — Preserved server-owned route authority, capability-gated AI verification, bounded recovery data, and explicit no-route behavior under provider failure.
- **Supply-chain verification** — Enforced provenance checks for release evidence and multi-architecture images before release publication.
- **Dependency remediation** — Updated audited client, server, and workflow dependencies, including current OSV and CodeQL action pins.
