# Native Purpose Profile Source Read Design

Status: implemented, unreleased. Research checked 8 September 2026 against
the linked primary sources.

## Problem

The count-only purpose coverage review shows that the active policies currently
have profile-only specialized purpose. Classifarr already has an
administrator-only, revision-checked native-purpose maintenance surface for an
operator to review and explicitly declare purpose. Its read service, however,
passed stored rule objects directly into the write-command normalizer.

That is unsafe and unavailable for a profile-derived stored rule. The write
normalizer correctly accepts only native-intent provenance, while the stored
rule records `media_server_library_profile`. Returning the stored object would
also expose provenance that the browser does not need and must not be able to
replay as a write instruction.

## Decision

Add `policyNativeIntentPurposeChangeStoredRuleAdapter.mjs`, a small ESM service
that projects only five editable fields from an active stored purpose rule:

- `signal_type`;
- `operator`;
- `values`;
- `constraint_mode`; and
- `semantics`.

The purpose-change read service sends that projection to the existing canonical
command normalizer. Before returning the narrow GET response, it removes the
normalizer's `source` and `inference_state` output. The existing mutation path
remains the only path that assigns canonical native-intent provenance after an
authorized administrator explicitly submits a revision-checked change.

```text
profile-derived stored purpose
  -> server allowlist projection
  -> canonical typed draft
  -> administrator review and advisory preflight
  -> existing revision-checked change transaction
  -> server-assigned native-intent provenance
```

This is a read compatibility repair. It does not declare purpose, modify a
policy, change routing, capture a cohort, collect labels, invoke AI, or make a
semantic decision.

## Security And Data Boundaries

- Existing administrator authorization remains enforced by the server for the
  read, preflight, and mutation routes.
- The adapter is an allowlist, so `source`, `inference_state`, ordering fields,
  identifiers, profile observations, and future stored fields cannot enter the
  browser's change draft through this path.
- The GET response omits provenance rather than relabeling profile evidence as
  an operator declaration.
- The mutation path derives persisted provenance from its own command contract
  in the transaction; it does not trust client-supplied stored evidence.
- Coverage preflight stays advisory. Applying still requires an administrator
  to review every displayed rule and explicitly submit the next revision.

## Research Basis

W3C's Data on the Web Best Practices treats provenance and version information
as useful metadata for quality and repeatability. Here provenance stays with
the stored evidence boundary while the reviewable draft has a separate,
versioned authority boundary. [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

OWASP recommends enforcing authorization on the server, least privilege,
default deny, and authorization tests. The existing administrator route and
revision-checked transaction retain that authority; the adapter grants no
write authority. [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

OWASP identifies returning or accepting unnecessary object properties as a
broken object-property authorization risk. The explicit stored-field allowlist
minimizes the GET projection and prevents profile provenance from becoming a
client-controlled property. [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)

NIST's AI RMF Measure guidance calls for documented test sets, metrics, tools,
and validation details. Keeping this policy-governance repair separate from the
frozen cohort and independent-label gates preserves a repeatable evaluation
boundary. [NIST AI RMF Playbook, Measure 2.1](https://airc.nist.gov/docs/AI_RMF_Playbook.pdf)

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep rejecting profile-derived stored rules | No new code. | Blocks the existing explicit-purpose workflow for the current profile-only policies. | Reject |
| Return stored rule objects unchanged | Lowest implementation effort. | Exposes unnecessary evidence provenance and presents it as replayable client data. | Reject |
| Let the browser translate stored provenance | Reuses UI code. | Moves an authority and data-boundary decision to an untrusted client. | Reject |
| Server-side editable-field allowlist | Makes the existing reviewable workflow available while preserving server-owned provenance and the transaction boundary. | Adds a focused adapter and regression coverage. | Adopt |

## Recommendation Stack

1. Keep stored evidence provenance and explicit policy-authority provenance
   distinct.
2. Project only editable typed fields into the administrator draft.
3. Require the existing administrator review, advisory preflight, and
   revision-checked mutation before any declaration is persisted.
4. Rerun the count-only coverage review and private eligibility audit after an
   approved policy change.
5. Capture a real 24–32-case cohort only after the policy-only gate permits it;
   use independent labels, readiness, and frozen-study preflight before any
   semantic counter-evidence work.
6. If later measurements support counter-evidence, send ambiguous items to
   review and never route them automatically.

## Non-Goals

- No automatic promotion of profile observations to operator-declared purpose.
- No automatic routing, semantic retrieval, provider access, label collection,
  readiness conclusion, or cohort capture.
- No schema migration or change to the existing native-intent provenance
  taxonomy.
