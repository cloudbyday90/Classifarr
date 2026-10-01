# Image-only upgrade compatibility design

Date: October 1, 2026. Baseline: `6fe6329c`.

## Decision and scope

We will deliver the first production-activation prerequisite: a fail-before-write
embedded startup contract and repeatable upgrades using unchanged saved deployment
profiles. We retain the current shared OS/database identity and maintenance path.
This work does not activate isolation, repair unknown ingestion ownership, or
claim that a successful health check proves least privilege.

I inspected the entrypoint, account provisioning, supervisor and published-image
upgrade drill. The drill currently tests only forced UID 1000. Runtime-mode errors
are discovered after entrypoint database writes. A disposable invocation also
confirmed that PostgreSQL cannot initialize under unmapped UID 99, even when its
database username is supplied explicitly. A Community Apps container that starts
as root and provisions PUID 99 is a different deployment, not equivalent coverage.

## Options and tradeoffs

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| 1. Require replacement deployment templates | One controlled configuration | Breaks image-only upgrades; rejected as the default |
| 2. Validate saved settings and test fixed profiles | Preserves working installations; rejects unsupported combinations before writes | Additional disposable test time; selected first implementation |
| 3. Activate separated identities immediately | Removes application administrator authority when complete | Remaining privileged jobs and persistent-layout migration are not integrated; not safe to claim complete |

I recommend Option 2 now, followed by the production identity migration. We cannot
infer permissions from PUID or a template name: Docker's actual user wins. We must
not add privileges, modify saved templates, or fall back from explicitly requested
isolation. Compatibility retains existing administrator authority; it is not an
equivalent security substitute for the later isolated deployment.

## Startup contract

The existing identity-provisioning command will first validate the shared pure
runtime/schema parsers and reject an externally supplied maintenance-channel
marker: the embedded production supervisor does not create that channel yet.
Missing runtime/schema values keep `normal`/`startup`; explicit invalid or empty
values fail. Non-root execution must have a named OS account at
its actual UID; existing account names are not changed or required to match
`classifarr`. Root execution retains the existing collision-checked PUID/PGID
provisioning. Errors are fixed messages, never raw environment values.

Validation precedes account modification, directory creation, recursive ownership
changes, PostgreSQL configuration and migrations. This is configuration admission,
not a claim to discover every filesystem or database readiness failure. Valid
normal and restore modes retain their current lifecycle behavior.

## Upgrade proof

Extend the existing attestation-verified published-release drill with fixed
deployment profiles: forced UID 1000/read-only, root-started Community Apps-style
PUID 99/PGID 100, and root-started custom IDs. Do not edit live Compose or templates.
Each profile uses the same settings for baseline and candidate; only the image
changes at upgrade. Hash the resolved non-image service configuration before and
after that transition. Reuse real migrations, inventory sentinels, restore
interruption/retry, scheduler/backfill and restart tests. Run profiles serially,
bound commands, preserve provenance verification, and clean only each randomly
named disposable project's own resources. Profile evidence must not be accepted
as the existing default CI receipt without an explicit contract change.

## Research and accessibility

Official links were discovered through online search and reviewed October 1 using
the September 2026 PostgreSQL 18 baseline. These are live sources, not an archived
September snapshot.

- [Docker runtime settings](https://docs.docker.com/engine/containers/run/): host
  user, mounts and capabilities override image defaults; an image cannot invent
  authority that its deployment prohibits.
- [Unraid Community Applications](https://docs.unraid.net/unraid-os/manual/applications/):
  existing installation settings are saved as user templates. We test unchanged
  settings instead of assuming template replacement.
- [PostgreSQL peer authentication](https://www.postgresql.org/docs/18/auth-peer.html):
  future isolation must bind database roles to real OS identities, not just rename
  SQL users while keeping shared trust authentication.
- [PostgreSQL filesystem backup](https://www.postgresql.org/docs/18/backup-file.html):
  later identity migration requires a consistent complete backup and a proven
  stopped-cluster boundary; retaining an image alone is not database rollback.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  future UI status must expose meaningful text programmatically. This backend-only
  change adds no UI and makes no new WCAG conformance claim.

## Acceptance and rollback

Reject invalid settings and unsupported identities before any mutation. Prove
normal/restore defaults, secret-safe failures and real image-only upgrades on the
supported profiles. Record measured test costs without presenting synthetic
figures as production capacity. No release, live migration or restart is part of
this component. Reverting the startup check does not undo schema migrations;
database rollback continues to require its existing verified recovery procedure.
