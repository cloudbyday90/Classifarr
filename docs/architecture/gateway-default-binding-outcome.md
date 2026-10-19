# Default gateway archive input binding outcome

## Result and exact subject

Passed the complete default native archive/catalog/retention rehearsal and a
shared history-study smoke on 2026-10-19. See the separate
[design](gateway-default-binding-design.md) for approved scope, official sources,
alternatives, weak points and the recommendation stack.

- Clean implementation source: `68d144ca9dac816f04c713d9abbedf731d641cd4`.
- No-cache local Docker image ID:
  `sha256:ce490eb94ca2c6459f24b3d061434dbe8a68521a637304061321d6927dadc90a`.
- Independently inspected OCI revision matches that source; Docker Desktop
  Linux/amd64, Node.js 24.21.0, PostgreSQL 18.6. This is local image identity, not
  a published registry digest, signed provenance or an arm64 acceptance claim.
- Default seven-file input manifest SHA-256:
  `04eabe2b9be41fa9a875e076401feccba1139889bd73bf14bba463a498c3f013`.
- History smoke input manifest SHA-256:
  `f110b9293d7849e577af449a57d9338ce6240efbd80c4a8da0419bf117591e16`.

The CLI now delegates the default family to small orchestration, execution,
sandbox and scenario modules. Committed Git bytes enter one sealed volume,
mounted read-only by the producer and copied-code verifiers. No executable host
binds remain in this family. The packaged archive verifier still executes its
original image code. Existing fixture files and application code are unchanged.
No additional results volume, schema, table, service or dependency was introduced.

The archive/regression policy retains manifest version 2 and the existing size
and argument limits. Independently expected leading records are checked before
removal; UUIDv7, text and receipt body bytes remain intact. Cleanup attempts all
owned resources and source revalidation even after another cleanup action fails.
Overall success is emitted only after cleanup verification.

## Native evidence

The no-flag command used `scripts/run-gateway-online-archive-rehearsal.mjs` with
the exact image and source above. It passed:

- Wrong manifest digest refusal before fixture imports, and real UID-1000 append
  and create denial on the producer's executable-input mount. Linux staging also
  verified no-follow symlink refusal and removed its writable container before
  database startup.
- Private restore-input exact bytes, distinct inode, read-only copy, shared-path
  replacement, low-space, permission, symlink, hardlink and cancellation checks.
- Real SELECT-only exports and restricted native restores; invalid/downgraded
  receipts, inventory tampering, receipt crash continuation and corrupted dumps
  refused without refunding attempts or granting purge authority.
- Mixed legacy v3/v4 archive rotation, immutable protection and crash-marker
  recovery, missing/tampered protection refusal and interrupted retirement.
- Legacy v5 catalog exact restore with concurrent synthetic inference, large
  integer and microsecond timestamp preservation, cancellation attempts, separate
  row-restoration/dependency results and missing-marker/tamper refusal.
- Dump, manifest, receipt and protection file changes after real export refused
  publication. Three verified catalog captures retained two roots after resumed
  retirement; shared pins, history and attempts remained protected.
- Combined sparse capacity accounting, excluded oversized-row and 10,001-job
  guards. Sparse files are capacity fixtures, not dump-throughput measurements.
- Final committed-source recheck and removal of every owned container, volume
  and disposable database directory. Independent post-run label scans were empty.

These retain the pre-existing synthetic clock changes, large-counter fixture
setup and legacy format exercises. They are not evidence that a production day
elapsed, a production counter was repaired, or a published-image upgrade passed.
No external provider calls, live history deletion or production recovery ran.

The shared `--history-profile` smoke also passed source binding, refusal/input
protection, real archive/restore, equivalence over 3,001 records, the unchanged
production query budget and owned cleanup. It retained the 3,000-row varied
history fixture. This confirms common-runner compatibility, not a new performance
optimization. The other long soak/restore/comparison protocols were not rerun;
their bootstrap positive/negative unit coverage remains in the gateway suite.

## CI regression and local checks

[Prior CI run 39192398135](https://github.com/cloudbyday90/Classifarr/actions/runs/39192398135)
failed in gateway tooling because ignored `.tmp` was absent on a fresh checkout.
The binding test harness used `mkdtempSync` and `readdirSync` without preparing the
parent; the runtime stager had the same assumption. Both now initialize it
independently. The CI build stopped there, so its later skipped application checks
were never described as successful. Database and installation jobs had passed.

- Gateway tooling: 77 cases, 76 passed and one Windows symlink-creation skip.
  The complete suite also passed from an actually empty working directory.
- All 26 binding tests passed separately in a restricted Linux container, with
  zero skips: full 32 KiB argument launch, oversized refusal, symlink refusal and
  absent-directory staging included. Test source was the committed implementation
  above; its Node-only runtime image was the prior trusted local image
  `sha256:cfea5f92865fd2132a710c68deb2dca83aef16285f64c6d70801fd116c9e6ba0`.
  This is subprocess/file-contract evidence, not an application upgrade test.
- The first Windows full-size launch exceeded the host's total command-line
  length. Keep the 32 KiB application bound: host boundary checks and a smaller
  portable launch run on Windows; the full launch passed locally on Linux.
- Four affected backend contract suites passed 36,325 tests: security scan
  workflows, CI preflight, code health and inventory ownership.
- Configured lint/types, copyright, ownership, both dependency inventories, four
  policy gates, static ESM and mock-shape checks passed. No baseline was refreshed.
  No full application coverage or published multi-platform acceptance claim.

## Local Compose evaluation and rollback

Rebuilt without cache, protected the prior running image, then refreshed only the
normal local service with no build/pull during replacement. Container
`a1c19cef7387f67a8d3aa82bff96bb088865da00db46e1dd7dd2237c8b9ea307`
uses the exact candidate image above and is healthy. `/health`,
`/api/system/health/ready` and `/` each returned HTTP 200.

Optional gateway schemas remain absent in the normal application database.
Capture guard remained `revision=2`, all call/token allowance and reservation
fields zero, and `next_check_at=2026-10-09 16:50:11.617278-04` unchanged.

Fresh private backup: `data/backups/gateway-default-binding-ready-20261019.dump`,
77,253,677 bytes, container-reported mode `0600`, SHA-256
`83f4645d5e88d85d1bd5e052084c418896044fea578ce50008e290a1eda75b95`.
`pg_restore --list` passed; it is not a full application-database restore proof.
Earlier backups remain retained. Protected rollback tag:
`classifarr-local-rollback:7a51fe7a8957bca34ae5fb7206553fc1851a095fd7c39476f17281a2f967ceac`
points to prior image
`sha256:cfea5f92865fd2132a710c68deb2dca83aef16285f64c6d70801fd116c9e6ba0`.
No image/backup pruning, Unraid change or shared Ollama reconfiguration occurred.

## Limits and next recommendation

Trusted-host hashes and inspected commands are not signatures or protection from
a compromised host, Docker daemon or image. Fixed input lists require maintained
closure tests. Abrupt host loss can leave labeled disposable resources; no success
is possible without verified cleanup. This documentation follow-up does not
change tested executable inputs. Hosted CI results are separate from local proof.

Next, apply this boundary to qualification/cleanup rehearsals, then scheduling and
rotation. Their staging remains unbound. Do not reduce production verification or
infer new purge/self-healing authority from this test-tooling result. Keep all
changes on main with Unreleased notes; no release, tag or PR merge.
