# Held-out Semantic Lifecycle Re-audit Cadence Design

Status: implemented on 2026-09-08. Research checked against the linked primary
sources on 2026-09-08.

## Problem

The platform already records normal lifecycle evidence atomically when a policy
is established, its native intent changes, or a verified rebuild replacement is
applied. The existing aggregate re-audit then discovers a changed source on a
15-minute cron interval. The browser’s passive readiness status refreshes every
five visible-page minutes, so a person or future automation consumer could see
that the prerequisites are available while the normal re-audit cadence had
another ten minutes to wait.

The delay does not cause an authority error, but it unnecessarily slows the
automatic, evidence-only path. It must not turn a policy write into a study
operation, manufacture legacy receipt history, reveal a policy or library, or
advance beyond the existing private audit.

## Decision

Change the existing `held-out-semantic-study-lifecycle-reaudit` schedule from
every 15 minutes to every 5 minutes. The task still calls the existing modular
re-audit service, whose first operation is a fixed aggregate source read. It
only invokes the private eligibility audit when both source prerequisites exist
and the aggregate SHA-256 fingerprint changed, or when a prior failure remains
within its three-attempt retry budget.

The delayed startup check remains 90 seconds. The existing in-process
`noOverlap` option and database advisory lock remain in force across instances.

```text
ordinary authoring commits a durable receipt
                    │
                    ▼
five-minute aggregate source check ── unchanged ──> no audit
                    │ changed and complete
                    ▼
existing private eligibility audit ──> existing aggregate receipt
```

## Security and authority boundaries

- The cron task has no browser route and accepts no user, library, policy,
  configuration, media, provider, prompt, or model input.
- It reads fixed aggregates before any audit; unchanged or incomplete source
  state does not run the candidate population query.
- It keeps the existing per-process no-overlap guard, cross-instance advisory
  lock, source fingerprint, and bounded failure retries.
- It neither creates a lifecycle receipt nor backfills a legacy record. Only
  ordinary authoring may create provenance.
- It cannot capture a cohort, collect labels, call AI, perform semantic
  selection, mutate policy, or route media.

## Research basis

W3C Data on the Web Best Practices calls for provenance and explanations that
let people and software understand data quality. The source fingerprint remains
the explanation for why a private audit can run, while its shorter check period
does not change the underlying provenance. [W3C Data on the Web Best
Practices](https://www.w3.org/TR/dwbp/)

The W3C PROV family distinguishes activities and their derived products. The
cadence change keeps authoring, aggregate observation, and the derived audit
receipt as separate activities rather than making an authoring transaction run
study work. [W3C PROV Overview](https://www.w3.org/TR/prov-overview/)

NIST AI RMF Measure supports documented, repeatable monitoring and independent
assessment. A bounded recurring check observes source availability; it does not
claim that a cohort, independent labels, or an error measurement exists.
[NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

OWASP advises keeping REST access decisions local and restricting methods. No
new network surface or mutation is added; the existing administrative status
endpoint and its controls stay unchanged. [OWASP REST Security Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep the 15-minute schedule | Lowest aggregate-read rate. | Leaves up to 15 minutes of avoidable automatic delay. | Reject |
| Run the audit inside each authoring transaction | Fastest result. | Couples three authoring paths to private study work and extends transaction risk. | Reject |
| Add a mutable browser or administrator trigger | Immediate control. | Reintroduces operator work and expands authority. | Reject |
| Recheck the existing aggregate gate every five minutes | Bounded autonomous response, no new input or authority. | Up to three extra lightweight checks per 15 minutes. | Adopt |

## Recommendation stack

1. Use the five-minute aggregate source check with the existing fingerprint and
   lock protections.
2. Keep ordinary authoring as the only producer of lifecycle evidence.
3. Run the existing private audit only after the complete aggregate source
   changes.
4. Advance only when it supports a real balanced 24–32-case cohort with two
   independent labels, adjudication, readiness, and frozen-study preflight.
5. Add semantic counter-evidence only after a good measured error profile, and
   send ambiguous items only to review.

## Non-goals

This change adds no new API, database schema, configuration, user action,
policy mutation, data collection, cohort capture, label collection, provider
call, semantic selection, automatic routing, or release.
