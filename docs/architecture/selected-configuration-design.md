# Protected runtime configuration compatibility

Date: 2026-10-05. Continues [runtime dispatch](selected-runtime-dispatch-design.md).

## Decision

Replace the protected launcher's fixture-oriented fixed configuration with an
explicit, validated application profile. Preserve the existing API encryption
key, runtime JSON and reviewed environment settings; accept safe custom settings,
key, log and backup paths without moving or recursively changing their contents.
Keep database identity, socket, executable, Node options and schema authority fixed.

This is internal composition, not production conversion or a public mode switch.
Saved Compose/Unraid templates keep their current startup path. The future
dispatcher must inventory all operator configuration before choosing this path;
unknown profile options must fail instead of disappearing. This increment does
not claim compatibility with every environment variable, symlinked mount or ACL.

## Contract

- Construct the child environment from fixed authority fields plus an explicit
  allowlist. Validate again under the separate application identity before any
  database/service import. Never spread the parent's environment. No shell,
  caller-selected executable, database credentials or privileged file repair.
- Preserve a valid explicit 64-hex-character API key with its existing precedence.
  Otherwise require a valid existing key file. Missing, malformed, oversized,
  inaccessible or unsafe key files stop this protected startup; never generate a
  replacement key for an existing installation. Fresh key creation is a separate
  first-install responsibility and remains on the compatible startup path.
- Read key files once with a bounded descriptor read and use that validated key
  in the child's in-memory environment before importing existing encryption code.
  Do not copy it to another file, put it in arguments, print it or put it in
  evidence. Existing explicit environment keys remain supported for compatibility;
  this is not a claim that environment variables are a secret vault.
- Require canonical absolute POSIX paths, bounded length/depth and safe ancestors.
  Reject links, special files, multiple hard links, protected database/image/system
  paths, foreign owners and group/other-writable paths. Key access must be private
  to the application owner/group. Inspect as the application, never root; perform
  no chmod, chown, copy, deletion or recovery writes.
- Existing writable log/backup directories and the runtime JSON parent must be
  owned by the application. A custom JSON file must exist and contain a bounded
  JSON object. A missing default JSON file may retain existing normal first-use
  behavior. Existing runtime setting precedence and normal default-key additions
  remain unchanged. Filesystem quiescence is a caller prerequisite; these checks
  do not isolate hostile concurrent writers sharing the application UID.
- Preflight is serialized, bounded to ten seconds, with cancellation checks and
  one-second join. Read at most 128 key bytes and 1 MiB of runtime JSON. Failure
  does not start the application, regenerate secrets or retry automatically.
  The supervising process/container remains the final bound for unjoined I/O.
- Normal mode alone receives this application profile. Restore-only mode refuses
  it rather than silently ignoring it; its separate input/admission contract is
  unchanged. Restricted restore HTTP remains a subsequent integration step.

## Research and tradeoffs

Official sources discovered through web search and opened on 2026-10-05:

- [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html):
  explicitly construct `env` and use shell-free spawning.
- [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/):
  secrets are mounted files; `_FILE` support is an application convention.
- [Node 24 file APIs](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html):
  Linux no-follow/nonblocking opens and descriptor metadata support bounded file
  inspection; handles must close even on failure. Ancestor checks are not a
  replacement for excluding concurrent writers with the same identity.
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html):
  minimize access/exposure and preserve long-lived storage encryption material.
  Prefer appropriately permissioned mounted secrets where practical; do not
  require a template rewrite merely to preserve an already configured key.
- [OWASP Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html):
  plan rotation and existing-data migration together. Retain retired keys as
  needed for older backups; replacing a lost key cannot decrypt old ciphertext.

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| Inherit every environment variable | Broad immediate compatibility | Imports executable/runtime and database authority overrides |
| Keep fixed defaults | Smallest code | Can lose access to encrypted values or ignore security settings |
| Validated application profile — selected | Explicit preservation and safe refusal | Requires a complete configuration inventory before production activation |
| Copy all custom paths into defaults | Uniform layout | Moves secrets/data and expands privileged filesystem authority |

Recommendation stack: validated key/settings preservation; complete configuration
inventory and restricted restore handoff; capability-aware production dispatch;
database-enforced ingestion writer isolation; unattended legacy recovery and
published-image upgrade rehearsal. No UI interaction changes in this batch.

Key regeneration is not inherently forbidden. A later lifecycle service can
rotate a readable old key by re-encrypting every affected value with verified,
restart-safe completion before retiring the old key. If the old key is lost,
replacement is a credential reset, not recovery: existing ciphertext cannot be
decrypted with the new key. Provide an authenticated recovery-only interface,
an affected-integration summary, explicit reset approval and notification; do
not silently replace secrets or delete inventory. Automatic first-install key
creation also needs proof there are no existing encrypted values. None of those
operations is authorized or implemented by this startup-preflight increment.

## Acceptance

Unit tests cover valid and invalid profiles, key precedence, path/file bounds,
permissions, missing/corrupt configuration, I/O errors and cancellation before
imports. Real-image tests must prove old ciphertext decrypts with the same key,
custom JSON/security settings remain effective, malformed inputs cannot launch
the application, bytes stay unchanged, and normal authenticated startup/restart
and one-shot restore exclusion still pass. Record outcomes separately.
