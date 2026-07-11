# File Operation Stage Contract Cutover

## Status

Implemented July 11, 2026.

## Decision

Replace the `phase` field in `fileOperationsService.moveFolder` failure
objects and `onProgress` callback updates with the durable `stage` field.

The values are unchanged:

- `preflight`
- `copy`
- `verify`
- `cleanup`

## Boundary Audit

`moveFolder` is called by the server-side reclassification move adapters. Those
callers consume successful completion and error text, but do not serialize its
progress callback payload through a route, WebSocket, or client API. No caller
supplies `onProgress` today.

The contract is therefore internal and can be replaced directly. Keeping a
phase alias would only preserve temporary delivery terminology without serving
a compatibility need.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends precise, unambiguous names. `stage` describes an operational
  portion of a folder move; a project delivery phase does not.
- [NIST SP 800-228 Update 1](https://csrc.nist.gov/pubs/sp/800/228/upd1/final)
  supports explicit, risk-managed interface changes. The cutover inventories
  callers first and tests both progress and failure output.
- [Node.js ECMAScript Modules](https://nodejs.org/api/esm.html) supports the
  repository's static ESM service composition; no CommonJS bridge is required.

## Options Considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep `phase` | No immediate code change | Leaves delivery terminology in production output | Rejected |
| Return both `stage` and `phase` | Transitional compatibility | No external consumer requires it; preserves naming debt | Rejected |
| Return only `stage` | Durable, precise contract with no dead alias | Requires focused internal test updates | Selected |

## Verification

- Move failures assert `stage` and reject the retired `phase` property.
- The progress callback test asserts copy, verification, and cleanup stage
  updates, all without `phase`.
- Reclassification service tests prove server callers still complete normally.
- The production naming inventory and regression audit are regenerated after
  the change before lowering the baseline.

## Security Outcome

The change does not alter path validation, filesystem permissions, cleanup,
checksum verification, routing, or error handling. It removes an obsolete
field name from internal operational output, reducing the chance that later
code conflates copy-progress state with roadmap delivery status.

## Next Step

Rename the remaining classification progress diagnostic text (`resume phase`)
to `resume stage`, then regenerate the naming inventory before selecting the
next contract surface.
