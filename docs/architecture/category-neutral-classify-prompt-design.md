# Category-neutral initial classification guidance

Research: November 9, 2026 Eastern. Baseline main ff7859e3f. Status: agreed;
the operator confirmed the complete scope before implementation. No release
or deployment.

## Problem and actual consumer

The classify-only suffix in `classificationAiService.mjs` categorically rejects
certification as a destination indicator and names a "Family" destination in a
rating/genre prohibition. Destination meaning should not depend on a built-in
library name or an application-wide category exception.

The initial classify packet contains item metadata, aggregate signals, optional
observed profile/RAG evidence and existing web research. It does not contain a
complete declared-purpose or rating contract for every library. The new private
purpose sidecar remains adjudicate-only. Do not tell the model that unavailable
configuration was supplied, or reconstruct it from display names or placements.

`classificationDeterministicAiMode.mjs` selects generic classify when there is
no ranked policy candidate/action. Ranked policy review retains its separate
verify/adjudicate/abstain paths. This correction does not establish the cause of
historical policy disagreement or demonstrate improved classification accuracy.

## Proposed complete first batch

Extract the existing static classify-only suffix into a small pure
`classificationClassifyInstructions.mjs` service leaf. Append it once at its
current point after existing web research. Keep all current clarification,
confidence, format and option-count instructions except the two category/rating
assumptions. Replace those two lines with these instructions:

> A content rating describes the item; it does not by itself establish a
> destination or a library's rules. Use ratings only with library-specific
> support actually present in the supplied evidence; do not invent rating
> requirements or exclusions.

> Do not infer a library's purpose, audience or restrictions from its name.
> Treat missing evidence as unknown, and observed profiles or past placements
> as observations rather than declared policy.

This is static guidance, not a new evidence producer or permission check.
Preserve the current item/profile/RAG/web packet and disclosure boundary; add no
rule reload, context field, capture, raw-purpose log or persistence payload.
Ratings remain metadata; this batch adds no rating rule/scorer or inferred
constraint. Model proposals may change. Scores, thresholds, deterministic mode
selection, clarification eligibility and routing/learning authority do not.

Preserve exact existing verify/adjudicate prompt construction and schemas.
Keep provider admission, locks, quotas, cancellation, repair/retry limits,
response membership checks and authorization outside the prompt unchanged.
Classify retains its existing repair opportunity; do not import adjudication's
no-repair contract into this path. Do not add a provider call or external service.

Add no UI, API, setting, schema, job, operator CLI trigger or live configuration
write. Existing automatic execution consumes the new wording directly.

## Meaningful verification

- Freeze old behavior and show the category/rating wording regression before
  replacement. Preserve unrelated clarification/format instructions and exact
  base introductions. The suffix must occur once, only in classify, after the
  existing web research.
- Exercise real Ollama and custom-provider HTTP through disposable loopback
  endpoints and inspect final requests. Assert current CONFIDENT/CLARIFY parsing,
  schema, candidate indexes/membership and successful generation count. Retain
  existing malformed-output, repair and transient-boundary controls.
- Exercise the production no-policy classify owner and deterministic mode tests;
  policy abstention must not become permission to use generic classification.
  A high-confidence synthetic AI proposal must still fail the real route-safety
  gate without independent authorization.
- Rename/reorder synthetic library labels while preserving static guidance and
  index contracts. This proves deterministic construction, not model-output
  invariance under renaming or resistance to every prompt injection.
- Run fresh backend coverage and normal lint/type/Knip/ownership/policy/ESM gates.
  Coordinate fresh client qualification with the independent dependency batch;
  reuse evidence only after unchanged source/tree/report hashes are proven.
  Preserve scanner findings, baseline classifications and review limits.

Document observed outcomes separately, update Unreleased, perform scoped artifact
maintenance, and commit/push all agreed changes on main. Inspect the exact code
commit's CI; no branch, release or deployment is proposed.

## Official guidance and application

Sources were discovered/opened through MCP on the research date.

- [OWASP prompt-injection guidance](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.md)
  separates untrusted content from instructions and requires downstream
  validation/permissions outside the model. Apply that principle by preserving
  deterministic gates; wording is not a security boundary or injection cure.
- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) distinguishes data and derivation.
  Our application is to keep observed placements/profile summaries separate from
  declared purpose and missing proof. This batch adds no PROV/RDF implementation
  or conformance claim. There is no new UI/accessibility surface.
- [NIST AI 600-1](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=958388)
  considers provenance, pre-deployment testing and use-case-specific risk.
  Our application is to qualify the actual prompt/transport/authority boundary
  without claiming that synthetic payload checks measure model accuracy.

## Alternatives and final recommendation stack

| Option | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Static category-neutral classify suffix | Removes the concrete named exception without new disclosure or operator steps | Does not supply missing per-library intent or prove accuracy | First batch |
| All-library purpose projection for classify | Could supply actual declared meaning | New completeness, binding, admission, size and provider-privacy boundary | Separate design |
| Add more named category exceptions | Small local wording change | Continues category coupling and can contradict saved intent | Reject |
| Change rating scoring or route authorization | Could affect wider behavior | Mixes deterministic policy and permission changes with prompt cleanup | Outside this batch |

First qualify this narrow prompt boundary. Then assess whether the generic
no-policy path needs an independently bound, provider-safe purpose representation.
Keep post-choice compatibility-purpose learning and runtime-security updates
as separate follow-ups; no historical repair or new learning authority follows.
