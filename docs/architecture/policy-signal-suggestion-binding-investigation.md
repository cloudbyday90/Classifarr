# Policy-signal suggestion binding investigation

Research: November 10, 2026 Eastern. Baseline main
19c8680f608b0ebdaf974268d346eb49726dbc36. This is a read-only investigation and
recommendation. The operator confirmed policy recovery advice as the first
consumer and then confirmed its complete proof contract. Runtime outcomes are
recorded separately from these preimplementation findings.
No release, deployment, live database access or configuration write was performed.

## Findings

`policyScoringContextBuilder.buildSignalContext` selects a library from the first
supplied ranked row, while independently copying `policyResult.confidence`.
It receives no item identity or native revision. It does not establish a private
receipt or revalidate the mutable context after asynchronous provider/evidence
work. The context is informational; it is not evidence of same-item provenance.

Normal production inputs are stronger than arbitrary structural fixtures: the
outer pool contains active, media-compatible libraries, and the policy engine
independently loads enabled policies with active libraries and filters media
scope. The policy owner passes its actual retained ranking to the builder.
An enable/add between those two reads can nevertheless produce a genuinely
evaluated destination absent from the earlier pool. This is a plausible race,
not proof of current live frequency or the cause of an inaccurate suggestion.

Do not replace overall confidence with the first candidate's score. Successful
decisions normally align those numbers, but the ranker's conservative fallback
can return manual action/confidence zero with nonempty ranked rows. Normalization
preserves that explicit zero; replacing it could change retry/mode selection.

The policy owner reuses the same context for normal AI prompts/profile lookups
and for provider-failure recovery. The shared recovery helper also serves the
independent legacy calculator. Tightening the shared builder or shared helper
globally would therefore change consumers beyond policy recovery.

Provider recovery already blocks automatic routing. NULL pending destinations,
current choices, explicit destination resolution and exact replay are supported.
Rejecting a suggestion while preserving the existing confidence/retry predicate
can use the newly qualified neutral fallback. Zeroing confidence to reject proof
would instead authorize another retry under the existing below-50 predicate.

## Existing private evidence and limitations

| Mechanism | Useful property | Limit for this task |
| --- | --- | --- |
| Numeric policy evaluation capture | Private minting, typed item and retained ranking checks | Diagnostic-only; omits action/confidence/native revision from its fingerprint |
| Candidate purpose live capture | Exact result/item/config/revision and post-await checks | Native-purpose, two-to-three-candidate adjudication contract; optional diagnostic gaps |
| Native purpose/contribution receipts | Actual minted match/contribution objects | Evidence for their own declared-purpose semantics, not a generic suggestion receipt |

Do not turn diagnostic presence, missing payloads or diagnostic overflow into a
new advice authority implicitly. Matching IDs, fields or hashes do not prove
that a copied/history/replay context came from the current live evaluation.
A loaded-snapshot witness would also not establish current database freshness
after an asynchronous provider call. Any stronger freshness claim needs separate
reads, admission/cancellation and availability decisions.

## Recommendations and alternatives

| Option | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Policy recovery consumer first | Limits behavior change to the investigated failure path | Normal prompt/profile and legacy advice remain separate | First consumer |
| Structural coherence checks only | Small; can reject mismatched/invalid destination fields | Cannot establish live same-item origin or revision proof | Describe as unverified consistency, never provenance |
| Dedicated private live reference | Can bind actual evaluation/item/destination and reject copying/mutation | Needs explicit lifecycle, source coverage and resource bounds | Preferred provenance direction after consumer scope is settled |
| Reuse diagnostic captures as permission | Reuses existing objects | Changes diagnostic contracts and couples gaps/overflow to behavior | Reject implicit reuse |
| Change all prompt/profile/recovery consumers together | Wider consistency | Changes normal generation and profile reads while fixing recovery | Separate scope choice |
| Fresh database validation after provider work | Can assess newer configuration | Adds reads/failure/resource boundaries; loaded snapshots alone cannot claim this | Separate explicit decision |

Recommendation stack:

1. Use the confirmed policy recovery consumer, preserving normal prompt/profile
   behavior, the independent legacy calculator and scoring/route/learning rules.
2. Define genuine live provenance separately from structural consistency and
   diagnostic capture. Preserve confidence/retry authority when proof is absent.
3. Set loaded-snapshot meaning, source/version coverage, mutation checks and bounds
   explicitly before implementation; do not claim current database freshness.
4. Prove the chosen contract with actual evaluator/isolated PostgreSQL, loopback
   provider failures, copied/mutated/cross-item evidence and existing UI/replay
   controls. Use modular leaves, separate design/outcome, Unreleased and main.

The consumer boundary is settled. The proposed loaded-snapshot contract is in
[the recovery binding design](policy-recovery-suggestion-binding-design.md);
its complete scope was subsequently confirmed. See the separate
[implementation outcome](policy-recovery-suggestion-binding-outcome.md).
Routine operator workflows continue through existing automatic work or UI;
this investigation introduces no page, control, setting, job or CLI trigger.

## Primary sources retrieved through MCP

- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) distinguishes an entity's identity,
  derivation and invalidation. Apply that distinction to the evaluated snapshot;
  do not infer current validity merely from matching fields. No RDF/PROV protocol
  or conformance claim is proposed.
- [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  supports explicit permissions and default refusal. Provenance for advice must
  not grant routing, learning, retries or uncertain-write replay.
- [W3C headings and labels](https://w3c.github.io/wcag/understanding/headings-and-labels)
  requires provided cues to be accurate and descriptive. Reuse existing neutral
  selection controls where evidence is unavailable, without adding UI clutter
  or claiming complete WCAG conformance.

## Independent PR review

Current MCP inventory contains only PR 589; uniform singleton selection chooses
it. Its head, two immutable blobs and all eleven compiler version/integrity
records match the previously demonstrated failing candidate. Registry/release
and upstream issue checks supply no changed artifact. Retain the settled
[compiler deferral](client-compiler-pr-589-outcome.md), without another install,
new candidate-test claim, PR merge or manufactured package change. The branch
is mergeable with unstable checks; no genuinely stale applicable branch was
established. Private review receipts remain under `.tmp/signal-binding-assessment`.
