# Policy Starter-Template Candidate Vocabulary Decision

Status: implemented as Phase 3R.7.2.

## Scope

Decide which legacy starter-template vocabulary may become a normal
policy-authoring candidate. This work audits `require_any`, `prefer`, hard-limit
style, and `exclude` template fields against the native destination controls
that exist today.

This work does not add a template browser, attach a template, add a new
helpful-match control, change a hard-limit or avoid semantic, persist policy
state, execute routing, invoke a provider, or modify library profiles.

## Finding

The template catalog is a legacy weighted configuration format, not a native
intent DTO. It contains such semantics as `prefer`, `exclude`, certification
inclusion, runtime bounds, and release-year bounds. The current native workflow
has one source-aware candidate path:

```text
genres | keywords | studios + require_any
  -> IntentSignalPicker
  -> add_signal_value
  -> policy.intent_signal_command_plan.v1
```

That path creates `purpose` intent only. It is a complete typed candidate
contract with an existing product owner.

The remaining categories do not meet that condition:

| Template vocabulary | Intended destination role | Current control assessment | Decision |
| --- | --- | --- | --- |
| `genres`, `keywords`, or `studios` + `require_any` | Belongs here | `IntentSignalPicker` accepts a canonical candidate and emits `add_signal_value` | Project |
| Any `prefer` | Helpful hint | No native helpful-candidate control or typed draft command exists | Do not project |
| `certifications.include` | Hard limit | A legacy inclusion set is not equivalent to the native maximum-rating hard limit | Do not project |
| Runtime, year, or score bounds | Hard limit | No matching native constraint control or command exists | Do not project |
| `certifications.exclude` | Avoid | `AvoidControl` accepts an explicitly confirmed server-allowlisted rating, but has no template-candidate input contract | Do not project |
| Other `exclude` values | Avoid | No native control accepts generic genre, keyword, studio, or language exclusions | Do not project |

The visible constraint controls do not change this decision. They intentionally
require explicit operator action, use a server-owned eligibility allowlist, and
must not reinterpret arbitrary legacy template fields in the browser.

## Design

`policyStarterTemplateCandidateVocabulary.mjs` is the server-owned decision
table. It records the destination bucket, existing owner, command, confirmation
requirement, and whether a source-aware candidate input contract exists. Its
only projectable entries are the three `require_any` purpose mappings.

`policyStarterTemplateSuggestions.mjs` now consumes that table when building
internal template suggestions. New template fields are fail-closed by default:
they are not added to the normal workflow merely because they resemble an
existing policy category. The table remains server-internal; it does not expose
template values, raw template metadata, or deferred candidates to the browser.

## Security Boundary

- A template remains a draft seed, not policy authority.
- The server owns the vocabulary allowlist and semantic mapping.
- Only an existing typed purpose command can carry a template candidate into a
  local draft.
- Explicit confirmation for hard limits and avoid rules is retained.
- Unsupported, partially matching, or legacy-only semantics have no browser
  candidate surface and no silent fallback.
- The native constraint eligibility projection remains the sole source of
  selectable rating values.

## Official Guidance Reviewed

Official sources were reviewed on 2026-08-01 against guidance current through
June 2026:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-owned workflow state and validation of legal transitions.
  The vocabulary policy prevents a client or an incidental template loop from
  treating a legacy weighted field as a new native-intent action.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends allowlist and semantic validation. The decision table allows only
  exact signal/operator mappings with an existing command contract; all other
  fields fail closed.
- [W3C WAI grouping controls guidance](https://www.w3.org/WAI/tutorials/forms/grouping/)
  recommends grouping only related controls with clear instructions. Keeping
  unsupported template categories out of the existing purpose multi-select
  avoids falsely labelling a preference or constraint as destination identity.

## Options Considered

### Project Every Familiar Template Field Into Its Nearest Native Category

Pros:

- Makes more legacy values visible immediately.

Cons:

- Changes semantics, such as turning a certification inclusion set into a
  maximum rating.
- Lets templates recreate a parallel policy-authority path.
- Adds candidate controls before the corresponding typed command contracts
  exist.

Decision: reject.

### Expose Deferred Template Values As Read-Only Hints

Pros:

- Preserves legacy context for comparison.

Cons:

- Reintroduces raw-template details and decision load.
- Offers information without an approved action, which conflicts with the
  destination-first workflow.

Decision: reject.

### Project Only Exact Mappings With Existing Typed Control Ownership

Pros:

- Preserves intent semantics and explicit constraint confirmation.
- Keeps the current authoring UI narrow and action-oriented.
- Gives future work a precise entry condition instead of growing another
  generic candidate picker.

Cons:

- Some legacy template fields remain unavailable in the normal workflow until
  their native controls are designed and implemented.

Decision: adopt.

## Final Recommendation Stack

1. Keep `policyStarterTemplateCandidateVocabulary.mjs` as the server-owned,
   fail-closed vocabulary decision point.
2. Project only `genres`, `keywords`, and `studios` `require_any` values to
   the existing purpose picker and typed `add_signal_value` command.
3. Do not project `prefer` values until a server-owned helpful-candidate
   projection, a named control, and a typed draft command are implemented
   together.
4. Do not translate legacy hard-limit or `exclude` fields into current
   constraints until their native semantics, eligibility, explicit
   confirmation, and candidate input contract match exactly.
5. Keep raw template records and deferred values server-internal.

## Implemented Outcome

- Added an immutable candidate-vocabulary decision service with explicit
  non-projection reasons.
- Replaced the starter-template suggestion loop's local signal list with the
  server-owned projectable vocabulary entries.
- Added regression coverage proving legacy `prefer`, hard-limit, and avoid
  fields cannot become purpose candidates.
- Added vocabulary coverage for exact purpose ownership, helpful-gap,
  hard-limit semantic mismatch, avoid-candidate gap, and unknown-field
  fail-closed behavior.

## Next Task

Phase 3R.7.3: Template Compatibility Bridge Inventory. Audit every remaining
preset attachment reader, round-trip serializer, and compatibility component;
delete dead mechanics and record the precise native-storage deletion gate for
each retained bridge artifact.
