# Policy Starter-Template Live Candidate Projection Audit

Status: implemented as Phase 3R.7.1.

## Scope

Audit the live `GET /policies/operator-workflow/libraries/:libraryId` response
from template lookup through candidate projection and typed draft acceptance.
The goal is to preserve optional starter-template value without creating a
second policy authority, attachment command, or browser-facing template record.

This work does not add a template browser, attach or replace a preset, infer a
hard limit or avoid rule, persist policy data, execute routing, refresh a
profile, or contact a provider.

## Findings

The candidate path already has the right product shape:

```text
connected library
  -> server-internal template match
  -> canonical intent-signal option projection
  -> source-labelled multi-select candidate
  -> typed draft command
  -> existing server-side policy validation
```

Observed-library candidates have higher source priority than starter-template
candidates, and an equivalent observed value wins. Template values retain only
the product label and explanation needed to explain the suggestion. Their raw
record, attachment payload, weights, scoring details, and matching diagnostics
do not reach the browser.

The audit found one enforcement gap: the normal workflow-read route generated
a projection but did not execute the existing workflow-read audit before
sending it. The custom-value validation route already performed that audit.

## Design

`policyOperatorWorkflowReadResponse.mjs` is a focused response guard shared by
the normal workflow-read and custom-value routes. It runs the server-owned
workflow-read audit, logs only stable audit risk identifiers, and returns a
generic `503` when the display projection is invalid.

`policyIntentSignalOptionProjection.mjs` now rejects a template candidate that
contains raw template provenance fields such as identifiers, names, signal
maps, descriptions, categories, scores, or matching reasons. The canonical
option deliberately keeps only candidate fields required by the intent picker.

The client normalizer allowlists the four supported selectable sources:

1. observed-profile suggestion;
2. starter-template suggestion;
3. common static option; and
4. operator-added custom value.

It strips unknown fields while constructing the typed draft command and rejects
unknown sources. The client remains a display and draft-construction boundary;
the server remains authoritative for all writes.

## Security Boundary

- Template matching and raw preset data stay server-internal.
- The GET route verifies the final response rather than trusting an earlier
  builder call or a browser condition.
- The projection audit fails when starter-template payload fields escape the
  canonical candidate shape.
- The response guard exposes only a stable error code to the operator and logs
  stable audit identifiers, never candidate values or raw template data.
- Candidate acceptance remains explicit, multi-selectable, and typed. A
  candidate cannot auto-declare intent, authorize a write, or apply routing.

## Official Guidance Reviewed

Official sources were reviewed on 2026-08-01 against guidance current through
June 2026:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-owned state machines, re-deriving security-relevant
  values, and applying business rules at every entry point. The response guard
  applies the same audit to the ordinary read and custom-value paths.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends allowlist and semantic validation at trust boundaries. The option
  audit and client normalizer reject unsupported sources and unsafe metadata.
- [Vue props](https://vuejs.org/guide/components/props) documents one-way data
  flow. The picker receives a server projection and emits a typed command;
  neither child component mutates projection state.
- [W3C grouping controls guidance](https://www.w3.org/WAI/tutorials/forms/grouping/)
  recommends visibly and programmatically grouping related controls. The
  existing multi-select groups candidates by the source label, keeping template
  suggestions visibly secondary to observed library evidence.

## Options Considered

### Trust The Existing Candidate Builder

Pros:

- No additional route work.

Cons:

- The ordinary GET route could return a malformed projection if a future
  builder change bypassed its unit-tested audit.
- A raw template field could reach the browser without a final boundary check.

### Restore Raw Template Details Or A Template Selector

Pros:

- Exposes more legacy context.

Cons:

- Reintroduces a second policy-authority path.
- Encourages attachment mechanics instead of explicit intent acceptance.
- Adds decision load before observed library context.

### Validate The Final Canonical Projection At Every Route

Pros:

- Applies one audited, fail-closed response boundary to normal and custom
  workflow reads.
- Keeps templates optional, source-labelled, and secondary.
- Preserves the current accessible multi-select and typed-command flow.

Cons:

- A projection regression now returns a generic `503` instead of a partially
  rendered workflow until the server contract is repaired.

## Final Recommendation Stack

1. Keep raw template matching and preset data server-internal.
2. Send only canonical, source-labelled candidate fields to the browser.
3. Audit the final projection at every route that can return it.
4. Keep observed library evidence ahead of starter-template suggestions.
5. Allow acceptance only through the existing typed draft command path.
6. Do not extend template hints into helpful, hard-limit, or avoid controls
   until each has an explicit server-owned candidate contract and owner.

## Implemented Outcome

- Added a shared server response guard for normal and custom workflow reads.
- Added an audit rule that rejects raw starter-template provenance in candidate
  options.
- Added client source allowlisting and metadata-stripping coverage for typed
  starter-template acceptance.
- Added live route coverage proving a template candidate is source-labelled
  but does not expose template identifiers, names, signals, or attachment data.

## Next Task

Phase 3R.7.2: Template Candidate Vocabulary Decision. Audit the remaining
template `prefer`, hard-limit, and avoid values against the existing typed
destination controls. Add a candidate projection only where a named owner and
explicit command contract already exist; otherwise keep those values out of the
normal workflow.
