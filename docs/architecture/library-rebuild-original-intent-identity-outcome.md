# Original intent identity verification

The rebuild workflow now carries the exact original intent ID from the
rollback plan through acceptance, verification, capture, replacement, and
the detailed removal reports. Safe IDs keep their numeric representation.
Larger IDs use canonical decimal strings through
`9223372036854775807`. Previously rounded numeric acceptances require a
fresh acceptance.

The verification, snapshot, and capture event writers check their returned
original-intent links inside the transaction. For large original IDs,
pending capture replay and replacement require an exact match in the saved
capture event. Completed replacement replay and removal readiness require
the corresponding replacement event evidence. Older safe-ID events remain
eligible under their existing rules.

## Evidence

- The baseline PostgreSQL reproduction rounded `9007199254741001` to
  `9007199254741000` and blocked an otherwise valid plan. The original
  acceptance validator also allowed an unsafe number when the two saved
  plan references agreed with that number.
- The before-and-after probes produced identical rollback fingerprints,
  acceptance fingerprints, and replay keys for both valid safe shapes,
  including an older plan with a safe decimal string in the nested snapshot.
  The revised validator refused the unsafe numeric form.
- The five PostgreSQL identity suites passed 41 tests. The new suite uses
  the production representative source, coordinator, receipt repository,
  transaction gates, and report readers with synthetic records. It confirms
  receipt replay, adjacent IDs, the BIGINT maximum, and safe capture replay
  after removing the new event field. A neighboring receipt alone could
  not authorize capture. Writes deliberately linked to a neighboring
  original rolled back at both receipt and snapshot insertion.
- Pending capture and replacement refused missing, numeric, and neighboring
  original-intent evidence. Completed replacement replay and the removal
  reports refused those same defects in the replacement event. The Jest
  fixture re-homes the cloned invocation in its test realm so production
  plain-object checks can inspect it. A separate Node.js probe verified
  the production invocation clone with safe, adjacent, and maximum IDs.

## Quality gates

The full backend run passed 64,939 tests across 1,959 suites with one
existing skip and 89.33% statement coverage. The client report recorded
7,751 passing tests and 87.84% statement coverage. The client evidence
was reused after verifying its SHA-256 and unchanged client inputs.
The coverage ratchet, preflight, type checks, policy gates, ESM checks,
server and documentation lint, schema check, and staged secret scan
passed. Production dependency audits found zero vulnerabilities in the
root, server, and client dependency sets.

## Follow-up

Preserve exact snapshot, original intent, and originating event IDs in
scheduled rollback snapshot retention. Qualify evidence attribution and
redaction in isolated PostgreSQL before changing how the marker is written.

The design records the researched options, tradeoffs, and recommendation.
[Original intent identity design](library-rebuild-original-intent-identity-design.md)
