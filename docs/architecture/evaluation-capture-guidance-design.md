# Evaluation capture guidance design

Date: 2026-10-09. Scope: read-only operator guidance and database-test isolation.

## Evidence and prerequisites

The local installation's read-only check at 19:09 UTC found completed policy
replay, ready inventory, capture disabled, zero configured daily limits and no
cached response batches. The latest saved comparison group reported 252 missing
responses and 23 unsupported comparison paths. These counts describe that saved
group, not every item or the Unraid installation. Missing responses do not prove
a provider failure: recurring capture is not currently authorized here.

CI run 37922140772 also exposed a separate fixture defect: three integration
tests fail because their temporary `libraries` table lacks `media_server_id`.
The deployed schema has the column. Reproduce before updating test fixtures;
do not bypass production readiness SQL or weaken acceptance gates.

## Contract

- Add a small, collapsed native disclosure beneath existing capture status.
  Explain the distinction between policy replay and optional AI-response capture.
  Provide only a read-only status command in the UI; configuration stays an
  explicit administrator action in the existing container console workflow.
- Document status, optional bounded activation, disable, verification and the
  limits of each outcome. Unknown configuration is not disabled or ready.
  Unsupported paths are not repaired by spending more tokens.
- No new endpoint, polling, inference, routing change, migration or deployment
  requirement. Old Compose/Unraid templates do not need a new service or mount.
  Fresh installs remain disabled; imports and metadata do not wait for this work.
- Preserve the existing per-installation durable budget, UTC rollover,
  reservations before requests, admission/ownership checks, persisted cooldown,
  cancellation and configuration/model/source-revision checks. Capture admits at
  most five calls per tick, reserves 8,448 tokens per call and has a 20-minute
  capture deadline. No worker policy is changed by this work.
- Read-only status may be repeated safely. Do not reset reservations, retry an
  uncertain generation manually or invoke the separate one-shot capture mode as
  a workaround. Do not label a deferral as disabled or successful. Unsupported
  comparison paths remain a separate coverage gap; an unknown outcome calls for
  sanitized diagnostic review.
- Complete means guidance works with keyboard/mobile and access loss, and the
  real PostgreSQL regression passes with all readiness relations isolated.
  It does not mean capture was enabled, every cache gap filled or accuracy proven.

## Options and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Existing console controls plus concise help | No new write authority; works on old templates | Administrator needs console access; recommended now |
| New authenticated budget form | Easier configuration | Requires authorization, revision/conflict and budget tests; separate feature |
| Enable capture automatically | Could fill supported gaps unattended | Removes explicit resource consent; rejected |

Recommended order: read-only status → deliberate existing budget configuration →
durable reservation and admitted capture → normal policy replay → saved results.
Keep memory and ownership safeguards unchanged. Next, validate a deliberately
authorized small-budget local experiment before considering a budget form.

## Research and validation

Official sources discovered and opened through MCP search on 2026-10-09:

- [W3C ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22): status updates
  should not move focus. Static instructions need no additional live region.
- [W3C summary naming](https://www.w3.org/WAI/standards-guidelines/act/rules/2t702h/)
  and [disclosure keyboard behavior](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/):
  use visible summary text and preserve Enter/Space interaction through native HTML.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html):
  keep existing repeatable-read status snapshots; read-only is not a substitute
  for worker concurrency protection.
- [Docker exec](https://docs.docker.com/reference/cli/docker/container/exec):
  run the existing executable inside the running container; no privileged exec,
  host Node install, shell concatenation or template modification is needed.
- [Unraid container controls](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/):
  the container icon's context menu offers Console from the Docker/Dashboard tab.
- [Ollama usage](https://github.com/ollama/ollama/blob/main/docs/api/usage.mdx):
  actual token metrics differ from our conservative admission reservations.

Run focused real-database tests before the integration suite; unit and browser
tests must cover collapsed help, keyboard opening, narrow layout, pause/resume,
lost authorization and no HTTP writes. Rebuild only local Compose without cache,
check health and disabled-budget state, and regenerate the schema through the
isolated container runner. Record actual results separately in the outcome.
