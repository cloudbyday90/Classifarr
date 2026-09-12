# Adjudication response contract outcome

## Delivered component

Bounded AI candidate comparison now uses one two-field JSON contract across the
production prompt, provider schema, application parser and read-only replay.
The [separate design document](adjudication-response-contract-design.md) contains
the discovered official sources, security boundaries and option tradeoffs.

`candidateAdjudicationResponseContract.mjs` owns the strict Zod field definition,
provider-schema conversion, prompt instructions and server-owned result adapter.
The schema bounds the choice to the actual two or three candidates. Application
validation also enforces `PROPOSE` with a candidate index or `ABSTAIN` with null.
There are no generated confidence, reasoning or clarification fields to validate,
store or display. Invalid responses remain distinguishable from valid abstention.

Adjudication no longer uses generic pipe parsing, embedded-answer salvage or the
second-model repair path. Candidate verification and generic classification keep
their existing contracts. Policy thresholds, evidence checks and fresh routing
receipts remain unchanged. No new UI, acknowledgement, API or schema migration
was introduced; no library names or media categories are hard-coded.

## Local Compose comparison

The rebuilt application reported healthy with its database connected. SHA-256
checks matched all nine changed/new service files against the running container.
The reproduction command and before-change results are recorded in the
[previous replay outcome](policy-shortlist-replay-outcome.md#reproduction-and-provenance).
The installed local model, context, seed and 256-token response budget were kept.

The first run overlapped broad tests: three cases stopped at `evidence_unavailable`
before inference and one produced a valid 16-token proposal. Its one generation
request took 17,093 ms with 2,844 input tokens. This incomplete run is not a paired
four-case improvement result. The bounded retriever redacts provider/database
errors, so this report does not assert a specific timeout or outage cause.

After all heavy test runs finished, the same command completed with all four
cases ready and all four responses accepted as proposals. No additional code,
retrieval timeout, model setting or output-budget changes were made for the repeat.

| Measurement | Before contract alignment | Completed repeat |
| --- | ---: | ---: |
| Distinct retained cases (three movies, one TV show) | 4 | 4 |
| Actual generation calls in the compared run | 4 | 4 |
| Identical shortlist-arm results reused | 4 | 4 |
| Valid proposals | 2 | 4 |
| Output-limited responses | 1 | 0 |
| Parser-rejected responses | 1 | 0 |
| Mean output tokens | 175.25 | 13.75 |
| Mean input tokens | 3,008.5 | 2,878.5 |
| Mean generation-request latency (ms) | 9,904 | 4,740.25 |
| Potentially consensus-eligible proposals | 0 | 0 |
| New live routing authorizations | 0 | 0 |

The completed repeat used `gemma4:e4b`, temperature 0, seed 42, thinking off,
32,768-token context and the unchanged 256-token output limit. Provider grammar
was enabled. Latency is observed, not a guaranteed speedup: host load and model
warm-up were not independently controlled across the earlier and later runs.

There were five actual generation calls this turn: one in the incomplete run and
four in the completed repeat. Reused results are not additional calls. All four
completed proposals were blocked from consensus by `policy_review_required`;
historic low scores/manual-review decisions were not replaced. No routing
receipts, user questions or learning records were created by either replay.

The cohort still has no independently verified labels. Four accepted responses
are a response-reliability result, not accuracy or proof that a particular title
now routes correctly. The `--size 300` flag remains a maximum; this replay tested
four distinct retained identities, not 300 fresh evaluations.

Completed-repeat provenance:

- Source fingerprint: `8a84eef93a922e48f5ad989f04dbc8af15cc268ae4318320accbbc5c866e7fe1` (unchanged).
- Evidence/prompt fingerprint: `c6ae4be51ebaab62275142c883665b18a759c7afd4c666e022bb48fb34ea81ca`.
  This fingerprint includes prompt text, which intentionally changed.
- Model digest: `c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb` (unchanged).
- Response contract: `candidate_adjudication.response.v2`.
- Accuracy: null; fresh policy evaluation: false; input truncation: unknown.

## Validation

- Focused contract, production parser/provider, replay and policy-consensus tests:
  14 suites, 523 tests passed. These include malformed/prose/fenced/pipe responses,
  invalid candidate scopes, extra fields, abstention and repair suppression.
- Backend/client lint and type checks, ESM static-import and test mock-shape
  checks passed. Markdown lint and the Compose frontend build passed.
- Full backend coverage: 1,237 suites, 35,446 tests passed. The new contract
  module has 100% statement, line, branch and function coverage.
- Full PostgreSQL integration: 139 suites, 1,608 tests passed; one existing
  suite/test skipped.
- Full client coverage: 365 files, 5,036 tests passed. The first concurrent run
  hit the existing five-second timeout in the client TODO source scan; that file
  passed all 2,660 tests in isolation, and the full repeat passed without code,
  timeout or threshold changes. Client coverage remains statements 85.49%,
  lines 87.55%, branches 77.39%, functions 84.98%.
- Coverage ratchet passed without baseline changes. Backend coverage is
  statements/lines 90.02%, branches 81.63%, functions 92.11%.
- The production-naming gate still reports 26 pre-existing production references
  against its zero-reference baseline. No naming gate or baseline was relaxed.
- GitHub MCP searches on September 12, 2026 returned no open Classifarr PRs.
  No random PR was available to implement; none was merged.

## Next high-value item

Run **fresh, read-only policy plus AI evaluation across the existing held-out
300 movie/TV items**, instead of replaying four repeatedly stored policy results.
Use the production learned-library metadata, description retrieval, shortlist,
new response contract and routing checks through an isolated evaluation adapter.
Exclude each held-out item's identity and duplicate descriptions from its learned
evidence. Report results per library and media type, including retrieval failures,
candidate misses, abstentions, proposal disagreements, routing blockers and cost.

Existing placements are weak labels, not verified truth. Keep candidate recall,
agreement with existing placement, response validity and automatic-route
eligibility separate. This will show where organic library understanding actually
needs improvement without asking users to declare every library's purpose or
raising confidence scores merely to reduce reviews.

Recommended stack: learned library metadata and descriptions → policy-eligible
shortlist → minimal AI proposal/abstention → strict validation → existing routing
checks → held-out evaluation. Do not add another settings panel or model-repair
call to address a response-format problem.

No release, version bump or release tag is part of this change.
