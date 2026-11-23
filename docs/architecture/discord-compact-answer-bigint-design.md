# Exact BIGINT IDs for compact Discord answers

November 23, 2026 Eastern. This follows the
[web admission outcome](pending-web-bigint-admission-outcome.md).

## Scope and design

Preserve the compact button format `ai_answer_<history>_<action>_<library>_<fingerprint>`.
Use canonical positive History IDs through PostgreSQL's BIGINT maximum.
Safe IDs keep their existing numeric representation in service calls.
Larger IDs use decimal strings through notification delivery, lookup,
resolution, routing, answer receipts, and outcome reporting.

Parse the whole button ID in a small module. Require the existing action
code, a positive INTEGER library ID, and the complete 22-character base64url
fingerprint. The alphabet includes underscores, which a general split can
lose. The longest current button ID is 65 characters, within Discord's
100-character limit. Existing generated IDs keep the same bytes.

The Discord handler still checks the stored notification message ID before
opting into exact admission on the versioned resolver. The existing row
lock, fingerprint, destination checks, learning admission, and completed
replay govern the result. Validate identifiers before the first lookup.
Treat the button ID as input and apply the existing server-side authority.

Astra confirmed that older clarification buttons carry only a mutable
option index and their shared library selector still converts a History ID
to a JavaScript number. Keep their existing safe-ID cap. A separate design
can cover exact selector parsing and message binding for those controls.

## Recommendations and tradeoffs

The recommended stack keeps the current button format, preserves full
fingerprints, validates IDs at the boundary, and uses the existing stored
message and receipt checks. It keeps old compact messages usable. The
parser needs to track the grammar if the fingerprint format changes.
A new format could make delimiters easier to parse and would need a
compatibility decoder. Widening the legacy controls in this batch would
also extend pending correction to the shared selector path.

Discord defines a bounded developer-owned `custom_id` returned with the
interaction. RFC 4648 defines the base64url alphabet Classifarr uses for
the fingerprint. W3C guidance on
identifier opacity also applies as a design principle here. Preserve exact
identity at the transport boundary and look up authority on the server.
[Discord component reference](https://github.com/discord/discord-api-docs/blob/main/developers/components/reference.mdx#custom-id),
[Discord interaction reference](https://github.com/discord/discord-api-docs/blob/main/developers/interactions/receiving-and-responding.mdx),
[RFC 4648, section 5](https://www.rfc-editor.org/rfc/rfc4648.html#section-5),
[W3C Web Architecture](https://www.w3.org/TR/webarch/#uri-opacity),
[PostgreSQL numeric types](https://www.postgresql.org/docs/17/datatype-numeric.html)

## Verification

Check old and new compact IDs, malformed components, exact length, and
fingerprints with underscores. Verify both adjacent large IDs and the BIGINT
maximum with real PostgreSQL and a local Discord and routing stand-in.
Cover message mismatch, receipt replay, and the unchanged legacy cap.
