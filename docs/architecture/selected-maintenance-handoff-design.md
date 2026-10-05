# Protected schema and restore worker handoff

Date: 2026-10-05. Continues [protected application storage](protected-application-layout-design.md).

## Decision

Replace the selected-database rehearsal's ad-hoc schema subprocess with a reusable,
fixed-target maintenance launcher. Exercise both schema and restore commands under
the separated PostgreSQL OS identity. This is the maintenance part of production
integration, not activation of automatic conversion or legacy ingestion takeover.
The ordinary entrypoint and saved Compose/Unraid templates remain unchanged.

## Contract

- A trusted root composition holds the migration journal lease, has verified the
  selected database and drained runtime work. It supplies the verified database
  UID/GID. No HTTP endpoint, timer, idle service or public mode switch is added.
- Launch only the packaged ESM worker through `su-exec`, without a shell, with a
  constructed environment. Use the fixed protected Unix socket, database
  `classifarr` and maintenance role `classifarr`. Never inherit credentials,
  preload flags, SQL, target paths or executable names from requests.
- Before importing database/services, the worker requires Linux, `/app`, the
  actual distinct named PostgreSQL identity, exactly one allowed operation and
  the exact constructed environment. Refuse an application `.env` file rather
  than allowing dotenv to expand this privileged worker's configuration.
- Schema work has a 900-second child bound; restore has 180 seconds. The selected
  supervisor allows 920 seconds for schema completion, and retains its existing
  joined TERM/KILL shutdown. Child output is discarded with a 64 KiB ceiling;
  success requires exit zero and closed streams, not a message in stdout.
- Restore accepts one nonempty Buffer, at most 64 MiB, via stdin only. The existing
  bounded parser decrypts/validates it before database loading; its byte buffers
  are cleared. The caller owns and clears its input after completion. No filenames
  or credentials appear in arguments or diagnostics.
- Reuse exclusive SQL maintenance admission, pinned sessions, durable restore
  quarantine and existing merge/replace verification. Busy returns 75; malformed
  input returns 2; unknown failure returns 1. Only the typed schema restore refusal
  returns 78 and produces the fixed recovery diagnostic. Cleanup failures override
  success/refusal. Signal, output failure or uncertain exit is never success.
- No write replay on timeout. A later explicit restore may resume only through
  existing admitted restore logic. Unknown old owners remain blocked. Normal
  startup cannot proceed until schema assessment confirms the restored gate.

Completion means the one-shot operation and pool/process cleanup completed. It is
not import/metadata recovery completion. Fresh installs without the protected
selection use their existing startup; optional AI work is unaffected. No schema
change, library-specific special case, warning suppression or ownership reset.

## Research and tradeoffs

Official sources discovered through web search and opened on 2026-10-05:

- [PostgreSQL 18 peer authentication](https://www.postgresql.org/docs/18/auth-peer.html)
  obtains the local client's OS identity from the kernel. Separate OS identities
  plus protected HBA rules are required; merely changing an environment username
  does not establish this boundary.
- [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html)
  documents constructed environments, shell-free launch, limited pipes and the
  distinction between process exit and stream closure. Retain bounded draining
  and join the actual child before stopping PostgreSQL.

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| Keep fixture-only launch code | Least change | Does not test the intended reusable handoff |
| Fixed protected maintenance worker — selected | Reuses restore/schema safety; no idle privileged worker | Requires protected dispatcher and runtime integration before deployment |
| Activate unattended migration immediately | Fewer operator steps now | Unsafe while legacy writers and custom-path/restore integration remain unresolved |

Recommendation stack: fixed maintenance handoff; protected runtime/dispatcher with
custom-path validation and bounded database diagnostics; enforce all ingestion
writer admission; then enable unattended legacy recovery and rehearse published
upgrades. There is no new web UI or accessibility interaction in this change.

## Acceptance

Unit-test environment/identity/operation refusal before imports, exit/close ordering,
input/output bounds, cleanup failure and typed restore refusal. On the exact image,
use disposable network-none volumes to test real peer authentication, runtime lock
contention, killed restore quarantine, schema refusal, verified restore and restart.
Preserve the old source database and all existing migration-selection checks.
