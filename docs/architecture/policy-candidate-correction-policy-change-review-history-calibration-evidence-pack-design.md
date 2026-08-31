# Policy-Change Calibration Evidence-Pack Design

## Decision

Create an offline, checked-in synthetic corpus that exercises the existing
calibration-protocol admission contract and emits a versioned, content-free
human approval packet. The component is a deterministic local evaluation
artifact; it does not evaluate live score bands, invoke AI/RAG, read the
database, call an API, save evidence, or approve or apply a policy change.

## Problem

The preceding protocol correctly identifies when a human may begin a controlled
offline review. It did not yet provide a reproducible way to verify that the
three protocol-admission states remain stable as the code evolves, nor a
concrete packet format that makes human approval requirements unambiguous.

The screenshots show why this distinction matters: a deterministic policy can
present a plausible destination while AI remains advisory. A fixture corpus
must prove governance behavior without accidentally turning the corpus,
aggregate history, RAG evidence, or an LLM response into routing authority.

## Architecture

```text
checked-in synthetic status corpus
             |
             v
strict fixture contract (allow-list, bounds, no authority)
             |
             v
pure existing calibration-protocol contract
             |
             v
aggregate-only pass / mismatch report
             |
             v
versioned human-approval packet format (not an approval)
```

The runner has one fixed repository-relative fixture path and accepts no
arguments. It reads a JSON document, evaluates it through pure ES modules, and
writes a status-only result to standard output. It cannot read runtime history
or configuration and has no server route, scheduler, queue, provider, RAG,
policy-engine, learning, retry, or routing integration.

The corpus has exactly three synthetic status cases:

1. Insufficient aggregate evidence keeps the protocol unavailable.
2. Eligible aggregate evidence paired with a shifted review process requires
   follow-up.
3. Eligible aggregate evidence paired with a consistent review process makes
   the existing fixed procedure available.

The corpus intentionally validates *protocol admission*, not numerical score
bands. The existing procedure still requires a human to compare fixed policy
bands in a separately controlled offline review. That comparison needs its own
explicit specification before a future component can claim to validate it.

## Packet Contract

Only a fully valid passing offline report may yield a packet read model. The
packet contains its version, corpus version, protocol identifier, report
version, synthetic fixture count, and the fixed procedure identifiers. It
contains no actor, signature, policy ID, threshold, score, media, library,
provider, prompt, response, RAG text, approval operation, or database key.

The packet always declares:

- `humanApprovalRequired: true`
- `approvalRecorded: false`
- all automatic policy, AI/RAG, and routing flags as `false`

Consequently, a packet is documentation of what a human must review—not a
grant of authority and not an approval record.

## Security and Privacy Boundaries

- The strict JSON contract allows only known status combinations and rejects
  unknown fields, duplicate fixture IDs, unexpected procedure lists, and any
  automatic authority flag.
- The fixture corpus is intentionally synthetic and status-only. It forbids
  current policy identifiers, score thresholds, media, libraries, AI/RAG
  inputs, provider responses, and operator identities.
- The evaluator returns aggregate counts and risk IDs only; it emits no fixture
  names or individual results.
- No HTTP endpoint, migration, database query, retention path, background job,
  queue, or provider request is introduced, which avoids converting a bounded
  local check into externally triggerable work.
- The explicit result contract keeps this artifact reproducible and supports
  code review and provenance practices without treating a test outcome as a
  production authorization.

## Accessibility and Automation

This component has no browser control or status region: it is a CLI-only,
offline engineering artifact. It creates no operator action to remember and no
new auto-refresh timer. When a later browser view exposes the report, it should
reuse the existing automatic page-visible refresh and present only a concise,
programmatically determinable status update; the packet contents should remain
outside the live region to avoid repetitive announcements.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Synthetic, offline, human-gated evidence pack (selected) | Repeatable, reviewable, private, no new operational authority | Does not validate live score bands or policy changes |
| Live history or active policy evaluation | Real configuration context | Retains/exposes more data and can blur evaluation with authority |
| LLM/RAG-generated calibration test cases | Broader semantic ideas | Non-deterministic, prompt/data exposure, hard to audit |
| Auto-approve after a passing suite | Lowest apparent friction | A test result cannot replace accountable human policy review |

## Recommendation Stack

1. Run `npm run test:offline:policy-change-calibration-evaluation` as a
   repeatable, offline guard before any future calibration proposal review.
2. Keep human approval separate from the packet format and from the suite’s
   pass status.
3. Define a separately reviewed, numeric fixed-band fixture specification only
   after the policy owners state the bands and desired semantics explicitly.
4. If a UI is later warranted, expose only automatic status and the packet
   version; do not add a provider call, free-form selector, or approval action
   without a separate threat model and authorization design.

## Official Research

Research performed on 2026-08-31 using official sources:

- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented human oversight, repeatable testing, performance
  assessment, and reporting before operational decisions.
- [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)
  describes objective, repeatable test, evaluation, verification, and
  validation processes and using measurements to inform—not silently replace—
  management decisions.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports integrating secure, verifiable development practices into the
  lifecycle; the checked-in corpus and deterministic runner make the artifact
  reviewable in normal source control.
- [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  identifies externally triggerable resource use as a risk. The offline-only
  runner avoids creating a new API or live/provider workload.
- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports concise, programmatically determinable updates without focus theft
  if a future view presents the result.
