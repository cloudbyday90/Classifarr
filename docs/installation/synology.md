# Synology installation and updates

Use Classifarr's existing image through **Container Manager > Project**. No
separate Synology package, database container or local AI service is required.
This guide targets modern DSM installations whose model is supported by
Synology's Container Manager package. Check the
[package's model list](https://www.synology.com/en-in/dsm/packages/ContainerManager)
and install the maintained DSM/package updates offered for your NAS. A DSM
version alone does not establish model or CPU compatibility.

The Compose files are locally tested, not certified on every Synology model.
Older DSM installations using the retired Docker UI are outside this guide.

## Existing installation? Preserve these first

Record your current image, project name, port, appdata folder, user/group IDs,
media mounts and custom settings. Do not replace them with the example values.
Only one running Classifarr instance may use an appdata folder at a time.

An image update does **not** update your saved Compose configuration or add host
mounts. The changes here are a reviewed, one-time project edit. A working
API-only installation does not need media mounts.

Before an upgrade, stop Classifarr cleanly and take a recoverable copy or
snapshot of its dedicated appdata folder, including PostgreSQL and secrets.
Keep the prior image and configuration. A configuration export alone is not a
complete database backup. Do not copy a running PostgreSQL data directory or
assume an older image can open a database already migrated by a newer one.

## 1. Prepare folders and permissions

Keep the project YAML separate from application data. For example:

| Purpose | Example NAS folder | Container path | Access |
| --- | --- | --- | --- |
| Project YAML and optional `.env` | `/volume1/docker/classifarr-project` | Not mounted | Administrator-managed |
| Database, settings and secrets | `/volume1/docker/classifarr` | `/app/data` | Read/write |
| Optional movie/TV media root | `/volume1/media` | `/data/media` | Read-only initially; read/write for moves |

Use an existing local NAS volume for appdata, not a network-mounted media share.
Create the dedicated appdata directory before starting. The Compose file now
refuses a missing directory instead of silently creating an empty one.
If this is an upgrade and the expected folder is missing, stop and locate your
existing data; do not create an empty replacement and continue.

Choose a dedicated non-administrator account with access only to the needed
folders. If using SSH, `id <username>` reports its UID and primary GID. Set
`PUID` and `PGID` to those values. The shipped `1026:100` values are compatibility
defaults, not guaranteed IDs on your NAS. Preserve an existing installation's
IDs unless you have a separately reviewed ownership migration.

Grant that identity access through DSM folder permissions. Check both the
container mount mode and the filesystem permissions; a read/write mount cannot
override a denied folder permission. Do not grant Everyone write access, run
`chmod -R 777`, or change ownership of an entire shared folder to fix an error.

The current image starts with its existing initialization permissions and then
runs the application/database as the configured identity. Startup may recursively
set ownership inside `/app/data`. **Never map a media root, `/volume1`, or an
unrelated shared folder to `/app/data`.** This guide does not change the image's
privilege model or add a forced `user:` override to existing installations.

## 2. Create or edit the Container Manager project

Use [docker-compose.synology.yml](../../docker-compose.synology.yml) as the
starting YAML. For a new installation, create a project using the YAML upload
or editor in [Container Manager Projects](https://kb.synology.com/en-global/DSM/help/ContainerManager/docker_project).
For an existing installation, edit the existing project's YAML after backup;
do not create a second instance pointing to the same data.

Review the appdata `source`, PUID, PGID, time zone and port before deploying.
For the simplest GUI setup, replace the `${...}` expressions you need to change
with your actual values in the YAML. Do not assume that entering a container
environment variable changes Compose interpolation or a host mount path.

The image reference remains the published `latest` channel. This source change
does not publish a new image or release. Operators requiring repeatable upgrades
can keep a verified published image digest in their saved YAML.

## 3. Add media access only if needed

API-based classification/routing does not require access to media files.
Filesystem verification needs read access; file moves need write access to the
source and destination folders. Mount only the folders you need.

For the GUI, add the volume entry from
[docker-compose.synology.media.yml](../../docker-compose.synology.media.yml)
to the existing service's `volumes` list. Keep the `/app/data` entry. Replace the
media source expression with your actual NAS media root, and use the literal
`read_only: true` for verification or `read_only: false` for moves.
Keep `bind.create_host_path: false` in both entries.

Choose one layout:

- A common movie/TV parent mounted at `/data/media`; or
- Separate movie and TV folders mounted at `/data/movies` and `/data/tv`, using
  one copy of the same long-form entry for each folder.

Do not add overlapping mounts or mount a whole volume just for convenience.
Match the paths used by Radarr/Sonarr, or configure Classifarr path mappings.
Test a small, disposable file before allowing moves of real media. Mounting a
folder does not enable a move workflow or change routing settings.

### Optional Compose CLI workflow

Keep both Compose files in the project directory. Put only the values you need
in a local `.env`; [the example](../../.env.example) documents the variables.
`CLASSIFARR_APPDATA_PATH` defaults to `/volume1/docker/classifarr`.
`CLASSIFARR_MEDIA_PATH` is required only when selecting the media overlay.
`CLASSIFARR_MEDIA_READ_ONLY` defaults to `true`; explicitly use `false` for moves.
Set your actual `PUID` and `PGID` too. Do not commit this local `.env`.

Validate, then deploy:

```sh
docker compose -f docker-compose.synology.yml -f docker-compose.synology.media.yml config --quiet
docker compose -f docker-compose.synology.yml -f docker-compose.synology.media.yml up -d
```

Omit the second `-f` argument for API-only use. Reuse the same project name and
file selection for later operations. `config --quiet` validates configuration;
it does not verify that the folders exist or that DSM permissions allow access.

## 4. Check startup and future updates

Confirm the expected appdata source in Container Manager, successful PostgreSQL
startup, and a healthy container. Open the UI on the NAS address and configured
port. Existing users should see their existing settings, not a new setup wizard.
If data appears missing, stop and verify the mount rather than initializing a
replacement installation.

For subsequent updates, back up first, obtain the selected published image and
redeploy the same project with its saved mounts and IDs. Use the project's YAML
controls, not a second unmanaged container. The CLI equivalent is `pull` followed
by `up -d` with the same file arguments. Do not use project **Clean**, volume
pruning, or `down --volumes` as routine update or permission-repair steps.

If rollback is necessary, stop the new container and restore the paired backup,
prior image and configuration through a reviewed recovery procedure. Retaining
an old image alone is not a database rollback plan.

## Troubleshooting and resource limits

| Symptom | Next step |
| --- | --- |
| Missing bind directory | Correct the source; for upgrades, locate the existing data before proceeding. |
| Permission denied | Check actual PUID/PGID, DSM folder permissions and mount mode; do not broaden access globally. |
| Media readable but moves fail | Verify both destination permissions and explicit `read_only: false`; check path mappings. |
| Unexpected setup wizard | Stop and verify the appdata source; do not continue setup over an empty replacement. |
| Container still starting | Inspect startup logs before restarting; a large migration can exceed the healthcheck grace period. |
| Container exits or reports OOM | Check NAS/container memory measurements and logs before changing limits. |

This storage change deliberately leaves the existing resource settings alone:
the Synology Compose file does not set a CPU quota or container memory cap.
Node heap is not total container memory; PostgreSQL and native buffers need
headroom too. A universal low-memory profile is not established by these tests.
Keep optional AI services off the NAS unless deliberately provisioned. The next
acceptance step is a real-NAS install/upgrade test with peak CPU/RAM measurements
during import and backfill, then evidence-based resource defaults.

See the [design and tradeoffs](../architecture/synology-storage-design.md) and
[test outcome](../architecture/synology-storage-outcome.md) for the scope and
remaining acceptance work.
