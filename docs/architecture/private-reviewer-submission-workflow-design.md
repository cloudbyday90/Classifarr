# Private Reviewer-Submission Workflow — Design

Status: implemented, unreleased. Sources were checked on 10 September 2026
against the requested August 2026 best-practice baseline.

## Decision

Add a local, ESM-only worksheet and finalization step between the private
reviewer packet and the existing independent-review consensus command. It gives
each reviewer a non-submittable, content-free worksheet containing only opaque
fixture IDs, the packet's SHA-256 fixture fingerprint, a generated opaque
submission ID, and the packet expiry. A reviewer supplies one `admit`,
`review`, or `abstain` value for every fixture; the finalizer then verifies the
original packet again before creating the already supported strict submission
format.

This is the practical next step after a reviewer packet. It does not invent
human labels, retain reviewer identity, expose a browser route, call AI/RAG,
learn, update a policy, or route media. Human judgement is still necessary to
produce an independent reference set; software must not claim otherwise.

## Workflow

```text
private packet (source description + declared policy context)
        |
        v
one local content-free worksheet per independent reviewer
        |
        v
reviewer supplies one bounded decision for every opaque fixture
        |
        v
original packet + completed worksheet + expiry check
        |
        v
strict content-free reviewer submission
        |
        v
existing two-reviewer consensus, adjudication, and offline evaluation
```

`heldOutSemanticStudyReviewerSubmissionTemplate.mjs` owns packet projection,
worksheet validation, expiry enforcement, and conversion to the pre-existing
submission contract. `privateStudyFileBoundary.mjs` provides the shared local
JSON-file boundary: project-relative `.tmp` only, symlink rejection on reads,
512 KiB input cap, realpath containment, exclusive output creation, and a
requested POSIX `0600` mode. This removes duplicate path logic from the packet
writer.

`runHeldOutSemanticStudyReviewerSubmission.mjs` is a small process boundary. It
emits only `template_created`, `submission_created`, or `invalid` plus a fixture
count. It never prints paths, packet content, fixture IDs, labels, policy
context, or reviewer identity.

## Controlled operator flow

The protected packet-capture command now creates one worksheet for each
reviewer automatically, using the packet filename with
`.reviewer-one-template.json` and `.reviewer-two-template.json` suffixes. The
manual `create-template` command remains available only to recover an expired
or deliberately discarded worksheet while the original packet is still
current:

```powershell
npm --prefix server run study:reviewer-submission -- `
  create-template `
  --packet-file .tmp/private-review/packet.json `
  --output-file .tmp/private-review/reviewer-one-template.json
```

The reviewer changes each `referenceDecisionId` from `null` to `admit`,
`review`, or `abstain`, without adding fields. Finalize it before the packet
expires:

```powershell
npm --prefix server run study:reviewer-submission -- `
  finalize-submission `
  --packet-file .tmp/private-review/packet.json `
  --template-file .tmp/private-review/reviewer-one-template.json `
  --output-file .tmp/private-review/reviewer-one.json
```

The second reviewer receives the separately generated template and therefore a
fresh opaque submission ID. Only the resulting content-free JSON submissions
are given to the existing consensus command. In the read-only production
container, these paths resolve below `/app/data/.tmp`; in a development
checkout they resolve below repository `.tmp`.

## Security and authority boundaries

- The packet is re-read during finalization, so an expired packet, a
  packet/worksheet fixture or fingerprint mismatch, incomplete worksheet,
  duplicate fixture, invalid decision, extra field, or unrecognised document
  fails closed. The fixture fingerprint is a content binding, not an identity
  credential or a signature over the locally controlled packet file.
- The worksheet excludes title, overview, genres, candidate names, policy
  terms, current placement, retrieval, embedding, prompt, provider, model,
  score, and every decision proposed by Classifarr.
- A generated opaque submission ID distinguishes documents but does not identify
  a person or prove independence. Reviewer separation and secure distribution
  remain external operational controls.
- Input and output are local-only artefacts under the same constrained private
  boundary. No database, HTTP route, queue, scheduler, provider, or RAG index
  is touched.
- The finalized submission has no authority beyond offline consensus. It cannot
  learn from a label or change a live classification decision.

## Research basis

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented test sets, metrics, uncertainty, and independent review.
  Packet re-binding and a separate completed submission make the human evidence
  reproducible without treating it as automatic training data.
- The [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends provenance, integrity validation, access control, and fail-closed
  operation. The workflow validates an exact fingerprint/fixture set and never
  makes the private input a retrievable application resource.
- [W3C WAI guidance on user notification](https://www.w3.org/WAI/tutorials/forms/notifications/)
  calls for concise, clear completion and error feedback. The local CLI uses a
  small status/count receipt instead of another dense Command Center panel.

## Options and trade-offs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Hand-author a reviewer submission | No code | Easy to omit a fixture, mistype a fingerprint, or add unsupported fields | Rejected |
| Let the packet become a valid submission by default | Fast | Would silently label every case and invite circular or accidental evidence | Rejected |
| Add a live browser review dashboard | Familiar UI | Expands sensitive-data retention, authorization, and dense-screen scope | Rejected |
| Local incomplete worksheet plus packet-bound finalizer | Clear bounded task, exact coverage checks, no new network surface | Reviewers still make three choices per case | Selected |

## Final recommendation stack

1. Capture only a current, readiness-gated packet from normal lifecycle data.
2. Generate two separate worksheets and distribute packet/context outside the
   product to genuinely independent reviewers.
3. Finalize each completed worksheet before expiry; resolve any disagreement
   with the existing third-reviewer adjudication path.
4. Run existing fingerprint-bound consensus and offline results summary.
5. Only if measured, stratum-specific results support it, design a separately
   governed candidate-bounded advisory priority experiment. Keep routing
   deterministic unless a later decision explicitly changes that authority.
