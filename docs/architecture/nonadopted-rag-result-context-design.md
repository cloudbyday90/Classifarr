# Non-adopted RAG result context design

November 13, 2026 Eastern. Baseline main is
`f3e99c1c995bbe3adcef2ead7eac338f298f31b2`.
Q1 confirms genuine successful non-adopted verification results as the first
consumer. Q2 confirms the complete assembly and verification contract below.

## Observed behavior

The production result builder can return destination B with confidence 75 while
its retained `signalContext` identifies earlier destination A with confidence
80. Baseline spread can also carry A's `ai_advisory` into a current confirmation.
A fresh read-only reproduction at this baseline observed both combinations.

The existing private non-adopted stage already supplies the current verification
context with exactly `ranked`, `confidence` and `suggestedLibrary`. Its wrapper
is frozen and contains the loaded ranking/library references. The AI service
uses this context during the invocation. The shared result builder subsequently
prefers the earlier context.

The History writer projects the advisory into `classification_details`.
The review presentation converts its v1 representation into a historical-advisory
banner. An inherited advisory therefore affects presentation after a current
confirmation. A current ABSTAIN, invalid response or capability refusal supplies
its own advisory through the existing parser.

Question construction also receives the earlier related-evidence summary.
Further tracing established that `normalizePolicyRuntimeQuestion` reconstructs
the question metadata and discards this summary before ordinary persistence.
The earlier investigation overstated this particular persistence effect. The
result context and temporary builder input still contain the earlier data.

## Proposed complete first batch

Use the existing private successful non-adopted verification branch immediately
after the AI-service invocation fulfills and its source check succeeds.
Assemble that candidate with the exact minimal context used by the invocation.
Take its advisory from the current provider result, using explicit absence when
the current result supplies none.

Apply this construction to every fulfilled outcome admitted by that branch,
including CONFIRM, ABSTAIN, contract violation and capability refusal. Existing
comparison and rollout decide which result becomes the classification outcome.
Shadow and comparison-rejection controls exercise the original baseline result.

The context represents the inputs accepted by the completed invocation at
candidate construction. The existing live source check runs immediately before
that construction. Its nested ranking and library references have their existing
loaded-object semantics. The current advisory represents that invocation's
output. This batch fixes ownership of these two fields during assembly.

The existing saved review frame carries its independent frozen policy evidence
through publication, known copies and History insertion. Its existing checks
continue to validate the selected result tuple and policy/item association.
Late source-change tests exercise the frame's recorded-gap behavior alongside
the ordinary classification lifecycle.

Implement the scoped assembly through the existing stage and a small focused
helper if needed. The private prepared verification reference identifies the
eligible call. The common builder continues to serve adopted, initial, generic
and legacy callers through its existing entry points. Their compatibility
controls form part of verification.

## Data, processing and security

Use the existing context fields and advisory representation. The existing
History advisory projection applies its established bounded fields. Original
root policy metadata and the current saved review frame retain their respective
sources. Newly generated question/presentation metadata and answer fingerprints
can change when the inherited advisory is removed.

Verification covers provider-call counts, charged invocations, capability
admission, source refusal, genuine rejected operations, configured time limits,
comparison/rollout, current candidate-bound status, routing and learning gates.
The execution path uses the existing evaluator and provider operations.

Historical History records keep their recorded evidence. Current rows receive
the assembled result through the ordinary writer. Existing completed-answer
receipts and queued routing replay provide the retry controls. The first batch
uses application execution with the existing review UI.

## Research and tradeoffs

Official sources were discovered through MCP and inspected November 13, 2026.
W3C PROV-DM describes generation, use and derivation. The application-specific
recommendation is to associate result context and advisory with the invocation
that used or generated them. [W3C PROV-DM](https://www.w3.org/TR/prov-dm/).

OWASP's RAG guidance emphasizes source attribution, context integrity and output
validation. Its authorization guidance requires validation on each request.
These support source-specific assembly and regression tests for downstream
authorization. [RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html),
[authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

| Approach | Benefits | Costs |
| --- | --- | --- |
| Scoped assembly using the accepted invocation | Small change, exact source reuse, fixes the reproduced inherited fields | Context reflects construction-time inputs and existing loaded references |
| General shared-builder precedence change | Covers more result paths at once | Requires separate adopted/generic/legacy behavior decisions and tests |
| Additional lifecycle validation for context and advisory | Adds later mutation detection | Requires further ownership, mutation, failure and propagation rules |
| Additional persisted original-context record | Adds historical observation detail | Expands storage, disclosure, retention and reader contracts |

Recommendation stack is scoped invocation-owned assembly, verification through
the normal owner/writer/review paths, then an assessment of adopted rerun result
assembly. Later lifecycle validation should address a demonstrated consumer
requirement through its own agreed behavior contract.

## Verification and delivery

Use distinct earlier/current destinations and confidences. Verify same-destination
reruns as well as changes. Cover all fulfilled verification statuses, current
advisory replacement and absence, copied or invalid stage references, source
loss, real rejected operations, apply/shadow/rejection and configured caps.
Assert the normalized question contract and actual temporary builder input.

Run real evaluator and production-factory PostgreSQL controls for selected
persistence, bounded advisory projection, current review frame binding, signal
and retrieval fallbacks, concurrent pending replacement, rollback and delayed
or lost acknowledgement. Use loopback provider HTTP and existing web/Discord
contract controls. Exercise exact completed receipts before fresh validation.

Run fresh backend coverage and affected quality gates. Reuse client coverage,
build and browser receipts only after verifying source, installed tree and
report hashes. Maintain artifacts through the existing maintenance skill.
Record observed results in a separate outcome document and update Unreleased.
Commit and push the intended changes on main, then inspect the pushed revision's
CI. The requested delivery contains source, tests and documentation.

## Open PR assessment and baseline CI

The November 13 MCP inventory contains only open PR 589, so uniform singleton
selection chooses that PR. Its head remains
`c6137f1467319a048e2d6babfe27dc6bb9859ffa`, with the same manifest, lock and
eleven-artifact compiler graph as the previously failed assessment. Fresh pinned
registry reads report installed/wanted vue-tsc 3.3.13 and latest 3.3.14.
The complete candidate graph's integrity values match that assessment.
[PR 589](https://github.com/cloudbyday90/Classifarr/pull/589),
[upstream release](https://github.com/vuejs/language-tools/releases/tag/v3.3.14).

Retain the assessed compiler deferral. Raw GitHub REST reports mergeable true
with unstable checks. The selected coupled compiler graph remains the applicable
assessment unit. Issue 6328 closed November 12, and the existing investigation
already records that update. Issue 6322 remains open.
[Issue 6328](https://github.com/vuejs/language-tools/issues/6328),
[issue 6322](https://github.com/vuejs/language-tools/issues/6322).

All seven workflows for baseline `f3e99c1c9` completed successfully, including
the main pipeline, CodeQL, OSV, Trivy, Gitleaks, copyright and resource regression.
[Baseline pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/43345911709).
