# Held-out semantic policy source-screen design

Status: implemented, unreleased. Research checked 8 September 2026 against
the linked primary sources.

## Problem

The full private eligibility audit found no policy-only candidate comparison.
The existing aggregate result did not explain whether there were no policy
purpose rules, whether the restricted study boundary had excluded them, or
whether retained rules had failed against canonical metadata. That distinction
matters: existing library contents are useful observed evidence, but they must
not select the cases used to measure semantic counter-evidence.

The preparation predicate was also broader than its documented boundary. It
removed any `inferred` rule, even when the rule had the
`operator_declared_intent` source. Native intent contracts use `inferred` as a
contract lifecycle state for both profile-derived and operator-declared rules.

## Decision

Add `heldOutSemanticStudyPolicySourceScreen.mjs`, a small pure ESM service that
does two things:

1. Exclude a rule only when its provenance is both
   `media_server_library_profile` and `inferred`.
2. Return an aggregate source-screen receipt: active-policy count, observed and retained purpose-rule counts, inferred-profile exclusions, policies with a
   retained purpose rule, and one fixed status ID.

`createHeldOutSemanticStudyPreparation()` now produces this receipt alongside
the already filtered in-memory policies. The eligibility audit includes it in
its v4 aggregate summary and configuration-drift fingerprint. It contains no
policy or library identity, rule value, title, TMDb ID, metadata, model output,
or routing result.

```text
active native rules
  -> source and inference-state boundary
  -> inferred profile rules excluded from study selection
  -> operator-declared inferred rules retained
  -> fixed aggregate source-screen receipt
  -> existing restricted evaluator and held-out eligibility audit
```

This corrects the boundary for future explicitly declared policies. It does not
make inferred profile rules study eligibility evidence and does not change the
current profile-only audit result.

## Research basis

NIST's AI RMF Measure function calls for documented test sets, tools, metrics,
conditions, and independent review where appropriate. A visible source boundary
documents why the current study population is unavailable without allowing
observed library contents to select an evaluation cohort. [NIST AI RMF
Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

W3C Data on the Web Best Practices recommends recording data provenance,
quality, and explanations for unavailable data. The fixed receipt exposes the
availability limitation while retaining no raw configuration or inventory.
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

OWASP's Secure AI Model Ops guidance favors clear trust boundaries and
controlled promotion between evaluation and production contexts. Keeping
observed profile evidence out of held-out selection preserves that separation;
the receipt is diagnostic evidence only. [OWASP Secure AI Model
Ops](https://cheatsheetseries.owasp.org/cheatsheets/Secure_AI_Model_Ops_Cheat_Sheet.html)

The existing private command sets PostgreSQL read-only defaults before loading
the application. PostgreSQL documents that a read-only transaction disallows
data-modifying statements, which provides a database-enforced backstop to the
command's no-write design. [PostgreSQL SET
TRANSACTION](https://www.postgresql.org/docs/18/sql-set-transaction.html)

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Include profile-derived rules in the held-out screen | May produce candidate comparisons immediately. | Lets existing placements select the measurement cohort and creates circular evidence. | Reject |
| Exclude every inferred rule | Simple predicate. | Incorrectly drops operator-declared purpose rules with the same lifecycle state. | Reject |
| Separate provenance-and-state predicate with aggregate receipt | Preserves the study boundary, fixes the declared-rule bug, and explains availability without disclosing configuration. | A profile-only policy remains ineligible until separately governed policy work. | Adopt |
| Lower policy thresholds or use semantic retrieval to find cases | Could create a cohort quickly. | Changes the system being measured or lets semantic evidence select the sample. | Reject |

## Recommendation stack

1. Preserve the provenance-and-state predicate: only inferred profile rules are
   excluded from held-out selection.
2. Run the private eligibility audit and retain only its fixed aggregate source
   screen and decision counts.
3. When the receipt reports no retained purpose rules, use the existing policy
   governance to author explicit, source-distinct purpose rules; do not infer
   them from library membership or lower thresholds.
4. Rerun the audit after an approved policy revision. Capture a cohort only
   when every stratum has the required policy-only comparisons.
5. Keep independent labels, readiness, frozen-study preflight, and any later
   review-only semantic counter-evidence gate separate from policy authoring.

## Non-goals

- No HTTP endpoint, UI, database write, policy edit, provider call, semantic
  retrieval, label collection, classification, or automatic routing is added.
- The receipt does not prove a policy is semantically correct or measure the
  accuracy of the library's existing placement.
- This work does not authorize semantic counter-evidence or change the existing
  requirement that ambiguous items go to review rather than automatic routing.
