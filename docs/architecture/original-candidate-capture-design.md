# Original candidate capture design

Date: 2026-09-07. Status: selected for implementation.

## Audit and decision

The prior Compose observation found five policy-ranked candidate IDs among 73
non-import history rows. That number measures one metadata path, not all proposals
the classifier produced. `classificationPersistenceService.mjs` only projects
`result.policyResult.ranked`; AI-only and signal-only decisions have no policy
ranking. `resolveAiUnavailableResult` also drops its supplied policy result on the
retry return and may drop signal context on fallback. Its decision-question helper
uses a policy result for routing checks without attaching it to the returned result.

Capture a bounded, versioned original-candidate record at the start of persistence,
before routing or human selection. Preserve policy/signal context through the
existing unavailable-AI helper. Keep the policy-ranked array as policy evidence;
do not populate it with a synthetic ranking based on an AI or signal proposal.

## Sources and missing reasons

`classification_details.candidate_capture` records version, the `pre_routing`
stage, the original method, a finite status/source and a candidate library ID when
available. It stores
no title, prompt, raw response, free-text reason or extra library metadata.

Prefer the first supplied policy-ranked candidate, then the first signal-ranked
candidate, then an actual decision proposal, then an available signal proposal.
A malformed leading candidate is invalid; never promote a later candidate or
replace an invalid leading prediction with the eventual destination. Empty rankings
allow another explicit source. Reject booleans, fractional, unsafe and out-of-range
IDs. IDs are PostgreSQL positive integers, not proof of current library eligibility.

| Status | Meaning |
| --- | --- |
| recorded | An explicit candidate ID was captured from a named source |
| no_candidate | A supported classifier path supplied no proposal |
| invalid_candidate | Supplied candidate evidence was malformed |
| not_applicable | Import, existing-membership or direct manual-selection path |
| unsupported_method | An unrecognized method cannot safely imply a proposal |

The default last-library fallback is not itself a prediction. Retry rows may retain
a policy or signal proposal, without becoming completed outcomes. The capture is
a scalar snapshot: later mutation of the result or a human-selected library cannot
alter its recorded candidate. Existing history is not backfilled from destinations.
Direct inventory and manual queue writers remain distinct from classifier output.
The clarification writer changes a history row's current method to
`manual_classification`; the capture retains its original method so that a later
resolution cannot erase the earlier proposal. Valid legacy policy rankings also
survive that method change. Imported-membership rows without an explicit prior
capture remain excluded from legacy classification evidence.

## Read model and compatibility

Extend the existing bounded evidence query with a fixed candidate-status partition
and reason counts. Valid legacy ranked evidence remains identifiable. Legacy rows
without that evidence stay unrecorded; new explicit absence is different from old
missing telemetry. New malformed/version-unknown capture data must not fall back to
apparently valid legacy data. Direct manual selections without prior candidate
evidence are not classification proposals.

Use `evidence.coverage.v2` because original-candidate availability now includes
explicit non-policy proposals and excludes non-classifier methods. Preserve the
existing fields and add mutually exclusive missing-reason counts. They reconcile
with original-candidate availability to retained history totals. Client presentation
uses labelled native text, preserves unavailable values, and adds no controls or
HTTP requests. The named client API documents the version/meaning change.

Prompt and standalone feedback continue using their existing policy-ranked
evaluation contract. Merely capturing an AI/signal proposal does not authorize a
new accuracy denominator, training use or automatic routing. Current eligibility,
independent labels, readiness and frozen-study preflight remain separate concerns.

## September 2026 research and alternatives

Official URLs were discovered with web search/GitHub MCP and read September 7,
2026. These are current observations, not claims about the rest of September.

| Recommendation | Benefit | Cost or limitation | Official source |
| --- | --- | --- | --- |
| Record source and generation stage | Separates a proposal from a later selection | A compact local contract needs documentation; it is not an RDF implementation | [W3C PROV-O](https://www.w3.org/TR/2013/REC-prov-o-20130430/) |
| Publish quality and missingness explicitly | Humans and future automation can assess suitability | Missing old evidence cannot be reconstructed reliably | [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) |
| Validate JSON shape before extracting IDs | Avoids malformed-data coercion and plausible false counts | SQL and ESM validation need parity tests | [PostgreSQL JSON operators](https://www.postgresql.org/docs/current/functions-json.html) |
| Keep recorded diagnostics bounded and free of raw content | Reduces disclosure and uncontrolled diagnostic size | Less detail than raw result dumps | [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) |

Inferring the original candidate from a selected library would contaminate
evaluation. Recording complete model responses would increase exposure and storage.
Adding manual annotations would duplicate work and violate the passive workflow.
Recommend a pure ESM capture module, the existing transactional JSONB persistence,
a separate SQL read-model module and a small native Vue presentation component.

## Verification

Test real persistence across policy, AI, signal, fallback and retry paths, malformed
first entries, subsequent selection/mutation, and explicit non-classifier methods.
Verify source/missing-reason parity with real PostgreSQL and unchanged feedback
evaluation. Exercise empty, legacy and capped aggregate populations; verify native
labels, escaping, keyboard access and no mutation requests in the browser.
Record actual local tests, Docker observations, limitations and the next task in
the separate outcome document.
