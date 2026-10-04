# Restricted-runtime interrupted routing outcome

Implementation and local validation, 2026-10-04. See the separate
[design and research](restricted-interrupted-routing-design.md).

## Implemented

The existing embedded isolation drill now exercises actual manual movie and TV
routing with a killed restricted application process after each accepted provider
add. Real login, CSRF, queue commands, persisted intent and read-only observation
remain in use. The provider survives application restarts and counts every add
attempt. No production service, permission, schema or saved-template changes.

The fixture initially exposed its own duplicate library-name setup and missing
startup health endpoints. Both were corrected without disabling real constraints
or health checks. Fixed phase/SQLSTATE/count diagnostics omit credentials and raw
exception payloads. Tests cover rejection, state loss, rewritten decisions,
unrecorded observations, cleanup failure, invalid paths and held HTTP responses.

## Verification so far

- 249 focused unit tests in 12 suites passed.
- 27 real PostgreSQL manual-routing integration tests in two suites passed.
- Backend ESLint, TypeScript and Knip passed.
- The development-image interrupted-routing phase passed: two accepted adds,
  zero duplicate attempts, two persisted observations, two preserved cooldowns,
  four item reads and 32 ordinary startup health reads. No deadline advances.
- Final no-cache image rehearsal, schema dump, local replacement and observations
  will be recorded below once complete; these are not yet claimed here.

No open PR was available in the repository's current enumeration. No PR was
merged, no release created and no Unraid instance or database modified.

## Scope and next recommendation

This is same-image Linux amd64 restart evidence with synthetic providers, not an
upgrade, native ARM/NAS test, live provider test, resource soak or production
privilege cutover. Recovery observations do not rewrite original routing success.
Legacy ingestion ownership warnings are a different safety boundary.

Next: trace and test automatic-policy/queue interruption at the same accepted-add
boundary. It does not currently use the manual intent persistence callback; that
difference needs its own evidence, not an assumption that this manual test covers
it. Then finish remaining privileged-adapter coverage before proposing production
identity migration. The extended real-image drill gives stronger evidence than
mocks at the cost of runtime and a deliberately narrow synthetic provider model.
