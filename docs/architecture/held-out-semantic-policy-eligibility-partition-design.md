# Held-out semantic policy eligibility partition design

Status: implemented, unreleased. Research checked against the linked primary
sources on 8 September 2026.

## Problem

The private audit previously retained dynamic contract-status and decision
counts. They were sufficient to establish that no case qualified, but a
consumer had to combine several overlapping source-screen counters with a
status count to explain the result. In particular, a zero-comparison result
could be mistaken for an inventory-quality problem, a missing identity, or a
semantic failure.

The explanation must stay library- and configuration-agnostic. It must not
retain a candidate, policy, library, title, TMDb identity, rule value, model
output, or semantic evidence, and it must not advance any held-out study gate.

## Decision

The audit now has two complementary, count-only partitions.

`heldOutSemanticStudyPolicySourceDisposition.mjs` classifies every active
policy into exactly one source disposition:

| Disposition | Meaning |
| --- | --- |
| `no_observed_purpose` | The policy has no observed purpose rule. |
| `profile_only_purpose` | Every observed purpose rule is inferred from a media-server library profile. |
| `retained_declared_purpose` | At least one rule was recorded by a native-intent server command. |
| `unverified_purpose_source` | Observed rules have no recognized native or profile provenance. |

The v3 `policySourceScreen.policyPurposeDispositionCounts` sum to the active
policy count. Existing convenience counts remain, but the partition is the
unambiguous source-quality explanation.

`heldOutSemanticStudyComparisonEligibilityPartition.mjs` then places every
candidate assessment in one fixed, mutually exclusive outcome:

| Outcome | Meaning |
| --- | --- |
| `ready_comparison` | A valid broad-policy comparison is available. |
| `not_pending_policy_decision` | Restricted broad-policy evaluation did not produce a pending comparison. |
| `insufficient_policy_candidates` | A pending decision had fewer than two valid competing policy candidates. |
| `identity_unverified` | A pending decision lacked a usable canonical identity. |
| `invalid_contract` | The assessment failed its closed contract invariant. |

The v1 partition’s counts sum to `candidateCount`; its ready count must equal
the sum of `eligibleCountByStratum`. Any mismatch fails the audit closed. It
records no per-case receipt and does not assert that a cohort is possible: the
existing stratum and 24–32 case requirements remain authoritative.

The enclosing receipt advances to
`policy.held_out_semantic_study_eligibility_audit.v5`. The lifecycle re-audit
recognizes only the current version as a completed receipt. An older receipt
is refreshed only when the existing lifecycle and current-purpose gates are
already positive. It does not bypass the source gate, create a cohort, label
media, or call an AI service.

```text
active policy purpose rules -> source disposition partition -> v5 audit receipt
canonical policy-only candidates -> comparison result partition -> stop when zero ready
```

## Security and authority boundary

- Both modules are pure ES modules with fixed identifiers and bounded integer
  counts. They have no I/O, logging, HTTP route, provider call, or write.
- The audit validates partition totals before returning a result and fails
  closed on malformed assessment data or configuration drift.
- Profile-derived library evidence remains descriptive. It cannot become
  declared policy authority, select a study case, produce a label, alter a
  policy, or route a media item.
- The private, read-only command remains the only way to run the full
  population audit. Its result is aggregate-only.

## Research basis

W3C Data on the Web Best Practices calls for machine-processable metadata,
provenance, quality information, and an explanation for unavailable data. The
versioned, fixed partitions let a consumer distinguish unavailable policy-only
comparisons without exporting the underlying inventory or configuration.
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

NIST AI RMF Measure calls for documented, repeatable evaluation methods, test
sets, metrics, and independent assessment. The partitions describe availability
and limitations only; they do not replace the required independently labelled
cohort or turn a policy-only observation into a semantic performance claim.
[NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

OWASP's REST guidance calls for per-endpoint authorization and constrained
resource operations. No endpoint is added here; keeping the existing audit
private and the output aggregate-only avoids a new operational surface while
preserving its existing access boundary.
[OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep dynamic counts only | No contract change | Consumers must infer why zero cases were eligible from overlapping signals | Reject |
| Return policy or candidate rows | Gives a direct manual explanation | Exposes operational data and encourages hand-picked cohorts | Reject |
| Treat profile-derived purpose as declared purpose | Could create comparisons sooner | Makes observed placements circular study authority | Reject |
| Add fixed source and comparison partitions | Machine-readable, privacy bounded, deterministic, and usable by future automation | Adds two small pure contracts and receipt-version refresh handling | Adopt |

## Recommendation stack

1. Use the v5 aggregate partitions to explain a zero-comparison receipt
   without operational inspection.
2. Keep profile-only purpose as observed evidence; do not convert it to
   declared policy authority or lower thresholds to manufacture a cohort.
3. After a separately governed native-purpose revision, rerun the private
   audit and capture a cohort only if every stratum can satisfy the existing
   24–32-case planner.
4. Obtain two independent blinded labels and adjudicate disagreements, then
   run the existing readiness and frozen-study preflight.
5. Consider semantic counter-evidence only after a good measured error
   profile. Any ambiguous item must be referred to review, never routed
   automatically.

## Non-goals

This change does not add an endpoint, UI action, policy authoring workflow,
cohort capture, labels, semantic retrieval, provider use, policy mutation,
automatic routing, or release.
