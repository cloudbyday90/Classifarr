# Queue evidence fingerprint identity verification

November 26, 2026. This follows the
[queue identity inventory](queue-task-identity-inventory-outcome.md)
and the [intake receipt repair](classification-intake-task-id-outcome.md).
The maintainer approved verification of the existing fingerprint contract.

## Contract

The classifier forwards a queue row's ID, task type and attempt to the
native handoff. The queue evidence producer hashes its normalized task
text. Request import admission passes the row's ID, type and attempt to
the request-time reader, which checks the task and execution fingerprints
against the supplied proof. The execution fingerprint also binds the
evidence digest. A failed proof check preserves the existing route
outcome with no inferred learning or profile refresh.

PostgreSQL returns safe IDs through the repository's adapter as numbers
and larger IDs as exact decimal strings. Astra's direct probe found that
valid numeric and text equivalents match, adjacent large task IDs remain
distinct, and the v1 symbolic fixture continues to work. Both helpers
also normalize generic text and accept numeric inputs already rounded
by callers. The worker passes the ID from PostgreSQL, and the trace
found no live path that supplies those permissive forms.

## Research and tradeoffs

IETF canonicalization guidance explains why stable hash inputs matter
and recommends text for integers beyond binary64 precision. Classifarr
hashes task text as UTF-8 and keeps its current v1 binding. This uses
the canonicalization principle for an ID and does not claim JCS
compliance for the fingerprint envelope. W3C guidance supports
preserving existing identifiers and reader contracts.
[RFC 8259](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html) ·
[Node.js 24 crypto](https://nodejs.org/download/release/v24.22.1/docs/api/crypto.html) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Preserve v1 and add database-backed coverage | Verifies the live ID forms and existing fallback | Generic helper input remains broader than database IDs |
| Share the existing v1 helpers | Reduces future producer/consumer drift | Refactors two passing paths and requires proof of byte compatibility |
| Require BIGINT-only values in both generic helpers | Rejects inexact and noncanonical values early | Changes the existing opaque identity contract and fixtures |

Use exact database IDs at the worker boundary, keep the v1 task and
execution bindings, and retain existing outcome-only admission. A
deterministic task hash correlates evidence and does not grant access,
queue claim ownership, or permission to write learning data.

## Verification

Claim actual PostgreSQL queue rows at the safe-integer boundary, just
above it, and at the BIGINT maximum. Feed the claimed rows to the
production producer and request import admission using synthetic
classification evidence. Check numeric/text equivalence, exact task
digests, distinct adjacent execution fingerprints and refusal to use
proof from another task or attempt. Check that raw queue payload, claim
token and task IDs stay out of the proof and that the fallback has no
side effects. Keep the existing symbolic fixture tests.
