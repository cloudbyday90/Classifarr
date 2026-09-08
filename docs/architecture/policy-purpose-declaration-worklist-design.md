# Policy purpose declaration worklist design

Status: implemented, unreleased. Research checked against the linked primary
sources on 8 September 2026.

## Problem

The private audit correctly excluded the active policies because their purpose
rules were profile-derived observations rather than native declarations. The
existing purpose-coverage view identifies profile-only provenance but could
show otherwise distinct coverage as requiring no coverage action. An
administrator therefore had to inspect individual policies to find the
existing, governed declaration form.

The platform needs a configuration- and library-agnostic way to discover
common current drafts while keeping declaration authority in the existing
revision-checked purpose writer. It must not publish terms, create a cohort,
or make a routing decision.

## Design

The administrator-only existing purpose-coverage endpoint advances to
`policy_purpose_coverage_review.v12`. Its nested
`policy_purpose_declaration_worklist.v2` contract reads active authoritative
native policies and their current purpose rules for one bounded, server-only
reduction.

`policyNativeIntentPurposeChangeCommandProjection.mjs` owns the projection
already used by the purpose-change read. The worklist canonicalizes that same
typed `update_purpose` draft in memory and groups only exact matches. The
canonical signature and all purpose values are discarded before the response
is built and are never persisted.

The returned group contains only a response-local ordinal, policy and library
identity, media type, one fixed aggregate purpose-provenance state, and the
fixed `review_and_declare_purpose` action. It has explicit false flags for raw
rule exposure, policy mutation, semantic selection, and routing. The Vue
normalizer rejects unknown properties, values, inconsistent counts, and any
attempt to add a raw-purpose field.

The action opens one selected policy in the existing policy modal and moves
focus to the existing declared-purpose maintenance section. The existing form
loads the server-owned prefilled draft, requires explicit review, performs its
existing advisory coverage preflight, and remains the sole revision-checked
write path.

```text
active native policies and current stored purpose
  -> server-only typed draft projection and exact grouping
  -> redacted bounded declaration worklist
  -> one policy's existing guarded declaration form
  -> explicit native revision and durable receipt
  -> passive aggregate eligibility re-audit
  -> no cohort, labels, semantic selection, provider call, or routing
```

## Security and accessibility controls

- The worklist shares the existing administrator-only route; no new browser
  parameter chooses a policy set, grouping key, library, or configuration.
- The database read is bounded to the report limit plus one. Raw purpose rules
  are present only while the server computes an equality key, then discarded.
- The API response and client normalizer are allow-listed closed contracts.
  Group signatures, rule values, rule sources, inference states, receipts, and
  provider or media data cannot cross the boundary.
- The page has no mutation endpoint. The review button is a navigation aid to
  the existing administrator, revision, command, idempotency, and transaction
  safeguards.
- A truncated report with no visible declaration request reports an explicit
  unknown window state. It never makes a full-population no-review claim from a
  bounded subset.
- The grouped table has a caption, column header scopes, and a row-group
  header for each shared draft. The existing declaration section is a
  programmatic focus target after the modal opens.

## Research basis

[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
provenance and data-quality metadata that users can interpret across domains.
The fixed provenance state distinguishes observation from declaration without
exposing the source configuration.

[W3C WAI tables guidance](https://www.w3.org/WAI/tutorials/tables/) and its
[two-header example](https://www.w3.org/WAI/tutorials/tables/two-headers/)
describe captions and scoped headers that preserve relationships between table
headers and cells. The worklist uses those semantics for the group, policy,
library, provenance, and action columns.

[OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
calls out object-, property-, and function-level authorization plus resource
consumption. This design retains the existing administrator check, limits the
query, and returns an explicit property allow-list.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Manual inspection of coverage rows | No new response shape | Repeats operator discovery work and obscures common drafts | Reject |
| Return raw purpose terms to group in the browser | Simple client grouping | Publishes configuration and makes the browser own a sensitive comparison | Reject |
| Server-only exact grouping and existing declaration form | Redacted, bounded, reusable, and preserves current authority | Adds a small read query and versioned response | Adopt |
| Automatically promote or route profile-derived purpose | Fewest clicks | Creates declaration authority from descriptive observations and bypasses gates | Reject |

## Recommendation stack

1. Keep exact grouping server-owned and ephemeral; never persist or expose a
   purpose signature.
2. Use the redacted worklist to find common drafts across libraries without
   treating a library profile as declared policy intent.
3. Send each review action to the existing revision-checked declaration form.
4. Let durable ordinary authoring trigger the existing passive aggregate
   re-audit; do not start a study or ask for operational study input.
5. Only after the audit finds enough eligible policy-only comparisons should
   the existing 24–32-case, independently labelled cohort process begin.
   Semantic counter-evidence remains gated on a good measured error profile
   and must send ambiguous media to review, never automatic routing.

## Non-goals

This change does not auto-declare purpose, edit policy storage, capture a
cohort, collect labels, invoke a provider, select semantic evidence, or route
media. It does not make a library, media server, or configuration format part
of the contract.
