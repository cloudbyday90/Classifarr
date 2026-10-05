# Command Center recovery guidance

Date: 2026-10-05. Scope: read-only operator guidance, not recovery authority.

## Contract

Reuse the Command Center library request and existing library recovery workflow.
Show one compact banner with affected libraries, impact, and a safe next step.
Separate operator attention from automatic import/retry activity. Healthy, empty,
archived, deliberately disabled, and unsupported libraries produce no warning.

The backend distinguishes legacy records eligible for automatic recovery from
current-protocol unknown writers and a missing compatibility fence. Read the
actual trigger catalog using the same fixed predicate as recovery admission.
This is an observation, not permission: the recovery transaction still checks
locks, configuration, protocol and authorization when work starts.

The existing authenticated library list/detail JSON adds
`ingestion_status.recoveryMode`: `null` when no foreign marker needs reconciliation,
otherwise `disabled`, `unconfigured`, `active`, `review`, `automatic`, or
`deployment_required`. Existing `state` values and mutation contracts are unchanged.
The fixed catalog predicate is shared with locked recovery admission, not exposed
as a client-controlled claim flag.

When deployment blocks recovery, `recoveryDiagnostic` provides the exact expected
migration filename, whether its ledger record exists, whether this connection uses
the current import protocol, and at most 12 fixed table/trigger checks. A check is
`missing`, `definition_mismatch`, or `not_always_enabled`; valid checks are omitted.
Definition mismatch takes priority over enablement so advice never suggests merely
enabling a changed trigger. No raw exception, credentials or host paths are returned.
Absence from the migration ledger is **not** described as a proven failed migration.

- Automatic recovery/import/retry: no intervention requested; details remain
  available through a library link.
- Unconfigured or source-review state: link to library settings with a concrete
  explanation; never assume an outage is a permission or mount problem.
- Unknown writer: link to the existing reviewed recovery screen. No direct
  ownership claim or mutation from the banner.
- Unrecorded migration: name it, back up, and use normal startup maintenance or the
  installation's separate migration administrator. A startup failure requires its
  actual log error before another attempt, not blind repeated restarts.
- Recorded migration with disabled safeguards: name the table/triggers and instruct
  a database administrator to restore ALWAYS mode while all writers are stopped.
  Missing or changed definitions need a reviewed repair, not enablement alone.
  Never delete a ledger record or rerun this non-idempotent original migration.
- Incompatible connection protocol: update/restart the Classifarr process using
  its normal startup; if persistent, report its image version. No DDL repair is
  suggested when catalog safeguards are intact.
- Do not prescribe a blanket Compose/template update, elevated privileges,
  trigger removal or new keys. External-database deployments may legitimately
  use an external migration administrator.
- Failed/malformed/offline library refresh: show that status is unavailable,
  remove actionable stale diagnoses, and offer a read-only refresh.

Library status stays in memory, not localStorage. Poll only while visible on the
existing bounded interval with existing single-flight handling. No new worker,
provider request, database mutation, retry-budget change, or schema migration.
No network I/O occurs while checking the fence catalog. A successful fresh
observation removes a resolved issue; dismissing a message cannot mark work done.

Use fixed copy and internal routes, escaped library names, semantic links, a
stable polite live region and disclosure for details. Announce summary transitions,
not every polling timestamp. Keep routine progress less prominent than blockers.
Use administrator-facing language: "Import needs attention" and "Review and
resume." The administrator controls the installation; internal import ownership
means a background process's write coordination, not the administrator's identity.
Limit expanded rendered library rows and link to the full Libraries view.
Keep refresh focusable with `aria-disabled` while coalescing requests. If a fresh
snapshot removes the focused banner, hand focus to its persistent status message;
ordinary background updates must not move focus from elsewhere.

## Tradeoffs and recommendation stack

1. Reuse existing status and recovery paths: minimal new traffic and consistent
   safeguards; the dashboard cannot inspect a backend that failed to start.
2. Share the catalog predicate: avoids contradictory automatic/manual guidance;
   adds a small catalog observation to library status reads.
3. Add verified deployment diagnostics incrementally: avoids unsafe guesses;
   arbitrary host mount errors still require host/startup-log inspection. Do not
   mount the Docker socket merely to power a banner.
4. Keep privilege isolation separate: this UI does not strengthen the compatibility
   fence against a deliberately privileged database writer.

## Verification plan

Test healthy/fresh, active/retry, disabled/archived, missing configuration, unknown
writer, missing fence, unknown future states, stale/offline/forbidden responses,
escaped names, bounded rows, internal navigation and resolved-summary behavior.
Verify catalog projection on real isolated PostgreSQL, test the production Vue
build in a browser fixture, and rebuild local Compose without cache. No Unraid
deployment and no release.

## Official sources checked October 5, 2026

- [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html):
  deny by default and recheck authorization on every request; navigation is not
  authority to perform recovery.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22):
  mount the status region before updates and announce coherent, polite summaries.
- [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/):
  mount permissions affect the host; do not recommend broad writable mounts or
  infer host configuration from an unrelated application error.
