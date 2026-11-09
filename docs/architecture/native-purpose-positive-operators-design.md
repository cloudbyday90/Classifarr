# Native purpose positive-operator compatibility design

Date: 2026-11-09 Eastern. Status: agreed; implementation and verification are
recorded in the separate outcome.
Baseline: b41b019a9 on main. No release or deployment.

## Problem and intended result

The next category-agnostic correction should make existing positive purpose
choices execute the meaning the operator selected. Today the authoring contract
accepts every combination of four purpose signals and five operators, while the
native scorer delegates raw values to a narrower legacy preset scorer. A valid
keyword require_all declaration can match every term and still contribute zero.
Changing destination names cannot repair this mismatch.

This first batch proposes consistent positive operators for canonical declared
native purpose rules. It does not standardize every legacy operator or repair
historical classifications. Keep stable item/policy/library identity, declared
versus observed provenance, and independent routing/learning authorization.

## Current evidence and design tree

Read-only repository inspection and provider-free calls to the real normalizers
and scorer establish the following. Numbers describe a fully matching item under
explicit identity semantics, before the existing runtime confidence cap.

| Signal | require_any | require_all | include | prefer | exclude |
| --- | --- | --- | --- | --- | --- |
| Genres | 80 | 100 | 50 regardless of match | 80 | 0 on excluded match; otherwise 50 |
| Keywords | 80 | 0 despite complete match | 50 regardless of match | 80 | 0 on excluded match; otherwise 50 |
| Studios | 80 | 0 despite complete match | 50 regardless of match | 80 | 50 regardless of match |
| Media type | 0 on known data | 0 on known data | 100 | 0 on known data | 0 on known data |

Preference partial matches score 65 for one of two terms in the supported list
scorers. Identity preferences with no match/missing data score zero; compatibility
preferences retain neutral 50. Missing media type has separate existing neutral
behavior. Exclusion never establishes affirmative purpose, but its zero/50
behavior participates in average/weighted/require-all combination modes. Changing
those negatives is therefore a separate behavioral decision.

Decision tree:

1. Preserve the existing meaning of accepted positive choices: recommend fixing
   native execution, rather than removing choices or introducing category forms.
2. Limit new interpretation to canonical declared purpose rules: recommend
   retaining observed, unverified and compound legacy behavior.
3. Share positive interpretation with downstream evidence: numeric scoring alone
   is insufficient because include is also missing from native evidence and
   overlap/specialization term extraction.
4. Preserve negative/other-role behavior and exact replay: recommend no validator
   tightening, new veto or historical rewrite in this batch.
5. Verify the whole current path, then commit/push on main without publication.

## Agreed implementation boundary

Add a small native-purpose semantics leaf, used by the existing native scoring
leaf and relevant native evidence readers. Recognize the four purpose signal
types and require_any, require_all, include and prefer only when the rule has
known declared provenance, explicit identity/compatibility semantics and one
bounded string-list value corresponding to its operator. Preserve an optional
valid existing positive finite weight through the existing combination math.
Use the current purpose-command term/count limits; add no unbounded traversal.

Do not reinterpret a combined values object, operator/value mismatch, unsupported
shape, missing semantics or unknown origin as new proof. Those records retain
their existing execution. Keep the structural schema, stored draft readers,
normalization/fingerprints and receipt lookup order unchanged. The shared update
normalizer is used before receipt recovery and for old editable drafts; tightening
it globally would break compatibility. Initial establishment also validates
before receipt lookup and has a broader stored-values contract.

Use existing matching behavior: normalized exact genre membership; the existing
keyword matcher over keyword metadata and whole terms in title/overview; existing
studio-name matching including production-company fallback; exact normalized
media-type membership. No destination names, category vocabulary or new provider
calls enter this interpretation.

| Positive operator | Proposed meaning and scalar score |
| --- | --- |
| require_all | Every configured term matches: 100; otherwise 0 |
| require_any | At least one configured term matches: 80; otherwise 0 |
| include | Required-any membership: 80 for content lists; retain media-type include's existing 100 and missing-data behavior |
| prefer | Retain 50 + 30 times matched fraction, including existing identity-zero versus compatibility-neutral behavior when nothing matches |

The existing average, weighted_average, best_match and require_all combination
math, per-rule weights and confidence cap remain. Already supported positive
pairs must keep their actual scores, not just their eligible/not-eligible state.
Newly working pairs can change eligibility, scores, ordering and threshold bands.

Apply this only to declared native purpose evaluation. Helpful hints, hard limits,
avoid rules, inferred profile scope and legacy presets keep their existing paths.
An exclude purpose is not converted into a hard limit, and strict on a purpose
rule does not acquire new hard-limit authority. Keep every current route, learning,
ambiguity, calibration and threshold-authorization safeguard.

## Shared evidence and explanation

Use the same native interpretation for runtime purpose matching, the bound
declared contribution, declared-match diagnostics and native required-term
comparison/preflight. Do not globally change hasAffirmativeSignalConstraints or
the legacy preset scorer merely to make include work.

Required include terms should participate with require_any/require_all in native
content-bearing specialization and overlap checks. A preference remains contextual;
media scope and compatibility semantics do not become specialized identity.
Keep existing cross-candidate comparison and private live binding checks. The
existing numeric explanation should continue to reflect actual contributions;
no new evidence category, API field, capture version or historical reinterpretation
is proposed. No new UI controls, jobs, settings or operator CLI process are needed.

## Verification and delivery

Before implementation, freeze failing controls for all eight currently missing
positive pairs. Exercise all sixteen positive pairs with full, partial, mismatched
and missing metadata; test actual supported numeric results under both semantics.
Use real normalizers and native authority projection, not a second test scorer.

Verify unchanged exclusion behavior and all four combination modes, weights,
unbound/unverified and compound legacy records, inferred admission and other roles.
Verify include's actual bound contribution, declared match, overlap and specialized
comparison against a competing destination; media and preference must not gain
specialized proof. Include nondefault review settings and renamed destinations.

Use the production-factory disposable PostgreSQL suites to verify stored canonical
rules load and execute through the real policy evaluator; include a competing
destination and threshold boundaries. Confirm existing exact receipt recovery and
authoring/read contracts continue to work without changing their validators.
Run focused tests, fresh full backend coverage, ownership and normal quality gates.
Reuse complete client evidence only after its source, installed graph and report
hashes remain equal; run relevant current client controls. Keep tests provider-free.

Document observed outcomes separately, update Unreleased, perform scoped artifact
maintenance, and commit/push all agreed changes on main. No schema, endpoint, UI,
CLI trigger, job, provider call, live configuration write, release or deployment.

## Official research and application

Sources were discovered and opened through connected MCP services on November 9,
2026. The scoring values above are application design choices, not requirements
specified by these standards.

- [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  distinguishes syntax from operation-specific meaning and separates validation
  from authorization. Here accepted canonical rule choices need coherent execution;
  replay-sensitive validation changes need their own compatibility plan.
- [W3C labels and instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions)
  and [error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
  inform future authoring controls: show meaningful options and textual errors
  in existing surfaces. These references do not justify adding UI in this batch.
- [W3C PROV-O](https://www.w3.org/TR/prov-o/) models derivation separately from an
  entity. Applied here, an observed profile or a native storage location does
  not become a declaration because a scorer understands its syntax. No RDF
  infrastructure is proposed.

## Alternatives and recommendation stack

| Option | Advantage | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Fix only the advanced dropdown | Small visible change | Other writers still accept the same shapes; old drafts/replay need care | Insufficient alone |
| Tighten all shared validators now | Prevents unsupported new commands | Can hide stored drafts and break exact committed receipt recovery | Separate compatibility batch |
| Extend the global legacy scorer | Fewer dispatch points | Changes presets, observations and other rule roles | Reject for this batch |
| Shared canonical declared-positive interpretation | Repairs accepted choices and evidence consistently across all categories | Changes scores for repaired pairs; compound/negative behavior remains | First batch |
| Standardize every negative/compound rule too | Wider consistency | Changes combination eligibility and needs migration/replay design | Follow-up |

1. Repair canonical declared-positive purpose interpretation with shared evidence.
2. Design replay-safe new-authoring capability checks and explicit negative/compound
   semantics without hiding or silently rewriting stored drafts.
3. Replace category/name-specific AI prompt assumptions through the common purpose
   and constraint contract.
4. Improve intentional review of individual/bulk drafts through existing surfaces.
5. Measure calibration and remaining correlation using frozen prospective evidence.
