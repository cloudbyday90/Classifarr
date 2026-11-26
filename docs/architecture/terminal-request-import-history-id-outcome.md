# Terminal request-import History identity outcome

November 26, 2026. See the
[design and alternatives](terminal-request-import-history-id-design.md).

The terminal request-import admission builder now uses the shared
BIGINT validator before creating its event. It preserves a safe History
ID as a number and larger IDs as exact decimal strings. The event key,
outcome, learning-intake reference and learning-guard outcome agree.
Malformed references take the existing not-applicable path, so the
worker can acknowledge the ordinary result without an admission summary.

The summary is projected after the classifier returns and stored in
the queue row's acknowledged JSONB result. The top-level classification
ID already used the database representation. The new projection has
the existing outcome-only authority and does not repair old summaries.

## Verification

- Before the change, 12 focused unit cases and all five new PostgreSQL
  cases failed. The old builder emitted numeric high IDs and attached
  an admission summary for the padded reference `087`.
- After the change, 101 focused unit tests and 41 isolated PostgreSQL
  tests passed. The new fixture read safe and adjacent large History
  IDs and the BIGINT maximum from actual History rows. It used the
  real queue processor and claim-fenced acknowledgement to store
  synthetic routed and missing-mapping results, with and without
  real queue proof. A join from each saved admission outcome reached
  the exact History row.
- The same worker still completed the queue task for a malformed
  History reference and omitted the summary. The retained learning
  and profile-refresh flags stayed false for the valid outcomes.
  The fixture supplied the classifier response and did not call a
  provider.
- Astra traced the same precision loss across both route and proof
  cases. GitHub listed zero open PRs. The root, server and client
  dependency audits each reported zero vulnerabilities.
- Full local CI passed with 64,827 backend tests, one existing skip,
  and 7,748 client tests. Statement coverage was 89.33% and 87.84%
  respectively. The coverage ratchet, server and Markdown lint, type
  checks, ESM gates and staged secret scan passed.

## Next recommended item

Verify and fix Discord pending-answer intake provenance. Astra
reproduced a shared legacy source key for adjacent large History IDs.
The native branch uses the same numeric parser. Both handlers retain
the original classification ID for routing, so the observed fault
concerns the derived intake reference. Check native and legacy key
formats, including the native fingerprint suffix against the existing
120-character intake limit, before choosing the compatible fix.
