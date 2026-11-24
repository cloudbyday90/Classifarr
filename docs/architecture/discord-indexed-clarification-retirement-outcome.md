# Discord index-only clarification retirement outcome

November 23, 2026. See the
[design](discord-indexed-clarification-retirement-design.md) for the source
review, options and decision.

Clicks on a delivered `ai_clarify_` button now receive a private reply that
directs the operator to the Classifarr Command Center. The dispatcher no
longer reads History, interprets the option label or routes the item from
this action. The retired generic `clarify` button uses the same reply.

Fresh legacy clarification notices on the confidence path show where to
review the item and when to use **Retry Classification**. They keep the
confidence delivery kind, `awaiting_clarification` status and receipt flow.
They contain neither positional buttons nor the companion selector. The
fingerprinted pending path continues to own current policy decisions.
Completed verification and corrections keep their existing controls.

Old delivered messages and retained deferred payloads can still show the
former buttons. Their appearances are preserved, and any old click now
gets guidance. Operators who used a safe-ID button on a historical row
without a stored question now complete the action in Classifarr. The original
question and option copy is replaced by review guidance on new legacy
confidence notices.

## Verification

- Before the repair, the renderer emitted an index-only button and selector
  for a safe ID. The large-ID notice described a question without guidance.
  In isolated PostgreSQL, the old safe-ID click reached resolution and the
  large-ID click returned a generic invalid-action reply.
- All 383 focused tests passed. They cover new render output, repeated clicks
  with no lookup or writer call, unchanged compact IDs and validation, and
  the completed control paths.
- All 90 tests across four isolated PostgreSQL suites passed. Old clicks left
  both historical row shapes unchanged and opened no transaction. The same
  run verified compact BIGINT answers, completed corrections, and retained
  delivery behavior. A duplicate test fixture ID found in the first patched
  run was corrected before this full targeted rerun.
- The first ownership scan still saw the unstaged deletion in the Git index.
  Staging it cleared the report without changing the review manifest. All 42
  ownership gate tests passed on rerun.
- The staged server run passed 64,555 tests across 1,958 suites with one
  existing skip. The coverage ratchet passed with 89.32% server and 89.58%
  client line coverage. Client evidence came from the preceding 7,721-test
  run after checking its report hashes and unchanged client inputs.
- Lint, type checks, preflight, ESM, policy and Markdown checks passed.
  All three workspace dependency audits returned zero findings. The local
  Classifarr container kept the same identity, start time and health.

GitHub listed no open PRs at intake or before delivery.

## Next UUIDv7 readiness item

Audit the now-unused `clarificationService.resolvePolicyQuestion` entry
point and its generic safe-ID branch. Verify public callers and saved replay
before deciding whether that fallback can be removed. Keep exact History ID
validation and receipt binding in the contract-based answer service.
