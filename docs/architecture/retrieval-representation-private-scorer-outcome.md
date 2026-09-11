# Retrieval-Representation Private Scorer — Outcome

Status: implemented, unreleased on 10 September 2026. No release was created.

## Delivered

- Added modular ESM services for private scorer-input validation, bounded
  current-history retrieval, admitted structured evaluation, and categorical
  submission construction.
- Made reviewer-packet capture automatically create the private scoring input
  and two independent reviewer worksheets from the exact same prospective
  cohort. One explicit capture command now produces the redacted bundle,
  reviewer packet, scorer input, and both worksheets together.
- Added `study:retrieval-representation-score`, a status-only CLI that is
  database read-only, writes only a valid categorical submission below `.tmp`,
  and always closes its short-lived database pool.
- Added tests for binding, private-field rejection, parameterized retrieval,
  provider admission, label-included/label-free derivation, failure handling,
  and CLI output containment.

## Result

Classifarr can now generate the evidence needed by the paired
retrieval-representation artifact workflow without asking an operator to
manually transcribe one decision per item. The automatic portion remains
strictly offline and cannot route media, change a policy, learn from the
library, retry classification, or surface raw content in a browser or command
receipt.

This implementation intentionally does **not** claim that RAG is already
correct for a particular library or that a historical classification label
should be removed. It makes a bounded comparison possible. The outcome becomes
meaningful only after a real private run and an independently labelled
reference set are evaluated by the existing aggregate workflow.

## Local use

After the existing authorised reviewer-packet capture creates its five
companions, run the scorer with its exact paths:

```text
npm --prefix server run study:retrieval-representation-score -- \
  --bundle-file .tmp/<packet>.evaluation-bundle.json \
  --scoring-input-file .tmp/<packet>.scoring-input.json \
  --output-file .tmp/<packet>.submission.json
```

The command fails closed without writing a submission when the provider is not
the saved, verified, self-hosted structured-output Ollama configuration, when
history cannot be read, or when output is not exactly categorical JSON.

## Open-PR check

GitHub's public pull-request endpoint returned zero open pull requests for
`cloudbyday90/Classifarr` on 10 September 2026. No random open PR was
available to implement locally; no closed or merged change was reapplied.

## Next item

Acquire an independently double-labelled reference set for the pinned cohort,
then invoke `study:complete:retrieval-evaluation` once to run the scorer and
paired aggregate report. Review the included versus excluded history result by
stratum and uncertainty. If the label-free condition does not regress, the next
engineering proposal is a bounded, reversible ephemeral re-embedding pilot—not
an automatic routing or policy change.
