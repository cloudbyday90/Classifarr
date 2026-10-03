# Image-level recovery evidence

Use this reference when restart or upgrade safety is part of the requested
change. It does not authorize replacing a live container or recovering real data.

## Choose the existing runner

- Manual routing checks: `scripts/run-manual-routing-rehearsal.mjs` and
  `docs/architecture/manual-routing-rehearsal-design.md`.
- Queue claim recovery: `scripts/run-embedded-shutdown-drill.mjs --queue-claims`.
- Published installation/migration: `scripts/run-published-upgrade-drill.mjs`.

Read the chosen runner's arguments and safety checks before running it. Do not
point an isolated fixture at live credentials or retrofit it with a live-volume
override. Never substitute a newer database created by the candidate for a
database initialized by the old image.

## Make the claim match the evidence

Pin both images to immutable IDs. Record the source revision and whether each is
published or locally built. A same-image restart is not an upgrade. A locally
built development baseline is not proof of upgrade from the published release.
Keep the production entrypoint, authentication, migrations and scheduler intact;
mount test fixtures separately, never over application source or dependencies.

For interruption tests, observe the actual admitted request or durable claim
before killing the process/container. Verify the pre-interruption state survived
before making fixture deadlines due. Resetting counters to advance a scenario
destroys the evidence of preserved budgets. Explicitly disclose fixture deadline
changes: they do not prove the real cooldown elapsed.

Count attempted provider writes as well as successful effects. A request that
timed out may already have succeeded remotely. Zero duplicate rows alone does
not prove zero duplicate add attempts. Preserve the original routing decision
when recording a later read-only observation.

## Bound and finish the exercise

Require synthetic data, bounded CPU/memory/PIDs, fixed HTTP targets, no published
ports and no external network where feasible. Poll within a deadline; keep normal
authentication and rate limits enabled. Inspect failures using fixed error codes
and fixture locations, not raw response bodies, cookies or credentials.

Delete only exact randomly generated resources whose ownership labels match.
Check cleanup after scenario failure and after ambiguous Docker timeouts. Never
prune Docker, delete caller-supplied images, or claim success before cleanup
verification. Report an unresolved cleanup failure with its exact test resource
name, not as a passed rehearsal.

Keep a separate outcome document with image IDs, actual checks, skips, deliberate
fixture shortcuts, and deferred platform coverage. Metadata validation of this
skill is not behavioral validation; tests of its runner prove only those checks.
