# Migration from full suggestion detail

November 23, 2026 Eastern. This follows the
[dashboard migration](suggestion-dashboard-evidence-outcome.md).

## Caller audit

The dashboard opens the proposal from a list row and uses the administrator
evidence endpoint. Astra found no bundled runtime caller of the full-detail
GET. The exported client adapter and integration tests still express that
contract. The tests include a regular member reading a saved feedback note.
Archived release documentation advertised supporting feedback. Repository
inspection leaves external usage unknown.

The legacy detail route expands all saved reference IDs and returns complete
feedback rows. It has neither a page limit nor a response-size ceiling and
does not recheck the feedback policy and destination. The existing
administrator evidence route pages saved references and checks that
attribution. The proposal path separates a single proposal from feedback
expansion. Both existing suggestion lists and the impact endpoint have
their own query contracts.

## Alternatives

| Option | Benefit | Cost |
| --- | --- | --- |
| Add a proposal read and deprecate full detail | Gives signed-in members and external callers a bounded lookup before migration | Raw member feedback and full-response cost remain during the transition |
| Limit full detail to administrators immediately | Removes regular-member access immediately | Breaks member scripts and retains the unbounded administrator response |
| Remove the full response immediately | Retires the raw row projection and expansion immediately | External integrations could lose proposal status and evidence in one change |

## Selected sequence

1. Add `GET /api/suggestions/:id/proposal` for authenticated callers. Validate
   positive canonical `INTEGER` IDs before lookup. Use one parameterized
   query for fixed proposal, label, status, and reference-count fields.
   Project simple typed values from the three generated proposal types.
   Report unsupported, malformed, or oversized configuration as unavailable.
   Bound the encoded response to 8 KiB and use `Cache-Control: no-store`.
   The available result describes stored data for review. Apply retains its
   current validation and authorization. PostgreSQL can still expand a large
   stored configuration to check its text size. The configuration and response
   ceilings bound transfer and projection costs.
   [OWASP response property selection](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/)
   · [HTTP caching](https://www.rfc-editor.org/rfc/rfc9111.html)
2. Introduce a dated `Deprecation` header and link to the same-installation
   API documentation on successful legacy detail responses. Keep their
   body, existing error behavior, and member access through the transition.
   Document the administrator evidence migration explicitly. A legacy caller
   that needs raw notes or raw analysis data cannot get those fields from
   the bounded contracts. The deprecation date records the decision and
   sets no shutdown schedule. A later decision about response or access
   removal should have its own compatibility plan.
   [Deprecation](https://www.rfc-editor.org/rfc/rfc9745.html)
   · [Sunset](https://www.rfc-editor.org/rfc/rfc8594.html)
   · [W3C URI persistence](https://www.w3.org/TR/webarch/#URI-persistence)
3. Verify genuine member and administrator reads in PostgreSQL, with an
   exact response projection and size controls. Check legacy body and
   permission compatibility, unrelated route headers, and the rendered API
   specification. Then review the support window and removal contract with
   external callers in mind. Changes to suggestion lists and impact queries
   can be assessed independently.
