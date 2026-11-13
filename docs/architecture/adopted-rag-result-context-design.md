# Adopted RAG result context design

November 13, 2026 Eastern. Baseline main is
`26db6c5c47f45bf86f1cab0c22cda5f32754102d`.
Q1 confirms the complete assembly, safeguards and verification batch below.

## Reproduced result ownership problem

A fresh adopted verification returns destination B at confidence 75 while its
result context still identifies earlier destination A at confidence 10. A
current confirmation can also inherit A's advisory because its fulfilled result
supplies no advisory of its own.

Read-only controls use the production candidate, verification-result,
comparison, apply, current-frame, question-normalization and answer-contract
helpers. They distinguish the actual invocation from the returned envelope.

| Observed value | Current construction | Proposed construction |
| --- | --- | --- |
| Current result destination/confidence | B / 75 | B / 75 |
| Returned context destination/confidence | A / 10 | B / 75 from the exact invocation context |
| Returned context identity | Earlier baseline object | Actual object passed to the invocation |
| Context ranking/support | Earlier loaded fields | Existing invocation's earlier loaded fields |
| Current confirmation advisory | Inherited earlier advisory | Explicit absence |
| Saved current review | Fresh bound frame | Fresh bound frame |
| Pending recommendation | B with retained candidate score 70 | B with retained candidate score 70 |

The actual adopted invocation already contains a mixture. Its context builder
spreads the earlier context and retargets only destination and overall
confidence. Its ranking, diagnostics, summary and nested signal/RAG references
can therefore describe earlier support. This batch establishes ownership of the
returned context by the invocation that received it. Freshening those invocation
inputs is the next separate behavior decision.

The saved adopted frame now supplies the current pending recommendation and
numeric mechanics. In the synthetic control, clearing inherited advisory changes
its presentation category from `historic_advisory_not_retained` to
`advisory_unavailable`. The answer fingerprint includes the decision summary,
so that fingerprint changes even when preferred bound-verification presentation
continues to show the same confirmed status.

## Agreed complete assembly batch

Apply the repair only after an invocation in the existing adopted verification
branch fulfills. Give the current candidate builder a scoped baseline containing
the exact `verificationSignalContext` passed to that invocation and
`ai_advisory:null`. The existing current-result overlay supplies its own advisory
when present.

Cover CONFIRM, ABSTAIN, invalid-output/contract-violation and capability refusal.
Capability refusal fulfills before provider generation and retains its existing
charged invocation. Genuine rejected calls, admission/eligibility skips and
policy-only outcomes exercise their existing candidate/error paths.

Put the small assembly operation in the existing focused verification leaf, or
directly beside the scoped stage construction if that is clearer. Use the
existing shared candidate builder. The implementation should require only the
focused assembly helper and stage selection, with meaningful regression updates.

The exact invocation object is the source for returned context. Its nested
references have their existing loaded-object lifecycle. Construction occurs
after fulfillment. Existing parser results supply current advisory or absence.
This is construction-time result ownership.

The adopted review observer continues to govern diagnostic frame availability.
Missing, copied or changed diagnostic proof produces its established saved gap.
A fulfilled invocation still owns its actual input context and current result
when that diagnostic proof is unavailable. Optional prompt advice has its own
admission. Neither diagnostic state supplies provider or routing permission.

Existing mode/candidate admission, provider capability, call counters, repair
and retry bounds, comparison, rollout and routing/learning checks govern
processing. The initial, non-adopted, generic and legacy builder entry points
provide compatibility controls. The shared builder's general precedence serves
those callers through its current contract.

## Persistence and operator effects

The History writer stores the bounded advisory projection, which becomes null
after current confirmation with no advisory. Its signal and retrieval fallbacks
read the same nested invocation fields. Question construction receives the
existing related-evidence summary, and normalization discards that summary from
the ordinary saved question.

The complete signal-context object is an in-memory result field. Original
policy metadata, current saved ranking and the row-bound current-review frame
retain their respective evidence roles. Existing frame publication and
insertion checks continue to validate their own receipts.

The answer contract hashes advisory presentation as part of its decision
summary. New answer fingerprints and Discord button identifiers can therefore
change. Existing stale-state rejection and exact completed-receipt recovery
govern subsequent answers. The current bound-verification section continues
through the existing web and Discord presentation paths.

Execution uses the existing application flow and review UI. The implementation
targets the existing result fields and writer. Historical rows keep their
recorded representation.

## Verification and completion

Exercise normal stage and orchestration entry points with distinct earlier and
current destinations and confidences. Verify exact invocation-object identity,
same-destination behavior, leading score versus overall confidence and the
intermediate candidate's maximum-confidence rule.

Cover every fulfilled status, current advisory replacement and absence,
missing/copied/mutated diagnostic proof, optional advice omissions and long
labels. Exercise cap/resilience/mode skips, genuine transient and permanent
errors, apply/shadow/comparison rejection, unchanged provider-call counts and
actual candidate-bound authority projections. Assert the inherited support
fields explicitly so the result-ownership repair has an accurate contract.

Use real evaluator fixtures, production-factory isolated PostgreSQL and
loopback provider HTTP. Verify advisory persistence, signal/retrieval fallbacks,
recorded/gapped current frames, canonical row binding, current pending contracts,
both Discord paths, concurrency, rollback, delayed/lost acknowledgement and exact
answer replay.

Run fresh backend coverage and normal type/lint/dependency/ownership/security
checks. Reuse client coverage/build/browser evidence only after input,
installed-tree and report hashes match the verified receipts. Perform artifact
maintenance before heavy work and at handoff. Record actual results in a
separate outcome and Unreleased entry. Commit and push intended changes on main,
then inspect the pushed commit's CI to completion.

## Primary-source research

Official URLs were discovered through MCP and inspected November 13, 2026.
W3C PROV-DM describes activities using entities, generating outputs and deriving
new entities from earlier ones. The application-specific inference is to pair
the returned context and advisory with the actual invocation inputs and output.
[W3C PROV-DM](https://www.w3.org/TR/prov-dm/).

OWASP describes binding decisions to their relevant context and matching each
response to its corresponding request. This supports explicit invocation and
result pairing in this code path. Execution authorization remains a distinct
server-side responsibility. [OWASP authorization decisions and output handling](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Decisions_And_Output_Handling_Cheat_Sheet.html).

OWASP's LLM guidance calls for tool permission and parameter checks in execution
code. The application-specific inference is to keep result/advisory assembly
independent of diagnostic provenance and permission grants.
[OWASP prompt-injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html#agent-specific-defenses).

## Tradeoffs and recommendation stack

| Approach | Benefit | Cost or limitation |
| --- | --- | --- |
| Scoped construction from actual invocation context and current advisory | Repairs the reproduced returned fields with a small change | Existing hybrid support fields still belong to the invocation inputs |
| Fresh minimal adopted invocation context | Could make request support internally coherent | Changes prompt/admission inputs and needs its own source-loss and provider-accounting contract |
| General shared-builder precedence change | Covers several result paths together | Broadens initial, generic and legacy behavior requiring additional decisions |
| Later lifecycle validation of returned fields | Adds mutation detection after construction | Requires further binding, failure and propagation rules |

First repair adopted result ownership through scoped construction and verify
the actual writer/review consumers. Next evaluate coherent fresh inputs for the
adopted verification invocation. Continue compiler adoption only when a coherent
published candidate passes the existing differential and normal gates.

## Independent PR intake

The November 13 intake at 3:12–3:14 p.m. Eastern finds only open PR 589. Uniform
singleton selection chooses its immutable head
`c6137f1467319a048e2d6babfe27dc6bb9859ffa`. The client manifest/lock and all eleven
reviewed compiler version/integrity pairs match the previously assessed
candidate. Installed/wanted vue-tsc is 3.3.13 and latest is 3.3.14, with the same
published release and upstream issue states recorded in the
[compiler investigation](vue-compiler-graph-investigation.md).
[PR 589](https://github.com/cloudbyday90/Classifarr/pull/589),
[published compiler metadata](https://registry.npmjs.org/vue-tsc/3.3.14),
[official release](https://github.com/vuejs/language-tools/releases/tag/v3.3.14).

Retain the demonstrated compiler deferral. Its five candidate failures describe
the earlier differential execution. Actual REST mergeability settles to true
with unstable checks. Recheck open PR state at delivery and rebase only a
genuinely stale applicable branch.
