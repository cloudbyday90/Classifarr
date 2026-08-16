# Native Intent Reconciliation Operator Remediation

## Status

12R.0 is complete on 2026-08-16. It turns the administrator reconciliation
screen from a grouped-state dashboard into a bounded remediation entry point
for existing legacy policies that cannot be converted because they have no
declared destination purpose.

## Problem

The scheduler correctly preserves `requires_maintenance` when a legacy policy
contains constraints or preferences but no materializable identity rule. The
prior status screen reported only a grouped reason ID. An operator could see
that something was unresolved but could not tell which policy required work or
reach the compatible editing path without database inspection.

The observed `Kids TV Policy` is the reference case: legacy certification and
genre settings constrain or support matching, but they do not state what
belongs in the destination. It must not be converted by guessing from the
library name, observed profile, historical assignments, RAG, or AI output.

## Research And Options

Current official guidance supports a state-bound, server-enforced workflow:

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires the user to see material transaction data, authorizes sensitive
  state transitions server-side, and requires a final execution control.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends server-side access control and prevention of out-of-order API
  execution.
- [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  describes the concurrency behavior that requires the normal policy update
  transaction to remain the write authority.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports explicit secure-design decisions and verification evidence.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Direct database edit or state deletion | Fast for one installation | Bypasses policy validation, leaves no normal audit path, can hide an unresolved policy without making it convertible | Rejected |
| New remediation endpoint that creates native intent | Could reduce clicks | Would duplicate policy-write authority, require a new replay and rollback protocol, and risks treating a short purpose choice as the whole policy | Deferred |
| Bounded inventory plus existing policy editor | Preserves one validated write path, shows exactly what needs attention, retains scheduler-owned conversion and normal audit behavior | Conversion waits for the next scheduler run | Selected |

## Implemented Design

`GET /api/policies/native-intent-reconciliation/remediation` is
administrator-only and returns at most 100 current unresolved rows. Each row
contains only the policy and library identity needed for an operator to act,
the bounded reconciliation status IDs, and a server-authored fixed action.
It excludes policy configuration, candidate fingerprints, profiles, history,
AI/RAG/provider content, queue data, and raw errors.

For the exact `requires_maintenance` / `no_convertible_intent` state with a
legacy configuration (a preset attachment or advanced override) and no
authoritative native intent, the action is **Declare destination purpose**.
The UI loads the current policy into the existing
compatibility editor. The operator must add the appropriate **Belongs Here**
identity rule and save through the existing validated policy update endpoint.
The screen makes no inference and submits no conversion request.

After save, the protected reconciliation scheduler independently reloads and
re-evaluates the policy. A valid materializable contract may then convert using
the existing transactional conversion, audit, rollback-snapshot, and native
authority rules. If it remains unresolved, the inventory presents its current
state again.

The screen offers no write action for rows with active native authority or no
supported legacy editor path. Those rows remain explanatory only.

## Notification Behavior

Reconciliation alerts now represent an incident transition, not a periodic
reminder. A firing alert creates one notification. It cannot create another
until the durable alert state resolves and later fires again. The notification
now targets the remediation screen instead of the generic policy page.

## Security And Privacy Properties

- Administrator authorization is checked on the server before inventory data is
  read.
- The browser cannot choose an action identifier or claim that a policy is
  convertible; it can only open a server-selected existing policy editor.
- The normal policy write route remains responsible for input validation,
  native-authority write guards, and its transaction boundary.
- The scheduler remains the only normal conversion path. No remediation request
  queues classification work, calls an AI provider, changes routing, or writes
  reconciliation state directly.
- The inventory is deliberately bounded and returns no raw configuration or
  operational payloads.

## Successful Outcome

An administrator can open **Native intent reconciliation**, see the specific
unresolved policy, understand that it lacks destination identity rather than
being an AI disagreement, edit the existing policy deliberately, and wait for
the scheduler to verify the updated policy. Repeated notifications do not
accumulate while the same unresolved incident remains open.

## Verification

Focused server contract, service, route, alert, client API, view, and component
tests prove bounded output, administrator-only access, action availability,
normal editor handoff, and one-notification-per-incident behavior.

## Next Task

Proceed with **12R.1 Specialized-Destination Identity Evidence Calibration**.
It should address broad-policy ties, such as `Reality and Docuseries` versus
`TV Shows`, by improving deterministic identity-evidence differentiation and
operator explanation without allowing library names, AI output, or broad genre
overlap to become autonomous routing authority.
