# Evaluation coverage gaps: design

## Decision and scope

September 25, 2026. Extend the existing bounded evaluation history, not a second
scheduler or a new inference authority. Classifarr evaluates movie/TV libraries;
music remains excluded. This change does not enable capture, change a quota,
promote a model, route media, create labels, or deploy a release.

## Root cause

Commit `70572763` retained distinct-item completion and label coverage, but reduced
each unsuccessful pair to `paired: false`. Replay also collapsed configuration,
runtime, preparation and request failures into `unavailable`. The operator could
not distinguish an actionable cache gap from a result that must not be retried
until it looks successful.

The capture worker already resumes missing requests through durable checkpoints,
reserves quota before each call, and rotates only after publication and replay.
Reusing an invalid cached response is intentional for honest evaluation: blindly
retrying invalid output would hide failures and bias the benchmark.

## Recommended stack and tradeoffs

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Add categorical facts to existing history and SWR summary | Reuses retention, access controls, deduplication and scheduling | Versioned readers and migration required | Adopt |
| Retry every unsuccessful pair immediately | Might increase completed counts | Retry amplification, quota waste, selection bias | Reject |
| Add a separate workflow engine / queue | Useful for distributed long-running work | Another authority and recovery ledger for an already bounded local worker | Defer |
| Persist prompts and error messages for diagnosis | More detailed debugging | Private content exposure and storage growth | Reject for this aggregate view |

Final recommendation: small ESM gap-classification service; versioned PostgreSQL
history; existing admission/checkpoint/budget worker; existing authenticated,
read-only summary endpoint; nonpersistent Vue SWR and native disclosure controls.

## Contract

- History v2 stores two allowlisted arm gap categories alongside existing facts.
  No model text, prompts, titles, library names, URLs or exception messages enter
  the history or API. Legacy v1 rows remain readable; their missing reasons are
  explicitly unknown, never reconstructed from a guess.
- For each revision, retain latest completed outcomes as before. For items never
  completed within retained history, use their latest observed gaps. Count each
  such item once, preferring a blocking cause over a missing-cache cause. Counts
  sum to selected minus completed. Unselected eligible items are a separate gap.
- Label gaps remain separate: no reference label means unknown correctness, not
  an inference failure and not permission to use model output as ground truth.
- Preserve 500 windows / 30 days and original first-observation expiry. Include
  gap categories in canonical result identity so changed diagnoses are recorded.
- Bump computation provenance; old and new evaluator revisions do not mix.

## Recovery semantics

Missing-cache-only items can be filled by the existing scheduled capture worker
when enabled, admitted and within quota (at most five new calls per tick). A
restart resumes checkpointed requests; failed/unknown attempts remain charged.
Provider/availability failures retain existing cooldowns. This summary must not
claim a saved gap is a currently running or enabled job.

Unavailable evidence/configuration/runtime and unsupported preparation are
re-evaluated when inputs change. Invalid responses and output/context limits are
reported as evaluation failures, not retried until passing. Cache retention and
normal window rotation remain unchanged; this is not a permanent failure ledger.
Missing labels require independent evidence, not extra inference.

## Official guidance researched

URLs were located and read using online tools on September 25, 2026. These sources
inform the design; they do not prescribe the project's exact bounds or schema.

- [NIST AI RMF Core, Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/):
  document measurement limits and test systems before and during operation.
  Keep coverage, completion and independently labeled outcomes separate.
- [AWS retry behavior](https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html):
  classify retryable failures and bound retries with quotas and backoff. Reuse the
  existing retry owner rather than layering another retry loop on top.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  restrict sensitive diagnostic data and enforce retention. Persist categories,
  not private parser/error payloads.
- [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide):
  keep automatic summary updates pausable.
- [W3C Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  preserve non-disruptive loading/error status announcements and keyboard access.
  Detailed gap counts are ordinary disclosed content, not repeated alerts.

## Acceptance and follow-up

Test every gap category, mixed-arm precedence, old records, overlap/deduplication,
recovery after cached responses arrive, invalid response retention, publication
atomicity, PostgreSQL migration, hostile/private fields, SWR pause/auth failures,
and mobile/keyboard access. Use synthetic data and no paid/live model calls.

Next: **mixed deterministic/AI outcome evaluation**. Eligibility includes pairs
where only one arm needs AI, but the current paired AI reducer requires both arms
to use candidate adjudication. Such items cannot be repaired by more inference.
Represent the deterministic arm's real decision directly and use cached AI only
for the other arm, under a new benchmark revision. Compare against independently
screened reference labels, retain abstentions/invalid output, and report coverage
and quality separately. Do not mint routing authority or add artificial AI calls.

Acceptance: synthetic automatic-vs-AI, AI-vs-automatic and differing automatic
decisions produce honest paired outcomes; missing cache still obeys the existing
budget; invalid output remains a failure; movie/TV coverage is distinct; music
stays excluded. This advances the evaluator rather than adding another dashboard.
