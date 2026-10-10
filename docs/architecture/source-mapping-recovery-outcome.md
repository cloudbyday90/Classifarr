# Approved source mapping recovery — outcome

## Scope and diagnosis

Implemented on `main` on 2026-10-10. No release or version change. See the
[design and researched tradeoffs](source-mapping-recovery-design.md).

The local read-only check at 21:04:41 UTC found eleven unresolved items across
ten current library captures: nine need source review and two are waiting for
their existing retry cooldown. All eleven have Plex descriptions and artwork.
That metadata is not proof that their conflicting provider IDs identify the same
catalog work. Nine declare two TVDB IDs; two grouped shows declare multiple
TMDb series. No real item was approved, silently discarded or rematched.

Unraid and shared Plex/Ollama were not modified. The local result is not a fresh
measurement of Unraid's count.

## Implemented behavior

Administrators can approve a freshly verified whole-work or complete season
mapping, inspect its saved state and revoke it. Partial season mappings remain
unresolved, as requested. The browser cannot submit its own verification result.
Approval saves intent and an audit record; it does not clear the unresolved count.

Normal owned ingestion revalidates the source and catalog, then commits inventory,
the mapping receipt and observation removal atomically. Failure retains the issue.
Grouped seasons keep their Plex organization and have typed season descriptions,
not an arbitrary parent series ID or borrowed whole-series synopsis. Ordinary
description retrieval/backfill can consume that evidence; whole-work-only
comparison consumers abstain.

Recovery is bounded per library run, with durable failed-attempt cooldowns. Recent
catalog evidence is reusable only after a fresh matching source-layout read, and
reuse does not extend its expiry. Repeated successful sync preserves completed
metadata-fetch progress. Revocation respects the ingestion lock and invalidates
only inventory still bearing that mapping's receipt.

Lost mutation responses are explicitly uncertain. The UI directs the operator to
read saved state, rather than automatically posting again. Status reads do not
contact media/catalog providers. Existing memory and ownership safeguards remain.

## Random open PR trial

Enumerated the open PRs and randomly selected
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`. Applied its exact dependency changes
locally: Node declarations 24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0.
Installation, client typecheck and audit passed, but the runtime-alignment test
correctly rejected Node 26 declarations with the supported Node 24 runtime.

The trial passed 39 of 40 tooling tests. Restoring the original manifests and
lockfile produced 40 of 40, with zero audit findings. No dependency change from
this trial is retained, and the PR was not merged. This is a compatibility
rejection, not evidence of a vulnerability in that PR.

## Verification

Focused backend: 10 suites / 198 tests passed. Focused client: 5 files / 60 tests
passed. Isolated PostgreSQL integration: 2 suites / 36 tests passed, including
22 mapping lifecycle tests. These cover partial/stale/unauthorized approval,
atomic rollback, repeated sync, source/configuration drift, durable cooldown,
catalog evidence expiry, conflicting approval and ingestion-safe revocation.

The broad backend run completed 1,782 suites: 1,780 passed, with three assertions
in the ownership-review/schema-freshness suites failing before their reviewed
manifest and generated snapshot were updated. Both suites then passed all 60
tests on rerun. The broad run recorded 55,773 passed tests and one Windows-only
skip; it is not presented as an initially green run.

Chromium checks passed for the Command Center overview and mapping approval,
including keyboard confirmation, a lost response without duplicate posting,
saved-state recovery and revocation. Narrow-width bounds were checked at 390 and
320 pixels; the complete 320-pixel panel screenshot was visually inspected.
These browser tests use intercepted fixture APIs, not live identity mutations.

Root typecheck, copyright, dependency-use checks, the reviewed ownership gate,
four policy gates, ESM gates and Markdown lint passed. Server lint passed; the
browser test's explicit global reference was corrected and its lint rerun passed.
No coverage/security baseline was weakened. The final complete client run passed
453 files / 6,655 tests after correcting an old-copy assertion and a test-file
closing-line convention. The final full client lint passed. Coverage ratchet
passed: server lines 89.70%, branches 86.04%; client lines 88.91%, branches 80.68%.

## Exact-image and local evaluation

Both builds used `--no-cache --require-provenance`. The first image generated the
new snapshot from a disposable, network-isolated database. After committing that
reviewed snapshot, the final image was rebuilt from runtime revision
`5c5c4ddb222e4bc3cbcaabb3248dfbb1cba8f256`:

- Local Docker image ID:
  `sha256:b6a219dd355bac7b0953b8dc9bf73ff4e5cc2aa1c5d5fb7d740f3fba440d9b99`.
- Previous local image retained for rollback:
  `sha256:389db35af626e882c8f7e4fe6292a92b1f4fa5ac77d4d83e8922fa8c9add8634`.
- A private 76,855,317-byte local database archive was checksum-verified and its
  archive directory was readable before replacement. It is not committed.
- The final image's isolated schema dump matched `database/schema/current.sql`
  without changes. Its fresh database had no invented pending work or unresolved
  identities. Both schema fixtures' containers and data directories were removed
  and cleanup verified.
- The Windows-skipped directory-fsync behavior passed inside the final Linux
  image: exclusive copy, complete matching content and unchanged source. The
  network-isolated disposable filesystem fixture was removed and verified absent.

Recreated only the local `classifarr` Compose service with `--no-build --pull
never --no-deps`, preserving its data mount. At 22:03:41 UTC, health was HTTP 200,
Docker reported healthy, restart count zero and no OOM. The 2 GiB limit, read-only
root and user `1000:1000` remained unchanged. Aggregate database checks made no
writes/provider calls: eleven unresolved items (nine source-review, two retry-wait),
ten current libraries, zero saved mapping approvals and no startup warnings/errors
in the inspected log window. A bounded retrieval batch contained ten unique
records and completed in 5 ms; this is a smoke check, not a performance benchmark.

Only test assertions and this evidence document changed after the image revision;
both are excluded from the Docker build context. This is local development-image
evidence, not a published-release upgrade rehearsal or an Unraid rollout.

## Recommendation stack and limits

1. Ship the explicit complete-mapping workflow without automatic identity guesses.
   It preserves grouping and auditability; operator review remains necessary.
2. Keep Node 24 runtime/types aligned. Evaluate compatible tooling updates
   separately; do not change the runtime to make the sampled PR pass.
3. Next, improve the per-item review with bounded, typed catalog suggestions and
   specific verification-deferred reasons. Validate the actual eleven mappings
   individually; catalog membership does not establish independent agreement
   between every provider.

The new table is empty on upgrade. There is no mass approval, import reset or
automatic clearing of existing conflicts. Backfill follows only successfully
materialized approved mappings. This work does not claim a complete downstream
season-aware evaluation model, an Unraid deployment, or remote CI success.
