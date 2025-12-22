# Classifarr Release Notes

## v0.18.9-alpha (2025-12-22)

### Fixed
- **Emby Settings Persistence:** Added database transaction wrapper to Emby server configuration saves to prevent partial data writes and ensure settings persist correctly after page reload
- **Jellyfin Settings Persistence:** Added database transaction wrapper to Jellyfin server configuration saves to prevent partial data writes and ensure settings persist correctly after page reload
- **Discord Settings Persistence:** Added database transaction wrapper to Discord notification configuration updates to prevent partial data writes and ensure settings persist correctly after page reload
- **Plex UI State:** Fixed Plex authentication state management to properly reset after saving server configuration, ensuring consistent behavior with other media server types

---

## v0.18.8-alpha (2025-12-22)

### Added
- **Integration Testing:** Added testcontainers-based integration testing with real PostgreSQL Docker containers for production-parity testing
- **Schema Tests:** New comprehensive database schema integration tests verifying all table structures and queries

### Changed
- **Test Infrastructure:** Separated unit tests (`npm test`) from integration tests (`npm run test:integration`) in Jest configuration
- **Jest Config:** Updated to exclude integration tests from default test run to prevent conflicts

### Infrastructure
- **Docker Testing:** Integration tests now spin up real PostgreSQL containers via testcontainers for accurate database testing
- **CI/CD Ready:** Test suite now fully compatible with CI/CD pipelines that support Docker

---

## v0.18.7-alpha (2025-12-21)

### Fixed
- **Global Settings Persistence:** Applied transaction-based saving to **Ollama** and **TMDB** settings to prevent data loss during configuration updates, matching the fix previously applied to the Media Server.
- **Tab State Persistence:** The Settings page now remembers the active tab via URL query parameters (e.g., `?tab=sonarr`), allowing for page refreshes and direct linking without losing context.

## v0.18.6-alpha (2025-12-21)

### Fixed
- **Settings Persistence:** Resolved a critical issue where media server settings were not saving correctly. Implemented database transactions to ensure configuration changes are atomic and prevent data loss.
- **Initial Setup Loop:** Fixed a bug where the application would get stuck in a redirect loop to the Setup Wizard. The mandatory setup is now strictly limited to admin account creation, with other steps being truly optional.
- **Plex Connection:** Improved the Plex Media Server configuration flow by removing auto-selection. Users can now manually select their preferred connection (e.g., local vs remote IP) to ensure connectivity in complex network environments (Docker/Host).

## v0.18.5-alpha (2025-12-21)

### Changed
- **Plex Connection:** Enhanced Plex connection testing to prioritize remote HTTPS connections for better Docker compatibility.
- **UI:** Added visual indicators for recommended connections in the manual server selection list.

### Fixed
- **System Health:** Fixed an invalid query in the `/health` endpoint that caused false negative health checks.
- **Logs:** Corrected a SQL JOIN issue in the `/logs` endpoint that prevented classification history from displaying correctly.

## v0.18.4-alpha (2025-12-21)

### Changed
- **Authentication:** Removed email requirement for admin accounts. Authentication is now strictly username-based.
- **Setup:** Simplified the initial account creation form to only require username and password.

### Infrastructure
- **Database:** Added migration `011_make_email_optional.sql` to remove the email column from the `users` table.

---

## v0.18.3-alpha (2025-12-21)

### Added
- **Plex Auth:** Improved error messaging for Plex authentication failures.
- **API:** Added request interceptor to automatically inject authorization headers, fixing 401 errors.

### Fixed
- **Discord Bot:** Fixed an issue where the bot would attempt to fetch channels before the client was ready.

## v0.18.2-alpha
- Initial alpha release with core functionality.
