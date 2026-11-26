# Exact classifier metadata-failure task IDs outcome

November 26, 2026. See the [design and tradeoffs](classification-metadata-failure-task-id-design.md).

New classifier metadata-failure events retain safe queue task IDs as JSON
numbers and larger IDs as exact decimal strings through
`9223372036854775807`. Invalid and already-rounded inputs leave the field
absent. The actual runtime queue task still takes precedence over the
payload fallback. Existing task failure codes, failure references, stack
boundaries and queue retry decisions continue to apply.

The bounded logger stores the field in its existing JSONB metadata. The
administrator detail, bug report and export readers expose the same value.
The list and its separate History ID filter retain their established
contract. Previously omitted fields remain absent in historical records.

## Verification

- Before the fix, the projection omitted adjacent large task IDs and the
  BIGINT maximum. The isolated PostgreSQL regression also failed on the
  missing field in the existing administrator detail response.
- All 105 focused classifier and queue tests passed. The classifier test
  asserts the literal runtime task ID with a different payload fallback.
  Projection tests cover safe numbers, canonical strings, invalid forms and
  already-unsafe numbers.
- All 29 isolated PostgreSQL tests passed. The real logger, JSONB and
  HTTP routes preserved a safe number, both adjacent IDs and the maximum
  through detail, bug report and export. The response checks retained the
  failure reference and stack while excluding the synthetic upstream URL
  and response body. The fixture used existing session authentication and
  administrator middleware with a rate-limit stub.
- Astra reviewed the projection, caller precedence, and existing admin
  and redaction boundaries. GitHub listed zero open pull requests. Root,
  server and client dependency audits each reported zero vulnerabilities.
- Full local CI passed with 64,784 backend tests, one existing skip, and
  7,748 client tests. Fresh statement coverage was 89.33% for the backend
  and 87.84% for the client. The coverage ratchet, server and Markdown
  lint, type checks, ESM checks and staged secret scan passed.

## Next recommended item

Refresh the read-only identity inventory at the current revision. Start
with persisted `task_queue.id` references, including typed columns, loose
JSONB links, witnesses and retained receipts. Record each writer, reader
and replay boundary alongside the current History reference map. That
evidence can guide any remaining exact-ID repairs and show whether an
independent public or cross-installation ID would justify UUIDv7.
[UUIDv7 readiness assessment](classification-uuidv7-readiness-outcome.md)
