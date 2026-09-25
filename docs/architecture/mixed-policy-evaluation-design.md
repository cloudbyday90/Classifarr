# Mixed deterministic/AI evaluation: design

## Decision

September 25, 2026. Extend the current automatic movie/TV comparison worker to use
a validated deterministic automatic decision directly. Only an arm requiring
candidate adjudication may prepare an AI request or consume a cached response.
Do not turn a policy decision into a fabricated AI response or routing receipt.

## Previous-commit review and root cause

Commit `f5a51d00` exposed why selected comparisons were incomplete. Inspection
confirmed a structural gap: `replayCachedAdjudication` selects differing automatic
decisions and automatic-vs-AI pairs, but required `mode === 'adjudicate'` on both
arms. A legitimate `skip` mode therefore became `not_adjudication`; retrying AI
could never complete it.

The new adapter requires agreement between the projected automatic outcome, the
underlying `auto_classify` policy result, `skip` mode and one current same-media
destination. It rejects missing, conflicting, inactive, ambiguous or cross-media
destinations. It does not use library names, genre-specific rules, source library
membership or labels to select the destination. Music remains excluded.

## Contract and measurement

- Replay report v3 separates automatic decisions from AI cache hits, proposals,
  abstentions and invalid output. Deterministic arms consume zero provider tokens
  and do not contribute artificial latency or cache hits.
- Completed pairs are partitioned into deterministic-only, mixed and AI-only.
  Compare canonical destination identifiers; automatic decisions and AI proposals
  are destination-bearing outcomes, but an AI proposal is not routing approval.
- Existing screened correction labels are used only by the final reducer.
  Missing labels stay unknown correctness. More completed pairs and fewer
  abstentions do not themselves demonstrate better classification.
- AI verification/classification modes and manual decisions remain outside this
  paired-adjudication experiment. Invalid AI output and missing cache remain
  incomplete. Agreeing automatic pairs remain excluded by existing selection.
- History v3 adds only a categorical pair kind; it never retains destinations,
  prompts, titles or provider content. Old v1/v2 evidence stays readable and is
  reported as legacy pair-kind coverage, not silently reinterpreted.
- Bump evaluator provenance and versioned aggregate readers. Preserve the
  300-item frozen cohort, 25-pair window, 500-window/30-day history, existing
  admission, cooldown, checkpoint and quota boundaries.
- Empty capture plans return without loading provider configuration or inspecting
  a model, after confirming inputs have not changed. Capture permissions and
  daily quotas are unchanged; this does not enable a disabled capture worker.

Scheduling limitation: a zero daily capture budget currently disables the worker
that advances selection windows, even if a window needs no AI. This change fixes
evaluation semantics, not that scheduling authority. The follow-up is a bounded,
restart-safe zero-inference window progression path independent of AI permission.

## Options, pros and cons

| Option | Benefit | Cost / risk | Recommendation |
| --- | --- | --- | --- |
| Small outcome adapter plus versioned existing reports/history | Honest mixed coverage, fewer required AI responses, shared recovery controls | Additional compatibility validators and migration | Adopt |
| Force both arms through AI | Uniform provider-only comparison | Changes the tested production path and spends unnecessary inference | Reject |
| Encode automatic decisions as fake AI proposals/cache hits | Small patch | Misleading usage and origin metrics | Reject |
| Build another evaluation queue | Independent scheduling | Duplicate admission, budgets and recovery ownership | Defer |

Recommended stack: ESM outcome adapter and reducer → existing isolated replay
worker → PostgreSQL bounded history → protected aggregate GET → existing Vue SWR
summary. Keep details collapsed and updates pausable; add no inference controls.

## Official research

Sources were located and read with online tools on September 25, 2026. The
implementation decisions below are project-specific applications of the guidance.

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/):
  document repeatable evaluations, metrics and limitations. Version the changed
  experiment and keep the execution paths visible rather than mixing old results.
- [NIST AI risks and trustworthiness](https://airc.nist.gov/airmf-resources/airmf/3-sec-characteristics/):
  report test conditions and distinguish performance across relevant segments.
  Keep movie/TV and deterministic/mixed/AI coverage separate from labeled quality.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  minimize sensitive diagnostic data and respect retention. Export only categorical
  counts through the existing administrator-only, no-store endpoint.
- [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide):
  preserve pause/resume for auto-updating information. Use the existing native
  disclosure and keyboard focus behavior for the additional origin counts.

## Acceptance

Test automatic-vs-AI in both orders, differing automatic decisions, numeric/string
identifiers, missing/cross-media/disabled destinations, invalid output, abstentions,
missing labels, empty plans, cache recovery, legacy versions, PostgreSQL migration,
history deduplication and origin-count integrity. Use synthetic data only; no live
provider calls, routing changes, version bump, release or live deployment.
