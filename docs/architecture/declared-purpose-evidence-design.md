# Declared-purpose evidence design

Date: 2026-10-28. Status: agreed Q1/Q2 scope implemented. Validation is recorded
in the separate [outcome](declared-purpose-evidence-outcome.md).
Follows the [policy evaluation capture outcome](prospective-policy-intent-capture-outcome.md).

## Problem and agreed meaning

An operator declaration, a purpose-rule match, native storage and runtime
admission are separate facts. The previous card could describe eligibility plus
a positive purpose-rule count as declared support without retaining provenance
or an actual declared-subset match.

The live specialization producer already filters matched terms to declared
rules. Inferred-only native purposes normally receive contextual specialization
before the fallback is reached. The UI still called that context declared policy.
This establishes an explanation gap, not the cause of a specific historical
classification's wrong library.

The agreed presentation-first batch adds a closed server-derived diagnostic and
v2 cards. It keeps five source rows, shows inferred/mixed/unknown origins, and
isolates the legacy v1 statistical producer. Scores, ranking, thresholds, routing
and learning authority remain unchanged. No database/capture version, endpoint,
job, provider call or private-CLI cohort change is included.

Declared support requires validated active native authority and a native contract
with matching policy/library IDs; a declared-subset match using the existing
combination mode and greater-than-50 boundary; runtime eligibility; positive
specialized evidence subject to existing conflicts; and a classifier-owned
retained source bound to the same typed item and candidate.

A mixed policy can have a matched declared subset without turning inferred rules
into declarations. Blocked, unknown and unevaluated paths cannot imply a positive
match. Historical proof is never inferred from current configuration.

## Producer and trust boundary

`policyPurposeMatchEvidence.mjs` freezes `policy.purpose_match_evidence.v1`
synchronously in native evaluation before asynchronous supporting scorers. It
reuses provenance reduction and the existing rule scorer. The evaluator's private
required-rule set includes unverified non-inferred rules and is not the declared
subset.

The diagnostic contains version, typed item identity, policy/library IDs, origin,
declared-match state, eligibility and specialization state. A private WeakMap
receipt binds a minted object to its loaded authority/contract fingerprint.
Specialization can refine it only while contract and identity agree; copied
objects or intervening contract changes leave a gap. No fingerprint, raw rule,
name, prompt or contract becomes a public field.

Existing candidate diagnostics carry the proof through specialization and
classification persistence. Matching, numeric scores and admission are unchanged.
Provider prompt formatters select their fields explicitly; the new diagnostic
does not become prompt text.

The reader checks the actual History method, server-owned pre-routing candidate
capture marker and final `classification_details.ranked_candidates`, including
typed item/candidate binding and the existing five-candidate bound. It does not
trust an older `metadata.policyResult` copy. Classifier intake/retries select
metadata fields and drop supplied diagnostics. Manual/imported writers preserve
some arbitrary metadata but overwrite their method/capture origin, which the
reader rejects. Shape and matching IDs alone do not authenticate a producer.

This is a presentation diagnostic in existing metadata, not a new immutable
assessment or independently authenticated backup artifact.

## Versions and presentation

| Consumer | Implemented boundary |
| --- | --- |
| Pending decision/library comparison | v2 cards with fixed public purpose categories |
| Client normalization | Explicit v1/v2 acceptance; actual version preserved; every path validated |
| Correction snapshots/attribution | Named legacy v1 producer and version; original heuristic states |
| Statistics/calibration/representative review | Existing v1 meanings and queries unchanged |
| Private prospective/disagreement cohorts | Eligibility, labels and denominators unchanged |

Small services separate shared five-source mechanics, the legacy heuristic and
current verified purpose interpretation. Contextual purpose alone cannot yield
a corroborated current card; existing conflicts retain priority. Public purpose
fields contain only version, origin, match, eligibility and specialization.
Malformed v2 supplements fail closed. Older cards display Legacy policy context,
without a verified-origin upgrade. Immutable policy capture v1 lacks declared
subset match proof and cannot backfill that missing fact.

Adjacent decision facts reflect verified origin. Numeric labels say Policy
purpose or Policy signals; wire identifiers, values, weights and reconstruction
remain unchanged. Existing semantic disclosures and captioned tables remain.
Visible origin/conflict text carries uncertainty independently of color. No new
async interaction requires focus changes or a live region.

## Alternatives, pros and cons

| Approach | Pros | Cons / risk | Decision |
| --- | --- | --- | --- |
| Provenance plus declared-subset match | Separates origin, match and admission | Needs bound diagnostics and propagation checks | Implemented |
| Eligibility and rule count | Already available | Cannot prove declaration or match | Replaced for current cards |
| Reject all mixed purposes | Simple | Loses valid declared-subset matches | Rejected |
| Trust older specialization flags | More apparent coverage | Missing retained origin/binding | Rejected |
| Presentation first; legacy statistics isolated | Correct explanations; stable historical metrics | Retains legacy code until separate cutover | Implemented first batch |
| New statistical versions now | Verified measurement semantics | Needs admission, retention and denominator decisions | Follow-up |
| Rewrite v1 meanings/current-policy backfill | Less migration effort | Relabels history and hides missing proof | Rejected |
| Rename labels only | Small visible change | Leaves underlying heuristic intact | Insufficient alone |

Final recommendation stack: validated native contract → declared-subset match
and separate provenance → bound live diagnostic → classifier-origin validation
→ v2 current card → strict version-preserving client → visible origin/conflict
text. Keep legacy statistics explicit until prospective measurement is versioned.

## Official research checked October 28, 2026

URLs were discovered or revalidated through MCP. These applications are
engineering inferences, not certification or conformance claims.

- [W3C PROV-DM](https://www.w3.org/TR/2013/REC-prov-dm-20130430/)
  distinguishes origin/attribution from producing activities and derivation.
  A rule's source does not establish its successful evaluation against an item.
- [W3C headings and labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels)
  supports accurate visible labels; inferred context should not assert declaration.
- [W3C use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
  supports text beyond color. Preserve origin/conflict descriptions and semantics.
- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)
  supports contextual explanations and documented measurement limitations. New
  verified evidence must remain distinguishable from old heuristic buckets.
- [OWASP property-level authorization guidance](https://github.com/OWASP/API-Security/blob/master/editions/2023/en/0xa3-broken-object-property-level-authorization.md)
  supports deliberate field projection and response schema validation. Do not
  expose whole contracts or accept diagnostic-looking client fields as proof.

## Verification and delivery

Test all origins/combination modes, mixed declared mismatch, hard-limit outcomes,
specialized restrictions, contract/identity drift, forged non-classifier metadata,
legacy gaps and strict client versions. Compare native numeric/admission and
specialization outputs against main; compare legacy card/snapshot outputs exactly.
Verify database reads do not rewrite metadata. Run coverage, types, lint,
ownership and repository gates before committing/pushing main. No release.
