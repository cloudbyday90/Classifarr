# Policy Storage Closure Component Catalog Cutover

## Status

Implemented July 11, 2026.

## Intent

The storage-closure verification chain used temporary delivery identifiers as
its component catalog values and normalized those values inside current
evidence. That made roadmap sequencing an implicit runtime compatibility
contract. The catalog must instead identify stable product capabilities and
derive only bounded evidence from documentation labels.

## Boundary Audit

The prior input-key cutover showed that current callers already produce durable
field names, but the following internal producers still emitted historic values:

- completion-checkpoint component metadata and normalization map;
- closure-evidence artifact metadata and source-roadmap output;
- current evidence collection from roadmap headings and sequence entries;
- closure requirement-audit catalog, coverage scope, and roadmap parser;
- the validation manifest path for a phase-named closure inventory record.

No persisted database record, route payload, or external integration consumes
these values. All callers are internal evidence tooling, so the cutover removes
the historic value contract rather than adding another adapter.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  calls for descriptive and unambiguous stable names. Durable component IDs
  name the verified capability, unlike temporary delivery numbers.
- [NIST SP 800-228 Update 1](https://csrc.nist.gov/pubs/sp/800/228/upd1/final)
  recommends risk-based API lifecycle controls. Requiring a single internal
  evidence schema keeps completion behavior explicit and testable.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports traceable secure development. Focused tests and the naming
  regression gate prove that the removal did not create a silent bypass.

## Options Considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep delivery values and normalize them | Avoids changing internal fixtures | Leaves delivery history in production decisions | Rejected |
| Add a parallel catalog with a compatibility bridge | Allows staged conversion | Duplicates authority and adds deletion debt | Rejected |
| Replace the catalog with durable component IDs | One source of current truth, deterministic blocking | Old ad hoc JSON must be regenerated | Selected |

## Final Recommendation Stack

1. Define all closure catalog entries with durable `componentId` values.
2. Accept only durable component IDs from checkpoint and evidence callers.
3. Collect documentation evidence by the catalog label within structural
   headings and sequence entries, then emit the corresponding durable ID.
4. Keep delivery-phase history in roadmap documentation only, outside runtime
   artifact contracts.
5. Use focused tests plus the naming inventory ratchet for regression control.

## Implementation

- Removed `legacyId` metadata and historic-value normalizers from the
  completion checkpoint and closure evidence runner.
- Replaced every closure artifact catalog entry with a durable component ID.
- Changed roadmap evidence collection to label-based structural matching and
  durable-ID output.
- Updated the requirement audit to use the same component catalog terminology.
- Renamed the validation inventory-sync document to
  `policy-storage-closure-inventory-sync.md` and updated its executable path.
- Added negative coverage proving historical identifiers cannot satisfy the
  closure checkpoint.
- Reduced the naming baseline from `15/16` to `11/12` production references
  and rename candidates.

## Security Outcome

- Evidence completion has one canonical component identity scheme.
- Historic values and phase-key aliases cannot be used to satisfy current
  closure evidence.
- Repository evidence collection remains read-only; no storage, Git, process,
  or network side effect is introduced.
- The validation manifest reads the durable record path, reducing executable
  coupling to delivery-history file names.

## Verification

- Focused storage checkpoint, evidence-run, current-evidence collector,
  requirement-audit, and validation-evidence tests pass.
- The current repository collector emits durable component IDs for every
  mapped closure capability.
- The production naming inventory remains valid and the regression baseline is
  lowered to the observed count.

## Next Step

Replace the remaining phase-coded WebSocket progress fallback after confirming
all producer payloads use `stage`, so the final runtime progress consumer no
longer accepts the retired field.
