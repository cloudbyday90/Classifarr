# Protected application data layout outcome

Date: 2026-10-04. Base: `2621ecae3f2d881d5292f9e62e9ade331e4d8b4e`.
See the [design, sources and tradeoffs](protected-application-layout-design.md).

## Implemented

Added a fixed-path ESM provisioner for application config, secrets, logs and
backups below already protected appdata. It preflights every child before writes,
uses retained no-follow directory handles, restricts permissions to 0700,
preserves all contents, syncs metadata and verifies ownership before success.
It does not recursively change ownership or make the appdata parent root-owned.

Extracted shared separate-account validation for this provisioner and the selected
database adapter; duplicate application UID aliases are now rejected as well.
The selected startup rehearsal calls provisioning while holding the migration
lease, before runtime admission. New Linux scenarios cover a real killed
provisioning process, restart, substituted links, nonempty root-owned refusal,
preserved synthetic settings/key bytes and restricted application writes.

No production conversion, schema/API/dependency/version/template change or release.
Saved forced-non-root startup is unchanged. The compatible entrypoint still refuses
a reserved protected layout. Movies ownership warnings are not resolved by this
increment; no inventory or legacy markers are reset.

Saved GitHub CLI login returned no open Classifarr PRs on 2026-10-04. No eligible
random PR could be implemented; none was merged or represented as open.

## Verification

Initial focused run: five suites, 107 tests passed. Server lint/typecheck, ESM
import/mock checks and Markdown lint passed (1,887 documents before this outcome).
Lint caught one promise-executor return in the synthetic interruption worker;
fixed the code rather than disabling the rule. Full backend and image verification
are pending at this point; exact results will be recorded after the clean build.

Ownership pins were reviewed only for the changed provisioner/identity helpers
and synthetic fixture modules. New entries remain separately coordinated, not
proof of completed ingestion fencing. The recovery and release-evidence skills
required the bounded lifecycle, real Linux checks and explicit activation limits.

## Next item

Connect the protected production dispatcher with restricted runtime, startup and
restore maintenance, custom-path validation and bounded PostgreSQL diagnostics.
Then enforce ingestion writer admission and activate unattended legacy recovery.
Do not use file permissions alone as proof that an older database writer stopped.
