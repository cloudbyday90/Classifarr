# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [August 2026 Release Details](docs/changelog/CHANGELOG-2026-08-releases.md) | [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Added

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

### Changed

- **AI readiness controller** — AI Settings now leads with one server-owned, self-updating readiness state; visible-page refreshes are pausable, while runtime evidence, history, compatibility checks, receipts, and preflight observations are lazy diagnostics.
- **AI evidence minimization** — Candidate adjudication sends bounded profile distributions and limited historical titles only to a syntactically trusted local Ollama endpoint; all other providers and hosts receive aggregate availability, size-band, and match facts.
- **Catalog evidence minimization** — Current-library lookup sends at most three title/year matches per candidate only to a syntactically trusted local Ollama endpoint; other providers receive aggregate retrieval facts only.
- **Comparison coverage precision** — Destination competition now distinguishes complete active-competitor coverage from a genuinely capped comparison, including the exact-cap case, without exposing an active-policy total or identity.
- **Shared-eligibility explanation** — Destination competition now explains possible overlap through allow-listed, anonymous declared-purpose category aggregates without exposing policy terms or changing routing authority.
- **Destination competition preview** — Existing-policy maintenance can now compare a proposed draft against bounded, anonymous active same-media-type competitors and report aggregate deterministic eligibility overlap before saving.
- **Policy cohort preview** — Existing-policy maintenance can now compare a saved policy and unsaved draft against a bounded recent deterministic cohort, returning aggregate native-eligibility deltas before the draft is saved.
- **Policy overlap precision** — Current-policy coverage and draft preflight now flag a shared `require_any` purpose alternative even when a sibling term is unique, preventing broad fallback matches from being presented as safely distinct.
- **Offline evaluation coverage** — The semantic evidence corpus now covers declared-scope conflict, semantic overreach, clear series, and low-margin uncertainty cases rather than only the original four examples.

### Security

- **AI readiness refresh boundary** — Automatic AI Settings refreshes call only the existing administrator-authorized saved-capability read at a visible-page bound; they cannot probe providers, discover models, write settings, route media, or expose raw scheduled-preflight errors.
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
