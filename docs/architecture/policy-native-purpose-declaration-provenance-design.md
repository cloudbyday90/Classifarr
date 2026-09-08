# Governed native-purpose declaration provenance design

Status: implemented, unreleased. Research checked against the linked primary
sources on 8 September 2026.

## Problem

The active native-purpose maintenance read already returned a typed, editable
copy of stored purpose terms. When every stored rule came from a library
profile, the browser had no bounded provenance signal and described those
terms as declared purpose. That presentation blurred descriptive evidence and
policy authority at the exact point where an administrator should make an
intentional declaration.

The platform needs to make the existing safe path easier to understand without
creating a second writer, exporting library configuration, or automatically
promoting profile observations to policy authority.

## Decision

The administrator-only purpose-change read advances to
`policy.native_intent_purpose_change_read.v2`. Each available response now
contains one fixed `purposeProvenance` object:

| Identifier | `declarationRequired` | Meaning |
| --- | --- | --- |
| `declared_native` | `false` | Every stored purpose rule was recorded by a native declaration path. |
| `profile_derived` | `true` | Every stored purpose rule is descriptive profile evidence. |
| `mixed` | `true` | Stored rules have more than one provenance class. |
| `unverified` | `true` | Stored rule provenance is incomplete or unknown. |

`policyNativeIntentPurposeChangeProvenance.mjs` reduces rule provenance using
the established server-owned classifier. It returns only the identifier,
whether a declaration is required, and `rawRuleProvenanceExposed: false`.
Individual rule sources and inference states remain private.

The Vue client repeats the contract as a closed normalizer. It rejects an
unknown status, extra field, raw-provenance flag, or contradictory declaration
requirement. For `profile_derived`, the existing prefilled terms remain a
review draft. The administrator must still use the existing revision-checked,
idempotent native purpose-change action to record the next native revision.
That ordinary durable receipt is already observed by the passive lifecycle
scheduler, which re-audits aggregate study eligibility after the source
changes.

```text
stored active purpose rules
  -> fixed aggregate provenance state
  -> administrator reviews the existing typed draft
  -> existing revision-checked native declaration
  -> durable lifecycle receipt
  -> passive aggregate re-audit
  -> no cohort, semantic selection, or routing
```

The native policy summary now calls the display "Current stored purpose." It
does not claim a declaration before one exists.

## Security and authority boundary

- The read stays administrator-only and read-only. It does not access a
  provider, write the database, select routing, or alter learning.
- The existing write remains the only declaration path. It requires an
  administrator actor, a positive actor ID, the current intent revision, an
  allow-listed typed command, an idempotency key, and one transaction.
- A profile observation can prepare a review draft but cannot create a native
  revision or satisfy held-out study evidence on its own.
- The response exposes neither policy source values nor per-rule provenance;
  it contains only a fixed aggregate state alongside the already-established
  editable purpose command.
- A purpose write does not run a study synchronously. The existing passive
  scheduler observes durable aggregate evidence; it still cannot capture a
  cohort, collect labels, invoke AI, select semantic evidence, or route media.

## Research basis

[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
provenance, version indicators, and an explanation when data is unavailable.
The v2 fixed provenance state provides a versioned explanation without
publishing per-rule storage metadata.

[W3C PROV-O](https://www.w3.org/TR/prov-o/) provides a lightweight,
domain-agnostic model for communicating provenance across different systems.
The bounded state preserves the distinction between an observed source and a
later administrator declaration without coupling the contract to a library or
configuration.

[OWASP API Security Top 10](https://owasp.org/API-Security/) identifies broken
object- and function-level authorization as API risks. This design leaves
policy identity server-derived and retains the existing administrator-only,
revision-checked write boundary; the browser never supplies authority or a
provenance override.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep calling all stored terms declared | No contract change | Misstates profile evidence and weakens review context | Reject |
| Return each rule's source and inference state | Detailed diagnostics | Expands operational/configuration data in the browser | Reject |
| Fixed aggregate provenance plus existing declared-purpose write | Accurate, private, library-agnostic, and reuses the durable lifecycle receipt | Requires a small versioned read contract and browser validator | Adopt |
| Auto-promote profile-derived terms | Fewest operator actions | Creates policy authority from descriptive data and bypasses governance | Reject |

## Recommendation stack

1. Use the v2 provenance state to distinguish stored terms from declared
   authority.
2. Let profile-derived terms prefill a review draft only; require the existing
   administrator declaration to create a native revision.
3. Let the lifecycle scheduler detect that durable revision and re-audit the
   aggregate source automatically.
4. Permit cohort planning only after the audit finds a balanced 24–32-case
   policy-only cohort, then require independent labels, readiness, and frozen
   study preflight.
5. Consider semantic counter-evidence only after a good measured error
   profile, and send ambiguity to review without automatic routing.

## Non-goals

This change does not infer purpose, modify a policy without an administrator
action, expose library configuration, trigger synchronous study work, capture
a cohort, collect labels, invoke AI, select semantic evidence, or route media.
