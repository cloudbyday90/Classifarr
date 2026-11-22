# Production image package-manager outcome

November 22, 2026 Eastern. The
[approved design](production-image-package-manager-design.md) separates
the builder toolchain from the production image.

The two builders still inherit the pinned Node image and install npm/npx
12.2.2. Production starts from the matching Alpine base and copies the
exact Node binary. A checksum-pinned download supplies its release
notice for both architectures. The production image checks Node,
Alpine, the certificate bundle and zlib, and checks that the global
Node modules directory and npm/npx commands are absent.

GitHub listed zero open pull requests at intake.
