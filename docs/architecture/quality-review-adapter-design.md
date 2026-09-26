# Protocol-bound quality review adapter: design

September 26, 2026. Follow-up to `3ecf4a7b`.

## Finding and decision

The coverage audit correctly separates unavailable evidence from zero coverage.
The next missing component is the independent reference-label handoff. Existing
held-out tools accept 24–32 cases and admit/review/abstain decisions, not the new
300-case movie/TV destination protocol. Keep those contracts unchanged.

Implement a separate offline adapter using the existing private JSON boundary and
a small shared consensus decision helper. Do not initialize the database, provider,
worker, scheduler, or routing stack. No new dependencies, migration, release, or
deployment. Preserve existing Vue SWR and music exclusion.

The blind packet includes item text and destination names, not a frozen library
purpose specification. Reviewers must already have the same agreed destination
criteria; a name alone is not a library's intent. Leave unclear cases unresolved.
This adapter binds the packet it receives, not any separately supplied instructions
or purpose documents. Do not claim that this limitation has been solved.

## Contract and workflow

1. Validate the saved protocol and exact blind packet membership. Bind worksheets
   to a canonical digest of the full packet, including descriptions and destination
   names, so changing displayed review context invalidates existing submissions.
2. Create a content-free worksheet for each explicitly assigned, stable reviewer
   pseudonym. Generate a separate submission ID. Never prefill destination labels.
   Require explicit human or synthetic provenance; do not silently promote fixtures.
3. Finalize worksheets within the original 720-hour protocol window. Missing labels
   remain null. Human submissions require a reviewer independence attestation;
   software cannot verify it. Validate every case and same-media destination.
4. Compose two distinct reviewers' submissions. Agreeing non-null labels become
   unanimous references. Missing labels and disagreements remain unresolved.
   Do not use a majority vote, model predictions, or library placement as truth.
5. Prepare an optional third review covering only disputed cases, without revealing
   either original choice. Bind it to both finalized primary submissions so it
   cannot be reused after either changes. A null adjudication stays unresolved;
   a third reviewer does not fill gaps left by missing primary judgments.
6. Export the existing quality-reference contract plus a private unresolved-case
   receipt. Partial references are explicit and usable for partial reporting, not
   a complete quality claim. The older held-out flow remains all-or-nothing.

Composition may happen after expiry using submissions finalized inside the window;
this does not renew the study or authorize new evidence collection. Timestamps,
pseudonyms, and attestations are declarations, not authenticated identities or
proof of independent human work. Hashes bind content, not its authenticity.

Only bounded hashes, movie/TV identifiers, counts, enums, and reviewer pseudonyms
enter submission files. Stdout contains aggregate receipts, never pseudonyms or
case content. Metadata in the separate packet stays untrusted text. Unknown fields,
duplicate identities/cases, changed packet content, mixed provenance, future or
expired submissions, and stale adjudication bindings fail closed with fixed guidance.

Reuse exclusive private writes. Deterministic composition can verify an identical
existing output after interruption; it never overwrites a different file. Reference
and receipt writes are not an atomic pair: retry the same inputs to finish the
second write, and use fresh output names when inputs change.

## Alternatives and recommendation stack

| Option | Benefit | Cost/risk | Recommendation |
| --- | --- | --- | --- |
| Widen the old contracts in place | Less new wiring | Silently changes unrelated study semantics | Reject |
| Model-generated truth labels | Less reviewer work | Circular evaluation and uncalibrated judging | Reject as ground truth |
| New review web application | Richer editing | New auth, storage, UI and privacy surface | Defer |
| Offline protocol adapter | Reuses tested boundaries; no inference | Real judgments and identity separation remain external | Implement |

Stack: private JSON → strict ESM binding/submission services → shared deterministic
consensus primitive → protocol-compatible reference + unresolved receipt → existing
quality report/audit. Automate preparation, validation, composition and retry—not
human judgments. Keep source authenticity and independence explicitly unverified.

## Official guidance discovered and read

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/):
  document test sets, metrics and limitations and involve independent assessors.
  Keep missing evidence and declared independence distinct from verified quality.
- [Node.js 24 filesystem guidance](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html):
  open directly with exclusive creation and handle errors, rather than relying on
  an existence precheck; asynchronous writes are not inherently synchronized.
- [W3C Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
  and [Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion):
  identify invalid input and give a useful correction. Apply this principle to
  fixed CLI guidance without echoing private values; no web WCAG conformance claim.

## Acceptance

Exercise 300 movie/TV cases, agreement, missing labels, disputes, third-review
binding, duplicate reviewers/submissions, tampering, time boundaries, provenance,
strict private output, real CLI exit codes and interrupted output recovery. Keep
legacy reviewer tests passing. Demonstrate reference compatibility with the quality
report, without fabricating actual reviewers or making a live quality claim.
