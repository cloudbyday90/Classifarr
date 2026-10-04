# Preset saving: request state and safe retry

Date: 2026-10-03. Scope: the existing Presets Manager and custom-preset form.

## Evidence and decision

The form emits `save` synchronously, then immediately clears its local busy
flag. Its `try/catch` cannot observe an asynchronous parent listener rejecting.
The parent rethrows failures, so the user can receive neither accurate pending
state nor an actionable in-dialog error. The shared transport also retries
failed writes, which can duplicate an uncertain preset creation.

The POST implementation in `server/src/routes/presetsRouteShared.mjs` allocates
a new identifier, inserts, then fetches/logs the result before responding.
A failure after insertion is therefore not proof that nothing was saved.
There is no durable idempotency receipt in this endpoint today.

Use a small instance-owned ESM composable for save admission, pending state and
safe failure classification. The parent owns the request; the form owns draft
validation and emits intent only. Pass pending/error/review state as props.
Keep the existing endpoint, authentication, CSRF handling and payload contracts.

## Contract and bounds

- Work starts only after explicit submission of an open, editable form with a
  nonblank name. Fresh/idle pages do not save, poll or schedule work.
- At most one write is pending per mounted manager. Repeated submissions are
  ignored. Freeze the draft and reject close requests while pending so a late
  completion cannot close a newly opened form. Show a concise Saving status.
- Create and update use one HTTP attempt, a 30-second client timeout and the
  existing `skipAutomaticRetry` option. This also prevents authentication-refresh
  replay. A timeout does not prove that the server cancelled or rolled back.
- Ordinary 4xx refusals receive fixed, safe guidance. Authentication/permission
  failures are not auto-retried. Network failures, timeouts, 5xx and conflicts
  require reviewing saved presets before another submission; never display raw
  provider/server error bodies. There is no automatic retry or persisted cooldown.
- An uncertain result replaces Save with Check saved presets. That action closes
  the form, clears list filters, switches to My Presets and performs the existing
  read. It does not reissue a write or infer identity from a matching name.
  Closing/reopening cannot clear the review requirement; only an explicit
  successful review read does so. This reduces accidental repeats, but a list
  read cannot prove a timed-out server operation has stopped. It is not an
  exactly-once guarantee; durable server receipts remain the next safety step.
- A successful write response is completion. Close the form before refreshing
  the list; a failed read must not turn an acknowledged write into a retryable
  save failure. No transaction, database lock, migration or ownership lease is
  added. Existing server validation/body limits remain authoritative.
- Disposing the manager invalidates completion effects. The bounded request
  may still finish server-side; no new view is closed or success claimed after
  disposal. Reloads lose local draft/state and do not replay a write. Cross-tab
  idempotency and durable receipts require a separate server contract.
- Keep status/error feedback inside the active dialog with appropriate roles.
  Associate the name field and validation text; preserve the draft on failure.

## Alternatives

| Approach | Benefit | Cost / decision |
| --- | --- | --- |
| Parent-owned request state and one attempt | Small change, reliable feedback, no silent replay | Uncertain writes need operator review; selected |
| Await component `emit` | Looks simple | Emit is not a request promise; rejected |
| Generic transport retry | Masks brief outages | Can duplicate creation without idempotency evidence; rejected for these writes |
| Durable command/receipt API | Cross-tab and restart-safe reconciliation | Database/API changes; defer as a separate design |

## Official sources

Discovered through web search and reviewed in October 2026:

- [Vue component events](https://vuejs.org/guide/components/events): child
  events signal parent handlers. Request lifetime belongs with the asynchronous
  operation, not a synchronous notification.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  visible progress/results should be programmatically identifiable without
  unnecessarily moving focus. This does not establish full WCAG conformance.
- [RFC 9110, idempotent methods](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2):
  automatic repetition of a non-idempotent request needs evidence that it is
  safe or was never applied. Local timeout alone is insufficient.

## Validation

Test delayed success, duplicate submission, validation/refusal, uncertain
failure, unmount, close-during-flight, safe error text and list-refresh failure.
Exercise the real form and transport in Chromium with intercepted requests;
check create/update options and existing retry interceptor tests. Run client
coverage, strict checks, lint, build and the coverage ratchet with backend
coverage, plus repository checks. Do not mutate live presets or create a release.
