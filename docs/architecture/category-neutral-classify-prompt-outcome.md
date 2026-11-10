# Category-neutral initial classification outcome

November 9, 2026 Eastern. Baseline main ff7859e3f. The complete
[design](category-neutral-classify-prompt-design.md) was confirmed before
implementation. Local qualification is complete; exact-source CI is pending push.
No release, deployment, live provider call or configuration write.

## Implemented behavior

`classificationClassifyInstructions.mjs` owns the static suffix, appended once
at the existing classify-only call site after web research. Two instruction lines
change: ratings require library-specific support actually supplied, rather than
being categorically rejected; names do not establish purpose, audience or
restrictions, and profile/placement observations do not become declared policy.
All other clarification and format instructions remain.

A direct comparison against the baseline suffix confirms the other fifteen
lines are identical after removing the two replaced instruction lines.

There is no new context field, rule read, disclosure or purpose producer.
The private declared-purpose sidecar remains adjudicate-only. The initial packet
does not acquire complete per-library purpose/rating contracts. Model proposals
may change; this supplies neither a deterministic accuracy guarantee nor an
explanation of historical classifications.

The production deterministic-mode owner still selects generic classify only for
the no-ranked-policy-candidate path. Policy review retains verify/adjudicate or
abstention. Scoring, thresholds, clarification eligibility, provider admission,
locks, quotas, cancellation, repair/retry and routing/learning authority remain.
The existing classify repair opportunity is preserved, not replaced by the
stricter adjudication contract. No UI, API, job, setting or operator step is added.

## Observed regression evidence

Before implementation, both real Ollama and custom-provider loopback requests
failed the category-neutral wording checks. Six ordinary parsing/index/authority
controls already passed. After the correction, all seven focused suites and
149 tests pass, including production no-policy owner/mode and route-safety tests.

The new HTTP controls inspect final transmitted requests: the suffix occurs once
after actual normalized research, the existing response schema remains, and a
successful generation makes one request. CONFIDENT and CLARIFY retain valid
supplied indexes. A synthetic high-confidence answer still has no route, learning
or policy-mutation permission and fails the real automatic-route gate. An
out-of-set answer remains review-bound and cannot obtain a disabled repair call.
Renaming/reordering libraries changes only their existing labels/index mapping;
static instructions stay identical. This does not prove model-output invariance.
Existing adjudication HTTP and exact base-prompt/mode controls pass.

Backend lint/typecheck, normal/production Knip, ownership, four policy gates,
static import/mock-shape checks and copyright checks pass without baseline,
classification or review-limit changes. Fresh full backend coverage passes
1,938 suites and 62,964 tests, with one existing skip: statements/lines 89.30%,
branches 86.76% and functions 90.84%. All 7,423 frozen code inputs remain identical
after execution, and both current reports pass the coverage ratchet. Exact-source
CI results will be recorded after push. Preliminary interrupted reports do not
qualify delivery. The independent
[client outcome](client-jsdom-pr-588-outcome.md) records fresh coverage,
production build/browser, tooling, compiler and audit results.

Scoped maintenance reuses the recent reviewed inventory. The Docker daemon,
all three protected service/image identities, precise start times and health
remain unchanged. Preserve recovery assets, worktrees, toolchains, volumes,
shared cache, other projects and current evidence. No local image is built and
no stale artifact is selected for removal; no production cleanup or restart.

## Research and tradeoffs

The [design's MCP-retrieved official sources](category-neutral-classify-prompt-design.md#official-guidance-and-application)
apply OWASP instruction/data and external-enforcement principles, W3C provenance
distinctions, and NIST context-specific evaluation guidance. This is application
of those principles, not certification or a prompt-injection prevention claim.
There is no new accessibility surface or model/framework dependency.

| Choice | Benefit | Remaining limit |
| --- | --- | --- |
| Static classify-only leaf | Removes a concrete named exception with a small automatic change | Initial classify still lacks full per-library declared purpose |
| Preserve external authority | Prevents prompt wording or model confidence granting permission | Prompt text cannot guarantee the model uses evidence correctly |
| Preserve existing packet and modes | Avoids a new disclosure/configuration boundary | Does not repair historical evidence or ranked policy disagreement |

Next inspect `aiResponseParserResults.getDefaultLibrary`: malformed/fallback
advice still prefers broad destination names or the last supplied library before
manual review. Trace its references and replay/decision semantics before choosing
a category-neutral replacement. Keep the existing review/route safeguards.
Broader purpose projection for generic classify remains a separate later design.
