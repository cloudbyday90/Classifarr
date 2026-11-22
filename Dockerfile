# ===========================================
# CLASSIFARR DOCKERFILE
# Optimized for production with Alpine 3.24.4 + Node.js 24.22.3 LTS
# ===========================================

ARG NODE_VERSION=24.22.3
ARG ALPINE_VERSION=3.24
ARG ALPINE_RELEASE=3.24.4
# Multi-platform index, not an architecture-specific manifest. Update the tag,
# digest and expected release together after validating both shipped platforms.
ARG NODE_IMAGE_DIGEST=sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
# The production index's amd64 and arm64 children are the Node image's Alpine parents.
ARG ALPINE_IMAGE_DIGEST=sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf
ARG NPM_VERSION=12.2.2
# npm defaults to two registry fetch retries. A multi-architecture build has
# more independent registry reads, so retain `npm ci` integrity while allowing
# short-lived registry network failures to recover.
ARG NPM_FETCH_RETRIES=5

# Shared builder baseline. npm distributes npx, so both stay aligned.
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION}@${NODE_IMAGE_DIGEST} AS node-build-base
ARG NODE_VERSION
ARG ALPINE_RELEASE
ARG NPM_VERSION
RUN node --version && cat /etc/alpine-release \
  && test "$(node --version)" = "v${NODE_VERSION}" \
  && test "$(cat /etc/alpine-release)" = "${ALPINE_RELEASE}" \
  && apk add --no-cache zlib=1.4-r0 \
  && apk info --exists zlib=1.4-r0 \
  && npm install --global npm@${NPM_VERSION} \
  && npm --version && npx --version \
  && test "$(npm --version)" = "${NPM_VERSION}" \
  && test "$(npx --version)" = "${NPM_VERSION}"

# Stage 1: Frontend Builder
FROM node-build-base AS frontend-builder
ARG NPM_FETCH_RETRIES

WORKDIR /build/client

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files first for better caching
COPY client/package*.json client/.npmrc ./
COPY client/patches/ ./patches/
RUN npm ci --fetch-retries=${NPM_FETCH_RETRIES}

# Copy source and build
COPY client/ ./
RUN npm run build

# Stage 2: Backend Builder  
FROM node-build-base AS backend-builder
ARG NPM_FETCH_RETRIES

WORKDIR /build/server

# Install build dependencies for bcrypt and other native modules
RUN apk add --no-cache python3 make g++

# Copy package files first for better caching
COPY server/package*.json server/.npmrc ./
RUN npm ci --omit=dev --fetch-retries=${NPM_FETCH_RETRIES}

# Verify bcrypt's reviewed installer can select/build its Alpine musl binding.
RUN npm rebuild bcrypt

# Stage 3: Production Runtime
FROM alpine:${ALPINE_RELEASE}@${ALPINE_IMAGE_DIGEST} AS production
ARG NODE_VERSION
ARG ALPINE_RELEASE
ENV NODE_VERSION=${NODE_VERSION}
COPY --from=node-build-base /usr/local/bin/node /usr/local/bin/node
# Keep the release notice available on both platform builds. Update it with Node.
ADD --chmod=0644 --checksum=sha256:5888dbb9a1d2b18f2c3e6c5f6af1b39de658372b402a0577b002777f14c62ace \
    https://raw.githubusercontent.com/nodejs/node/e63cab040c09d43ceef8cb35508c40044614e906/LICENSE /usr/local/LICENSE
RUN apk add --no-cache libstdc++ libatomic zlib=1.4-r0 \
    && test "$(node --version)" = "v${NODE_VERSION}" \
    && test "$(cat /etc/alpine-release)" = "${ALPINE_RELEASE}" \
    && apk info --exists ca-certificates-bundle zlib=1.4-r0

# pgvector build mode:
# - multi (default): generic + AVX + AVX2 on x86_64; portable generic elsewhere
# - generic: build only non-AVX variant (widest CPU compatibility)
# - avx: build only AVX-optimized variant
# - avx2: build only AVX2-optimized variant
ARG PGVECTOR_BUILD=multi
ARG PGVECTOR_VERSION=0.8.7
ARG PGVECTOR_SHA256=cac0b10c360f05b2d521200105ba3697e773d4cd3731f5a915a7e37ebe0bea85
ARG VCS_REF=unknown
# Best practice for portability: OPTFLAGS="" (pgvector docs recommend this to avoid illegal instruction)
ARG PGVECTOR_GENERIC_OPTFLAGS=""
# AVX-optimized build (kept conservative to avoid AVX2-only requirements)
ARG PGVECTOR_AVX_OPTFLAGS="-mavx"
ARG PGVECTOR_AVX2_OPTFLAGS="-mavx2"
ENV CLASSIFARR_PGVECTOR_BUILD=$PGVECTOR_BUILD
ENV CLASSIFARR_BUILD_REVISION=$VCS_REF

# Labels for OCI compliance
LABEL org.opencontainers.image.title="Classifarr"
LABEL org.opencontainers.image.description="AI-powered media classification for the *arr ecosystem"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.revision="${VCS_REF}"
LABEL org.opencontainers.image.vendor="cloudbyday90"
LABEL org.opencontainers.image.source="https://github.com/cloudbyday90/Classifarr"
LABEL org.opencontainers.image.licenses="GPL-3.0"

# Install runtime dependencies including PostgreSQL 18.
# Also includes PostgreSQL 17 binaries for automatic in-place upgrades (pg_upgrade).
# Keep the runtime PostgreSQL packages separate from the dev headers/packages used
# to build pgvector: Alpine's pg_versions trigger manages /usr/bin/pg_config as a
# symlink for the selected server version, while libpq-dev installs a concrete
# binary there. Installing them together causes avoidable trigger warnings even
# though the image eventually works.
# Note: --no-cache is intentionally omitted here so the postgresql-common post-install
# trigger (pg_versions) can read the APK index without warnings. The cache is cleaned
# in the same RUN layer so nothing bleeds into the final image.
RUN apk add \
    tini \
    curl \
    tzdata \
    netcat-openbsd \
    postgresql17 \
    postgresql17-contrib \
    postgresql18 \
    postgresql18-contrib \
    su-exec \
    shadow \
    && rm -rf /var/cache/apk/*

# Build pgvector extension for both PostgreSQL 17 and 18.
# PG17 build is needed by pg_upgrade to verify binary compatibility of extensions.
# PG18 build is the production runtime.
# Install version-specific dev packages only after the runtime packages are settled
# so Alpine's pg_versions trigger can finish managing the default symlink cleanly.
RUN apk add --no-cache --virtual .pgvector-build-deps \
        make \
        gcc \
        musl-dev \
        postgresql17-dev \
        postgresql18-dev \
    && curl --fail --location --retry 3 --retry-delay 2 https://github.com/pgvector/pgvector/archive/refs/tags/v${PGVECTOR_VERSION}.tar.gz -o pgvector.tar.gz \
    && echo "${PGVECTOR_SHA256}  pgvector.tar.gz" | sha256sum -c - \
    && tar -xzf pgvector.tar.gz \
    && cd pgvector-${PGVECTOR_VERSION} \
    && case "$PGVECTOR_BUILD" in generic|avx|avx2|multi) ;; *) echo "Invalid PGVECTOR_BUILD" >&2; exit 1 ;; esac \
    && PGVECTOR_EFFECTIVE_BUILD="$PGVECTOR_BUILD" \
    && case "$(uname -m):$PGVECTOR_BUILD" in \
         x86_64:*|*:generic) ;; \
         *:multi) PGVECTOR_EFFECTIVE_BUILD=generic ;; \
         *) echo "AVX builds require x86_64" >&2; exit 1 ;; \
       esac \
    && PG17_CONFIG="/usr/libexec/postgresql17/pg_config" \
    && PG18_CONFIG="/usr/libexec/postgresql18/pg_config" \
    && PKGLIBDIR17="$($PG17_CONFIG --pkglibdir)" \
    && PKGLIBDIR18="$($PG18_CONFIG --pkglibdir)" \
    && echo "Building pgvector v${PGVECTOR_VERSION} for PostgreSQL 17..." \
    && (make clean PG_CONFIG=$PG17_CONFIG || true) \
    && make OPTFLAGS="$PGVECTOR_GENERIC_OPTFLAGS" PG_CONFIG=$PG17_CONFIG \
    && make install PG_CONFIG=$PG17_CONFIG \
    && echo "Building pgvector v${PGVECTOR_VERSION} for PostgreSQL 18..." \
    && if [ "$PGVECTOR_EFFECTIVE_BUILD" = "generic" ]; then \
        (make clean PG_CONFIG=$PG18_CONFIG || true) \
        && make OPTFLAGS="$PGVECTOR_GENERIC_OPTFLAGS" PG_CONFIG=$PG18_CONFIG \
        && make install PG_CONFIG=$PG18_CONFIG \
        && cp "$PKGLIBDIR18/vector.so" "$PKGLIBDIR18/vector_generic.so"; \
      elif [ "$PGVECTOR_EFFECTIVE_BUILD" = "avx" ]; then \
        (make clean PG_CONFIG=$PG18_CONFIG || true) \
        && make OPTFLAGS="$PGVECTOR_AVX_OPTFLAGS" PG_CONFIG=$PG18_CONFIG \
        && make install PG_CONFIG=$PG18_CONFIG \
        && cp "$PKGLIBDIR18/vector.so" "$PKGLIBDIR18/vector_avx.so"; \
      elif [ "$PGVECTOR_EFFECTIVE_BUILD" = "avx2" ]; then \
        (make clean PG_CONFIG=$PG18_CONFIG || true) \
        && make OPTFLAGS="$PGVECTOR_AVX2_OPTFLAGS" PG_CONFIG=$PG18_CONFIG \
        && make install PG_CONFIG=$PG18_CONFIG \
        && cp "$PKGLIBDIR18/vector.so" "$PKGLIBDIR18/vector_avx2.so"; \
      else \
        (make clean PG_CONFIG=$PG18_CONFIG || true) \
        && make OPTFLAGS="$PGVECTOR_GENERIC_OPTFLAGS" PG_CONFIG=$PG18_CONFIG \
        && make install PG_CONFIG=$PG18_CONFIG \
        && cp "$PKGLIBDIR18/vector.so" "$PKGLIBDIR18/vector_generic.so" \
        && (make clean PG_CONFIG=$PG18_CONFIG || true) \
        && make OPTFLAGS="$PGVECTOR_AVX_OPTFLAGS" PG_CONFIG=$PG18_CONFIG \
        && make install PG_CONFIG=$PG18_CONFIG \
        && cp "$PKGLIBDIR18/vector.so" "$PKGLIBDIR18/vector_avx.so" \
        && (make clean PG_CONFIG=$PG18_CONFIG || true) \
        && make OPTFLAGS="$PGVECTOR_AVX2_OPTFLAGS" PG_CONFIG=$PG18_CONFIG \
        && make install PG_CONFIG=$PG18_CONFIG \
        && cp "$PKGLIBDIR18/vector.so" "$PKGLIBDIR18/vector_avx2.so" \
        && cp -f "$PKGLIBDIR18/vector_generic.so" "$PKGLIBDIR18/vector.so"; \
      fi \
    && cd / && rm -rf pgvector-${PGVECTOR_VERSION} pgvector.tar.gz \
    && apk del --no-cache .pgvector-build-deps

# Remove setuid/setgid binaries for security (CIS Docker Benchmark 4.8)
# This reduces privilege escalation attack surface
RUN find / -perm /6000 -type f -exec chmod a-s {} \; 2>/dev/null || true

# Create non-root user for security
# Create the default application identity on the Alpine runtime base.
RUN addgroup -g 1000 classifarr && \
    adduser -u 1000 -G classifarr -s /bin/sh -D classifarr

# Extension binaries remain root-owned. Runtime selection uses the existing
# staging path or the packaged generic variant, never writable image binaries.

WORKDIR /app

# Copy built artifacts from builder stages
COPY --from=backend-builder --chown=root:root /build/server/node_modules ./node_modules
COPY --chown=root:root server/src ./src
COPY --chown=root:root server/package.json ./
COPY --from=frontend-builder --chown=root:root /build/client/dist ./public

# Copy database initialization files
COPY --chown=root:root database/ ./database/
COPY --chown=root:root scripts/lib ./scripts/lib

# Copy entrypoint script
COPY --chown=root:root docker-entrypoint.sh /app/
RUN chmod -R go-w /app && chmod +x /app/docker-entrypoint.sh

# Create directories for PostgreSQL data and runtime
RUN mkdir -p /app/data/postgres /run/postgresql && \
    chown -R classifarr:classifarr /app/data /run/postgresql && \
    test ! -e /usr/local/lib/node_modules && \
    ! command -v npm && ! command -v npx

# Environment variables
ENV NODE_ENV=production
ENV PORT=21324
ENV TZ=UTC
ENV PUID=1000
ENV PGID=1000
ENV UMASK=022

# Note: Container runs as root initially to allow dynamic user/group creation
# The entrypoint script will drop privileges to the configured PUID/PGID

# Expose port
EXPOSE 21324

# Health check
# start-period=120s: covers Postgres init, optional pg_upgrade, migrations, and Node bind
# on fresh installs, pg17→18 upgrades, and slow-I/O hosts. Interval/timeout/retries
# remain conservative; the app is either up cleanly or truly broken at that point.
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:21324/health || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/docker-entrypoint.sh"]
