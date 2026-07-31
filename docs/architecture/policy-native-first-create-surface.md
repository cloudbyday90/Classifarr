# Policy Native-First Create Surface

Status: implemented for new policy creation

## Outcome

Creating a policy is now a library-first native-intent action, rather than a
legacy preset and scoring configuration exercise. The operator:

1. Reviews the connected library profile.
2. Selects one or more observed values that should define the destination.
3. Creates the policy.

Classifarr keeps the accepted values explicit and unchecked by default. It
creates native purpose intent only after the operator accepts the evidence.
Routing setup remains visible but does not prevent policy creation; it still
prevents automatic application of approved matches until it is complete.

Existing persisted policies continue to use the compatibility edit surface in
this slice. That is an intentionally bounded transition state, not a second
new-policy authoring path.

## Design Decisions

### Native Create Is Separate From Compatibility Edit

The UI selects `native_create` whenever no persisted policy ID exists and
`legacy_edit` only for a persisted policy. Native create does not render or
load:

- starter-template selection,
- preset suggestions,
- preset migration notices,
- raw legacy intent editor controls, or
- advanced scoring and threshold controls.

Those controls would make a new operator infer implementation mechanics from a
library that Classifarr can already observe. The server still owns validation
and transactionality for native establishment; the browser only proposes the
explicitly accepted candidate set.

Native creation also has a separate wire contract from compatibility editing.
It sends only `library_id`, `name`, and `native_intent_establishment`; the
server rejects every other input field before legacy validation or a database
transaction begins. This prevents hidden compatibility form defaults from
becoming de facto native policy controls. See [Policy Native Create Payload
Cutline](policy-native-create-payload-cutline.md).

### Candidate Selection Is Explicit and Accessible

Observed values remain unchecked. They are presented as a semantically grouped
checkbox set with a short instruction to select all values that define the
destination. This supports multiple correct identity signals without the poor
interaction and assistive-technology history of multi-select dropdowns.

### Server Authority Is Not Weakened

The create button is disabled until there is an explicit purpose declaration,
but this is usability feedback rather than authorization. The existing server
contract continues to reject non-administrators, malformed or unsupported
observed values, mixed legacy preset attachments, and partial native writes.
The create transaction establishes the policy, native authority, audit state,
routing record, and rollback snapshot together.

## Research And Recommendation

The review used current official guidance available in June 2026:

- [GOV.UK checkbox guidance](https://design-system.service.gov.uk/components/checkboxes/)
  recommends checkboxes for multiple independent selections, requires clear
  instructions such as "Select all that apply", advises against preselection,
  and calls for a fieldset and legend.
- [GOV.UK select guidance](https://design-system.service.gov.uk/components/select/)
  advises against multiple-selection dropdowns because their usability and
  assistive-technology support have historically been poor.
- [W3C grouping-controls guidance](https://www.w3.org/WAI/tutorials/forms/grouping/)
  recommends visual and programmatic grouping with `fieldset` and `legend` for
  related controls.
- [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  requires server-side access-control enforcement and safe handling of failed
  authorization checks.

Options considered:

| Option | Advantages | Costs |
| --- | --- | --- |
| Keep the full legacy builder for creation | Familiar to previous operators | Duplicates library evidence, exposes internal mechanics, and encourages unnecessary configuration. |
| Auto-declare every observed value | Fastest path | Incorrect observations become durable policy without operator intent. |
| Native-first explicit observed multi-select | Low decision count, preserves operator authority, supports multiple signals, and is accessible | Requires a current profile and an explicit acceptance action. |

Recommendation stack:

1. Use native-first observed selection for every new policy.
2. Require at least one explicit accepted purpose value before creation.
3. Keep routing a non-blocking post-create readiness concern.
4. Retain the legacy editor only for persisted compatibility policies until the
   migration-and-deletion cutover proves it can be removed.

## Verification

- Focused modal, workflow-shell, experience-mode, and save-boundary tests
  verify native creation, compatibility editing, semantic selection, and the
  absence of legacy create requests.
- Client lint verifies the Vue and ESM implementation.
- The server native-create contract remains the final validation and
  authorization boundary.

## Follow-Up

Native creation now also concludes with a server-owned saved-policy handoff.
The modal confirms the persisted declared authority and routing state before an
operator closes it. See [Policy Native Create Handoff](policy-native-create-handoff.md).

The next 6R.5 decision is whether observed library evidence needs durable
provenance after creation, rather than treating setup observations as transient
inputs to the declared-intent authority.
