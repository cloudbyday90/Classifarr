# Production-contract shortlist replay outcome

## Delivered component

The existing benchmark command now compares the former metadata-only shortlist
with the description-preserving shortlist through shared production prompt,
response-parser, advisory, consensus-eligibility and route-safety code. See the
[separate design and researched tradeoffs](policy-shortlist-replay-design.md).

This component measures decisions; it does not train model weights, change policy
scores, lower thresholds, route media or add a user-facing setting. The production
prompt extraction preserves its text exactly. Replay services use ESM and an
independent read-only database pool. Candidate descriptions and learned profiles
are captured once per case; exact candidate/prompt pairs reuse one model response.

The previous [shortlist outcome](description-preserving-shortlist-outcome.md)
measured candidate inclusion, not classification accuracy. This implementation
supplies the next measurement layer without manufacturing policy decisions for
inventory-only items.

## Rebuilt local Compose measurements

Measured September 12, 2026 with the installed local `gemma4:e4b` model. Preflight
found four distinct retained policy identities from 72 repeated history rows:
three movies and one TV show. All four had usable current description evidence.
The `--size 300` setting is a maximum, not a claim that 300 cases were tested.

| Measurement | Result |
| --- | ---: |
| Distinct retained policy cases | 4 |
| Changed old/new shortlists | 0 |
| Actual generation requests per run | 4 |
| Identical protected-arm results reused | 4 |
| Valid proposals | 2 |
| Output-limited responses | 1 |
| Parser-rejected responses | 1 |
| Potentially consensus-eligible proposals | 0 |
| New live routing authorizations | 0 |
| Independently verified labels | 0 |

Both the initial run and a diagnostic repeat had the same outcome counts. Eight
local generation requests were made in total, not sixteen. The final repeat
reported mean generation-request latency of 9,904 ms, 3,008.5 input tokens and
175.25 output tokens across all four actual requests. The report explicitly
distinguishes actual calls from reused arm outcomes; do not add those two sets
together when estimating cost. Input truncation is unknown, not asserted absent.

The limited response reached the replay's 256-token output bound. The other
rejected response failed validation of `problem_summary`. Diagnostics retain only
that schema-owned field name, never the generated explanation or raw error text.
The three responses reaching consensus assessment were blocked by
`policy_review_required`; the output-limited response was not assessed as valid.

The command intentionally exits nonzero with `completed_with_errors` for these
model failures. Unit tests passing does not mean the model benchmark passed.
Identical shortlists and four historically selected cases cannot establish that
the earlier 299/300 candidate-recall result improved final classification. Accuracy
remains null. Frozen historic policy scores also cannot establish current routing
authority, even when current retrieval agrees with a destination.

The second rebuild briefly exceeded Compose's 120-second readiness wait during
PostgreSQL recovery and restarted once. A replay invocation during that startup
failed before producing a report. The diagnostic repeat was run only after the
service reported healthy with its database connected. This startup issue is
separate from model-response validation; no database contents were removed.

## Findings and next high-value item

The response-contract follow-up below is now implemented; see the separate
[aligned-contract design](adjudication-response-contract-design.md) and
[measured outcome](adjudication-response-contract-outcome.md). This document
retains the earlier measurements as the before-change baseline.

**Align and simplify the AI adjudication response contract next.** Production
`aiPromptBuilderFormatters.mjs` currently demands a pipe-delimited answer while
`classificationAiService.mjs` supplies non-reasoning local models with a JSON
schema. The schema also requires eight keys, including clarification fields that
are irrelevant to a successful proposal. Its `problem_summary` description says
50 characters, while the parser actually enforces that limit.

The conflicting formats are a concrete code finding and a plausible contributor,
not a proven sole cause of the observed rejection. Fix prompt/schema/parser
alignment together, prefer a small closed-candidate proposal-or-abstention
response, and regression-test both successful proposals and uncertainty. Preserve
strict candidate membership, server-owned confidence and routing checks. Do not
silently accept an invalid response or simply inflate the output budget until
these four cases pass.

| Follow-up option | Benefit | Cost or limitation |
| --- | --- | --- |
| Align and minimize the adjudication contract | Directly targets invalid responses and unnecessary generated questions | Requires coordinated prompt, schema, parser and compatibility tests |
| Increase output budget alone | May avoid the observed truncation | More latency; does not fix conflicting instructions or field validation |
| Re-run the same history repeatedly | Cheap regression check | Still only four identities; no evidence of broader accuracy |
| Fresh read-only policy evaluation on the existing held-out 300 | Measures actual policy and AI behavior across more libraries | Needs an isolated evaluation adapter; historical replay cannot substitute for it |

Recommended order: fix response-contract alignment, then run fresh policy and AI
evaluation on the existing held-out 300 movie/TV cases. Learn from library contents
and metadata without library-name-specific exceptions. Keep existing placements
as weak labels and distinguish model reliability from semantic correctness and
automatic-routing eligibility. Add no more acknowledgements or dense settings.

Final stack: library-agnostic inventory evidence → policy-eligible shortlist →
aligned minimal AI contract → strict server validation → existing routing checks.
The replay remains the read-only regression tool for that stack.

## Reproduction and provenance

```powershell
docker compose exec -T -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false `
  -e 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=1000' `
  classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs `
  --seed classifarr-policy-replay-20260912 --size 300 --policy-shortlist-replay `
  --generate-cases 4 --context 32768 --max-minutes 20
```

Omit `--generate-cases` for preflight. Do not combine this mode with grouped-fold,
prior-cohort or alternative benchmark-mode flags. Run only after Compose is
healthy. Generation remains local-only with no fallback, model pull or persisted
learning/question/route writes. Application startup maintenance is not part of
that replay-only no-write guarantee.

- Source fingerprint: `8a84eef93a922e48f5ad989f04dbc8af15cc268ae4318320accbbc5c866e7fe1`.
- Evidence fingerprint: `849af36d165d52ba46eefc8d22ece4fcfd11aacf7d773cb6aa398ad6a47a42d1`.
- Model digest: `c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`.
- Controls: temperature 0, seed 42, thinking off, 32,768-token context,
  256-token output limit; no change to live provider settings.
- GitHub MCP returned no open Classifarr pull requests on September 12, 2026.
  No random PR could be selected, implemented or merged.

## Validation

- Focused production/replay checks: 6 suites, 128 tests passed.
- Targeted PostgreSQL integration: 2 suites, 11 tests passed.
- Client coverage run: 365 files, 5,036 tests passed.
- Server/client lint and type checks, ESM static imports and mock-shape checks,
  Markdown lint and Compose frontend build passed.
- Full backend coverage: 1,236 suites, 35,358 tests passed.
- Full PostgreSQL integration: 139 suites, 1,608 tests passed; one suite/test
  skipped by the existing configuration.
- Coverage ratchet passed: server statements/lines 90.02%, branches 81.62%,
  functions 92.10%; client statements 85.49%, lines 87.55%, branches 77.39%,
  functions 84.98%. The baseline was not lowered.
- SHA-256 comparisons matched all six edited/new service files against the
  rebuilt container; its final health check reported the database connected.
- The existing production-naming gate still reports 26 pre-existing references
  against its zero-reference baseline. This change neither adds naming debt nor
  relaxes that gate. Do not describe all CI gates as green.

No release, version bump or release tag is part of this change.
