# Offline gateway recovery outcome

Date: 2026-10-14. Runtime source: `7bb8177c6ddc73f1352acd20af66ef8ff6a06ada`.
Branch: `main`. No branch, PR merge, release or production gateway activation.

## Delivered

Implemented the approved offline administrator-reviewed path, not a lifecycle
supervisor. Small ESM modules validate private review documents and coordinate
atomic PostgreSQL recovery. Native UUIDv7 receipts retain the original uncertain
request; stop acknowledgement enters maintenance, and a separate reviewed resume
removes it. No request is replayed, marked successful, or refunded. Cooldowns,
attempts and caller consent remain intact. Normal application startup does not
read the offline settings. Unraid, Plex and shared Ollama were not changed.

The standalone version-2 schema has a timestamped upgrade and matching fresh
schema. Application migrations/schema are unchanged. Old gateway binaries refuse
version 2. Runtime cannot alter the maintenance hold when deployed with the
documented column grants; recovery cannot reset attempts or modify receipts.

The [design](ollama-gateway-offline-recovery-design.md) contains official MCP
research, options, pros/cons and the recommendation stack. The
[operator procedure](../operations/ollama-gateway-offline-recovery.md) covers
private configuration, evidence, role upgrade, acknowledgement, resume and
unknown-commit handling.

## Checks

- Focused gateway unit tests: 7 suites, 159 tests passed.
- Real PostgreSQL/HTTP integration: 4 suites, 112 tests passed on the final code.
  Includes fresh/upgrade column parity, retained uncertain work, competing
  migration/gateway sessions, session-lock reentrance, stale identities and
  replay, rollback, cancellation, unknown commit, UUIDv7, role boundaries,
  preserved timestamps/cooldown/attempts, and no upstream requests during a hold.
- Ownership and offline-setting boundary regressions: 2 suites, 104 tests passed.
- Final full backend rerun: 1,846 suites passed; 58,582 tests passed and one
  pre-existing test skipped (411.719 seconds).
- Type checking, both server ESLint checks, normal/production Knip, static ESM
  imports, ESM test mock shapes, migration naming/application snapshot integrity,
  copyright and Markdown checks passed. Ownership gate passed; pre-existing
  `productionCompatible: false` inventory debt remains explicitly unresolved.
- Initial integration run exposed a fresh-schema SQL quoting error; corrected.
  A subsequent old singleton test still inserted schema version 1; updated to
  version 2 so it tests uniqueness, then all 112 integration cases passed.
  Initial full suite reported two failures: the reviewed ledger digest and the
  explicit list of settings excluded from application forwarding. Both were
  corrected and their 104 targeted cases passed before the complete rerun.
- Gitleaks found no secrets in the implementation commit (60.12 KB scanned).
- GitHub MCP enumeration and GitHub CLI both returned zero open PRs; none was
  selected, implemented or merged under a false open-PR claim.

## Exact image and isolated rehearsals

No-cache Compose build from the clean runtime commit completed, including frontend
build. Inspected immutable image ID:
`sha256:e9f88eb0bcc9cce7511d532100384880c4513ae73bca0a278821d952d0b37cb2`.
Its OCI source label matches the runtime commit above. This is a local development
image, not published-release upgrade evidence.

The packaged offline rehearsal ran with normal image entrypoint, a fresh isolated
database, no external network or published ports, and bounded resources. Test
fixtures were copied to `/tmp`, not over application source. It exercised the
actual private-file CLI with a restricted recovery role, two UUIDv7 receipts,
restart-maintenance hold, stale document refusal and explicit resume. Five
attempts remained five; recovery made zero provider calls. The preceding synthetic
completion tests made four calls, including a genuinely unknown timeout. The
entire synthetic provider server was stopped before its test-only attestation;
this does not prove termination of a real Ollama runner.

The broader packaged gateway rehearsal passed its 19 synthetic calls, credential
lifecycle, cancellation and abrupt-death uncertainty checks. Owned container/data
cleanup was verified for
`classifarr-schema-check-331e35fe-fe2c-42bf-bcb7-de90751522c6`.
The separate internal-network/TLS rehearsal passed one synthetic compute call
and blocked direct provider access. Cleanup reference:
`9c92b1dd-c158-4aa9-b312-5d440948d9e0`.
No fixture changed shared Ollama, live routing or saved AI settings.

## Local replacement and recovery assets

Before replacement, created local ignored backup
`data/backups/gateway-offline-before-20261014.dump`:
SHA-256 `D0A40B8E8ED9AFDCA0E49757F7939498AAADD660E10C442E93B48B7960697052`.
The archive listing was readable (1,933 lines); a restore was not performed.
Verified rollback tag
`classifarr-local-rollback:63afeaaaa3bcbd6f4f4651db72b913a7a03e27e41891a83f79171aeb2a09520e`
retains prior image
`sha256:0fb56cf9a526ce78823e19095387310200899fc8f8d15c9a0a16030c0357f9f0`.
No prior images or volumes were deleted.

Recreated only local `classifarr`, using `--no-build --pull never --wait` and the
rollback guard. It is healthy on the exact tested image, `/health` returns 200,
restart count is zero and OOM is false. Non-root `1000:1000`, read-only root,
no-new-privileges and the 2 GiB limit remain. Observed spot checks: 710.2 MiB /
0.66% CPU initially and 827.5 MiB / 118.57% CPU later during background activity.
These are not idle/peak guarantees or a capacity benchmark. The unrelated Harmoniarr
container remained running.

Gateway/routing/recovery environment settings remain absent and the application
database has no `ollama_gateway` schema. Saved workload consent is unchanged:
`when_idle`, daily calls/tokens/reserved calls `0/0/0`, revision `2`, next check
`2026-10-09 16:50:11.617278-04`.

## Recommendation and limits

Keep the stack: bounded ESM gateway, separate PostgreSQL 18 UUIDv7 receipts,
least-privilege offline review and explicit resume. Benefit: auditable recovery
without new daemon privileges or uncertain replay. Cost: coordinated downtime and
human responsibility for the stop evidence; it is not automatic self-healing.

Next: design trusted provider lifecycle/stop evidence before unattended recovery.
Cover every runner and ingress path across installations, restart/watchdog races,
lost supervision and revoked ownership. Do not replace human attestation with
elapsed time or an empty model list. No live recovery or production cutover is
authorized or demonstrated by these isolated tests.
