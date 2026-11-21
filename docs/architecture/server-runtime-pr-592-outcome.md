# Server runtime PR 592 assessment outcome

November 21, 2026 Eastern. Local qualification of the dotenv change from
[PR #592](https://github.com/cloudbyday90/Classifarr/pull/592) and the patched
limiter candidate from the [approved design](server-runtime-pr-592-design.md).

The server pins dotenv 18.0.10 and express-rate-limit 8.7.5. The lock delta
contains the two direct declarations and package records. Transitive
dependencies, peer declarations and installer decisions match the baseline.
The candidate passed the strict npm install and full package-tree check.

`server/package-lock.json` SHA-256 at intake and after the change, respectively.

```text
ce40b08d6860da873fc944d5127954b81516faf36b6feeedf305cffc746148d8
246fb7028d5b725e4f38e9cd5ae9a428d00967968e471b8c49bf2637869f6ff0
```

The unmodified dotenv fixtures reproduced four CLI failures against 18.0.10.
Resolving `bin.dotenv` from the installed package manifest restored the
original test expectations for quiet output and environment precedence. The
library and side-effect import controls still exercise the module exports.
The runtime environment loader continues to use its existing entry point.

The limiter upgrade uses the publisher's patched version for
`GHSA-cppf-2hm6-mrvm`. Version 8.7.4 from the PR was superseded by that patch.
The ordinary memory-store probe observed an expired hit count on 8.7.3.
The new clock-controlled test verifies that 8.7.5 omits the expired count
and starts a fresh window on the next increment. Existing HTTP tests verify
auth quotas, response headers, diagnostics and store failure behavior.
[Publisher patch range](https://github.com/express-rate-limit/express-rate-limit/security/advisories/GHSA-cppf-2hm6-mrvm)

The affected focused server suites passed 876 tests. Isolated PostgreSQL
auth and API-key suites passed 96 tests. Full root, client and server npm
audits returned zero findings. The baseline audit returned zero even with
the affected limiter version. The version-range conclusion comes from the
publisher record and the reviewed installed version. The local change was
qualified on `main` while the PR remained unmerged.

The reviewed OSV scanner reported no issues on all three lockfiles and
reported the existing unused ignore and deprecated expiry field. Root and
client lock and installed dependency metadata hashes match intake.

Fresh server coverage passed 64,108 tests with one existing skip. The shared
dependency tooling suite passed 125 tests with the existing Linux-only WASI
case skipped on Windows. CI preflight, lint, types, policy and ESM checks
passed. Astra reviewed the final scope and package delta.

## Next recommended item

Review retirement of the expired, withdrawn deepmerge OSV ignore. Verify
that removing the unused entry preserves the scanner's handling of active
advisories and clears the deprecated configuration warning.
[OSV configuration guidance](https://google.github.io/osv-scanner/configuration/)
