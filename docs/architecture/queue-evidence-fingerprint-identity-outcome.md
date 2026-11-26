# Queue evidence fingerprint identity outcome

November 26, 2026. See the [design and tradeoffs](queue-evidence-fingerprint-identity-design.md).

The current fingerprint contract works for database-issued queue IDs.
Astra reproduced equivalent numeric and decimal-text IDs, distinct
adjacent large IDs, and compatibility with the symbolic v1 fixture.
The implementation adds regression coverage and keeps the existing
producer, reader and fingerprint bytes.

## Verification

The disposable PostgreSQL test used the real queue service to claim
rows at `9007199254740991`, `9007199254740992`, `9007199254740993`
and `9223372036854775807`. It passed those claimed rows through the
production queue question-reduction producer and request import
admission. Classification evidence and the route outcome were synthetic.

- The producer proof and reader acceptance were identical for the safe
  number and its canonical decimal text. Each database-issued ID
  matched the SHA-256 digest of its exact decimal representation.
- Adjacent task IDs shared the same evidence digest for the same
  input, but their task and execution fingerprints differed. Request
  import admission declined the mismatched proof and kept the route
  outcome only, with learning and profile refresh disabled.
- The real retry and dequeue path acquired a new claim and incremented
  the persisted attempt. The old proof was declined. Fresh evidence
  kept the same task digest and changed the execution digest.
- The projections excluded the raw task ID, claim token and synthetic
  payload title. The fixture did not dispatch a provider request.

All 36 isolated PostgreSQL tests and 109 focused unit tests passed,
including existing symbolic ID, claim and replay tests. CI preflight,
type checks, test and Markdown lint, ESM gates, and the staged secret
scan passed. All three dependency audits reported zero vulnerabilities.
Local verification used the affected suites for this test-only change.
GitHub listed zero open PRs.

## Next recommended item

Fix the separate terminal request import History reference. A local
probe through the production admission builder reproduced the same
`classification:9007199254740992` event key for both History IDs
`9007199254740992` and `9007199254740993`. It also rounded PostgreSQL's
maximum to `classification:9223372036854776000`. The queue worker
persists the admission summary in its acknowledged result after
routing. The top-level classification ID remains exact.

Trace the History ID through the event, outcome and learning-intake
projections, then qualify an exact boundary with adjacent History rows.
Keep the existing outcome-only behavior and prove that the saved result
correlates to the right History row. This is a History identity issue
independent of the queue task fingerprint.
