# Manual routing upgrade and restart rehearsal

Date: 2026-10-03. Scope: disposable release evidence, not live recovery.

## Decision

Add a focused image-level rehearsal alongside the existing embedded shutdown
and published-upgrade drills. Run two immutable image IDs against one newly
created scratch volume. The baseline is commit
`eef03e57ffdd26d638f32f1593c424b438041ea2`, which introduced durable opt-in checks;
the candidate includes the provider guard migration. This is a development-image
upgrade, not evidence of a published-release or PostgreSQL-major upgrade.

Use the real application entrypoint, database migrations, authentication, API
routes and minute scheduler. Do not patch production timers or expose test routes.
The fixture supplies only synthetic history, prior attempt state and a loopback
Radarr/Sonarr HTTP server. Fixture SQL may make its own cooldowns due after their
persistence is verified; this is not evidence that wall-clock waiting elapsed.

## Contract and bounds

- No work on a fresh installation until explicit opt-in. Seed legacy/incomplete
  history without enrolling it. Optional AI is not a prerequisite.
- Enable through the authenticated API; preserve attempts, opt-in and due dates
  across image replacement. Deny anonymous and non-admin access, reject invalid
  payloads, and retain normal CSRF/rate-limit behavior.
- Kill the candidate only after the fixture observes an actual scheduled GET.
  The spent attempt and cooldown must survive. Unknown completion is not refunded.
- Confirmed provider authentication failures pause checks without spending an
  item attempt. The pause survives restart. Rotate synthetic credentials and
  recover without changing the saved destination or replaying an add.
- Verify terminal observations and the three-attempt limit. Provider request
  counts are durable and count every non-GET as a forbidden write.
- One container at a time: 2 CPUs, 2 GiB memory, 128 processes, non-root,
  read-only root, dropped capabilities, no-new-privileges, network disabled,
  no published ports. HTTP is loopback only; no live endpoints or media mounts.
- Use random labeled resource names, reject collisions, and remove only exact
  names with matching ownership labels. Preserve caller-supplied images. A
  failed command must not print credentials or raw application logs.
- Each Docker command and polling phase has a timeout. Provider responses stay
  within the production 10-second/2-MiB bounds; a held response is interrupted
  deliberately. Failure stops the scenario and still attempts owned cleanup.

## Running the rehearsal

Build the baseline production image from a `git archive` of the exact baseline
revision in a new directory under `.tmp/`; do not switch branches or copy the
candidate schema into that context. Build the candidate with the ordinary
production Dockerfile. Set each build's `VCS_REF` to its source revision. Resolve
both tags with `docker image inspect --format '{{.Id}}'` before running:

```text
node scripts/run-manual-routing-rehearsal.mjs --baseline sha256:<baseline-id> --candidate sha256:<candidate-id>
```

The runner refuses mutable tags, identical images and a baseline with the wrong
revision label. It does not build, push or delete the supplied images. Allow
several real minute-scheduler ticks. Successful output ends with one
`ROUTING_REHEARSAL` JSON receipt including both image IDs and verified cleanup.
Failure is nonzero with a fixed classification; it is not a passing receipt.
The root npm alias is `test:local:manual-routing-rehearsal` (pass the same flags).

The fixture signs in again after each restart because nonpersistent sessions are
deliberately invalidated. A 429 may be plain text; status verification must not
assume all rejected requests return JSON. No token, password or raw provider
response belongs in the final receipt.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Mock-only checks | Fast, precise branch coverage | Cannot prove image startup or persisted-volume migration |
| Focused disposable image drill (selected) | Real auth, scheduler, migration and restart evidence | Docker and several minute ticks required |
| Live outage exercise | Real provider behavior | Risks user data; unnecessary for this contract |

Keep unit and real-PostgreSQL tests, add this focused drill, then incorporate its
receipt into candidate release evidence. Do not replace the broader published
upgrade rehearsal or claim NAS/multi-architecture coverage from an amd64 run.

## AI skill improvement

Extend the existing `classifarr-recovery-change` skill with a conditional image
rehearsal reference. Teach immutable inputs, actual interruption evidence,
synthetic-clock disclosure and owned cleanup. A second overlapping skill would
make selection less clear. Validate the skill metadata and exercise the linked
runner; neither proves autonomous skill decision quality.

## Official research

Discovered with online search and opened on 2026-10-03:

- [Docker resource limits](https://docs.docker.com/engine/containers/resource_constraints):
  explicit CPU/memory limits are needed; defaults are not bounded.
- [Docker volume persistence](https://docs.docker.com/engine/storage/volumes/):
  data outlives container replacement, which is the upgrade boundary under test.
- [Docker network isolation](https://docs.docker.com/compose/how-tos/networking/):
  internal networks restrict external connectivity; this smaller fixture needs
  no container network at all.
- [PostgreSQL upgrade testing](https://www.postgresql.org/docs/current/pgupgrade.html):
  use synthetic data in a copied schema for deployment tests. Here the old image
  creates its own database; no production backup is loaded.
- [HTTP retry semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2):
  uncertainty alone does not authorize replaying non-idempotent requests.
- [OpenAI skill guidance](https://learn.chatgpt.com/docs/build-skills):
  keep discovery focused and load supporting resources only when relevant.
