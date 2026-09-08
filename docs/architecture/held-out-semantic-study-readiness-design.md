# Held-out Semantic Study Readiness Design

Status: implemented on 2026-09-08. Research checked against the linked primary
sources on 2026-09-08.

## Problem

The lifecycle re-audit correctly stops before a private candidate scan when a
normal lifecycle receipt or complete declared-purpose evidence is absent. Its
`null` result is deliberately minimal for scheduler safety, so a person or a
future automation consumer had to inspect several diagnostics to learn which
prerequisite was missing.

The platform needs a passive, library- and configuration-agnostic answer to:
“may the existing private eligibility audit run after the next lifecycle
change?” The answer must not turn profile observations into declared purpose,
create historical evidence, select media, start a cohort, collect labels, call
AI, mutate policy, or route media.

## Decision

Add a small ESM contract and read-only service that compose the existing two
aggregate sources:

1. verified normal lifecycle receipt count; and
2. complete current policy-purpose evidence count.

The result is versioned and has exactly four states:

| Status | Meaning |
| --- | --- |
| `normal_lifecycle_receipt_required` | No normal lifecycle receipt exists. |
| `complete_declared_purpose_evidence_required` | Lifecycle history exists but no current policy has complete retained purpose and lifecycle provenance. |
| `eligibility_audit_available` | Both prerequisites exist; only the *existing* private eligibility audit may run on a source change. |
| `held_out_semantic_study_readiness_unavailable` | Either aggregate source cannot be safely read. |

The service exposes only two counts, its status, and a Boolean indicating that
the re-audit prerequisite is satisfied. It validates the projection before
returning it and fails closed to the unavailable state. It uses no user input
and makes no write.

An administrator-only endpoint,
`GET /api/policies/native-intent-reconciliation/held-out-study-readiness`,
serves that contract. It is parameter-free, rate-limited, `Cache-Control:
no-store`, and returns no policy, library, intent, receipt, rule, provider,
configuration, or media identity. The reconciliation page loads a passive
status panel with `role="status"` and `aria-atomic="true"`; it does not move
focus or interrupt work. Authorization runs before the per-IP limiter, so an
unauthorized caller cannot consume the administrator view's quota.

```text
normal lifecycle aggregate ─┐
                            ├─> closed readiness projection ─> status only
complete-purpose aggregate ─┘
                                                        │
                  only both positive ──────────────────┘─> existing audit on change
```

## Research basis

W3C Data on the Web Best Practices recommends metadata, provenance, data
quality, and explanations for unavailable data so data can be understood and
reused by people and software. The fixed status makes a missing prerequisite
machine-readable without exporting its private source records. [W3C Data on
the Web Best Practices](https://www.w3.org/TR/dwbp/)

W3C PROV-DM distinguishes entities and activities from their derived products.
The report derives a narrow availability observation from durable lifecycle and
purpose evidence; it does not describe either source as semantic truth. [W3C
PROV-DM](https://www.w3.org/TR/prov-dm/)

NIST AI RMF Measure calls for documented, repeatable evaluation methods and
independent assessment. This report describes only the audit prerequisite, so
it cannot be mistaken for a representative cohort, independent label, or
measured error result. [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

OWASP recommends minimizing API responses, using authorization for management
endpoints, and preventing sensitive browser responses from being stored. The
endpoint is administrator-only, count-only, rate-limited, and no-store.
[OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)

W3C WCAG 2.2 requires programmatically determinable status messages that do
not take focus. The UI uses a polite status region with an atomic announcement
rather than an alert. [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep the scheduler’s `null` result as the only signal | Smallest runtime surface. | Makes passive automation and diagnosis depend on manual correlation. | Reject |
| Return policy, library, or rule rows | Easier manual explanation. | Leaks operational context and encourages manual candidate selection. | Reject |
| Treat profile observations as declared purpose | May show readiness sooner. | Corrupts provenance and bypasses the policy-only study boundary. | Reject |
| Add a count-only, closed readiness report | Reuses canonical evidence, explains deferral automatically, and is safe for future automation. | Adds two aggregate reads when the report is viewed. | Adopt |

## Recommendation stack

1. Read the aggregate readiness report to explain deferment without an
   operator inspecting policy or library configuration.
2. Keep lifecycle receipts and retained declared-purpose provenance as separate
   durable facts; do not backfill or infer either from library profiles.
3. Run the existing private eligibility audit only after both prerequisites are
   positive and its source changes.
4. If that audit produces a balanced real 24–32-case cohort, collect two
   independent labels and adjudicate disagreements, then run readiness and the
   frozen-study preflight.
5. Add semantic counter-evidence only when its measured error profile passes;
   send ambiguous media to review and never automatic routing.

## Non-goals

This change does not expose operational configuration, create a policy purpose,
record a lifecycle receipt, invoke the private eligibility audit, capture a
cohort, label media, call a provider, execute semantic retrieval, alter policy,
or route media.
