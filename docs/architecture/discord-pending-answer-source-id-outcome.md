# Discord pending-answer event reference outcome

November 26, 2026. See the
[design and alternatives](discord-pending-answer-source-id-design.md).

The pending-answer intake builder now validates History IDs using the
shared BIGINT normalizer. It preserves safe numeric IDs, carries larger
ones as exact decimal strings, and declines invalid inputs. Legacy
source keys keep their shape. Native keys use the existing shape when
it fits. Overflow uses `discord_pending:v2:<id>:<fingerprint>`, with a
119-character maximum. The full valid fingerprint survives the existing
120-character intake limit. Invalid or overlong tokens use `unknown`.

## Reachability

The correction and verification handlers require completed-delivery
evidence and receive a completed-family History row. The projection
returns `not_applicable` for those rows. Compact pending controls use
a separate handler. The bug was reproduced in the exported pending
projection using stored row shapes. No active Discord interaction was
observed emitting a rounded or clipped pending intake key.

The projection remains outcome-only. Application routing, delivery
checks, permissions, replay and existing saved questions continue
through their established owners. Prior logs retain their recorded
values.

## Verification

- A no-write probe reproduced clipping of a real-length SHA-256
  fingerprint at an 11-digit safe History ID. At the BIGINT maximum
  the previous key lost both History precision and fingerprint digits.
  The new regression failed before the fix in 14 unit cases and the
  database-backed intake case.
- All 113 focused unit tests and 82 isolated PostgreSQL tests passed.
  The checks exercised adjacent large IDs, BIGINT maximum, a verbose
  key at 120 characters, and an 80-character token at the 119-character
  compact maximum. Tokens with a common prefix remained distinct.
  Tests retained the metadata-first fallback and short-key behavior.
- The PostgreSQL regression used actual stored pending History rows
  and invoked the projection directly. It also invoked the normal
  Discord interaction handler for verification and correction controls
  on those rows. Both were refused with the existing guidance and
  caused no History update, correction, or routing call. Existing
  completed-control and compact pending-answer tests passed.
- Astra reviewed the precision, size and reachability boundaries.
  GitHub listed zero open pull requests. Dependency audits in the
  root, server and client reported zero vulnerabilities.
- Full local CI passed with 64,843 backend tests, one existing skip,
  and 7,748 client tests. Statement coverage was 89.33% and 87.84%
  respectively. The coverage ratchet, lint, type and ESM checks,
  and staged secret scan passed.

## Next recommended item

Trace the live manual-correction learning transaction. A no-write
probe reproduced rounding of adjacent large History IDs in the
exact-item memory candidate and intake, with the builder audit still
passing. The manual-correction route passes that result to the
authorized executor. Verify whether a real transaction rejects the
inexact reference or persists incorrect provenance before selecting
the repair. Preserve correction ownership and exact-item authority.
