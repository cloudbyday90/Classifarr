# Restricted restore HTTP handoff

Date: 2026-10-05. Follows [deployment admission](selected-deployment-design.md).

## Decision

Keep the authenticated restore web process under the application OS identity and
`cf_runtime` database role. Give it one inherited, private stream to a trusted
supervisor, usable for one bounded restore request per process lifetime. The
supervisor launches only the existing fixed restore worker as the database OS
identity. It never accepts commands, SQL, paths, environment settings or identities
from that stream. The worker independently validates and decrypts the envelope,
acquires database exclusion and retains the existing durable verification gate.

This is an internal selected-runtime composition. Do not activate automatic
production selection, edit saved templates, reset keys or recover live imports
in this change. Forced-non-root installations keep the compatible path.

## Contract and safeguards

- Preserve administrator authentication, cookie CSRF checks, no-store responses
  and the existing restore-only HTTP allowlist. Normal APIs/workers stay absent.
- Resolve filenames under the reviewed backup directory in the unprivileged
  process. Reject traversal, symlinks, special files, linked files, excessive size
  and changing files. Do not let the privileged worker open a supplied filename.
- Limit the envelope to 64 MiB, partial transfer to ten seconds, worker execution
  to the existing three-minute limit. Serialize imports before reading files.
- Use a length-prefixed stream, not unbounded JSON IPC. Respect stream
  backpressure; a false write return is not proof of failure.
- Return only a fixed outcome after worker exit and stream closure. Do not log
  backup contents, passwords, tokens or worker exceptions. Clear owned byte
  buffers; JavaScript strings/parsed objects cannot be reliably zeroized.
- Never automatically retry a failed, disconnected or uncertain restore. A new
  attempt requires restart and renewed administrator action. Parent shutdown
  kills and joins an active worker; unconfirmed exit fails the composition.
- Preserve existing keys. The maintenance worker does not create a replacement
  API key; notification alone cannot recover unreadable ciphertext. HTTP success
  counts describe the submitted configuration after worker verification.
- List/preview remain available before submission, with bounded catalog work and
  a single preparation slot. Successful restore still requires normal-mode restart.
- Test actual HTTP authentication, CSRF, restricted PostgreSQL identity and
  privileged child execution in the network-isolated synthetic image fixture.
  This is not evidence of a published-old-image upgrade or an Unraid rollout.

## Research and alternatives

Official sources discovered through web search and opened on 2026-10-05:

- [PostgreSQL role attributes](https://www.postgresql.org/docs/18/role-attributes.html):
  avoid superuser authority in the network-facing process.
- [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html):
  construct arguments/environment, use no shell and join process termination.
- [OWASP Node.js security](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html):
  bound request work and avoid exposing internal errors.
- [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html):
  retain CSRF protection for cookie-authenticated mutations.

| Option | Benefit | Cost |
| --- | --- | --- |
| Owner-privileged HTTP | Reuses current restore directly | Exposes database administration to the web process |
| General privileged broker | Flexible | Broad, persistent authority and replay surface |
| One-use fixed restore handoff — selected | Bounded authority; reuses verified worker | Restart needed for another attempt; explicit lifecycle code |

Recommendation stack: restricted restore handoff, production dispatcher with all
saved-setting checks, published-old-image upgrade rehearsal, then database-fenced
unattended ingestion recovery. No UI interaction change is introduced here.
