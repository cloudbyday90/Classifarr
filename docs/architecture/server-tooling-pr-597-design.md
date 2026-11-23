# Server tooling PR 597 assessment design

November 23, 2026 Eastern. A random draw between open PRs 596 and 597
selected [PR 597](https://github.com/cloudbyday90/Classifarr/pull/597).
The reviewed head is `55fdae2de0f23306ed513a38fcca0860cb70c67d`. Both PRs
were one commit ahead and zero behind `main` at intake. PR 596 had failing
checks on that current base. The selected PR had green checks.

## Candidate and tradeoffs

Conditionally adopt exact Knip 6.46.1 and Testcontainers 12.2.2, including
`@testcontainers/postgresql` 12.2.2. The registry confirms each exact pin.
Knip adjusts production-mode accounting for packages used by plugin
configuration. Testcontainers updates several runtime fixes, including
Windows Docker credential helper handling and Dockerfile parsing.
[Knip release](https://github.com/webpro-nl/knip/releases/tag/knip%406.46.1),
[Testcontainers release](https://github.com/testcontainers/testcontainers-node/releases/tag/v12.2.2)

The recommended stack is the aligned Testcontainers pair, the exact Knip
patch, the existing strict install policy and an independently reviewed lock.
This picks up fixes for tooling and keeps production dependencies separate.
The cost is reviewing transitive changes and verifying Docker test behavior on
the available host. Keeping the current pins retains a known baseline but
postpones the upstream fixes. Conditional adoption allows an incompatible
candidate to be deferred with evidence.

## Verification

Check registry integrity, Node compatibility, lockfile changes, lifecycle
scripts and the production graph. Keep existing npm and Node pins, overrides,
dependency analysis settings and script decisions. Review the initial lock
with scripts disabled, run a strict clean install and audit the full server
tree including development dependencies. Run Knip in normal and production
modes, the tooling policy gates, and the existing isolated PostgreSQL suite
startup and teardown. Verify the selected pins with fresh backend coverage
and normal quality gates. Apply the reviewed changes directly on `main` and
keep PR publication separate from local verification.
