# Private Reviewer-Submission Workflow — Outcome

Status: implemented, unreleased on 10 September 2026. This work creates no
release and no version bump.

## Delivered

- Added modular ESM services that make a bounded reviewer worksheet from a
  current private packet and finalize it only against that original packet.
- The worksheet is intentionally incomplete: every `referenceDecisionId` is
  `null` until a human supplies an allowed decision for every fixture.
- Finalization rejects packet expiry, fixture/fingerprint drift, duplicate or
  missing fixture IDs, extra fields, invalid decisions, and invalid submission
  identifiers. It emits the existing content-free reviewer-submission contract.
- Added a single local command with `create-template` and `finalize-submission`
  operations. Its receipt contains only a fixed status and fixture count.
- Extracted the private JSON file boundary used by reviewer packets so reading
  and writing share constrained temporary-path, symlink, size, containment, and
  exclusive-create safeguards.
- Added the `study:reviewer-submission` server script and an Unreleased
  changelog entry.

## Verification

Focused tests cover packet projection, null/default decisions, content removal,
expiry handling, drift rejection, strict finalization, aggregate-only CLI
receipts, command validation, and private JSON reads. Server lint, typecheck,
and the focused Jest group passed locally. The bounded full server suite passed
with 1,182 suites and 33,609 tests; the coverage ratchet passed. A no-cache
Compose build and force-recreated healthy service also completed the synthetic
24-case packet → worksheet → content-free finalized-submission flow inside the
read-only production container.

## Open-PR check

GitHub's public pull-request API returned `openPullRequestCount=0` for
`cloudbyday90/Classifarr` on 10 September 2026. No open PR was therefore
available to implement locally; no closed or fabricated PR was substituted.

## Pros and cons

| Result | Benefit | Cost / limit |
| --- | --- | --- |
| Incomplete worksheet | Prevents an accidental default label and removes hand-authored submission structure | A reviewer still needs to choose each decision |
| Packet-bound finalizer | Detects expiry, wrong fixture coverage, and altered binding before consensus | Requires the original private packet to remain available until finalization |
| Content-free output | Keeps titles, policy context, and AI/RAG evidence out of consensus and evaluation inputs | Reviewer distribution remains a controlled local activity |
| No new product UI | Avoids a sensitive, dense, always-on dashboard | This is deliberately not one-click routing automation |

## Next high-value item

Run two real independent reviews with this completed workflow, compose the
reference set, and run the fixed offline semantic evaluation/results summary.
The first possible AI/RAG product change afterward is a measured,
candidate-bounded advisory review-priority experiment—not auto-routing and not
learning directly from one study.
