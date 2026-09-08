# Held-out semantic lifecycle re-audit design

Status: implemented on 2026-09-08. Research checked against the linked primary
sources on 2026-09-08.

## Problem

The private held-out eligibility audit is the correct count-only gate before a
24–32-case cohort can be captured, but it required someone to remember to run
it after ordinary policy lifecycle work. That creates an operator dependency and
can leave the aggregate study boundary stale after a native intent is
established, changed, or safely replaced by a verified library rebuild.

The audit may read a bounded canonical population. It must therefore remain off
the policy write transaction, run at most once for a completed lifecycle state,
and never grow into cohort capture or automatic media handling.

## Decision

Use the existing durable normal lifecycle receipts as a library- and
configuration-agnostic aggregate change source. The source accepts only these
verified transitions:

- initial native-intent establishment;
- applied native-intent change; and
- a terminal library rebuild replacement whose execution gate, verification run,
  event, source revision, and replacement revision agree.

The database counts those receipts by transition without selecting an identity,
rule value, configuration value, provider value, or media row. A deterministic
SHA-256 digest of the fixed aggregate receipt is compared with a one-row durable
cursor. A change starts the existing eligibility audit after the commit, under a
dedicated PostgreSQL advisory lock. The audit itself remains the producer of the
receipt: the re-audit returns and stores that unmodified v3 aggregate receipt.

```text
verified normal lifecycle receipt
  -> fixed aggregate transition counts
  -> aggregate fingerprint differs from durable cursor
  -> lock-protected background eligibility audit
  -> persist the existing aggregate audit receipt
  -> stop

no cohort capture, labels, readiness, frozen-study preflight,
semantic retrieval, policy mutation, or routing
```

The scheduler checks every 15 minutes and once 90 seconds after application
readiness. An unchanged completed, truncated, or configuration-changed state
emits nothing. A failed state receives at most three total attempts for its same
source fingerprint, then stops until lifecycle evidence changes. A state with no
normal lifecycle receipts does not invoke the audit.

## Security and data boundary

The cursor persists only a source digest, count-only source receipt, attempt
count, audit status, and the existing aggregate audit receipt. It is a derived
automation cursor and is deliberately omitted from backup and restore; a
restored instance safely rechecks its durable lifecycle source.

The scheduler has a dedicated advisory lock so multiple application instances
cannot concurrently run the expensive audit. It does not attach to individual
authoring writes, use a user-supplied trigger, expose an endpoint, add an AI
provider call, or log library, policy, actor, media, rule, or configuration
values. Audit failure is represented by the established `failed` aggregate
receipt and has a finite retry budget.

## Research basis

W3C Data on the Web Best Practices says provenance should describe origins and
changes so people and software can judge data quality and reuse. The lifecycle
source preserves that provenance as counts while keeping the data boundary
small. [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

W3C PROV-DM models entities, activities, generation, usage, and derivation. The
implementation maps this idea to a provenance relationship between a durable
lifecycle activity, its verified receipt, and the derived aggregate audit
receipt without claiming semantic correctness. [W3C PROV-DM](https://www.w3.org/TR/prov-dm/)

NIST AI RMF Measure calls for appropriate metrics and for tracking identified
and emergent AI risks over time. Fixed audit versions, a configuration-drift
outcome, and bounded retries make the automated measurement repeatable without
turning it into an automated decision. [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)

OWASP's logging guidance says event data should be validated and sanitized, and
that sensitive or unnecessary data should be excluded. The aggregate-only
source, receipt, and scheduler logs avoid raw lifecycle inputs altogether.
[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Trigger the audit inside every policy write | Immediate. | Makes a bounded audit part of a transaction and couples three lifecycle implementations to study automation. | Reject |
| Periodically audit every instance regardless of change | Simple. | Repeats expensive work and supplies no provenance for why it ran. | Reject |
| Expose raw receipt details to help an operator trigger it | Easier manual debugging. | Adds sensitive detail and operator work. | Reject |
| Aggregate receipt fingerprint with a durable cursor and advisory lock | Automatically covers every verified lifecycle path, survives restart, and bounds work. | Adds a small derived-state migration and polling delay. | Adopt |

## Recommendation stack

1. Treat a verified normal lifecycle receipt as the only automatic re-audit
   trigger.
2. Compare fixed aggregate source state before starting the private audit.
3. Keep the eligibility audit's versioned aggregate receipt unchanged.
4. Use a database advisory lock and three-attempt failure budget to control
   multi-instance and failure behavior.
5. Continue to require a genuinely independently labelled frozen 24–32-case
   cohort, readiness, and frozen-study preflight before considering semantic
   counter-evidence.
6. If measured error later supports semantic counter-evidence, route ambiguous
   items only to review. Never route them automatically.

## Non-goals

This adds no cohort capture, label collection, readiness or frozen-study
preflight execution, semantic retrieval, AI call, policy edit, library
configuration edit, endpoint, manual trigger, media routing, or release.
