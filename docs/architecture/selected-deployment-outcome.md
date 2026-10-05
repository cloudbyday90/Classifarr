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

Full backend validation, clean-source no-cache build, isolated image rehearsal,
schema dump and local replacement evaluation are pending below; no completion
claim is made until those checks finish.

## Next

Implement the restricted restore HTTP handoff. Then integrate production dispatch
with every returned supervisor setting, actual identity/mount checks and explicit
handling of automatic/unbounded heap sizing. Prove published-old-image upgrades
before enabling database-fenced unattended legacy recovery. Do not change saved
host mounts, regenerate lost encryption keys or infer stopped writers from age.
The fresh client dependency check also found PostCSS 8.5.29 available over 8.5.28;
review that patch separately when returning to tooling updates.
