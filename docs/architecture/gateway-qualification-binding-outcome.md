# Qualification rehearsal input binding outcome

## Result and exact subject

Passed the approved input-binding and functional qualification scope on
2026-10-19. Memory observations have explicit coverage limitations below. See the
separate [design](gateway-qualification-binding-design.md) for official research,
alternatives, safeguards and the recommendation stack.

- Clean implementation source: `a6af5bc52042b7552914180ec56983ec7ce5d0fb`.
- No-cache local Docker image ID:
  `sha256:977d3c3191930c8cdff65c295016e87cac61c028c0a23ac31e4c27288b58fd57`.
- Inspected OCI revision matches that source. Docker Desktop Linux/amd64,
  Node.js 24.21.0, PostgreSQL 18.6; 16 CPUs and 8,330,231,808 bytes VM memory.
  Native runs were sequential. This is not signed provenance, a registry release
  digest, an arm64 acceptance result or a published-image upgrade claim.
- Regression twelve-file manifest SHA-256:
  `a6a4258c5f0aa521627cd2f0bb7ae172b816d6c84ee03397e7157f10677d8d8a`.
- Unsampled manifest SHA-256:
  `9176e72b16592d68fd9fb3ef4f586c68f916f0b6edfe67ba1aeb288e1ce8f0f8`.
- Measured manifest SHA-256:
  `30b425c55a13b6ed2e39df7198d4cc38cda5580026ccedf3392eddd89974c6ee`.

Three direct entries and their twelve-file closure now use committed bytes,
sealing before database startup and read-only mounts on all consumers. The
diagnostic preload and batch verifier remain fixed indirect launches from that
verified closure, not independently attested children. Same-process verification
preserves driver/worker/native-child topology. No fixture or application source,
schema, UUID generation, production limit, schedule, retry or recovery authority
was changed. No results volume, resident service or administrator action was added.

## Native functional evidence

All five CLI routes passed against the exact subject above:

- `--qualification`: capacity, oversize, cancellation, protection and cleanup.
  Actual dump bytes and restored COPY rows were observed before interruption.
  Receipts, fingerprints, cooldowns and attempts survived; oversized canonical
  history of 322,655,763 bytes refused without replacing the earlier archive.
- `--cleanup`: independently repeated the full alias workflow. Each cleanup
  fixture deleted exactly 200 synthetic bindings, preserved attempts at 80,100,
  retained four archives including protected copies, and confirmed interrupted
  completion without repeating deletion. No live history was deleted.
- `--catalog-qualification`: all six capacity/publication/acknowledgment/export
  interruption/wide-history/protected-evidence cases passed. Publication actually
  committed after the client kill; reconciliation read durable truth without
  refunding work. Concurrent synthetic admission continued during export.
- Protected evidence required 400 genuine restricted restores across twenty
  batches: 9,575,622 evidence bytes and 9,296,502 payload bytes. Tampering blocked
  both archive and cleanup before unsafe work; repaired synthetic evidence then
  passed the real catalog restore, with history, dependencies and attempts intact.
- `--catalog-memory-baseline` and `--catalog-memory`: the same catalog-wide
  workload passed unsampled and sampled on the same image. Each retained the
  four-read ABBA same-view dependency comparison, two genuine catalog restores,
  attempts-exhaustion preservation and oversized-evidence refusal.

Every case passed wrong-manifest pre-import refusal and real input-write probes.
Worker limits, command, mounts, environment and output identity were inspected.
No boundary or metric was accepted before binding; a legitimate empty startup
window remained bounded and stopped empty/failed output refused. Case and overall
success now follow cleanup verification. Final independent scans found no owned
qualification containers/volumes, schema-check containers, staging directories or
disposable database directories. The manual unit container/bundle was also removed.
All rehearsal provider calls were zero. Clock advancement, large seeded counters
and deliberate corruptions were synthetic, not elapsed production cooldowns or
production repairs. Unraid, Plex and shared Ollama were unchanged.

## Memory observations and limits

Both lanes retained the 256 MiB archiver/cleanup and 1536 MiB verifier envelopes,
CPU/PID limits and no-swap settings. No OOM kill or PID-limit failure was reported.
Wide-history archivers reached the 268,435,456-byte lifetime cgroup peak, so this
does not establish spare memory headroom or justify increasing production limits.

The measured lane produced seven archiver summaries: three complete and four
partial, with 104 samples, 25 partial samples, zero failed samples and no cap hit.
Pressure counters were unavailable on this cgroup-v1 VM. Retain missing data as
missing; these are not seven fully covered profiles. Some complete observations
show file-cache contribution, but the lifetime peak was not fully attributed.
Process RSS/PSS, sampled cgroup usage and lifetime peaks have different scopes;
[Docker CLI memory usage also subtracts cache](https://docs.docker.com/reference/cli/docker/container/stats/).
Do not add shared RSS values or infer a heap leak from the container peak alone.

Worker elapsed time still begins at the original child spawn. Parent verification,
observer cost and whole-container lifetime counters are not equivalent timings.
The normal local applications remained running, and this was one matched pair
with fresh synthetic data per lane, not identical frozen databases across lanes
or a statistical performance experiment. Historical unbound measurements are
not a before/after control. No production verification reduction is justified here.

## Code and dependency checks

- Gateway tooling: 89 tests, 88 passed, one Windows symlink-creation skip.
  All 38 binding/adapter tests passed separately on Linux with zero skips,
  including actual symlink refusal and the full 32 KiB argument boundary.
  That Node-only test runtime was the prior local image
  `sha256:ce490eb94ca2c6459f24b3d061434dbe8a68521a637304061321d6927dadc90a`,
  with committed test source from the implementation above. The first manual
  packaging attempts failed on a read-only copy and a missing CLI file; a complete
  read-only Git archive corrected the harness without weakening permissions.
- Four affected backend contract suites passed 36,355 tests, including catalog
  memory, preflight, code-health and inventory-ownership contracts.
- Preflight, ownership, both dependency inventories, configured lint/types, four
  policy gates, ESM import/mock checks and secret/diff checks passed. No ownership
  baseline was refreshed. No full application coverage claim is made.
- Random open [PR 562](https://github.com/cloudbyday90/Classifarr/pull/562), reviewed
  at head `daf9a4b6dfa306ebb425dd3379025f287bee7f88`, was implemented locally,
  not merged. Root markdownlint is exactly 0.42.0; removing only the stale
  `string-width` override permits its exact supported 8.3.0 dependency.
- Reviewed lock changes include micromark 4.0.3, core-commonmark 2.0.4, GFM table
  2.1.2, util-types 2.0.3, new edit-map 1.0.0 and re2js 2.8.6, plus display-width
  dependencies get-east-asian-width 1.7.0 and ansi-regex 6.4.0. No new install
  lifecycle scripts or unrelated security-override changes. Strict `npm ci`,
  `npm ls --all` and the full root audit passed with zero reported vulnerabilities
  on 2026-10-19; this is not a guarantee of dependency safety.
- Dependency tooling passed 43 tests, including Unicode/ANSI width and unchanged
  Markdown rule/selection/retired-dependency guards. Complete Markdown checks
  passed over 2,298 files with zero errors, including these final documents.

## Local Compose evaluation and rollback

No-cache build protected the previous image. Replacement used no build/pull and
only the normal local Classifarr service. Healthy container
`bbfbb31672c052064f8bb124e9f1d97c57e0aa67a73c25c3f47797efe1a4815f`
uses the exact candidate image. `/health`, `/api/system/health/ready` and `/` each
returned HTTP 200; the other local application remained healthy and untouched.

Optional gateway schemas remain absent from the normal application database.
Capture guard stayed at revision 2, all call/token allowances and reservations
zero, with `next_check_at=2026-10-09 16:50:11.617278-04` unchanged.

Private backup: `data/backups/gateway-qualification-ready-20261019.dump`,
76,227,063 bytes, container-reported mode `0600`, SHA-256
`c4cbb7ae384991628176ee90c0b1544fa462f859650e4409e8c8098c695a1eff`.
Archive listing passed; this is not a full application-database restore proof.
Protected rollback tag:
`classifarr-local-rollback:a1c19cef7387f67a8d3aa82bff96bb088865da00db46e1dd7dd2237c8b9ea307`
retains the prior image above. Earlier backups/images were not pruned.

## Remaining boundary and next recommendation

Local hashes and inspected commands do not defend against a compromised host,
Docker daemon or image. Fixed closure tests need maintenance. Abrupt host loss
or the existing schema helper's CLI signal exit may bypass outer volume cleanup;
such interrupted runs cannot claim success and may leave labeled resources.
Completed runs above verified all owned cleanup. No automatic destructive cleanup
or new administrator function was added.

Next bind scheduling/rotation rehearsals, then assess reduced repeated checks with
fully qualified evidence. Keep production verification and resource limits intact;
partial memory observations are not sufficient to establish headroom. This work
and its documentation stay on main under Unreleased: no release, Git tag or PR merge.
Hosted CI for the final documentation commit is separate from the local evidence.

Follow-up: [scheduling/rotation binding outcome](gateway-scheduling-binding-outcome.md)
records the completed remaining rehearsal boundary and its unchanged recovery
checks. Production verification and resource limits were not reduced.
