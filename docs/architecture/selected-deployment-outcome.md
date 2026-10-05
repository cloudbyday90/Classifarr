# Saved deployment admission outcome

Date: 2026-10-05. See [design, tradeoffs and sources](selected-deployment-design.md).

## Implementation

Added small ESM modules for deployment environment admission and heap-only Node
options. Compiled profiles preserve the saved heap cap and the compatible
application defaults of fifteen pool connections and two acquisition retries,
unless explicitly overridden. Supervisor inputs stay in a separate object.
The real-image configuration fixture now exercises this compiler before launch.

Unknown settings, host-only mount variables, remote database authority, unsupported
restore mode and unsafe Node options refuse compilation with fixed messages.
Secret-bearing profiles are never logged. Existing saved templates, compatible
entrypoint, keys, schema and inventory are unchanged. Production dispatch is not
enabled, and this does not resolve legacy ingestion ownership.

The recovery skill kept configuration admission separate from permission to
change ownership. The release-evidence skill requires actual rebuilt-image checks,
not unit-test-only acceptance. No UI/API interaction changed.

## Validation status

Focused checks passed: five suites, 264 tests. Server lint and typecheck passed.
The random open PR trial selected [555](node-types-pr-555-outcome.md), applied its
exact manifest/lock diff locally, and reproduced the Node 26/24 mismatch: 7/8
candidate checks versus 8/8 baseline. Removed only that trial; all thirty tooling
checks then passed. No dependency installation or merge occurred.

Read-only admission of the local container's eighteen resolved environment names
passed without printing raw configuration. The compiled profile retained its
1536 MiB heap, pool 15/retries 2, UID/GID 1000:1000, umask 022, automatic vector
staging and 300-second startup deadline. Its saved forced-non-root identity still
uses compatible startup; successful compilation does not authorize conversion.

Five ownership entries were reviewed individually. Preflight, both knip checks,
ESM static imports/mock shapes and Markdown passed. The ownership inventory remains
19 owned, 287 separately coordinated and 502 unresolved; this is not an all-writers
isolation claim. No client code changed and no new client coverage claim is made.

Final full backend run: **1,691 suites, 52,380 tests passed**, one Windows skip,
266.975 seconds. The first run overlapped the ownership-review update and failed
only that stale-review check; its focused rerun passed all 39 checks, followed by
the clean full repeat above. No assertion was weakened. The Linux directory-fsync
copy/source-preservation/overwrite-refusal probe passed in the actual image; the
Windows Jest case itself remains skipped. The staged secret scan found no leaks.

## Image and schema evidence

Clean-source no-cache build: `4c8e1e784fa543e2ab2f1111d6aedaea7fbbd618`.
Docker's inspected local image ID:
`sha256:f48e4b730ba8b4786c459e60810fd296ed827c81d64333bef433181f39bf3a2a`.
Its OCI revision matches. This is local linux/amd64 AVX2 evidence, not a published
registry digest or a multi-platform release attestation. Initial test invocations
used the build's config digest, which Docker did not expose as a runnable image;
they refused before creating fixtures. Acceptance used the inspected ID above.

All **12 core recovery scenarios passed** in 175.000 seconds, including the
deployment-compiled custom profile and 31 actual application environment settings
(the prior thirty tuning settings plus the 1536 MiB heap). Existing authenticated
decryption, JSON precedence, unchanged file bytes, restricted SQL admission,
interrupted restore/routing, source preservation and joined shutdown passed.
These are same-image synthetic scenarios, not a published-old-image upgrade.

Saved-profile rehearsals passed for 1000:1000, custom 2345:2345 and Unraid-style
99:100. Clean stops under the unchanged ten-second host timeout took 2.454,
2.627 and 2.586 seconds respectively, including verification. Forced host kill
remained nonzero and recovered committed synthetic data on restart; it is not
counted as graceful shutdown. Normal runtime had no idle maintenance workers.

After the rebuild, the existing schema dump implementation ran against isolated,
network-disabled PostgreSQL 18 from this image. Load/dump/load/dump had zero drift;
`database/schema/current.sql` is unchanged. No migration was added.

Cleanup passed. A separate inventory found no containers, volumes or networks for
`classifarr-isolation-drill-77ed747ae12a609e31028950f5d9c692`. The exact disposable
schema and filesystem-test containers were removed. Only synthetic test resources
were deleted; they are reproducible, and installation data/caller images remained.

## Local evaluation

Recreated only the local `classifarr` Compose service with the tested image using
`up --no-build --force-recreate --wait`; existing volumes were preserved. Both the
running image ID and OCI revision match the tested build. HTTP health returned
200, Docker health is healthy, restarts are zero, and no OOM occurred. Live Unraid
and its separate database/appdata were not accessed.

At 40 seconds after PostgreSQL startup, there were no new WARN/ERROR rows;
CPU was 4.52%, memory 364.8 MiB of 2 GiB, and 38 PIDs. At 161 seconds, CPU was
0.51%, memory 395.3 MiB and 38 PIDs. There were zero ERROR rows and one
`mediaSync` warning: `legacy_owner_unknown` for Movies (5). Read-only inspection
confirmed Family (4) complete at 866/866 with no ownerless running records;
Movies still has six. No ingestion records were repaired or reset by these checks.

The process sample found exactly one application, one supervisor and zero
compatible/selected maintenance workers. The actual application environment
retained the saved 1536 MiB heap without exposing its other values. Node remains
24.21.0. The saved profile is still UID/GID 1000:1000, read-only, limited to 2 GiB,
with no CPU quota or PID ceiling. No host resource limits were changed. These
short samples are not a sustained resource soak or proof against memory leaks.

## Next

Implement the restricted restore HTTP handoff. Then integrate production dispatch
with every returned supervisor setting, actual identity/mount checks and explicit
handling of automatic/unbounded heap sizing. Prove published-old-image upgrades
before enabling database-fenced unattended legacy recovery. Do not change saved
host mounts, regenerate lost encryption keys or infer stopped writers from age.
The fresh client dependency check also found PostCSS 8.5.29 available over 8.5.28;
review that patch separately when returning to tooling updates.
