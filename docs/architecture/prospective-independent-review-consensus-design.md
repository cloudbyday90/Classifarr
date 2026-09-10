# Prospective independent-review consensus design

Status: implemented, unreleased. Sources were checked on 10 September 2026
against the requested August 2026 best-practice baseline.

## Problem

Classifarr already has a private cohort capture, a redacted fixture format, an
independent-reference-set validator, and an offline evaluator. It did not have
a safe way to turn two separately produced reviewer decisions into the
reference-set file required by that evaluator. A reviewer therefore had to
manually assemble the final file, which makes the most important study step
error-prone and obscures whether a disagreement was actually adjudicated.

The missing work is not a second live AI panel and not automatic routing. It is
a narrow, prospective study-intake boundary: once an eligible cohort has been
captured from normal lifecycle activity, independently produced, candidate-
bounded decisions need a reproducible path into the already existing offline
measurement gate.

## Decision

Add a private, ESM-only independent-review consensus composer.

```text
existing redacted, candidate-bounded fixture set
  -> reviewer-one opaque submission
  -> reviewer-two opaque submission
  -> compare exact fingerprint and fixture coverage
       -> agreement: two-reviewer final decision
       -> disagreement: third opaque adjudication submission required
  -> existing fingerprint-bound reference-set document under ignored .tmp
  -> existing offline semantic evaluation
  -> human design review only
```

Each reviewer submission contains exactly a submission ID, the fixture-document
SHA-256 fingerprint, and no more than 32 `(opaque fixture ID, admit/review/
abstain)` pairs. It cannot carry a title, description, library, candidate,
prompt, model response, vector, reviewer identity, or free text. Two primary
submissions must have distinct submission IDs, exact fixture coverage, and the
same fixture fingerprint. Disagreement produces no reference set until a third
submission covers exactly the disputed fixtures. Its decision becomes an
`adjudicated` three-reviewer record; matching primary decisions become
`unanimous` two-reviewer records.

`scripts/compose-policy-candidate-semantic-reference-set.mjs` is the thin
process boundary. It reads bounded, project-contained JSON inputs, writes only
a completed reference set, and limits that explicit output to a fresh JSON file
under ignored `.tmp/`. The file is opened exclusively with owner-only requested
permissions, so the command does not overwrite an existing study artifact. Its
stdout is an aggregate receipt: status, count summary, reference-set
fingerprint, false authority flags, and whether an output was written. It does
not print paths, fixture IDs, decisions, or review content.

For example, the controlled study owner may run:

```text
node scripts/compose-policy-candidate-semantic-reference-set.mjs \
  --reviewer-one-file .tmp/reviewer-one.json \
  --reviewer-two-file .tmp/reviewer-two.json \
  --adjudication-file .tmp/adjudication.json \
  --reference-set-id september-prospective-study \
  --output-file .tmp/september-prospective-reference-set.json
```

The adjudication option is omitted when both reviewers agree. If it is needed
but absent, the command exits with status 2 and writes nothing. Invalid input
exits with status 1 and writes nothing.

## Research basis

NIST's AI RMF Measure guidance calls for documenting test sets, metrics, tools,
and conditions, and notes the value of separate testing teams for independent
decision-making. The exact fixture binding, separate submissions, explicit
adjudication, and content-free receipt make the study reproducible without
asserting that software can prove reviewer independence. [NIST AI RMF Playbook
— Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)

The W3C Forms tutorial says feedback should be concise, clear, and explain the
next action. The command therefore gives only `complete`,
`adjudication_required`, or `invalid` plus a count summary; it does not expose
the dense per-case comparison in a live product screen. [W3C WAI Forms — User
Notification](https://www.w3.org/WAI/tutorials/forms/notifications/)

OWASP's RAG guidance recommends provenance, integrity checks, access control,
and treating model or retrieved information as untrusted. This change adds no
retrieval or model call: it pins opaque review evidence by content address,
rejects unknown fields, uses a bounded temporary output, and leaves both policy
and routing outside the workflow. [OWASP RAG Security Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Hand-author one final reference-set file | No new code | Easy to misstate unanimous versus adjudicated decisions; no mechanical coverage check between reviewer submissions | Reject |
| Let normal policy outcomes become labels automatically | Fast and hands-off | Circular: the policy being assessed supplies its own truth; cannot measure AI/RAG correction quality | Reject |
| Store reviewer identities and full review packets in Classifarr | Rich audit trail | Adds sensitive retention, access-control, and UI scope beyond the offline evaluator | Reject |
| Compose two redacted submissions and require a third only for disagreement | Bounded, reproducible, supports the existing evaluator, preserves external governance | Reviewer separation remains an operational control outside the application | Adopt |

## Security and authority boundaries

- The code is deterministic ESM only, has no route, provider call, scheduler,
  database access, RAG/index access, or client UI.
- The composer rejects unrecognised fields and fails closed for mismatched
  fingerprints, duplicate submission IDs, duplicate fixture IDs, mismatched
  coverage, a superfluous adjudicator, or incomplete adjudication.
- Reviewer IDs are deliberately not stored. A unique opaque submission ID
  proves only that separate documents were supplied; access separation,
  blinding, reviewer qualification, and secure review packets are external
  controls and must not be misrepresented as software proof.
- The final document uses the established
  `independent_double_blind_human.v1` attestation but has no learning, policy,
  retry, AI invocation, or routing authority.
- The complete reference set remains an offline input. A successful consensus
  does not show accuracy, change confidence, train a model, or move media.

## Final recommendation stack

1. Continue to record declared policy intent and let the existing passive
   eligibility audit discover when a valid prospective cohort exists.
2. Supply the resulting redacted cases to two genuinely separate reviewers in
   an access-controlled process outside Classifarr.
3. Use this composer to produce a bound final reference set; resolve every
   disagreement through a third reviewer.
4. Run the existing frozen offline RAG/index/model evaluation and inspect only
   its aggregate error profile.
5. If a representative measured study justifies it, design a separately
   approved candidate-bounded advisory feature with drift checks. Do not
   promote the study directly to automatic routing.

## Non-goals

This does not create an eligible cohort, automate human labels, prove blinding,
retain review content, update a RAG index, change model configuration, learn
from a decision, modify policy, retry classification, route media, or create a
release.
