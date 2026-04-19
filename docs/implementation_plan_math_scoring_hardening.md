# Math & Scoring Hardening Implementation Plan

## Status: Complete

### Implementation Progress

**Step 1 — Complete:** Threshold safety and ranking invariants verified in focused unit coverage and Docker-backed schema integration coverage.
**Step 2 — Complete:** `confidenceCalculator.js` authoritative conflict handling and weight/rounding fixes verified in focused regression coverage.
**Step 3 — Complete:** `policyEngine.js` normalization math fixes and invalid formula cleanup verified in focused policy-engine regression coverage and the combined hardening slice.
**Step 4 — Complete:** Formula-engine utility hardening and strict numeric/rating normalization behavior verified in focused regression coverage.
**Step 5 — Complete:** Regression matrix, changelog/docs updates, and full server verification completed.

**Remaining:** None.

---

## 1. Problem Statement

The current scoring stack contains several mathematical and threshold-handling defects that can produce incorrect classifications even when the surrounding code is functioning as designed.

The most serious issues are:

- authoritative conflicts are resolved by array order instead of explicit precedence or conflict detection
- neutral scores are sometimes treated as real positive contribution
- some weights remain in normalization denominators after their signals have been neutralized to zero
- ranking thresholds accept invalid values and can produce dead or inverted decision bands
- several numeric parsers use permissive coercion or truthiness checks that silently mis-handle malformed strings and valid zeroes

These are logic defects, not just missing tests. The current targeted suites pass, which means the codebase needs implementation changes plus new regression coverage.

---

## 2. Scope

This plan covers the following files and adjacent tests:

- `server/src/services/policyCandidateRanker.js`
- `server/src/services/policyDecisionBuilder.js`
- `server/src/services/confidenceCalculator.js`
- `server/src/services/policyEngine.js`
- `server/src/services/formulaEngine.js`
- `server/src/services/clarificationService.js`
- `server/src/services/classificationRoutingService.js`
- `server/src/utils/ratingNormalizer.js`
- related Jest suites under `server/src/__tests__`

This plan does **not** attempt a broader policy-engine redesign. The goal is to harden the existing formulas and decision thresholds without changing the feature set.

---

## 3. Current Findings

### 3.1 Threshold and Ranking Defects

- `policyCandidateRanker.js` compares scores against raw threshold values without normalizing them first.
- `null` thresholds are dangerous because JavaScript numeric coercion makes `score >= null` behave like `score >= 0`.
- Equal-score candidates are tie-broken by input order only.
- The code assumes `auto_classify_threshold >= prompt_threshold >= 40`, but that invariant is not enforced in the ranking path.
- Policy-engine scores are capped at `95`, but the system currently allows policy thresholds up to `100`, creating unreachable branches for non-authoritative decisions.
- `clarificationService.getTierFromPolicyThresholds()` inherits the same threshold-order assumptions.

### 3.2 Confidence Calculator Defects

- Authoritative signals from different libraries are not reconciled; the first one wins.
- `custom_rule` signals are emitted but have no default weight in `DEFAULT_WEIGHTS`.
- persisted zero weights and a zero threshold are lost on reload because `parseInt(...) || fallback` treats `0` as falsy
- threshold checks use rounded confidence instead of the raw score, allowing sub-threshold totals to cross the boundary after rounding
- profile-score semantics are inconsistent with the rest of the scoring stack: values below the neutral baseline can still contribute positive confidence

### 3.3 Policy Formula Defects

- `policyEngine.evaluatePolicy()` always includes `profile_weight` in the denominator even when profile scoring has been reduced to zero as neutral or unavailable.
- `scoreCertification(..., mode='max')` compares movie and TV certification systems in one mixed ladder.
- `scoreKeywords()` uses substring matching, which creates false positives and false exclusions.
- `scoreGenres()` treats missing genre metadata as hard failure even for exclusion-only or preference-only configs.
- `scoreVoteAverage()`, `scoreRuntime()`, and `scoreReleaseYear()` use truthiness checks that mis-handle valid zeroes and zero bounds.
- `scoreMediaType()` is hard-blocking on mismatch but contributes nothing on success, so a media-type-only preset cannot produce a positive score.

### 3.4 Formula Engine Defects

- `formulaEngine.scoreHistory()` documents `50` as neutral, but that neutral value still contributes to weighted totals.
- `formulaEngine.scoreRules()` is mathematically degenerate because every matching rule adds the same constant and the method returns the average of identical values.

### 3.5 Utility / Parsing Defects

- `classificationRoutingService.js` uses permissive `parseInt` coercion, so malformed values like `'12abc'` are silently accepted as valid IDs.
- `ratingNormalizer.js` omits `TV-Y7-FV` from standard TV ratings and from the SQL normalization filter, causing a valid rating to degrade to `NR`.

---

## 4. Design Decisions

### Decision 1: Treat Thresholds as a Validated Ladder, Not Raw Inputs

Introduce a shared normalization rule for policy thresholds in ranking code:

- thresholds must be finite numbers
- thresholds must satisfy `0 <= prompt_threshold <= auto_classify_threshold <= 95` for policy-engine decisions
- invalid thresholds should be rejected at write-time and defensively normalized at read/use-time

This prevents silent JS coercion bugs and removes unreachable policy-engine branches.

### Decision 2: Treat Neutral as Zero Contribution at Aggregation Time

Signals described as neutral must not silently move totals. If a signal is mapped onto a `0-95` contribution scale, neutral must become `0` before weighting, and its weight must not remain in the denominator unless the formula is intentionally centered around a non-zero baseline.

This applies most clearly to:

- `policyEngine` profile normalization
- `formulaEngine` history scoring
- any future signal that advertises `50 = neutral`

### Decision 3: Prefer Conservative Outcomes on Ambiguity

When evidence is contradictory or mathematically tied, the system should not auto-classify by incidental ordering. Exact ties, near-ties, and authoritative disagreements should degrade toward `prompt_select`, `prompt_confirm`, or `manual` rather than force a deterministic winner without justification.

### Decision 4: Numeric Parsing Must Be Strict

ID-like and threshold-like values should use whole-string numeric validation. Truthiness checks should be replaced with explicit numeric validation.

Examples:

- use `Number.isFinite(...)` for parsed numeric inputs
- use `value !== undefined && value !== null` for bounds
- reject malformed values like `'12abc'` instead of truncating them with `parseInt`

---

## 5. Implementation Plan

### Step 1: Threshold Safety and Ranking Invariants

Files:

- `server/src/services/policyCandidateRanker.js`
- `server/src/services/policyDecisionBuilder.js`
- `server/src/services/clarificationService.js`
- `server/src/routes/policies.js`
- `database/migrations/`

Changes:

- add a shared threshold-normalization helper used by both `policyCandidateRanker` and `clarificationService`
- normalize thresholds with explicit numeric checks only
  - use `Number(...)` plus `Number.isFinite(...)`
  - do not rely on JavaScript relational coercion
  - do not allow `null`, `undefined`, empty string, or `NaN` to flow into `>=` comparisons
- enforce a monotonic threshold ladder at write-time and read/use-time
  - `0 <= prompt_threshold <= auto_classify_threshold`
  - for policy-engine scoring paths, cap or reject thresholds above `95`, since `FORMULA_CONFIDENCE_CAP` is the real ceiling for non-authoritative results
- add a database-level `CHECK` constraint for the row-local threshold relationship
  - this belongs in PostgreSQL because the invariant is row-local and stable
  - keep API validation too; DB constraint is the backstop, not the only guard
- make ranking deterministic and conservative for ambiguity
  - keep primary sort on descending `score`
  - add explicit secondary ordering only for observability and reproducibility, not to force auto-classification on ties
  - if multiple candidates are tied on top score, or within a defined “close score” margin, do not let fetch order decide the action
  - degrade ties/near-ties to `prompt_select` or `manual` unless there is an explicit business-rule winner
- return threshold metadata that reflects the normalized values actually used for branching
- add direct regression tests for:
  - `null` threshold coercion
  - inverted thresholds
  - thresholds above `95`
  - exact top-score ties
  - near-tie behavior
  - clarification-tier behavior when normalized thresholds are used

Acceptance criteria:

- no branch may auto-classify because of `null` coercion
- equal-score policies must not produce different actions solely because their order changed
- prompt and auto thresholds must form a monotonic ladder everywhere they are consumed
- the API, service layer, and DB all reject or normalize the same invalid threshold shapes
- result payloads expose the actual threshold values used for the decision

Implementation notes:

- Repo intent today is already clear:
  - [docs/architecture/policy-engine.md](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/docs/architecture/policy-engine.md:286) documents `auto_classify_threshold: 85` and `prompt_threshold: 60`, with prompt as the lower band.
  - [database/migrations/042_policy_driven_schema.sql](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/database/migrations/042_policy_driven_schema.sql:86) documents `prompt_threshold` as “confidence >= this threshold but < auto_classify_threshold”.
  - [server/src/__tests__/clarificationService.test.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/clarificationService.test.js:208) and [server/src/__tests__/classification-auto-route-threshold.test.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/classification-auto-route-threshold.test.js:52) also assume that ladder.
- Current best-practice guidance supporting this step:
  - MDN notes that `x >= y` has surprising `null` behavior because `null` is coerced to `0` in relational comparison contexts. This is the direct reason Step 1 must normalize before comparison rather than compare raw values. Source: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Greater_than_or_equal>
  - MDN recommends well-formed comparators and notes that returning `0` keeps original order; stable sort preserves pre-sort order among equal elements. That means today’s score-only comparator turns fetch order into an implicit tie-breaker, so ambiguity must be handled explicitly in business logic. Source: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort>
  - MDN documents `Number.isFinite()` as the stricter numeric guard because it does not coerce non-numeric inputs. This is the correct primitive for threshold normalization. Source: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite>
  - PostgreSQL recommends `CHECK` constraints for row-local invariants involving multiple columns. The threshold ladder is exactly that kind of invariant. Source: <https://www.postgresql.org/docs/current/ddl-constraints.html>
  - Google’s ML guidance emphasizes that thresholds are chosen decision cutoffs and should reflect the cost of mistakes, not arbitrary defaults. For this repo, that supports making tie and close-score behavior conservative instead of silently auto-classifying. Source: <https://developers.google.com/machine-learning/crash-course/classification/thresholding>
  - scikit-learn’s threshold-tuning guidance reinforces that thresholds are decision policy, not inherent truth, and should be tuned against a meaningful metric. For this repo, that means Step 1 should preserve explicit thresholds but enforce valid, explainable decision bands. Source: <https://scikit-learn.org/stable/modules/classification_threshold.html>

### Step 2: Confidence Calculator Corrections

Files:

- `server/src/services/confidenceCalculator.js`
- `server/src/services/signalCollector.js`
- `server/src/__tests__/confidenceCalculator.test.js`
- `server/src/services/formulaEngine.js`

Changes:

- define the authoritative-signal contract explicitly
  - authoritative signals are intended to short-circuit scoring, as already documented in [docs/architecture/policy-engine.md](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/docs/architecture/policy-engine.md:406)
  - but “authoritative” must mean “internally consistent”, not “first array element wins”
- detect conflicting authoritative signals that point to different libraries
- choose and document one of two allowed behaviors:
  - explicit precedence ordering, if the business rules really support it
  - conservative downgrade to a conflict/manual path, if conflicting authoritative evidence means the system no longer has a valid authoritative answer
- add regression tests for both same-library and cross-library authoritative multi-signal cases
- add a default weight for `SIGNAL_TYPES.CUSTOM_RULE` because [server/src/services/signalCollector.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/signalCollector.js:293) emits it today
- preserve configured zero weights and a zero threshold when loading from `confidence_settings`
  - replace `parseInt(...) || fallback` with explicit parsing and `Number.isNaN(...)` checks
  - do not treat `0` as “missing”
- separate decision math from display math
  - use raw `topLibrary.totalScore` for `meetsThreshold`
  - round only when producing human-facing output fields
  - keep the display value and decision value consistent in naming so future code does not branch on a rounded score by accident
- normalize profile-score semantics to the same neutral baseline used elsewhere
  - `signalCollector` emits `PROFILE_SCORE` only when `profileScore !== 50`
  - `formulaEngine.scoreProfile()` already treats `50` as neutral and maps `< 50` to zero contribution
  - `confidenceCalculator` should not let sub-neutral profile values still add positive confidence simply because they are multiplied as raw percentages
- decide whether negative profile evidence should:
  - contribute zero and remain advisory-only in this calculator, or
  - contribute explicit negative evidence through a new signed or penalty-based model
  - do not keep the current hybrid, where a “mismatch” score can still increase confidence
- tighten breakdown correctness
  - `isAuthoritative` entries in breakdown should be real booleans, not the raw object result of `weight >= 100 && signal.library`
  - preserve enough metadata for diagnostics to explain why a conflict/manual downgrade happened
- add targeted tests for:
  - `custom_rule` default weight contribution
  - conflicting authoritative signals
  - raw-score threshold comparisons vs rounded display values
  - zero-valued persisted settings
  - profile-score handling for `> 50`, `= 50`, and `< 50`

Acceptance criteria:

- a `custom_rule` signal contributes non-zero confidence by default
- zero-valued persisted settings reload correctly
- a `79.65` score does not satisfy an `80` threshold just because it rounds up
- conflicting authoritative inputs no longer silently resolve by array order
- profile mismatch signals do not increase confidence under a supposedly neutral-centered scoring model
- breakdown metadata is internally type-correct and suitable for debugging

Implementation notes:

- Repo intent today is visible in the current code:
  - [server/src/services/confidenceCalculator.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/confidenceCalculator.js:123) treats weight `>= 100` as authoritative and short-circuits.
  - [server/src/services/signalCollector.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/signalCollector.js:274) only emits profile signals when the profile score deviates from the neutral baseline `50`.
  - [server/src/services/formulaEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/formulaEngine.js:123) already maps profile `50` to neutral and `< 50` to zero contribution, which is the closest existing semantics match for this calculator.
  - [server/src/__tests__/confidenceCalculator.test.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/confidenceCalculator.test.js:224) currently codifies the buggy “first encountered authoritative signal wins” behavior, so the tests must be updated along with the implementation.
- Current best-practice guidance supporting this step:
  - MDN documents `Number.isFinite()` as stricter than global `isFinite()` because it does not coerce non-numeric inputs. This is the correct primitive for parsing persisted numeric settings safely. Source: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite>
  - MDN documents that `parseInt()` ignores the first invalid character and everything after it, e.g. `parseInt("15px", 10) === 15` and `parseInt("1e3", 10) === 1`. That is precisely why Step 2 should avoid permissive parsing/fallback behavior when loading configuration. Source: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt>
  - MDN documents `Math.round()` as rounding to the nearest integer. That makes it suitable for display, but not for threshold decisions where a raw score below threshold must remain below threshold. Source: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round>
  - Google’s ML guidance emphasizes that the classification threshold is a chosen decision boundary, and handling at equality depends on implementation. For this repo, that reinforces the need to make threshold comparison semantics explicit and avoid letting incidental rounding define the decision boundary. Source: <https://developers.google.com/machine-learning/crash-course/classification/thresholding>
  - scikit-learn’s threshold-tuning guidance distinguishes model scores from the decision threshold applied afterward. That supports keeping the confidence score computation separate from display formatting or post-hoc threshold presentation. Source: <https://scikit-learn.org/stable/modules/classification_threshold.html>

### Step 3: Policy Formula Corrections

Files:

- `server/src/services/policyEngine.js`
- `server/src/__tests__/policyEngine.scoringFunctions.test.js`
- `server/src/__tests__/policyEngine.presetSemantics.test.js`
- `server/src/__tests__/policyEngine.combinationModes.test.js`

Changes:

- fix weighted normalization so “neutral” or unavailable signals do not keep suppressing positive evidence through the denominator
  - [server/src/services/policyEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js:411) currently always includes `profile_weight` in `totalWeight`
  - that contradicts the repo’s neutral-score model whenever profile is unavailable or deliberately collapsed to neutral
  - normalize only across signals that are both enabled and meaningfully participating in the score, or keep every signal on a true neutral-centered scale so a neutral value does not distort normalization
- define the neutral-score contract for each signal family
  - `preset`, `pattern`, `rag`, and `history` already behave like optional evidence sources
  - `profile` needs the same clarity: either “always enabled with neutral midpoint semantics” or “optional evidence that is removed from the denominator when neutral/unavailable”
  - do not leave this as an implicit side effect of current arithmetic
- split movie and TV certification handling into separate allowlisted ladders
  - the current combined list mixes MPA movie ratings with TV Parental Guidelines in one linear order
  - treat movie certifications and TV certifications as different domains, selected by `item.media_type` or explicit configuration context
  - preserve exact-match `include` / `exclude` behavior
  - for `max` mode, compare only inside the correct domain-specific order
  - if the item certification is unknown within that domain, return a documented neutral score rather than silently comparing across systems
- move keyword matching from substring search to bounded-term matching
  - [server/src/services/policyEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js:743) currently uses `allText.includes(...)`
  - for fixed keyword inputs, matching should respect token or phrase boundaries so unrelated words do not satisfy the rule by accident
  - escape user-configured terms before building regex patterns
  - preserve support for multi-word phrases, not just single-token keywords
- tighten the matching model by signal type
  - use exact or bounded matching for discrete allowlisted values such as certifications and languages
  - use tolerant text matching only where the source data is actually free text, such as `overview` and `title`
  - avoid letting free-text heuristics redefine exact metadata semantics
- make missing metadata neutral when the configuration is advisory-only
  - [server/src/services/policyEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js:687) returns `0` when genres are missing even if the config only contains `prefer` or `exclude`
  - missing genre metadata should fail only true requirements such as `require_all` / `require_any`
  - when config is only `prefer` or only `exclude`, missing metadata should return neutral instead of behaving like a mismatch
  - apply the same rule review to any other advisory metadata scorer that currently hard-fails on absence
- replace truthiness-based numeric range checks with strict numeric checks
  - `0` is a valid runtime, year, rating, or threshold bound in code even if rare in the domain
  - use explicit parsed-number checks and explicit `min !== undefined` / `max !== undefined` style comparisons
  - do not let JavaScript truthiness decide whether a numeric constraint exists
- decide and document the `media_type` role inside preset scoring
  - [server/src/services/policyEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js:625) currently hard-blocks mismatches but does not contribute weight or score on matches
  - choose one behavior:
    - keep `media_type` as pure gating and require at least one scored signal for a preset to contribute
    - or treat `media_type` as an explicit scored signal with documented weight
  - do not keep the current hybrid, where a preset can appear configured but still be mathematically unable to score above `0`
- add targeted regression tests for:
  - neutral profile normalization and denominator behavior
  - movie vs TV certification `max` comparisons
  - keyword false positives from substring-only matching
  - missing-genre advisory configs
  - numeric comparisons where value or bound is `0`
  - media-type-only presets and mixed media-type preset bundles

Acceptance criteria:

- a neutral or unavailable profile signal does not make prompt/auto thresholds unreachable for otherwise strong matches
- `scoreCertification({ mode: 'max', max: 'PG-13' }, { media_type: 'movie', certification: 'TV-14' })` does not resolve through a mixed-domain ladder
- a strong preset-only match can still realistically reach `prompt_confirm` and `auto_classify`
- `scoreVoteAverage({ max: 1 }, { vote_average: 0 })` behaves as an actual numeric comparison, not as “missing”
- unrelated words do not satisfy keyword requirements through substring accidents
- missing metadata is neutral unless the config truly requires it
- a preset configured with only `media_type` has defined, documented behavior rather than an accidental zero-score outcome

Implementation notes:

- Repo intent today is visible but inconsistent:
  - [server/src/services/policyEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js:413) normalizes by enabled weights, but it still treats `profile` as always enabled even when the score is effectively neutral.
  - [server/src/services/policyEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js:661) currently compares `G`, `PG`, `PG-13`, `R`, `NC-17`, `TV-Y`, `TV-Y7`, `TV-G`, `TV-PG`, `TV-14`, and `TV-MA` on one ladder, which conflates two separate rating systems.
  - [server/src/services/policyEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js:743) uses substring matching for keywords, which is why terms can match unrelated words.
  - [server/src/services/policyEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js:687) returns `0` on missing genre metadata before checking whether the config is actually advisory-only.
  - [server/src/services/policyEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js:834), [server/src/services/policyEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js:863), and [server/src/services/policyEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js:890) use truthiness checks that mishandle real zeroes.
  - [server/src/services/policyEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/policyEngine.js:625) treats `media_type` as a gate, not as a scored signal, so presets with no other signals cannot accumulate weight.
  - [docs/architecture/policy-engine.md](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/docs/architecture/policy-engine.md:286) still documents concrete score bands (`>=85`, `60-84`, `40-59`, `<40`), so Step 3 has to preserve the ability for valid matches to actually reach those bands.
- Current best-practice guidance supporting this step:
  - OWASP’s Input Validation Cheat Sheet recommends allowlist validation and exact matching when an input comes from a fixed set of options. That supports treating certifications, languages, and similar structured metadata as exact domain values, not fuzzy substring text. Source: <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
  - MDN documents JavaScript word-boundary assertions for cases where matching should respect token boundaries instead of arbitrary substrings. That supports bounded keyword/phrase matching in `title` and `overview` text rather than raw `.includes(...)`. Source: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Word_boundary_assertion>
  - MDN documents `RegExp` as the correct primitive for constructed text patterns. For this repo, that means user-supplied keyword terms must be escaped before being embedded into a regex. Source: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp>
  - Google’s threshold guidance emphasizes that decision cutoffs change false-positive and false-negative behavior. In this repo, denominator inflation from neutral signals is effectively an accidental threshold shift, so Step 3 should remove that distortion. Source: <https://developers.google.com/machine-learning/crash-course/classification/thresholding>
  - The official MPA ratings guide treats `G`, `PG`, `PG-13`, `R`, and `NC-17` as the movie-rating system. Source: <https://www.filmratings.com/ratings-guide/>
  - The official TV Parental Guidelines define a separate TV system with `TV-Y`, `TV-Y7`, `TV-G`, `TV-PG`, `TV-14`, and `TV-MA`, plus `FV` only with `TV-Y7`. Source: <https://www.tvguidelines.org/> and <https://www.tvguidelines.org/aboutUs.html>
  - TMDB exposes separate certification endpoints for movies and TV. That is a practical API-level confirmation that the upstream metadata model also treats them as separate domains. Source: <https://developer.themoviedb.org/reference/certification-movie-list> and <https://developer.themoviedb.org/reference/certifications-tv-list>

### Step 4: Formula Engine and Utility Hardening

Files:

- `server/src/services/formulaEngine.js`
- `server/src/services/classificationRoutingService.js`
- `server/src/utils/ratingNormalizer.js`
- `server/src/__tests__/formulaEngine.test.js`
- `server/src/__tests__/classificationRoutingService.test.js`
- `server/src/__tests__/ratingNormalizer.test.js`

Changes:

- rework `formulaEngine.scoreHistory()` so “no history” and “insufficient history” do not add positive weight by default
  - [docs/architecture/policy-engine.md](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/docs/architecture/policy-engine.md:267) already states “If insufficient history → score = 0”
  - [server/src/services/formulaEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/formulaEngine.js:296) and [server/src/services/formulaEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/formulaEngine.js:304) currently return `50`
  - choose one consistent model and document it explicitly:
    - preferred: `scoreHistory()` returns `0` when there is no usable history, so missing evidence stays neutral inside the existing weighted sum
    - fallback alternative: keep `50` as an internal neutral marker but then recenter or remove it before weighted aggregation
  - do not keep the current hybrid where “neutral” history still adds positive score to every library
- redesign `formulaEngine.scoreRules()` so corroborating matches can change the score meaningfully
  - [server/src/services/formulaEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/formulaEngine.js:167) currently gives every matched rule the same `80`, then averages identical values back to `80`
  - define an explicit aggregation model instead of an accidental constant:
    - preferred: first matching rule establishes a strong base score, and each additional independent match adds a smaller corroboration bonus up to `FORMULA_CONFIDENCE_CAP`
    - preserve the current “no matched rules = 0” behavior
    - do not penalize a library merely for having more total rules configured; the model should reward corroboration, not rule-count sparsity
  - leave room for future per-rule weights/confidence if the schema later expands, but fix the current degenerate math now
- replace permissive `parseInt` acceptance in routing helpers with strict whole-string numeric validation
  - [server/src/services/classificationRoutingService.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRoutingService.js:74) currently accepts truncated values such as `"3.7"` and `"12abc"`
  - apply the same strict parse helper anywhere routing consumes structured numeric input:
    - `quality_profile_id`
    - `metadata.year` when building Radarr payloads
    - `tvdbId` matching in Sonarr lookup
    - `requested_seasons` and season numbers
  - reject malformed numeric strings instead of silently truncating them into different values
  - use a whole-string allowlist for positive integers, then convert and verify with integer checks
- tighten routing behavior around invalid structured numbers
  - invalid `quality_profile_id` should remain `null` and trigger normal fallback resolution, not mutate into a different profile ID
  - invalid `requested_seasons` members should be dropped, not truncated into valid-looking season numbers
  - invalid `year` should be omitted from the outbound Arr payload rather than passed as a truncated number
  - invalid `tvdb_id` should fail lookup cleanly instead of accidentally matching a different series
- add `TV-Y7-FV` to both the runtime normalizer and the SQL normalization filter
  - [server/src/utils/ratingNormalizer.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/utils/ratingNormalizer.js:60) omits `TV-Y7-FV` from `STANDARD_TV_RATINGS`
  - [server/src/utils/ratingNormalizer.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/utils/ratingNormalizer.js:63) also omits it from `NEEDS_NORMALIZATION_SQL`
  - this causes a valid standard TV rating to be treated as non-standard and repeatedly flagged for normalization
- add direct regression tests for:
  - `scoreHistory()` with no TMDB ID, no history rows, mixed-history rows, and query failure
  - `scoreRules()` with one, two, and multiple corroborating rule matches
  - strict integer parsing for `"3.7"`, `"12abc"`, `"1e3"`, and padded/whitespace variants if those are intentionally supported or rejected
  - `requested_seasons` elements like `"2x"` and `"03"`
  - `TV-Y7-FV` pass-through in runtime normalization and SQL normalization detection

Acceptance criteria:

- `formulaEngine.scoreHistory()` no longer gives every library a positive baseline score when history is absent
- `scoreRules()` returns a meaningfully higher score for corroborating multiple rule matches than for exactly one rule match, while still capping at `95`
- malformed IDs and season values are rejected instead of truncated
- `normalizeQualityProfileId('12abc')` and `normalizeQualityProfileId('3.7')` return `null`
- invalid `requested_seasons` values do not silently turn into different season numbers
- `TV-Y7-FV` is preserved as a valid rating and is not selected by the SQL “needs normalization” filter

Implementation notes:

- Repo intent today is visible and stronger than the current implementation:
  - [docs/architecture/policy-engine.md](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/docs/architecture/policy-engine.md:267) says “If insufficient history → score = 0”, but [server/src/services/formulaEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/formulaEngine.js:296) and [server/src/services/formulaEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/formulaEngine.js:304) return `50`.
  - [server/src/__tests__/formulaEngine.test.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/formulaEngine.test.js:420) currently codifies that buggy `50 = neutral-but-positive-in-total` behavior, so the tests must move with the implementation.
  - [server/src/services/formulaEngine.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/formulaEngine.js:167) makes `scoreRules()` effectively constant for any positive match count.
  - [server/src/services/classificationRoutingService.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRoutingService.js:74), [server/src/services/classificationRoutingService.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRoutingService.js:326), [server/src/services/classificationRoutingService.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRoutingService.js:439), [server/src/services/classificationRoutingService.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRoutingService.js:480), and [server/src/services/classificationRoutingService.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/services/classificationRoutingService.js:508) all rely on permissive integer parsing.
  - [server/src/__tests__/classificationRoutingService.test.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/classificationRoutingService.test.js:198) currently asserts the buggy truncation behavior for `"3.7"`, so that test must be rewritten as a rejection case.
  - [server/src/utils/ratingNormalizer.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/utils/ratingNormalizer.js:60) and [server/src/utils/ratingNormalizer.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/utils/ratingNormalizer.js:63) omit `TV-Y7-FV`, even though it is part of the standard TV vocabulary.
- Current best-practice guidance supporting this step:
  - MDN documents that `parseInt()` stops parsing at the first invalid character and ignores the rest. That is exactly why values like `"12abc"` and `"3.7"` should not be accepted for structured identifiers and season numbers. Source: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt>
  - MDN documents `Number.isInteger()` as the correct primitive for verifying that a parsed numeric value is an integer. Source: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger>
  - OWASP’s Input Validation Cheat Sheet recommends allowlist validation and regexes that cover the whole input string for structured fields. That supports a shared whole-string positive-integer validator for routing IDs and season numbers. Source: <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
  - The official TV Parental Guidelines include `FV` as a descriptor used exclusively with `TV-Y7`, and the ratings overview surfaces `Y7FV` alongside the standard TV ratings. That supports treating `TV-Y7-FV` as a valid standard TV rating rather than as malformed input. Source: <https://www.tvguidelines.org/> and <https://www.tvguidelines.org/aboutUs.html>
  - TMDB exposes a dedicated TV certifications list endpoint. That reinforces that TV certification vocabulary should be preserved as official domain data, not normalized away unless it is genuinely non-standard. Source: <https://developer.themoviedb.org/reference/certifications-tv-list>
  - The exact `scoreHistory()` and `scoreRules()` redesign choices above are an inference from this repo’s own documented semantics and the existing weighted-sum architecture, not a direct external standard. The external sources mainly support the parsing and rating-normalization parts of Step 4.

### Step 5: Regression Tests and Documentation

Files:

- `server/src/__tests__/services/policyCandidateRanker.test.js`
- `server/src/__tests__/policyEngine.scoringFunctions.test.js`
- `server/src/__tests__/policyEngine.presetSemantics.test.js`
- `server/src/__tests__/formulaEngine.test.js`
- `server/src/__tests__/confidenceCalculator.test.js`
- `server/src/__tests__/clarificationService.test.js`
- `server/src/__tests__/classificationRoutingService.test.js`
- `server/src/__tests__/ratingNormalizer.test.js`
- `server/src/__tests__/classification-auto-route-threshold.test.js`
- `CHANGELOG.md`

Changes:

- convert Step 5 from a generic “add tests” pass into a defect-to-test matrix
  - each confirmed defect from Steps 1–4 must map to at least one named, direct regression test
  - where a defect spans multiple consumers, pin it at both the pure-function level and the end-to-end decision boundary that actually matters
  - do not rely on broad integration tests to cover subtle numeric edge cases indirectly
- rewrite tests that currently codify incorrect behavior
  - [server/src/__tests__/confidenceCalculator.test.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/confidenceCalculator.test.js:224) currently expects “first encountered authoritative signal wins”
  - [server/src/__tests__/formulaEngine.test.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/formulaEngine.test.js:429) currently expects `scoreHistory()` to return `50` when no history exists
  - [server/src/__tests__/classificationRoutingService.test.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/classificationRoutingService.test.js:205) currently expects `"3.7"` to truncate to `3`
  - Step 5 should explicitly replace those expectations rather than only adding parallel tests that leave the bad behavior “acceptable”
- add targeted tests for Step 1 threshold/ranker fixes
  - invalid threshold normalization (`null`, `undefined`, non-numeric, inverted, >95)
  - exact top-score ties
  - near-tie conservative branching
  - normalized-threshold propagation into `clarificationService` tiering and auto-route behavior
  - equality behavior at the threshold boundary using raw scores, not rounded display scores
- add targeted tests for Step 2 confidence-calculator fixes
  - conflicting authoritative signals pointing to different libraries
  - multiple authoritative signals pointing to the same library
  - `CUSTOM_RULE` default weight contribution
  - persisted zero threshold and zero weight reload behavior
  - profile-score handling for `> 50`, `= 50`, and `< 50`
  - display rounding separated from branch logic
- add targeted tests for Step 3 policy-engine fixes
  - movie-vs-TV certification domain separation
  - keyword false-positive prevention for substring accidents
  - advisory-only missing metadata neutrality
  - numeric-range scorers preserving valid zeroes
  - explicit `media_type` preset semantics
  - denominator/neutral-weight behavior that preserves reachable score bands
- add targeted tests for Step 4 formula/routing/normalizer fixes
  - history-neutrality and insufficient-history behavior
  - non-degenerate rule corroboration scoring
  - strict whole-string integer parsing
  - season filtering without truncation
  - `TV-Y7-FV` runtime pass-through and SQL-filter preservation
- standardize the shape of the new tests
  - prefer small pure-function tests for edge-case math and parsing
  - add narrow orchestration tests only where a downstream branch can still diverge from the pure helper
  - keep mock setup in `beforeEach` / `afterEach` blocks, not in `describe` bodies
  - use `mockReset()` / `restoreAllMocks()` intentionally so one-off mock behavior does not bleed across cases
- document the behavior change in `CHANGELOG.md` as a user-facing bug-fix entry
  - keep the change under `## [Unreleased]`
  - categorize the scoring hardening under `### Fixed`, not only `### Changed`, because most of this work corrects incorrect classification behavior
  - summarize user-visible outcomes, not an internal file-by-file implementation log
  - mention threshold handling, authoritative-conflict handling, score-normalization fixes, and stricter routing/rating parsing in one curated entry or a small set of grouped entries

Acceptance criteria:

- every confirmed defect from Steps 1–4 has at least one direct regression test
- tests that currently assert buggy behavior are updated or removed, not left in place beside the new expectations
- threshold and scoring behavior is pinned by tests, not just by comments
- at least one targeted command can run the full math-scoring hardening suite without requiring the entire server suite
- `CHANGELOG.md` documents the bug-fix behavior in the existing `Unreleased` section using the repo’s current human-readable style

Implementation notes:

- Repo intent today is clear from both the tests and the changelog structure:
  - [CHANGELOG.md](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/CHANGELOG.md:8) already uses `## [Unreleased]` and grouped headings such as `### Changed` and `### Fixed`, so Step 5 should extend that format rather than invent a new release-note style.
  - [server/src/__tests__/confidenceCalculator.test.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/confidenceCalculator.test.js:224), [server/src/__tests__/formulaEngine.test.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/formulaEngine.test.js:429), and [server/src/__tests__/classificationRoutingService.test.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/classificationRoutingService.test.js:205) show that some existing tests currently preserve the exact bugs this plan is trying to remove.
  - [server/src/__tests__/classification-auto-route-threshold.test.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/classification-auto-route-threshold.test.js:52) already pins one important downstream threshold behavior, which makes it a good place to extend coverage for normalized threshold semantics instead of relying only on helper-level tests.
  - [server/src/__tests__/clarificationService.test.js](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/src/__tests__/clarificationService.test.js:194) already exercises threshold-tier logic directly, so Step 5 should tighten that suite instead of duplicating the same branch logic elsewhere.
- Current best-practice guidance supporting this step:
  - Jest’s setup/teardown guidance recommends putting setup and cleanup in `before*` / `after*` hooks rather than inside `describe` blocks, because Jest executes `describe` handlers before any tests run. That supports the existing repo preference for explicit mock lifecycle management in hooks. Source: <https://jestjs.io/docs/setup-teardown>
  - Jest’s mock function API documents `mockReset()` / `mockRestore()` as the right primitives when test cases need clean mock state and original implementations restored. That supports Step 5’s emphasis on preventing cross-test mock leakage in these regression suites. Source: <https://jestjs.io/docs/next/mock-function-api>
  - Jest’s manual mocks guidance recommends keeping manual mocks adjacent in `__mocks__` and, when useful, deriving from `jest.requireActual(...)` so mocks stay in sync with real modules. That is relevant for any new shared mocks introduced while expanding these suites. Source: <https://jestjs.io/docs/manual-mocks>
  - Jest CLI documentation confirms `--testPathPatterns=<regex>` as the correct focused runner flag and notes Windows path-separator caveats. That supports keeping a dedicated targeted command in the plan for the math-scoring hardening suite. Source: <https://jestjs.io/docs/cli>
  - Keep a Changelog defines changelogs as curated, human-readable summaries, recommends keeping an `Unreleased` section at the top, and groups changes by type such as `Changed` and `Fixed`. That matches the repo’s current format and supports logging this work as grouped bug-fix behavior rather than commit-by-commit implementation detail. Source: <https://keepachangelog.com/en/1.0.0/>

---

## 6. Test Plan

Goal:

- verify each math/scoring hardening change at the narrowest useful layer first, then confirm that the downstream classification actions still align with policy intent
- catch both logic regressions and accidental score-distribution shifts before the full server suite

Executed verification summary:

- Step 1 focused threshold/ranker coverage passed, and Docker-backed schema verification passed in `server/src/__tests__/integration/policy-schema.test.js`
- Step 2 focused confidence coverage passed in `server/src/__tests__/confidenceCalculator.test.js`
- Step 3 focused policy-engine coverage passed across `policyEngine.scoringFunctions.test.js`, `policyEngine.presetSemantics.test.js`, `policyEngine.combinationModes.test.js`, and `policyEngine.resultContract.test.js`
- Step 4 focused formula/routing/normalizer coverage passed across `formulaEngine.test.js`, `classificationRoutingService.test.js`, and `ratingNormalizer.test.js`
- combined Step 1-4 focused regression suite passed: 13 suites, 459 tests
- full server verification passed after Step 5 cleanup: 218 suites, 7,357 tests

Actual commands run:

- Step 4 focused suite:
  - `cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="formulaEngine.test.js|classificationRoutingService.test.js|ratingNormalizer.test.js" --no-coverage`
- combined hardening slice:
  - `cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="policyCandidateRanker.test.js|policyDecisionBuilder.test.js|clarificationService.test.js|classification-auto-route-threshold.test.js|policies-threshold-routes.test.js|confidenceCalculator.test.js|policyEngine.scoringFunctions.test.js|policyEngine.presetSemantics.test.js|policyEngine.combinationModes.test.js|policyEngine.resultContract.test.js|formulaEngine.test.js|classificationRoutingService.test.js|ratingNormalizer.test.js" --no-coverage`
- full server verification:
  - `npm --prefix server test`

Notable verification follow-up:

- `server/src/__tests__/policies-routes.coverage.test.js` exposed stale mock-state leakage and outdated update fixtures during the full-suite gate
- the suite now resets database mocks explicitly in `beforeEach` and includes current threshold fields in update fixtures, aligning the broad route coverage file with the hardened policy write-path contract

Verification layers:

- Layer 1: pure-function regression tests
  - fastest feedback for threshold normalization, score formulas, parsing, and normalization edge cases
  - these should fail immediately when arithmetic or coercion behavior drifts
- Layer 2: narrow orchestration tests
  - verifies that helper-level fixes still produce the intended action/tier at service boundaries such as `clarificationService` and auto-route branching
- Layer 3: full server suite
  - confirms no unrelated subsystem was depending on the old buggy behavior

Execution order:

1. run the targeted math-scoring hardening suite after each subsystem change
2. when a subsystem is complete, rerun the targeted suite plus the most relevant downstream orchestration test file
3. once all five implementation steps are complete, run the full server suite
4. if the targeted suite passes but score bands or actions still look suspicious, add or tighten fixture-based tests before merging

Primary commands:

- targeted regression suite:
  - `cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="policyCandidateRanker.test.js|policyDecisionBuilder.test.js|clarificationService.test.js|classification-auto-route-threshold.test.js|policies-threshold-routes.test.js|confidenceCalculator.test.js|policyEngine.scoringFunctions.test.js|policyEngine.presetSemantics.test.js|policyEngine.combinationModes.test.js|policyEngine.resultContract.test.js|formulaEngine.test.js|classificationRoutingService.test.js|ratingNormalizer.test.js" --no-coverage`
- full server verification:
  - `npm --prefix server test`

Recommended focused reruns while implementing:

- Step 1 threshold/ranker changes:
  - `cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="policyCandidateRanker.test.js|policyDecisionBuilder.test.js|clarificationService.test.js|classification-auto-route-threshold.test.js|policies-threshold-routes.test.js" --no-coverage`
- Step 2 confidence-calculator changes:
  - `cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="confidenceCalculator.test.js" --no-coverage`
- Step 3 policy-engine changes:
  - `cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="policyEngine.scoringFunctions.test.js|policyEngine.presetSemantics.test.js|policyEngine.combinationModes.test.js|policyEngine.resultContract.test.js" --no-coverage`
- Step 4 formula/routing/normalizer changes:
  - `cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="formulaEngine.test.js|classificationRoutingService.test.js|ratingNormalizer.test.js" --no-coverage`

Optional debugging commands:

- if a failure is order-sensitive or hard to reproduce:
  - `cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="<same patterns>" --no-coverage`
- if Jest hangs or appears to keep resources open:
  - `cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="<same patterns>" --no-coverage --detectOpenHandles`
- these debugging flags are not part of normal verification because they are slower and intended for diagnosis

Pass criteria by layer:

- targeted regression suite:
  - all updated regression tests pass
  - no remaining test asserts a known-bad behavior from Steps 1–4
- downstream orchestration checks:
  - threshold tiers, prompt/auto decisions, and normalization outputs match the updated helper semantics
- full server suite:
  - no unrelated suites fail because of hidden dependence on the prior buggy math

Recommended regression matrix additions:

- Step 1:
  - authoritative threshold ladder accepts only normalized numeric values
  - exact ties and near ties degrade conservatively
  - `null` thresholds do not coerce into `0`-like behavior
- Step 2:
  - authoritative cross-library conflicts no longer resolve by array order
  - `custom_rule` contributes by default
  - persisted `0` survives reload for weights and threshold
  - display rounding does not change `meetsThreshold`
- Step 3:
  - preset-only strong matches still reach documented decision bands after denominator correction
  - mixed-domain certification comparisons do not succeed through one shared ladder
  - advisory-only missing metadata returns neutral instead of hard-fail
  - zero-valued numeric comparisons remain valid numeric comparisons
- Step 4:
  - no-history formula results stay neutral in totals
  - additional matching rules can increase the score meaningfully
  - malformed integer-like strings are rejected, not truncated
  - `TV-Y7-FV` remains standard in runtime and SQL normalization checks

Failure triage expectations:

- if only pure-function tests fail:
  - fix the implementation or test expectation before running broader suites
- if pure-function tests pass but orchestration tests fail:
  - inspect normalization/rounding data flow between helper and caller
- if the targeted suite passes but the full server suite fails:
  - look for older tests that were implicitly relying on the incorrect behavior
  - update those tests only when the old behavior is demonstrably part of the bug being fixed

Implementation notes:

- Repo-specific execution guidance:
  - [docs/AGENTS.md](/c:/Users/Moreland/Repositories/Classifarr/Classifarr/docs/AGENTS.md:98) already recommends targeted Jest runs, and the repo wrapper at `server/scripts/run-jest.mjs` is the safest way to preserve the repo's Jest runtime wiring while still using plural `--testPathPatterns`.
  - the current Step 5 file list maps cleanly onto one targeted suite, so Step 6 should treat that suite as the required pre-merge gate for this work.
- Current best-practice guidance supporting this step:
  - Jest CLI documents `--testPathPatterns=<regex>` as the focused path filter and notes Windows path-separator behavior. That supports the repo’s targeted command shape. Source: <https://jestjs.io/docs/cli>
  - Jest CLI also documents `--runInBand` as a serial debugging mode and `--detectOpenHandles` as a diagnostic flag with significant performance cost. That supports keeping both as optional debugging tools rather than normal CI gates. Source: <https://jestjs.io/docs/cli>
  - Jest setup/teardown guidance reinforces that deterministic setup belongs in `before*` / `after*` hooks. That matters here because order-sensitive regression tests can otherwise produce false failures. Source: <https://jestjs.io/docs/setup-teardown>
  - Keep a Changelog’s guidance on human-readable `Unreleased` tracking complements this section because the final verification gate includes updating the curated bug-fix notes once the test plan passes. Source: <https://keepachangelog.com/en/1.0.0/>

---

## 7. Risk Management

Main risks:

- existing tests may be asserting current incorrect behavior
- denominator fixes will shift score distributions and may affect real-world thresholds
- stricter parsing may expose bad stored data or previously tolerated malformed inputs
- DB validation backstops may fail on pre-existing bad rows or take stronger locks than expected during rollout
- a broad “fix everything at once” merge can make it hard to tell whether a regression came from threshold handling, score normalization, or parsing changes

Required mitigations:

- implement fixes in small, isolated commits by subsystem
- add regression tests before or alongside each behavior change
- validate policy-engine score distribution with targeted fixture cases before merging
- review whether any seeded/default policy thresholds need adjustment after the denominator correction
- audit stored policy/config rows before enabling stricter validation paths
  - threshold rows that violate the new ladder
  - malformed numeric config values currently tolerated by permissive parsing
  - policy/preset shapes that rely on accidental zero-score or substring behavior
- stage schema protections carefully
  - if a DB constraint is added, validate existing data first or use a rollout path that minimizes lock impact
  - avoid discovering bad production rows only after the migration has started

Optional safety features to include in the design:

- optional rollout mode for decision-path changes
  - if score-distribution drift is larger than expected, introduce a temporary local rollout switch with stages such as:
    - `off`: old behavior remains authoritative
    - `shadow`: compute hardened results alongside current behavior, but do not change routing
    - `live`: hardened behavior becomes authoritative
  - this is optional because it adds implementation complexity; use it only if fixture validation and targeted tests suggest a meaningful rollout-risk gap
- optional shadow diagnostics payload
  - when rollout mode includes `shadow`, log old-vs-new top candidate, score, threshold band, and action for targeted comparisons
  - keep this diagnostic payload narrow and temporary so it does not become a second long-term contract
- optional operator-facing audit script or one-shot check
  - before enforcing threshold/parse constraints, provide a focused query or script that reports rows which will be normalized, rejected, or clamped
  - this is useful if current environments may contain legacy or hand-edited configuration data
- optional temporary warning telemetry
  - during the first live rollout window, emit structured warnings when normalization changes an invalid threshold, rejects malformed numeric config, or downgrades an authoritative conflict to a manual/conservative path
  - remove or downgrade this telemetry once the rollout is stable so normal logs do not become noisy
- optional threshold-adjustment review step
  - if denominator fixes materially lower or raise real-world scores, review seeded/default thresholds after the logic is stable instead of silently preserving values that were calibrated against buggy math
  - this review is optional only if score samples show negligible drift

Design boundaries for optional features:

- do not add an external feature-flag platform just for this work
  - if a rollout switch is needed, keep it local to existing config/settings patterns
- do not create permanent dual-logic code paths unless the rollout data proves they are necessary
  - optional rollout modes are temporary safety tools, not part of the target steady state
- do not add optional telemetry that exposes sensitive payloads or produces high-cardinality logs
  - log only the decision metadata needed to compare behavior safely

Rollout recommendations:

1. Start with the required regression suite and fixture review.
2. If the score/action deltas are small and explainable, ship directly without a rollout flag.
3. If deltas are significant or operator trust is likely to be affected, enable the optional `shadow` rollout path first.
4. Promote to `live` only after shadow comparisons show stable action parity or clearly justified action changes.
5. Remove any temporary rollout switch and extra diagnostics after the hardened logic is stable.

Failure-response plan:

- if threshold normalization exposes invalid stored data:
  - pause enforcement, correct the rows, then re-run the targeted suite and audit
- if score shifts break expected prompt/auto bands:
  - compare fixture outputs, review denominator assumptions, and only then decide whether thresholds need recalibration
- if stricter parsing blocks real operator workflows:
  - inspect the rejected inputs and decide whether the contract should explicitly allow that shape rather than silently truncating it
- if DB constraint rollout causes lock contention or migration delay:
  - back out of the migration step, validate data first, and reintroduce the constraint with a safer sequence

Implementation notes:

- Repo context makes staged rollout optional but reasonable:
  - this plan is primarily fixing correctness bugs, not introducing a net-new user feature, so a permanent feature-flag architecture would be disproportionate.
  - however, earlier repo plans already use staged concepts such as `shadow`, `live`, and rollout diagnostics when behavior changes could affect runtime decisions, so reusing that pattern locally is consistent if the score drift turns out to be material.
  - the strongest rollout-risk areas in this plan are exactly the ones that can silently alter operator trust: threshold normalization, denominator corrections, authoritative-conflict handling, and stricter parsing of previously tolerated inputs.
- Current best-practice guidance supporting this section:
  - LaunchDarkly’s migration guidance recommends staged transitions such as `off`, `dualwrite`, `shadow`, `live`, `rampdown`, and `complete`, with incremental movement and easy rollback. This supports the optional local `off` / `shadow` / `live` design here when behavior drift is uncertain. Source: <https://launchdarkly.com/docs/guides/flags/migrations>
  - Google’s SRE guidance on canarying emphasizes gradual rollout, automated comparison, and rollback-friendly release processes. That supports using a small-scope or shadow-style rollout when classification decisions may materially change. Source: <https://sre.google/workbook/canarying-releases/>
  - PostgreSQL documents that many `ALTER TABLE ... ADD CONSTRAINT` operations require stronger locks, while `NOT VALID` plus `VALIDATE CONSTRAINT` can reduce impact for certain constraint types, and `VALIDATE CONSTRAINT` uses a lighter lock mode. That supports treating DB enforcement as a staged migration concern rather than a casual follow-up step. Source: <https://www.postgresql.org/docs/12/sql-altertable.html>
  - PostgreSQL also documents `lock_timeout` as the control for aborting statements that wait too long on locks. That supports using session-scoped lock-timeout discipline during rollout-sensitive migrations instead of discovering blocking behavior only after deploy. Source: <https://www.postgresql.org/docs/current/runtime-config-client.html>
  - Statsig’s feature-gate guidance highlights gradual rollouts and top-level gates that can disable dependent behavior quickly. Even though this plan should not add an external flag service, the underlying operational principle supports keeping any optional rollout switch centralized and easy to disable. Source: <https://doc.statsig.com/feature-flags/overview/>

---

## 8. Recommended Delivery Order

1. Threshold/ranker safety
2. Confidence calculator fixes
3. Policy-engine denominator and numeric-range fixes
4. Formula-engine neutral-score fixes
5. Routing/parser and rating-normalizer cleanup
6. Full targeted test pass
7. Changelog update

This order removes the highest-risk misclassification paths first, then tightens the lower-level scoring math underneath them.
