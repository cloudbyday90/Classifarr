# Private capture storage: design and outcome

Date: 2026-09-27. Status: Unreleased. This follow-up addresses the pre-existing
validation warning identified while implementing Emby catalog compatibility.

## Finding

The frozen-policy capture CLI duplicated filesystem writing rather than using the
existing private-study file boundary. Its dynamic `writeFile` path triggered lint;
the warning alone did not establish an exploitable vulnerability. Inspection also
found a concrete layout mismatch: the CLI assumed a checkout directory tree, while
the existing private-study tools use the application's writable `data` directory
in production. Under the container layout the old calculation pointed at `/.tmp`
instead of `/app/data/.tmp`.

## Design and implemented outcome

- Export the existing private-study storage root and share it with the capture CLI.
- Create a unique, owned temporary directory through a small shared boundary helper.
  Reject path-like prefixes and a temporary root redirected outside the configured
  installation root. Do not infer ownership from a guessed random filename.
- Delegate JSON writing to the existing relative-path validator, canonical-parent
  containment checks, exclusive `wx` file handle and explicit handle closure.
- Retain POSIX owner-only file permissions and the existing Windows inherited-ACL
  access boundary. Keep capture receipts limited to the relative private path and
  aggregate counts/fingerprints; never print the captured media or labels.
- On failure, remove only the newly owned capture directory. Preserve earlier
  evidence. No existing artifact, media or production data was deleted by this work.

The global lint rule remains enabled. The shared filesystem boundary uses the
repository's existing convention of narrowly documented static-analysis exceptions
for fixed server-owned paths. Runtime validation and regression tests enforce the
boundary; a lint exception is not the security control. No suppression was added
to the capture CLI and its duplicate direct file write was removed.

Like the pre-existing private-study boundary, this assumes installation directories
are controlled by the application's account. It is not a sandbox against a hostile
process with the same filesystem privileges swapping directories concurrently.

## Alternatives and recommendation

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Suppress the original capture warning only | Small change | Leaves duplicate I/O and the container-path mismatch. Rejected. |
| Build a second capture-specific file writer | Independent tuning | Duplicates validation and handle lifecycle. Rejected. |
| Reuse the guarded private-study boundary | One storage convention and tested exclusive writes | Small shared directory helper; recommended and implemented. |

Retain ESM, Node's filesystem APIs and the existing private-study writer. No new
package, service, schema, capture job or background work is introduced.

## Verification and source

Focused tests cover real capture output, receipt redaction, unique directories,
read-only capture settings, invalid options, capture failure, serialization/write
failure cleanup, malformed directory prefixes, redirected temporary roots and
development/production root selection in isolated Node processes. Existing private
writer tests retain exclusive-file, permission and invalid-path coverage. No live
capture, provider request or AI evaluation was run.

[Node.js filesystem documentation](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html)
describes exclusive creation, temporary directories and explicit file-handle closure.
The source was discovered through web search; no new-runtime-only API is required.

Full validation results for this commit are recorded in
[the compatibility outcome](emby-catalog-compatibility-outcome.md).
