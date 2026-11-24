# Bind native question handoffs to their selected library

Reviewed November 24, 2026. This follows
[exact selected-library validation](native-question-selected-library-outcome.md).

The native handoff reads stored profile and routing evidence asynchronously.
The admission service used to take its destination from the current result.
If the selection changed while a read was pending, both saved destination
fields could agree with the new library while the plan used the old library's
evidence. Direct and queued owners also selected their handoff output before
checking admission.

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Compare only the two saved destination fields | Keeps the existing storage format. | Both fields can agree after a selection changes. |
| Add a public library ID to the handoff | Makes the source identity visible to callers. | Copies can replace the ID and existing consumers inherit a new contract. |
| Bind the live handoff privately and verify at consumption | Associates the evidence with the same result and original canonical library without changing the wire format. | Consumers need the producer-owned handoff and stable selection. |

## Recommended implementation

1. Capture the exact positive PostgreSQL INTEGER library ID, routing input,
   and bounded native policy inputs before either read starts. Check returned
   evidence ownership and the current selection before building the plan.
   Compare canonical numbers and strings as the same library. Existing
   unavailable reads retain their normal handling.
2. Bind the live handoff, both proof objects, original result, and library ID
   through a private `WeakMap`. Compare the original proof content as well
   as the object references before publication and admission. A copied
   handoff cannot carry that association.
   [ECMAScript WeakMap semantics](https://tc39.es/ecma262/2026/multipage/keyed-collections.html)
3. When proof or selection changes, clear the proposed destination and omit
   direct and queue proof outputs. A refusal before History keeps the item
   in operator review. Recheck before provider dispatch and result
   publication. Preserve existing questions, retry state, stable no-create
   behavior, and any History, queue marker, or provider outcome already saved.
   Keep completed replay compatible.
   [OWASP transaction authorization guidance](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Transaction_Authorization_Cheat_Sheet.md)
   [W3C provenance and API compatibility guidance](https://www.w3.org/TR/dwbp/)

Verify changes during and after stored reads, crossed responses, copied
handoffs, stable canonical aliases, and direct and queued ownership. Exercise
History, the route barrier, and completed replay in isolated PostgreSQL,
including refusal before routing and successful provider closeout during a
later selection change.
