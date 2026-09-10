# Private Reviewer Aggregate Results — Design

Status: implemented, unreleased. Official guidance was checked on 10 September
2026 against the requested August 2026 best-practice baseline.

## Decision

Complete the held-out semantic-study handoff with one local ESM command:

```text
redacted evaluation bundle + completed independent reference set
                         |
                         v
fingerprint-pinned snapshot evaluation
                         |
                         v
existing content-free aggregate results report
```

`study:reviewer-results` takes exactly three project-relative `.tmp` JSON paths:
`--bundle-file`, `--reference-set-file`, and `--output-file`. It reads the
redacted sibling bundle that is automatically created with the private packet,
then runs the existing fixed-snapshot evaluator and existing aggregate results
summary. It writes a result only when independent labels make that summary
available.

The command is a local study handoff, not a classification action. It neither
reads the private packet nor creates a browser screen.

## Problem reconciled

The previous change retained the redacted evidence needed for measurement, and
the preceding one could compose a packet-bound consensus reference set. Neither
provided the final deterministic connection between the two. An operator would
otherwise have to discover, manually wire, and safely invoke lower-level
services—an error-prone gap after the human decisions already exist.

The new `heldOutSemanticStudyEvaluationResults.mjs` service owns that narrow
composition. It accepts only the exact four-key evaluation-bundle contract:
fixture document, manifest, snapshot document, and the known bundle version.
Unsupported versions, unknown fields, altered snapshots, invalid manifests, or
fingerprint mismatches return the existing `evaluation_source_invalid` result.
No output is written on that status. Missing or non-independent labels return
`independent_reference_set_required` and likewise write nothing.

## Architecture and boundaries

The workflow calls two existing pure services in order:

1. `evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument` validates
   fixture, manifest, snapshot, and exact bindings, then emits status-only
   evaluation output.
2. `buildPolicyCandidateSemanticEvaluationResultsSummary` joins that fixed
   output to an independently labelled reference set and returns only aggregate
   coverage, agreement, precision/recall, abstention, consensus, and Wilson
   uncertainty.

The CLI reuses the established private JSON file boundary: `.tmp` containment,
symlink rejection, realpath verification, a 512 KiB input limit, exclusive
creation, and requested `0600` permissions. Its stdout receipt contains only a
fixed status and `resultsWritten`; the aggregate report remains in the bounded
local output file.

It adds no HTTP route, database access, queue, scheduler, provider call,
embedding request, live RAG retrieval, model invocation, learning loop, policy
mutation, retry, or routing authority. The existing report itself declares all
automatic actions false and is not evidence to enable automatic routing.

## UI decision

No new settings panel, review card, or Command Center widget is added. The
current product already has a compact, auto-refreshing aggregate readiness
surface. Surfacing every provenance detail there would repeat the dense screens
that prompted this work and blur the distinction between system readiness and a
one-time local study result. The result remains inspectable through the local,
content-free artifact when an administrator deliberately runs the study.

## Research basis

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented test sets, methods, metrics, uncertainty, independent
  assessment, and formal reports. The command preserves that sequence: a
  pinned test source is evaluated first, independent labels are required, and
  only descriptive aggregate metrics are written.
- The [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends hashing/integrity checks, minimisation, and fail-closed behaviour
  across retrieval-adjacent pipelines. Exact manifest validation, a strict
  bundle shape, local containment, and no-output failure paths implement those
  controls without making this an online RAG flow.
- [W3C WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  calls for concise status changes that assistive technology can announce
  without moving focus, while warning against chatty live updates. Keeping the
  existing Command Center status as the sole automatic UI signal avoids a new,
  noisy or dense result panel.

## Options and trade-offs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Require manual lower-level evaluator calls | No new wrapper | Reintroduces fragile paths and artifact wiring | Rejected |
| Make the report trigger learning or routing | Fully hands-off | A small offline study cannot safely grant production authority | Rejected |
| Add a full browser results dashboard | Convenient discovery | Increases UI density and risks exposing workflow context | Rejected |
| Local aggregate-only results command | Closes deterministic handoff; fail-closed; no new UI or network surface | Must wait for real independent labels | Selected |

## Final recommendation stack

1. Let the protected packet workflow retain its redacted sibling bundle
   automatically.
2. Obtain two genuine independent reviewer submissions and complete consensus
   (with adjudication only for actual disagreement).
3. Run `npm --prefix server run study:reviewer-results -- --bundle-file ...
   --reference-set-file ... --output-file ...`.
4. Treat the report as a measurement input for a separately governed,
   candidate-bounded advisory experiment. Do not use it to auto-route, update
   policy, or train from reviewer labels.
