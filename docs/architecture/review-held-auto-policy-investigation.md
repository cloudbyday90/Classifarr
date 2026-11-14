# Review-held automatic policy investigation

November 14, 2026 (America/New_York). Read-only findings at main
`593c9b4fe43e5e96d057f1050594258f79c4b7ed`. The user confirmed current review
evidence with existing operator actions and separate prospective clearing of
inherited verification status. See the [agreed design](review-held-auto-policy-design.md)
and the separate [implementation outcome](review-held-auto-policy-outcome.md).

## Reproduced source mismatch

Real evaluation/capture, adopted RAG owner, question builder, route-safety and
answer-contract helpers reproduce this for native and compatibility origins.
Scoring/retrieval/settings/preset dependencies were supplied in memory; no live
deployment, database write or provider call was used.

| Observation | Result |
| --- | --- |
| Fresh retained policy candidate | B / 101 / 90 |
| Action and method | `auto_classify` / `policy_auto` |
| Genuine live numeric proof | Valid |
| Extra verification calls | Zero |
| Preserved review hold | `ai_advisory_cannot_route` |
| Current saved-review frame | Absent |
| Shown recommendation and score | Original A / 2001 / 80 |

Compatibility requires corroborating support: profile-only evidence correctly
produces selection rather than automatic classification. The reproduction uses
the real decision projection/builder and corroborating evidence, rather than
mutating a captured confirm result's action.

The production question builder fills remaining options from loaded libraries.
Earlier A therefore remains permitted even when the current ranking contains
only B. Calling only the normalizer misses this behavior. The absent-frame reader
then uses original `metadata.policyResult`, allowing A/80 to replace current B/90
in the recommendation.

## Admission and persistence timing

Fresh numeric proof is captured immediately after reevaluation, before adoption
callbacks. Actual stage/candidate association follows the existing adoption gate.
Final comparison, conflict handling, apply selection and fulfilled rollout precede
publication. Auto keeps its existing no-AI short circuit.

The review hold is established later by `ensureDecisionQuestion`. Persistence
then derives authoritative `awaiting_decision` status after existing asynchronous
question work; destination columns become null. `pending_retry` is distinct and
takes priority. A pre-normalization flag or automatic action alone cannot enforce
the requested review-only storage boundary.

Existing frame code holds evidence before state derivation, rechecks afterward,
and rechecks immediately before the row-bound INSERT. It currently writes every
held frame. Automatic evidence therefore needs a prospective version, exact
automatic method binding and conditional emission for the derived awaiting state.
Completed automatic and retry rows must keep their ordinary INSERT behavior.

The same latent attempted version must survive owner copies and unavailable
proof. Otherwise an unknown copy could become an ordinary absent-frame fallback,
or a default v1 gap could accidentally escape the automatic-only storage filter.
An attempted marker supplies no authority to record a positive frame.

## Review behavior and safeguards

Healthy automatic production does not itself require mandatory destination
selection. Ambiguity/weak evidence normally produces selection/manual action;
language and retrieval conflict controls reject adoption. Actual holds include
restrictive authority, administrative confirmation and a configured automatic
band below the application's confidence threshold. Defensive preserved-field
holds also exist; they must not become new provider or routing permission.

A genuine unique current reference uses the existing primary/Confirm/bulk rules.
The recommendation may change from A to B. Current-frame rules also suppress
inherited unbound adjudication, so some formerly hidden shortcuts can appear.
That is a recommendation/default change, not new server command authority.
Persisted hold projection separately explains `automatic_threshold_blocked` or
`automatic_route_blocked`; crossing a score threshold does not release the hold.

Existing missing-safety refusal remains necessary. With current recorded
score90/threshold85 but no trustworthy saved gate, the historical-safety helper
marks the answer stale and disables confirmation. A valid saved blocking gate
does not trigger that refusal. Add no blanket version exemption. An evidence gap
continues to use existing generic explicit-choice semantics without old numeric
fallback.

The existing History lifetime retains pre-operator evidence with the row.
Requiring its current status to remain pending would introduce a new lifetime
restriction. Prefer admission at creation, a distinct version/action/method, and
the existing row/item/method/question-membership reader checks.

Automatic candidates also inherit an earlier verification status. The user
separately confirmed clearing that status at new adopted automatic construction,
including later completed results. Future History confirmation/abstention counts
change intentionally; historical rows and actual provider observations remain.
Context/advisory inheritance stays outside this batch.

## Official research

Sources were rediscovered and opened through MCP on November 14.
[W3C PROV-DM](https://www.w3.org/TR/prov-dm/) relates derived output to inputs that
actually influenced it. Retaining original metadata beside a new result does not
prove that it describes the new evaluation; that is the application inference.

[OWASP decision/output handling](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Decisions_And_Output_Handling_Cheat_Sheet.html)
supports associating results with their subject, action, resource and context,
constraining reuse, and enforcing authorization server-side. Here, current
recommendation evidence, a review hold and the operator's authorized action remain
separate. A saved snapshot is not permission to dispatch work.

[WAI predictable input guidance](https://www.w3.org/WAI/WCAG22/Understanding/on-input)
and [labels/instructions guidance](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions)
support clear, intentional destination controls. These explanatory WCAG resources
do not prescribe another confirmation step. Preserve the existing interface and
test keyboard/mobile behavior without claiming full accessibility conformance.

## Options and recommendation

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Keep original evidence | No new version | Can show A/80 after accepting B/90 |
| Replace only context/advisory | Cleans returned support | Saved review can still recommend A |
| Current frame for review-held adopted auto | Correct technical reference with preserved hold | Version/cohort admission, new defaults and fingerprints |

Recommend the third option, with the separately confirmed verification-status
correction. Keep source proof, publication, derived pending-state admission,
row-bound storage, saved safety and authorized operator actions distinct.

## PR intake

At 19:05 UTC / 2:05 p.m. Eastern, the current GitHub open-PR collection is empty.
No eligible random PR or stale Dependabot branch exists. Recheck at delivery;
closed PRs are not reused.
