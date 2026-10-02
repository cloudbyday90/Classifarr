# Synology storage validation outcome

## Implemented scope

The Synology base now uses an explicit, existing appdata directory while
preserving its previous default location and runtime settings. The optional
media overlay adds read-only access unless file moves are explicitly selected.
The new operator guide separates fresh setup from existing-installation updates,
explains DSM permissions and preserves the image/data/configuration rollback
boundary. No application runtime or database schema changed.

## Verification

Completed locally on 2026-10-02:

- Four Synology contract tests and two adjacent Unraid Compose tests passed.
  They parse the shipped YAML and protect appdata, identity, startup, port,
  health/shutdown and optional-mount contracts.
- Docker Compose 5.5.1 rendered the base without media configuration. The
  default appdata path and IDs remained unchanged; custom paths and IDs were
  preserved. Adding the overlay changed only the volume list and retained the
  original appdata mapping.
- Unset/empty media paths and an invalid read-only value were rejected. Both
  the default read-only and explicit writable configurations rendered correctly.
- Three disposable Linux containers verified media reads, rejected writes on
  the read-only mount, accepted explicitly enabled writes, and retained synthetic
  appdata across recreation. They ran a bounded Node filesystem probe, not the
  application or a database upgrade, with UID/GID 1234/456, no network, no ports,
  dropped capabilities and read-only root filesystems.
- An isolated Compose create using a nonexistent Linux daemon path failed
  without creating a container. Windows shared-folder paths were not suitable
  for this negative test: Docker Desktop materialized them before the daemon
  checked them. The Linux-path rerun passed without changing the product's guard.
- Backend test lint and Markdown lint passed. No new runtime dependency or
  CommonJS module was added.

The filesystem probes used the existing local image
`sha256:e23b9eb6b42436ebbe9abfbdb8c0b346b2f44a04841a11ac72509d13c7c80a56`
only as a Node/Linux test environment. This is not a new-image or exact-source
application startup claim. The three owned test containers were removed;
regenerable fixtures remain under ignored `.tmp/`. Failed diagnostic runs also
removed their owned containers. No real media, application data or external
service was accessed. The live Classifarr container kept its ID/start time and
remained healthy. No image rebuild or deployment was needed for these config tests.

Run the focused tests from `server/`:

```sh
node scripts/run-jest.mjs --testPathPatterns='synologyCompose.test.mjs|unraidMediaCompose.test.mjs' --runInBand --no-coverage
```

These checks do not establish a minimum NAS RAM size, validate Synology ACLs or
certify a Container Manager GUI version. The operator guide does not claim that
an image update applies the new Compose settings automatically.

## PR availability

GitHub MCP search and the saved GitHub CLI login both returned zero open
Classifarr PRs on 2026-10-02. No random PR could be selected. No closed or unrelated
PR was substituted, and no PR was merged.

## Next acceptance work

Test fresh setup and an existing-data upgrade through Container Manager on a
currently supported Synology model. Record DSM, package, Docker/Compose and CPU
versions; verify appdata persistence, DSM ACLs, optional media reads/writes,
import/backfill recovery, clean stop and backup recovery. Measure peak CPU/RAM
before choosing a small-NAS resource profile. Optional AI jobs remain separate
from import/metadata recovery completion.

See the [design](synology-storage-design.md) for recommendations and tradeoffs.
No Synology certification, new published image or release is claimed.
