# Background AI evaluation controls: outcome

Status: Unreleased, 2026-10-14. Implemented and locally verified. See the separate
[design and research](evaluation-workload-controls-design.md).

## Implemented contract

Command Center now provides administrator-only Off / When idle / Scheduled
controls and a daily request safety limit. The existing scheduler resumes work
without an open page. The additive migration preserves zero/positive legacy
allowances; it does not activate inference. Legacy token and request ceilings
remain intact until explicitly edited. The UI displays their tighter effective
request limit instead of implying local-model billing.

GET `/api/stats/evaluation-workload` is read-only, no-store and administrator-only.
PUT accepts exactly `revision`, `mode`, `dailyRequests`, `startMinute`, and
`endMinute`. Revisions reject lost updates with 409; invalid input returns 400,
unknown failures 503 with fixed codes. Mutation limits are ten per minute, reads
thirty. The existing API authentication and application CSRF protection remain.
Only an explicit save changes durable consent. Neither route performs inference.

Both configuration paths preserve same-day counters and cooldown timestamps.
The private legacy CLI keeps a saved window while changing its two ceilings.
UTC windows support midnight, include start, exclude end, and reject equal times.
Reservation SQL checks the window at every request. One existing heavy-work
permit spans capture and cleanup. The new serial monitor checks local readiness,
revision and window during capture, with a separate check before each generation.
Unknown admission cancels the HTTP wait. No remote rollback is promised and no
attempt is refunded. Existing model identity, response size, timeout, retention,
memory admission, checkpoint and replay restrictions remain unchanged.

## Scope

No provider-wide coordinator is added. Independent Classifarr databases can still
call their shared Ollama simultaneously. These settings cannot guarantee GPU-wide
priority. No Unraid setting, shared provider setting, live evaluation opt-in,
release, tag, merge or model download is included.

GitHub MCP returned no open Classifarr pull requests on 2026-10-14. There was no
eligible PR to randomly implement; none was substituted or merged.

## Verification

### Automated checks

- Backend coverage run: 1,836 suites passed; 58,096 tests passed, one existing
  skip. Final focused service/code-health rerun: four suites, 34,975 tests passed.
- Frontend coverage run: 474 files and 7,347 tests passed, no skips. An earlier
  run exposed an outdated help-text assertion, which was corrected. A concurrent
  run timed out during existing lint-contract setup; the final full run passed
  without increasing deadlines or disabling tests.
- Isolated PostgreSQL and real loopback HTTP: three suites, 42 tests passed.
  These cover fresh/read-only state, concurrent revisions, legacy ceilings,
  repeat migration, UTC boundaries, preserved counters/cooldowns and cancellation
  on disable, edits, closed windows, foreground activity or unknown admission.
- Type checks, backend/frontend lint, dependency reachability checks (normal and
  production), static ESM import/mock-shape checks, migration/schema integrity,
  Markdown and copyright checks passed.
- Ownership review passed with no unreviewed drift. Its existing
  `productionCompatible: false` result remains: unrelated unresolved inventory
  writers were not waived or declared safe by this change.
- Coverage ratchet passed: server statements/branches/functions/lines
  89.71/86.34/91.07/89.71%; client 87.76/81.80/87.49/89.46%.

Test data is synthetic and model requests use loopback HTTP fixtures, not shared
Ollama. The schema was generated in a disposable network-none PostgreSQL container
from the preceding local image; its owned container and data directory were
removed. The packaged fresh schema also matched the checked-in snapshot.

### Image and local runtime

The no-cache Compose build used clean source
`7cc74482cc588a2c7d143c1f3eb4256e546434e9`. Candidate image:
`sha256:adabd220d5ab1b14b3ed0799951b1114cf8bb833f1e34da661ef2318feb2084c`.
The previous local image remains available for rollback:
`sha256:afba6acb9c5e7bb4cde3c2b32485abcbc0727598314e5437267f4c7a8e9385b0`.

The isolated rehearsal passed. It kept
the normal entrypoint, authentication, migrations and scheduler, with no published
ports or external network, synthetic inventory, two CPUs, 2 GiB memory and 512
PIDs. Its separately copied probe does not replace application code. Initial
fixture corrections addressed a PostgreSQL array parameter and an overbroad
assertion that counted routine maintenance jobs as classification/routing jobs.

The final run proved fresh Off/zero state, zero generations across 65 seconds of
normal scheduling outside the configured UTC window, exactly five generations
after explicit enablement, five saved responses, preserved cooldown and request
count after disabling, and Off/five saved responses after a same-image restart.
The normal application also completed 80 metadata-enrichment maintenance jobs;
there were no classification/routing tasks. Owned rehearsal containers and data
directories were verified removed, including after fixture failures. No deadlines
or counters were edited to advance this rehearsal. Fixed-clock PostgreSQL boundary
tests and fixture-only window closure are separate from this elapsed-time check.

Local Compose replacement completed using that exact image and retained data.
Health returned HTTP 200; Docker reported healthy, no OOM and zero restarts.
The migration is recorded and the existing allowance remains Off: zero requests,
zero token allowance, zero reservations, revision 2, unchanged cooldown timestamp.
Container limits remain 2 GiB and V8 old space 1,536 MiB. User `1000:1000`, read-only
root filesystem and `no-new-privileges` remain enabled.

A fresh local database archive was created before replacement and its archive
listing checked. This is not a restore drill. No user data or credentials are
included in the repository. Browser inspection could not complete because the
browser connection timed out twice; visual verification is not claimed.

This is a local development-image replacement and same-image fixture restart,
not a published-release upgrade drill. Synthetic responses do not establish model
quality, shared-GPU priority or long-duration memory behavior. The subsequent
outcome-only documentation commit does not change the tested runtime artifact.

## Next recommendation

Design provider-wide background admission for installations sharing Ollama,
including authenticated installation identities, bounded leases, failure-closed
behavior and foreground priority. Until then, opt in on one installation or use
deliberately separate windows. Do not raise shared server parallelism as a shortcut.
