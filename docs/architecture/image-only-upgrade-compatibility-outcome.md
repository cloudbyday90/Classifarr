# Image-only upgrade compatibility outcome

Date: October 1, 2026. No release or live deployment.

## Delivered behavior

The [design and researched alternatives](image-only-upgrade-compatibility-design.md)
are implemented as small ES modules using the existing entrypoint provisioning
process. Runtime/schema mode validation now happens before account or database
changes. Deployment-supplied internal maintenance-channel markers are rejected;
they cannot create an inherited capability. Missing settings retain normal/startup
defaults, while explicit invalid values fail with fixed explanatory messages.

Forced non-root containers must resolve to a named OS account; the guard does not
require existing installations to rename that account.
This does not change a container's UID or broaden its permissions. An unsupported
numeric UID fails before database initialization instead of failing later in
PostgreSQL. Root-started Community Apps-style PUID 99/PGID 100 and custom-ID
provisioning remain supported. We do not claim that the repository's separate
forced-UID-99 Compose example works without an account mapping; the disposable
probe reproduced that pre-existing limitation. Arbitrary unmapped UID support
needs an image-level identity solution, not permission escalation.

The published-release drill now accepts fixed deployment profiles. It uses the
actual application UID for probes even when the container starts as root. It
compares hashes of resolved application, network and volume configuration before
and after the baseline-to-candidate transition, excluding only the image field.
A difference blocks candidate startup. Raw resolved settings never enter receipts.
Non-default profile results cannot masquerade as the existing standard CI receipt.

## Real image-only upgrade validation

All profiles used the attestation-verified published `v0.48.4-beta` baseline at
revision `a0e417fd714919bb4ca30e20f9cd2380136ca74e`, with isolated synthetic volumes
and an internal network. Neither saved profiles nor host settings changed between
baseline and candidate. They are representative Linux deployment profiles, not
tests executed on an actual Unraid host.

| Profile | Startup identity | Result |
| --- | --- | --- |
| Standard | Forced 1000:1000, read-only filesystem | All 12 checks passed |
| Community Apps-style | Root startup, then 99:100 | All 12 checks passed |
| Custom | Root startup, then 2345:2345 | All 12 checks passed |

Each profile passed fresh initialization, published-image migration from 222 to
309 migrations, persisted inventory/settings, forced interruption during restore,
refusal of unverified normal startup, explicit verified restore retry, restart,
and automatic ingestion/backfill/profile progress. Movie/TV fixtures completed;
music stayed excluded and routing tasks remained zero. The custom and standard
end-to-end runs took 165.86 and 216.65 seconds respectively, including build,
provenance, scenario execution and cleanup. These are synthetic drill timings,
not production latency or throughput benchmarks.

After refining admission to preserve differently named existing OS accounts, the
standard profile passed all 12 checks again on the final code. That refinement
does not change the provisioned `classifarr` identities used by the two root-started
profiles. The final image also repeated all four refusal checks below successfully.

Four additional real-container checks verified that invalid runtime mode,
external schema mode, an injected channel marker and unmapped UID 99 all refuse
before changing `/etc/passwd` or creating files in an empty disposable data mount.
No live data was attached. Each drill project removed its own containers,
networks, synthetic volumes and candidate image tags; the four refusal containers
used automatically removed temporary filesystems.

## Regression and resource checks

- Focused final startup, supervisor, upgrade and receipt tests: 299 passed in
  12 suites; the separate seven-suite ownership/startup run passed 203 tests.
- Frontend: 5,795 tests in 411 suites passed; production build passed.
- Final full backend unit rerun: 48,457 passed and one existing skip across
  1,589 passing suites, completed in 201.59 seconds on the final code.
- Backend coverage run: 48,456 passed, one existing skip, and one ownership-review
  failure before its three changed-source records were refreshed. No unresolved
  ownership classification was waived; the gate then passed with 19 owned,
  188 separately coordinated and 490 unresolved paths. The final full rerun above
  confirms no remaining test failure.
- Combined coverage ratchet passed without baseline changes. Lint, types,
  ESM checks, Knip, copyright, migration naming and schema-snapshot integrity
  passed. No database migration or dependency change was introduced.

This change adds no production polling loop, process, listener or background job.
Existing account provisioning performs the extra pure checks. Disposable profile
runs were serial and kept the existing two-GiB memory limit and command deadlines.
CPU/total-memory saturation and real media workload latency are not certified by
these upgrade tests.

## Recommendation stack and next component

Keep image-only compatibility admission and profile tests first; retain current
autovacuum-first, bounded conditional recovery and on-demand diagnosis. The benefit
is continuity with unchanged supported deployments and earlier actionable refusal;
the cost is that production still has its shared administrator identity.

Next, complete the **production privileged-operation adapters and protected
persistent layout** before enabling separated identities. The acceptance boundary
is concrete: the real application must be unable to reconnect as administrator or
reset the maintenance budget, while schema maintenance, backup/restore, deferred
index work and queue recovery still function. Reuse these same deployment profiles
to test the cutover and interrupted migration. Do not equate this admission work
with completed isolation or automatic legacy ingestion ownership recovery.

The security-hardening review influenced the early-refusal boundary and the
decision not to silently grant privileges or activate an incomplete identity
migration. Official-source rationale and pros/cons are in the separate design.

## Delivery scope

GitHub MCP and the authorized saved-login GitHub CLI both returned no open PRs.
No random PR was available to implement; none was invented, merged or closed.
No live container, volume, deployment template, routing setting, image publication,
version or release was changed.

Reproduce the disposable profiles with:

```sh
node scripts/run-published-upgrade-drill.mjs --deployment=standard
node scripts/run-published-upgrade-drill.mjs --deployment=unraid
node scripts/run-published-upgrade-drill.mjs --deployment=custom
```

The launcher verifies the pinned baseline's provenance and refuses arbitrary
profile paths. Its cleanup targets only the collision-checked random project.
