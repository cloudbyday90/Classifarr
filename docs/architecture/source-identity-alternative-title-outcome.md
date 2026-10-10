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

The full backend unit run and requested image rebuild are in progress; their
results will be recorded after completion. Earlier CI for the starting revision
was green but is not evidence for this patch.

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
