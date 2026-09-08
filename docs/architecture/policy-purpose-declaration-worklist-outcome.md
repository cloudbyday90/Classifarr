# Policy purpose declaration worklist outcome

Status: implemented, unreleased. See the separate
[design](policy-purpose-declaration-worklist-design.md) for research,
alternatives, and the recommendation stack.

## Delivered

- Added ESM modules for server-only typed draft projection, exact worklist
  grouping, and bounded persistence.
- Extended the existing administrator purpose-coverage response from v9 to v10
  with a redacted `policy_purpose_declaration_worklist.v1` payload.
- Grouped only equal current prefilled purpose commands. Group identifiers are
  response-local ordinals; neither signatures nor purpose terms leave the
  server reduction.
- Added a strict Vue normalizer and an accessible grouped worklist that shows
  policy and library identity, fixed provenance, and one existing review
  action.
- Reused the existing declared-purpose maintenance form and gave its section a
  programmatic focus target. The worklist introduces no writer or routing
  action.

## Validation

Focused backend contract, persistence, and coverage-service tests verify
bounded over-fetching, exact grouping, provenance gating, omitted raw terms,
and non-mutation flags. Focused frontend tests verify closed-response
normalization, raw-field rejection, accessible table semantics, per-policy
handoff, and focusability of the existing declaration form.

The full backend and client suites, static ESM checks, documentation lint,
security diff review, and a no-cache Compose rebuild are recorded with the
implementation commit. No policy, study, provider, or routing data is changed
by this worklist.

The public repository had no open pull requests during discovery, so there was
no random PR available to implement locally or merge.

## Next item

Use the worklist only to reduce discovery effort for an already confirmed
purpose. Each explicit native declaration will be observed by the passive
aggregate re-audit. The next gated platform action occurs only if that audit
finds enough eligible policy-only comparisons: capture one balanced 24–32-case
cohort, obtain independent labels, and run the existing readiness plus frozen
study preflight. A later good measured error profile is required before any
semantic counter-evidence experiment, and ambiguous items must go to review.
