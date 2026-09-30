# Embedded provisioning and handoff outcome

Date: 2026-09-30. See the [design, research and tradeoffs](embedded-provisioning-handoff-design.md).

## Delivered

- Root-owned shipped executable assets, including PostgreSQL extension binaries.
- Modular ESM identity planning/provisioning with pre-mutation validation,
  bounded account tools, post-update readback and no account/group deletion.
- A fixed-command maintenance child and optional supervisor maintenance phase,
  with confirmed completion before normal workers and fail-closed cancellation.
- Real schema and encrypted-restore handoff probes, plus Unraid `99:100` and
  writable-root executable protection checks in the existing disposable drill.

## Validation

- Backend: **47,804 tests / 1,573 suites passed**, with statement/line coverage
  90.15%, branch coverage 85.16% and function coverage 91.82%.
- Frontend: **5,795 tests / 411 suites passed**, with statement coverage 86.11%,
  branch coverage 78.76%, function coverage 85.56% and line coverage 88.03%.
- Focused PostgreSQL integration: **71 tests / six suites passed**, covering
  backup restore/recovery, runtime admission and schema maintenance.
- Coverage ratchet, server/client lint and type checks, CI preflight, ESM import
  and mock-shape checks, all four policy gates, Markdown lint and diff checks passed.
- The writer ownership drift gate passed without reclassifying the existing
  **490 unresolved** entries as safe. Production writer compatibility remains false.

Both real Docker drills passed against the final source and cleaned up their
collision-checked disposable projects:

| Drill | Verified outcome |
| --- | --- |
| Embedded isolation | Six core checks, including actual schema and encrypted restore through the supervisor before restricted runtime startup |
| Deployment profiles | Default non-root `1000`, custom `2345:2345` and Unraid `99:100` startup, preserved-data restart and shutdown checks |
| Executable protection | Application writes denied for shipped code and extension binaries, including writable container filesystems |
| Failure handling | Node termination, PostgreSQL loss and forced host-stop recovery exercised |
| HTTP restore recovery | Six checks passed, retaining the existing restore API and post-restart authentication behavior |

The first complete isolation run measured 17,356 ms for its core drill and
93,816 KiB maximum orchestrator RSS. These are synthetic harness observations,
not whole-container sizing or production load measurements. The final rerun also
passed; its Unraid stop check completed in 2,801 ms including verification, under
the unchanged ten-second host timeout. No background retry process was introduced.

## Deployment and limits

Production packaging and account validation change now. Ordinary production
startup retains its shared OS/SQL identity and does not activate the optional
maintenance handoff. Saved templates, credentials, persistent data and the running
local container are unchanged. No release or tag is created.

Both GitHub MCP and the saved GitHub CLI login returned no open PRs, so none was
available to select or implement. No PR was merged.
The next component is the resumable legacy-cluster identity migration described
in the design, not automatic adoption of unknown ingestion owners.
