# Protected runtime configuration outcome

Date: 2026-10-05. See [design, alternatives and official sources](selected-configuration-design.md).

## Implemented

Small ESM modules validate the application profile and inspect configuration as
the application user before database/service imports. They preserve explicit
key precedence, existing key files, custom runtime JSON, reviewed security/OMDb
settings and log/backup paths. Missing/corrupt keys cannot trigger replacement
generation in this protected path. Database identity, socket, executable and
schema authority remain fixed; restore-only mode refuses application overrides.

This is preparation for protected production dispatch, not its activation.
Current Compose and Unraid startup remain compatible and unchanged. No deployed
ingestion ownership is reset, no live Unraid data is accessed, and no release is
created. Key rotation/reset is documented as a separate lifecycle feature, not
performed here. The recovery skill kept uncertain ownership and secret loss
separate from recoverable configuration failures.

## Local validation

- Final backend unit run: **1,689 suites, 52,216 tests passed**, one Windows skip,
  317.481 seconds on final code. The skipped directory-fsync copy/preservation/no-overwrite
  behavior was separately exercised against the actual Linux image; that is not
  a claim that the skipped Windows Jest case itself ran.
- Focused configuration, startup, ownership and code-health run: **5 suites,
  32,667 tests passed**. Initial broad validation caught the not-yet-reviewed
  ownership fingerprints and a false-positive secret-path literal; both were
  corrected without weakening either check, followed by the full passing run.
- Server lint/typecheck, copyright, ownership gate, both knip checks, static ESM
  imports, ESM mock shapes and Markdown checks passed. Scoped staged-patch
  Gitleaks found no secrets. Client source/dependencies did not change; no fresh
  client coverage or coverage-ratchet claim is made.
- Ownership review changed only the eleven inspected configuration/fixture
  entries: **19 owned, 283 separately coordinated, 502 unresolved**. Passing
  static drift review is not production writer compatibility.
- Random open [PR 556](node-types-pr-556-outcome.md) was applied and tested on
  main, then removed because Node 26 declarations violate the deployed Node 24
  baseline. All 30 tooling checks passed after removal. No merge or candidate
  installation was performed.

## Exact image and schema

Final no-cache local Compose build from clean source
`7e8892f409872c520ba962782a700bc87c8310eb` produced local image ID
`sha256:62a99f622ea6180778068b4806fc0b0d5c07fcc1347cf3580df2b83ce906838c`.
Its OCI revision matches; this is local linux/amd64 AVX2 evidence, not a
published registry digest or multi-platform release attestation.

After rebuilding, the existing dump-schema implementation ran against an
isolated, network-disabled PostgreSQL 18 container from that image. Loading the
tracked schema, dumping, loading a second fresh database and dumping again had
zero drift. `database/schema/current.sql` is unchanged; there is no new migration.
The exact labeled schema fixture was removed. The separate Linux fsync fixture
also exited and was removed.

The first build (`ce8b0b0c99c8baddb64873665bd4f1ecc1e1cf3f`, local image
`sha256:02c397e07ca3746765500b8c930542faeb89588415861c71a18ce068b9620e38`)
failed the new secure-cookie assertion during image rehearsal: the fixture
incorrectly expected JSON to outrank seeded database settings. Production
precedence is intentionally **database, then file, then environment/defaults**.
The corrected custom-profile fixture checks and removes only its two synthetic
database defaults after successful schema maintenance, before launching the
application, to exercise file-over-environment fallback. No production setting
precedence was changed or assertion removed. Failed-project cleanup passed.

The second build reached the same cookie assertion because the loopback request
was plain HTTP. The existing cookie policy intentionally falls back to non-secure
cookies on HTTP, even when forcing is configured. The fixture now supplies the
existing HTTPS-proxy indication for custom-profile login. This tests the real
cookie options under that indication, not TLS termination or proxy trust. The
assertion remains strict; application cookie behavior is unchanged. This failed
project also cleaned up completely.

Final image rehearsal and replacement evaluation are pending; update this
section with actual results before handoff.

## Recommendation stack

1. Keep the validated profile: it preserves existing credentials without granting
   application configuration control over privileged database startup. The cost
   is explicit refusal of unsafe paths and unreviewed settings.
2. Inventory the remaining operator environment and add the restricted restore
   HTTP handoff before connecting production dispatch. Do not silently drop
   unsupported settings or require every saved template to update first.
3. Design authenticated recovery-only access and restart-safe key rotation. A
   lost-key reset needs explicit approval and an integration reconfiguration
   summary; notification is necessary but cannot recover old ciphertext.
4. Complete database-enforced ingestion writer isolation, then unattended legacy
   recovery with import/metadata completion and published-image upgrade evidence.

Prior-head CI run [37298745090](https://github.com/cloudbyday90/Classifarr/actions/runs/37298745090)
completed successfully for `df6fd77db323cfc96141b46b36d0063ea5cc6d09`.
It is baseline evidence, not CI verification of this change.
