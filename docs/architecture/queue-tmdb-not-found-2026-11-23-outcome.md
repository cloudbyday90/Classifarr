# Production queue TMDB 404 investigation

Reviewed November 24, 2026. The production log and saved task agree on
`task_metadata_not_found` during a typed TMDB movie details lookup at
4:00 a.m. EST on November 23. The ordinary queue stopped after one attempt.
Five is its attempt ceiling. This failure is terminal in the ordinary queue
because subsequent classification requires the metadata.

Read-only inspection matched the failure reference. The failed task and
intake receipt have no classification link, and the saved task still contains
the same typed movie ID. The original linked webhook row was unavailable in
the retained data. The evidence establishes the ID Classifarr requested.
It cannot establish who assigned it or why the catalog lacked that record.
The reporting image matched revision `ef5b50ed1`, whose queue acknowledgement
explicitly treats this metadata result as terminal for ordinary retries.

The existing [same-ID recovery](queue-metadata-self-healing-design.md) enrolled
the task. At inspection it had two recorded probes, with the latest result
`not_found` at 11:00 a.m. EST on November 23. The next check was due
November 24 at 11:00 a.m. EST. There was no successful recovery or identity
repair receipt at inspection.

## Recommendation

Keep the bounded availability checks. A normal queue retry would repeat
classification against the same unresolved identity. Same-ID checks preserve
the original request and have a smaller work scope, at the cost of waiting
for the next scheduled probe. If a replacement is suspected, require retained
source identifiers and a reviewed match before using the existing identity
repair path. A 404 alone cannot establish a permanent removal or a replacement.

The investigation used the reporting container and scoped read-only
PostgreSQL queries. It invoked no provider request, requeue, repair, or
configuration change. The confirmed behavior needs no queue code change.

Sources verified through MCP.
[TMDB errors](https://developer.themoviedb.org/docs/errors)
[RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5)
