# Fixed-Band Calibration Evidence Design

## Decision

Extract the ordinary ordered score-band decision from `PolicyCandidateRanker`
into a pure ESM resolver, then exercise it with a checked-in, synthetic,
versioned default-band corpus. The existing offline calibration command now
requires both the admission corpus and this band corpus before it can expose a
human-review packet.

This records the current default baseline for review. It is not a live-policy
approval, threshold update, AI/RAG instruction, or routing authorization.
Policy owners must separately approve any change to a live policy's configured
thresholds.

## Problem

The screenshots show scores such as 62, 64, 71, and 80 producing an operator
confirmation. That is the current deterministic ordering, but prior offline
evidence only proved that an aggregate review protocol could start; it did not
prove the boundary behavior itself. A second risk is interpretation: an
`auto_classify` policy action is still only a candidate for automatic routing.
The route-safety gates remain the authority that decides whether the Arr side
effect may occur.

## Default Baseline Specification

The fixed corpus pins these current code-owned default values. It receives no
database configuration and deliberately does not describe an individual
library's customized values.

| Score range | Band ID | Existing action | False-positive cost | False-negative cost |
| --- | --- | --- | --- | --- |
| 0–39 | `manual_review` | `manual` | No automatic route is possible | Higher operator effort |
| 40–59 | `operator_selection` | `prompt_select` | Presenting an unjustified single destination | Extra selection friction |
| 60–84 | `operator_confirmation` | `prompt_confirm` | Confirming a wrong candidate | Delayed automatic handling |
| 85–100 | `automatic_candidate` | `auto_classify` | Incorrect automatic-route eligibility; highest cost | Lost automation benefit |

The corpus covers the floor, each inclusive boundary, the preceding value, the
policy-engine ceiling, and the score ceiling. A custom policy still uses its
own validated prompt and automatic thresholds with the same order; for example,
a 71/72/91 profile selects a destination at 71, confirms at 72, and becomes an
automatic candidate at 91.

## Architecture

```text
normalized ranked candidate
          |
          v
pure score-band resolver -------------------+
          |                                  |
          v                                  v
existing action selection        checked-in synthetic band corpus
          |                                  |
          +---------------+------------------+
                          v
              aggregate-only offline result
                          |
                          v
existing human-review packet, only when both
admission and band corpora pass
```

The resolver has no database, network, queue, provider, RAG, AI, routing, or
persistence import. It returns the existing action and explicit false values
for routing, policy-change, learning, retry, and AI invocation. The ranker
continues to apply ambiguity and weak-evidence controls before it asks the
resolver for the ordinary score band.

The fixed-path command accepts no arguments. It reports only aggregate fixture
counts and status IDs. It does not return fixture names, scores, configured
thresholds, libraries, media, policies, people, prompts, model responses, or
RAG material.

## Security And Privacy Boundaries

- The corpus allow-lists every field and rejects altered specification values,
  unknown fields, malformed expectation pairs, duplicate IDs, and out-of-range
  scores.
- A successful suite cannot create a policy proposal, save an approval,
  modify a threshold, call a provider, invoke RAG, retry work, or route media.
- The approval-packet read model now requires both independently validated
  corpora. It remains content-free and always records `approvalRecorded: false`.
- The ranker refactor preserves the prior ordering while making that ordering
  directly testable. It does not expose a new endpoint or client control.

## Accessibility And Automation

This component is CLI-only, so it creates no form, browser action, timer, or
status message. A future browser view should expose a concise automatic result
without focus movement, keep the full fixture list outside the live region,
and give any owner-review controls visible labels, instructions, and textual
error recovery. That follows W3C WCAG 2.2 requirements for status messages,
error identification, and labels or instructions.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Pure resolver plus fixed synthetic corpus (selected) | Tests the runtime order, repeatable, no private data, no added authority | Covers only default baseline values |
| Test a copied decision formula only | Smallest test surface | Can drift from the ranker actually used in production |
| Read live policies in the evaluation | Tests active values | Adds configuration exposure and makes the result non-reproducible |
| Let AI/RAG assess score bands | Potential narrative explanation | Non-deterministic and incorrectly broadens model authority |

## Recommendation Stack

1. Keep the fixed default-band corpus as a release-line guard and require it
   before producing the existing human-review packet.
2. Treat a passing suite as evidence for a human review, never as a live-policy
   approval or a route decision.
3. Preserve the existing route-safety gate as the final authority after an
   `automatic_candidate` result.
4. Add a synthetic route-safety matrix next, covering policy action, evidence,
   AI-advisory, provider-recovery, and provenance gates without using live
   classifications.

## Official Research

Research performed on 2026-08-31 with official sources:

- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented, repeatable evaluation and documented human oversight.
- [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)
  describes objective, repeatable test, evaluation, verification, and
  validation processes with metrics, uncertainty, benchmarks, and reporting.
- [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  recommends bounded externally triggerable work; the fixed-path offline
  command introduces no API or provider workload.
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) and its explanations for
  [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html),
  [error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification),
  and [labels or instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)
  guide any later operator-facing presentation.
