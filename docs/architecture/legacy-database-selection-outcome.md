# Legacy database selection outcome

Date: 2026-10-04. See the [design and official sources](legacy-database-selection-design.md).

## Delivered

Added a small ESM selection module, separate durable selection receipt and a
copy-phase guard. A completed conversion must pass verification before selection,
including on every restart. Failed or missing evidence stops the operation; it
never selects the old database as a fallback. Selection intent prevents recopy
even when the conversion receipt is missing. Directory-sync failures are retried
through verification and durable selection, not treated as successful startup.

The isolated PostgreSQL rehearsal now commits a restricted-role write after
selection, kills the actual process, reads that write in an independent restart
before replaying any write, and verifies the original cold source is unchanged.

This is a tested prerequisite, **not production activation**. Ordinary startup,
saved permissions, existing appdata and library ownership remain unchanged. No
new timer, API, dependency, database migration or release was added. The recovery
skill kept ambiguous ownership fail-closed; the release-evidence skill kept local
synthetic checks distinct from deployed upgrade acceptance.

## Validation

- Focused backend checks: 210 passed across nine suites; one Linux-only
  filesystem test skipped on Windows. The real Linux drill separately exercised
  file/directory sync, protected ownership and process death.
- XML contract: all ten tests passed. README Compose tests parse both the
  optional-media example and its no-media default.
- Repository lint, both client/server type checks, Markdown lint (1,882 files),
  copyright, ESM import/mock-shape checks, migration/schema integrity and both
  Knip modes passed. Docker Compose validated both README example variants.
- Ownership gate passed after reviewing only the changed migration paths and
  adding explicit selection dependencies: 19 owned, 260 separately coordinated,
  502 unresolved. Existing unresolved paths remain unresolved.
- Development image `sha256:432ef8702c094bb6342c68c87efac335fb20eec7ee7690c2b563d4daeaed5f8e`
  passed the full isolated drill: 12 core checks plus the existing default
  non-root, custom `2345:2345` and root-start Unraid-style `99:100` profiles.
  Core duration was 125,727 ms; orchestrator peak RSS was 92,336 KiB (not total
  container memory). The profiles retained their ten-second host stop budget.
  All owned disposable containers, volumes and aliases were removed; their
  synthetic data is regenerable. The caller's image and real appdata were retained.

The development image preceded the documentation and review-manifest updates.
Final clean-source no-cache rebuild and evaluation will be recorded below after
they run; the earlier result is not relabeled as exact final-image evidence.

## Template compatibility

The README example now clearly targets a new `1000:1000` installation, leaves
media access optional, disables missing-media-directory creation in the opt-in
bind, and includes the maintained 60-second shutdown grace period. Existing
installations are told to retain their saved configuration.

The project XML and existing upstream request explicitly preserve legacy
appdata, identities and media mappings. This does not change a saved CA template
or require copying forced-non-root Compose settings into it. The separate
[template outcome](unraid-template-startup-outcome.md) records the upstream handoff.

## PR and remaining work

The saved GitHub CLI login returned no open Classifarr PRs on 2026-10-04. No
random PR was available; none was invented, merged or substituted.

Recommended next step: compose the protected startup path around the verified
copy and durable selection, then finish database-enforced ingestion-writer
admission before activating unattended recovery. Preserve ordinary non-root
compatibility while defining and testing that transition. Recovery completion
means import plus metadata backfill, not disabled optional AI work.

This avoids post-upgrade write loss at the cost of a small protected receipt and
additional startup integration. A published-image upgrade, physical Unraid/
Synology validation, power-loss durability and completed unattended legacy import
recovery are **not** proved by this increment.
