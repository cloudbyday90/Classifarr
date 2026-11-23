# Legacy suggestion detail support window

November 23, 2026 Eastern. This follows the
[bounded proposal rollout design](legacy-suggestion-detail-migration-design.md).

## What we can verify

The bundled dashboard already uses the suggestion list and bounded
administrator evidence. Searches of the repository and indexed public code
found no known external caller. The matching project issue describes the
database schema. Private integrations and installed usage remain unknown.
[Policy database schema issue](https://github.com/cloudbyday90/Classifarr/issues/91)

Existing access logs can identify requests on one
installation during its retained period. They cannot establish which
response fields a client used. Collecting or sharing raw logs adds data
such as URLs, addresses, and user agents. Prefer voluntary reports of a
workflow and its required field names.
[OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

The latest published beta at review time, `v0.49.4-beta`, predates the
proposal endpoint and migration notice. A commit on `main` does not start
the support window.
[Published beta](https://github.com/cloudbyday90/Classifarr/releases/tag/v0.49.4-beta)

## Tradeoffs

| Option | Benefit | Cost |
| --- | --- | --- |
| Publish a minimum support window with narrow safeguards | Existing integrations get time to migrate and future columns stay private on legacy detail | Present raw fields and unbounded expansion remain available during the transition |
| Count legacy requests | Shows request activity on installations with coverage | Requires instrumentation and still cannot identify which fields callers need |
| Narrow legacy access immediately | Stops member access to raw feedback sooner | Changes a supported response for installations that may rely on it |

## Selected contract

1. Keep the legacy detail route supported for at least 90 days after the
   first public release ships both replacements, the deprecation notice,
   and the migration guide. A downloadable beta qualifies. Record the
   version and publication date when that occurs. After the minimum,
   review reported dependencies before deciding whether to remove or
   re-scope full detail. The window does not set a shutdown date or
   authorize automatic removal. GitHub's versioned policy is an example
   of tying support to replacement availability. The 90-day period is
   Classifarr's decision for this endpoint.
   [GitHub API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions)
   · [HTTP deprecation](https://www.rfc-editor.org/rfc/rfc9745.html)
   · [HTTP Sunset](https://www.rfc-editor.org/rfc/rfc8594.html)
   · [W3C URI persistence](https://www.w3.org/TR/webarch/#URI-persistence)
2. Use explicit lists of every suggestion and feedback column shipped in
   the current legacy response, with its existing aliases and feedback
   ordering. The legacy response continues to carry the present raw fields
   for members and administrators. New database columns require a separate
   API decision before exposure. Use `Cache-Control: no-store` on handled
   successful legacy reads. Existing conditional HTTP behavior is preserved.
   This directive limits compliant future storage and does not purge
   previously saved copies.
   [OWASP response field guidance](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/)
   · [HTTP cache control](https://www.rfc-editor.org/rfc/rfc9111.html)
3. Keep proposal and evidence reads for older rows with the saved fields and
   attribution they require. A missing analysis snapshot remains a conflict
   at Apply. Refresh pending work with the existing analysis, which can
   supersede an old suggestion and generate a fresh one for review. Completed
   records keep their history. Lost evidence or a missing historical
   analysis context stays unavailable. Reading current rows cannot establish
   the original inputs or authority.
   [Classifarr cohort rules](suggestion-cohort-design.md)
   · [W3C provenance](https://www.w3.org/TR/prov-o/)

Verify the full legacy body in isolated PostgreSQL, with newer columns on
both source tables, and exercise normal and conditional HTTP responses. Use
an older suggestion fixture to verify member proposal visibility,
administrator evidence, and refusal to apply without its original cohort.
