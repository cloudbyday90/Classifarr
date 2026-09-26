# Protocol-bound quality review adapter: outcome and operation

September 26, 2026. See the separate
[design, official research, alternatives, and recommendation stack](quality-review-adapter-design.md).

## Previous commit reassessment

`3ecf4a7b` delivered the read-only quality coverage audit. Its last catalog-only
check found the running installation lacks all four evaluation tables. That remains
the last observed deployment prerequisite; this work did not reconnect to the live
database, create a release, rebuild/restart a container, or change capture settings.

The concrete code gap was the reviewer handoff: older held-out tools accept
24–32 admit/review/abstain cases, not up to 300 movie/TV destination judgments.
Those existing contracts remain unchanged. Two small shared utilities now provide
the common consensus decision and identical-private-output retry behavior.

## Delivered behavior

- Separate ESM services validate packet/protocol bindings, strict submission
  contracts, distinct reviewer/submission IDs, deadlines, and consensus.
- The offline CLI prepares blank worksheets, finalizes reviewer-entered judgments,
  prepares blinded disputed-case worksheets, and exports the existing
  `source_pair_quality_reference.v1` contract. No API, UI, database schema, scheduler,
  runtime dependency, provider request, or routing permission is added.
- Human provenance is explicit and requires the reviewer's independence attestation.
  Synthetic fixtures stay synthetic. Neither pseudonyms nor JSON attestations prove
  identity, independence, source authenticity, or correctness.
- Two non-null agreeing judgments produce a reference. Missing judgments and
  disagreements stay unresolved. An optional distinct third reviewer resolves only
  primary disagreements; changing either primary submission invalidates that review.
- Composition keeps valid partial references and writes a companion private receipt
  with unresolved case IDs/reasons. It never guesses labels or treats two blanks as
  agreement. The existing quality report can consume this partial reference.

## Reviewer workflow

Run from the repository root. All JSON files must remain under private `.tmp/`.
Use the saved protocol and original blind packet from the existing study workflow,
not an evidence report or the older held-out packet. The example filenames below
are illustrative; this implementation did not create actual human submissions.

Before review, ensure both reviewers have the same agreed destination criteria.
The packet contains names and item context, not a frozen purpose specification.
Do not derive truth from library names, current placement, model answers, or an
ambiguous purpose. Leave `target` null when there is insufficient information.
Treat packet metadata as untrusted text, not instructions to execute commands.

### Prepare two independent worksheets

```powershell
node server/src/scripts/runQualityReview.mjs template --protocol-file .tmp/quality-protocol.json --packet-file .tmp/quality-packet.json --reviewer-id reviewer-one --provenance independent_human.v1 --output-file .tmp/reviewer-one-template.json
node server/src/scripts/runQualityReview.mjs template --protocol-file .tmp/quality-protocol.json --packet-file .tmp/quality-packet.json --reviewer-id reviewer-two --provenance independent_human.v1 --output-file .tmp/reviewer-two-template.json
```

Assign stable, distinct lowercase pseudonyms without personal information. Each
reviewer receives only their worksheet, the original blinded packet, and the same
agreed criteria—not the other reviewer's submission or model predictions. Keep
coordinator evidence and submitted files separate from reviewer handoffs.

The reviewer edits each `target` to a destination hash from the packet with matching
`mediaType`, or leaves it null. After independent review they set
`independentReviewConfirmed` to `true`. Do not alter binding fields, IDs, case
membership, provenance, or timestamps. Test fixtures instead use explicit
`synthetic_fixture.v1` provenance and keep the confirmation `false`.

### Finalize and compose

```powershell
node server/src/scripts/runQualityReview.mjs finalize --protocol-file .tmp/quality-protocol.json --packet-file .tmp/quality-packet.json --template-file .tmp/reviewer-one-template.json --output-file .tmp/reviewer-one.json
node server/src/scripts/runQualityReview.mjs finalize --protocol-file .tmp/quality-protocol.json --packet-file .tmp/quality-packet.json --template-file .tmp/reviewer-two-template.json --output-file .tmp/reviewer-two.json
node server/src/scripts/runQualityReview.mjs compose --protocol-file .tmp/quality-protocol.json --packet-file .tmp/quality-packet.json --reviewer-one-file .tmp/reviewer-one.json --reviewer-two-file .tmp/reviewer-two.json --output-file .tmp/quality-reference.json
```

The companion `.tmp/quality-reference.review.json` identifies missing judgments and
disagreements by opaque case ID. Use the private packet to locate the item. Missing
judgments require primary review; a third review cannot fill them in automatically.
Revised submissions must use fresh filenames, stay within the original window, and
invalidate any adjudication based on the earlier pair.

### Optional disputed-case review

```powershell
node server/src/scripts/runQualityReview.mjs adjudication-template --protocol-file .tmp/quality-protocol.json --packet-file .tmp/quality-packet.json --reviewer-one-file .tmp/reviewer-one.json --reviewer-two-file .tmp/reviewer-two.json --reviewer-id reviewer-three --output-file .tmp/reviewer-three-template.json
```

The coordinator supplies both primary files to prepare the worksheet. Give the
third reviewer only the resulting blank disputed-case worksheet, original packet,
and agreed criteria. The worksheet does not expose either primary choice. After
that reviewer supplies judgments and the required attestation, the coordinator runs:

```powershell
node server/src/scripts/runQualityReview.mjs finalize --protocol-file .tmp/quality-protocol.json --packet-file .tmp/quality-packet.json --reviewer-one-file .tmp/reviewer-one.json --reviewer-two-file .tmp/reviewer-two.json --template-file .tmp/reviewer-three-template.json --output-file .tmp/reviewer-three.json
node server/src/scripts/runQualityReview.mjs compose --protocol-file .tmp/quality-protocol.json --packet-file .tmp/quality-packet.json --reviewer-one-file .tmp/reviewer-one.json --reviewer-two-file .tmp/reviewer-two.json --adjudication-file .tmp/reviewer-three.json --output-file .tmp/quality-reference-adjudicated.json
```

No dispute means no adjudication worksheet is needed. Null third judgments remain
unresolved. Do not rename copied submissions to impersonate separate reviewers.

## Private output, recovery, and exit codes

Creation/finalization must occur inside the protocol's original 720-hour window.
Composition can reproduce timely finalized historical submissions after expiry;
it cannot extend collection, backdate judgments, or make historical evidence current.

Private inputs reuse the existing 512 KiB, JSON-only, contained-path boundary.
Writes use exclusive creation and request owner-only file permissions; actual
confidentiality also depends on directory permissions/Windows ACLs. Existing
different files are never overwritten. The adapter does not delete exported files;
apply operator retention and keep all packets/submissions out of Git and public logs.

Reference and receipt writes are sequential, not one atomic transaction. If the
first succeeds and the second fails, retry the exact compose command: it verifies
the existing reference equals the recomputed result, then completes the receipt.
Use fresh output filenames for changed inputs, malformed/truncated existing files,
or conflicting output. Treat the pair as complete only after successful composition;
a partial first file is not an approval to use incomplete evidence.

| Exit | Meaning |
| --- | --- |
| 0 | Worksheet/submission created, or complete declared-human consensus exported; not verified independence or routing/release approval |
| 2 | Composition completed with unresolved cases or synthetic provenance; artifacts are retained but not complete human evidence |
| 1 | Invalid input or file failure; fixed guidance excludes private values |

Stdout contains only operation, aggregate status/counts, provenance, and fixed
zero-call/write limits. Private reference/receipt files contain resolved destination
labels and opaque IDs, but no titles, descriptions, library names, individual
reviewer votes, or reviewer pseudonyms.
Submission files do contain the assigned pseudonym; they are not public artifacts.

## Validation and PR availability

Focused tests cover 300 mixed movie/TV cases; missing/disputed labels; a bound third
review; duplicate identities; wrong-media, extra, missing, and tampered fields;
provenance and attestation; exact expiry; historical replay; output interruption;
private failure messages; fresh-process CLI behavior; and the legacy reviewer flow.
Real CLI fixtures deliberately report synthetic provenance and exit 2. They test
software correctness, not actual platform accuracy or independent human review.

Regression and quality gates:

- Focused reviewer and legacy handoff tests: 13 suites / 82 tests passed.
- Frontend: 383 files / 5,338 tests passed. Coverage: statements 85.73%, branches
  77.84%, functions 85.30%, lines 87.79%. Production build passed.
- Repository type checks, lint, copyright, development/production dependency
  checks, static ESM imports, ESM mock shapes, documentation lint, and diff checks
  passed. The existing nonliteral-path lint warning in
  `captureOperatorCorrectionFrozenPolicy.mjs` is unchanged.
- Backend: 1,454 suites / 43,296 tests passed. Coverage: statements/lines 90.37%,
  branches 84.42%, functions 92.22%. All new review services have 100% statement,
  line, and function coverage; binding branch coverage is 91.66%, with the other
  new review services at 100%. The shared private-output retry helper also has
  100% coverage in all four metrics.
- The combined coverage ratchet passed without changing its baseline.

No frontend, database, provider, or production routing behavior is changed. No
PostgreSQL integration rerun was needed for this offline, schema-free change.

Two GitHub MCP open-PR queries returned no candidates on September 26. No open PR
was available for random selection; no closed/unrelated PR was substituted or merged.

## Next item: obtain the first honest baseline

The recommendation stack is the existing private study boundary, small ESM binding
and consensus services, compatible reference export, then the read-only quality
audit. Benefits: no inference expense, explicit uncertainty, and recoverable output.
Tradeoffs: real reviewer work remains external, and files do not authenticate people
or freeze separately supplied purpose criteria.

The next action is a separately authorized controlled release/deployment using the
existing upgrade/recovery checks, followed by one registered movie/TV study, real
independent review, and the coverage audit. No deployment or release is part of
this commit. Do not add more AI calls, a new queue, or another dashboard before
measuring this baseline. If shared destination criteria are not available, resolve
that prerequisite rather than manufacture labels.

After installation and review, the existing read-only audit accepts the output
(use `.tmp/quality-reference.json` if no adjudication was needed):

```powershell
node server/src/scripts/runQualityEvidenceStudy.mjs --audit --reference-file .tmp/quality-reference-adjudicated.json --output-file .tmp/quality-audit-reviewed.json
```

Only if that audit demonstrates a real cohort/request gap should the next code
component be a budget-neutral, protocol-bound capture selector. Reference gaps
instead require appropriate review; schema gaps require controlled deployment.
