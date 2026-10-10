# Exact alternative-title recovery: outcome

## Implementation — 10 October 2026

Implemented the [design](source-identity-alternative-title-design.md) in small ESM
modules: bounded provider transport, exact recovery-title verification, and shared
strict detail validation. The existing text-search matcher retains its behavior;
only independently proven recovery candidates can use the alias fallback.
No schema, public API, retry budget, ownership rule or memory safeguard changed.

The demonstrated alias mismatch now has a recovery path. This does not establish
that all twelve reported items can be recovered: the nine disputed TVDB identities
and two incomplete external cross-references still lack the required evidence.
Normal sync must admit an eligible attempt; no cooldown is reset by this change.
No production recovery, Plex edit or shared-provider restart was performed.

## Tests and review

- Eight focused suites passed all 260 tests, including strict matching, independent
  IDs, source rechecks, receipt reuse, cancellation and real HTTP response limits.
- Disposable PostgreSQL passed fourteen tests, including alias-produced recovery
  persistence, rejection after a superseding capture, atomic inventory/receipt/
  observation changes, backfill eligibility and durable retry/ownership fencing.
- Lint, both typechecks, backend dependency analysis, docs, copyright and ESM
  import checks passed. The ownership gate passed without baseline changes.
- Initial test development caught incorrect parameter-array wrapping and a fixture
  keep-alive teardown race. A real HTTP redirect test then exposed an unsupported
  Axios-style option; the implementation now uses native `redirect: 'error'` and
  the test confirms exactly one request. No assertion or safeguard was weakened.

The full backend unit run passed all 1,765 suites: 54,983 tests passed and one
Linux-only directory-fsync test was skipped on Windows, in 333 seconds. The
actual Linux image passed the corresponding exclusive-copy, directory-fsync and
unchanged-source probe. Production-only backend dependency analysis also passed.
No thresholds, ownership baselines or assertions were relaxed. This round ran
full backend unit tests without coverage, not the complete integration matrix or
fresh frontend coverage; no frontend implementation was changed. The container
build compiled the production frontend successfully.

Earlier CI for the starting revision was green but is not evidence for this patch.

## Local image, schema and current-source check

The no-cache local Compose image was built from clean source
`27295acea584591943c676854577a04a6ab17774`; Docker reports image identity
`sha256:fef5541a782ee8c39fefa6e6c9e614e216dceae85d22e50ba0c2710f393b4b10`.
This is local testing, not registry publication or signed release evidence.
Only the existing local service was recreated; its data/media mounts were retained.
The previous image was tagged privately for rollback, and a 76,678,596-byte
database archive passed checksum and `pg_restore --list` verification.

The container started at `2026-10-10T04:17:45.064126899Z`, became healthy and
returned HTTP 200. Early checks showed zero restarts, no OOM, UID/GID 1000,
read-only root, `no-new-privileges` and the unchanged 2 GiB limit. A 369.3 MiB
startup sample is not a sustained memory-soak result. The startup-window error
query returned no rows at 00:18 Eastern.

After rebuilding, the isolated schema-dump runner regenerated the snapshot
through `20261009_230000_comparison_incident_ledger.sql` with no tracked schema
change. Its disposable container and data were removed; live appdata was not
used for the schema fixture or Linux filesystem probe.

A bounded read-only probe using the rebuilt verification module checked the
confirmed case against current Plex and TMDb data. Independent IDs agreed on a
declared candidate; exact alias verification passed, current title/year matched
the captured observation, and a second Plex read confirmed unchanged evidence.
The probe neither claimed an attempt nor persisted recovery or catalog cache data.
Private identifiers, credentials and provider bodies are not in this document.

The local count therefore correctly remained twelve: nine `insufficient_evidence`,
two `external_evidence_inconclusive`, one `title_year_mismatch`. The latter's
recorded retry deadline was **10 October 2026, 05:43:25 Eastern**; recovery can run
on a later eligible normal sync, not necessarily at that exact time. Unraid has
not received this local image. The read-only success is evidence for the fix,
not a claim that an inventory write already completed.

## Random open PR trial

Randomly selected [PR #555](https://github.com/cloudbyday90/Classifarr/pull/555)
from the two open PRs, at head `4cbffcb7dd726af152382a1f92edb9dc326fe349`.
Applied its client manifest/lockfile patch locally: Node declarations 24.19.2 →
26.6.4, with undici-types 7.24.6 → 8.9.0. Installed with scripts disabled first,
then the reviewed lifecycle policy. Dependency tree, typecheck and full-scope
npm audit passed; audit reported zero vulnerabilities on 10 October 2026.

The runtime-policy suite passed 39 tests and rejected the Node 26 declaration
major. Restored only the trial patch, reinstalled the retained lockfile, and all
40 policy tests passed. There is no retained dependency diff and no PR merge.
The registry now reports Node declarations 26.6.5; that does not change our Node
24 compatibility requirement. Playwright 1.64.0 and Vue Router 5.4.0 were also
reported as available; neither was included in this identity fix.

## Recommendation

Retain the design's stack: external-ID agreement, strict details/year, exact
candidate alias, fresh source evidence and fenced database persistence. The
benefit is recovery of valid alternate spellings; the cost is one additional
bounded request and dependence on the catalog's alias records. It does not claim
global title uniqueness or recover disputed independent identifiers.

Next: trace the remaining missing catalog cross-references and conflicting TVDB
IDs using read-only evidence, then choose a separately tested correction path.
Do not strip regional suffixes or rematch all twelve items to clear the count.
