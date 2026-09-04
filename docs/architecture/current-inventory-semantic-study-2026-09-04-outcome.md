# Current-Inventory Semantic Study: 2026-09-04 Outcome

## Decision

Do not add semantic counter-evidence to the policy path from this result.
One real 28-case inventory replay was captured through the existing private
stdin boundary in local Docker Compose. Both the existing readiness command
and frozen-study preflight returned `not_ready`. The independent human
labelling step remains incomplete; this is an operational capture result,
not a completed independently labelled accuracy study.

## Recent Work Reviewed

The latest ten GitHub PRs inspected, #516–#525, were dependency updates closed
without merge. The relevant semantic work is in the recent commits and their
architecture documents. GitHub returned no associated PR for the latest
[private-runner commit](https://github.com/cloudbyday90/Classifarr/commit/3e1b67e70593d7d83d7dc4179044093e6253cbd6).

| Commit | Contribution |
| --- | --- |
| `6e842352` / `64b7837b` | Outcome-calibrated semantic retrieval and cohort evaluation |
| `ccee6494` | Independent labels become the metric oracle rather than copying fixture decisions |
| `b9cc8546` | Complete redacted study bundles accepted by the readiness CLI |
| `799f5a56` | Fingerprint-bound, time-limited frozen-study preflight |
| `9734dc97` | Current-inventory leader/alternative snapshots |
| `e491231f` / `3e1b67e7` | Bounded capture and the private stdin runner |

The existing capture, independent-label, complete-bundle, readiness, and
frozen-preflight design/outcome documents consistently make measurement the
prerequisite for a later review-only experiment. They do not authorize
automatic routing from semantic similarity.

## Execution

The local Compose instance contained 6,692 inventory items and 6,772 current
embeddings. Its 73 non-import history rows represented only five distinct
requested titles, so repeated history rows could not form independent cases.
Instead, this run sampled distinct real inventory identities.

- Sampling used a fixed hash order with seed `study-20260904` and at most
  96 screened items per group. Groups were reality, documentary, other items
  with at least two genres, and ordinary remaining items, in that precedence.
- The final selection process evaluated 163 items and found 29 eligible
  two-candidate cases. It reserved four cases per group and filled the
  remaining places in screening order, producing 28 cases. Semantic capture
  results were not used to choose them.
- Incoming-request replay used existing content metadata without the source
  library assignment. Policy evaluation used the normal local Ollama/RAG
  configuration. It was not a live classification or routing request.
- Candidate membership and ordering came from the existing policy factories:
  adjudication with its supported `maximumCandidates: 2` for `prompt_select`,
  or an already two-candidate contrastive contract for `prompt_confirm`.
  No policy action was forced to make a case eligible.
- The coordinator used the same decision builder while omitting metrics
  finalization in its own process. PostgreSQL confirmed
  `default_transaction_read_only=on`. File logging was disabled and logging
  restricted to fatal errors for the study process.
- The raw request remained in memory and entered the existing runner through
  a bounded stdin stream. Only redacted artifacts were retained under the
  ignored `.tmp/semantic-study-20260904/` directory.
- The capture service, private runner, and semantic retriever in the container
  matched the checkout byte-for-byte by SHA-256.

The capture ran from `2026-09-04T20:56:52.179Z` to
`2026-09-04T20:57:03.120Z`. A before/after fingerprint of selected configuration
fields, inventory/embedding counts, last inventory sync, and last policy
update was unchanged. This check does not prove that every database row or
model artifact was immutable.

## Observed Signals

| Sampling group | Cases | Supports leader | Supports alternative | Abstains |
| --- | ---: | ---: | ---: | ---: |
| Documentary | 12 | 12 | 0 | 0 |
| Genre overlap | 5 | 5 | 0 | 0 |
| Ordinary | 4 | 4 | 0 | 0 |
| Reality | 7 | 7 | 0 | 0 |
| Total | 28 | 28 | 0 | 0 |

All retrievals were available. Leading relevance ranged from 99 to 100;
strongest-alternative relevance ranged from 0 to 78. The fixed existing
82-relevance/8-margin scorer therefore produced zero semantic review triggers
and zero conflicts with the policy leader.

These are signal counts, not correctness metrics. Precision, recall, false
positives, and false negatives against independent labels are unmeasured.
Moreover, zero review predictions cannot achieve the gate's 90% review recall
on any label set containing its required eight or more review references.

## Why This Is Not Readiness Evidence

Every selected item was already represented in the current embedding index.
The production candidate semantic query does not exclude the queried identity.
Thus the near-perfect leader similarity is consistent with retrieving the
item itself; it does not establish useful semantic generalization. No query
or index was changed to conceal this limitation.

The required `independent_double_blind_human.v1` protocol was not completed.
That contract requires two human reviewers for unanimous labels and at least
three for adjudicated labels. Neither the assistant, current library placement,
nor the stored policy outcome was represented as that review process.

`independent-labels.json` is explicitly JSON `null`. The fixture contract
requires a reference and candidate-selection observation, so the unlabelled
packet uses documented abstain/`routed_not_applicable` placeholders. They are
not asserted human decisions or actual routing events. The gate's fallback
metrics against those placeholders must not be quoted as measured accuracy.
No `broad-policy` tag was asserted without independent assessment; its verified
coverage is zero. Other group tags came from inventory genres and also await
human validation.

## Existing Gate Results

Both commands successfully evaluated the redacted bundle using their existing
project-contained file options.

| Check | Result |
| --- | --- |
| Capture request validation | Valid, 28 cases |
| Readiness | `not_ready` |
| Independent reference set | `unavailable` |
| Frozen proposal shape | Valid |
| Four document fingerprints | Match proposal |
| Proposal window | Active; expires `2026-09-18T20:56:52.179Z` |
| Frozen-study preflight | `not_ready`: `semantic_readiness_not_ready` |
| Policy-change / automatic-routing eligibility | Both false |

Readiness blockers were `independent_reference_set_unavailable`,
`insufficient_reference_review_count`, `insufficient_stratum_coverage`,
`precision_below_minimum`, and `recall_below_minimum`. The final two are gate
results against the placeholder baseline, not independently measured errors.

The proposal-cohort marker is
`sha256:04f52f9e28ac9f1d76d4e7a1c536460e515c1b160e9d284fdb6b338ab7fbd22c`.
The fixture fingerprint is
`sha256:149d5fd3a9920c95490b2caf38d85259ac38e5eee07655b1cedc944cea61ffa8`.
Binding a missing-label sentinel is only an operational preflight check;
completed labels require a new bound proposal.

Retained local artifacts include `execution-report.json`, `fixtures.json`,
`snapshots.json`, `manifest.json`, `independent-labels.json`, `proposal.json`,
`readiness.json`, and `preflight.json`. The ignored coordinator contains code
only. No raw title, synopsis, library name, prompt, response, vector, or
reviewer identity is included in the redacted bundle.

Validation confirmed all 28 fixture identities are unique, both document
schemas are valid, fingerprints match, each input is below 128 KiB, prohibited
content fields are absent, and all automatic-action flags remain false. The
artifact directory has an explicit current-user-only access rule. Markdown
lint and `git diff --check` passed. No production code changed.

## Next Required Work

The subsequent [held-out implementation](held-out-semantic-study-outcome.md)
adds cohort-wide SQL exclusions and isolated candidate preparation. This
historical v1 capture remains diagnostic and cannot satisfy held-out readiness.

Prepare a study that separates queried items from indexed evidence, using
held-out incoming cases or an explicitly isolated inventory/index snapshot.
Preserve the policy-owned candidate boundary and freeze that study's retrieval
configuration before inspecting its semantic results. The current library
must not be altered to manufacture a passing score.

Have independent human reviewers validate case content and tags, including
at least four broad-policy cases, and assign blinded reference decisions.
Retain representative ordinary cases as well as genuine review cases. Bind
the completed labels, rerun readiness and frozen preflight, and report errors
per stratum. Only a qualifying result can support a separate review-only
counter-evidence change; this run does not justify implementing it.
