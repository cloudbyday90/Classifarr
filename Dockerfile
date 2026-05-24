# ===========================================
# CLASSIFARR DOCKERFILE
# Optimized for production with Alpine 3.23 + Node.js 24 LTS
# ===========================================

# Stage 1: Frontend Builder
FROM node:24.15.0-alpine3.23 AS frontend-builder

WORKDIR /build/client

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files first for better caching
COPY client/package*.json ./
RUN npm ci

# Copy source and build
COPY client/ ./
RUN npm run build

# Stage 2: Backend Builder  
FROM node:24.15.0-alpine3.23 AS backend-builder

WORKDIR /build/server

# Install build dependencies for bcrypt and other native modules
RUN apk add --no-cache python3 make g++

# Copy package files first for better caching
COPY server/package*.json ./
RUN npm ci --omit=dev

# Rebuild bcrypt for Alpine's musl libc
RUN npm rebuild bcrypt

# Stage 3: Production Runtime
FROM node:24.15.0-alpine3.23 AS production

# pgvector build mode:
# - multi (default): build generic + AVX + AVX2 variants, select at runtime
# - generic: build only non-AVX variant (widest CPU compatibility)
# - avx: build only AVX-optimized variant
# - avx2: build only AVX2-optimized variant
ARG PGVECTOR_BUILD=multi
# Best practice for portability: OPTFLAGS="" (pgvector docs recommend this to avoid illegal instruction)
ARG PGVECTOR_GENERIC_OPTFLAGS=""
# AVX-optimized build (kept conservative to avoid AVX2-only requirements)
ARG PGVECTOR_AVX_OPTFLAGS="-mavx"
ARG PGVECTOR_AVX2_OPTFLAGS="-mavx2"
ENV CLASSIFARR_PGVECTOR_BUILD=$PGVECTOR_BUILD

# Labels for OCI compliance
LABEL org.opencontainers.image.title="Classifarr"
LABEL org.opencontainers.image.description="AI-powered media classification for the *arr ecosystem"
LABEL org.opencontainers.image.version="1.0.0"
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
    && curl -L https://github.com/pgvector/pgvector/archive/refs/tags/v0.8.2.tar.gz -o pgvector.tar.gz \
    && tar -xzf pgvector.tar.gz \
    && cd pgvector-0.8.2 \
    && PG17_CONFIG="/usr/libexec/postgresql17/pg_config" \
    && PG18_CONFIG="/usr/libexec/postgresql18/pg_config" \
    && PKGLIBDIR17="$($PG17_CONFIG --pkglibdir)" \
    && PKGLIBDIR18="$($PG18_CONFIG --pkglibdir)" \
    && echo "Building pgvector v0.8.2 for PostgreSQL 17..." \
    && make clean PG_CONFIG=$PG17_CONFIG || true \
    && make OPTFLAGS="$PGVECTOR_GENERIC_OPTFLAGS" PG_CONFIG=$PG17_CONFIG \
    && make install PG_CONFIG=$PG17_CONFIG \
    && echo "Building pgvector v0.8.2 for PostgreSQL 18..." \
    && if [ "$PGVECTOR_BUILD" = "generic" ]; then \
        make clean PG_CONFIG=$PG18_CONFIG || true; \
        make OPTFLAGS="$PGVECTOR_GENERIC_OPTFLAGS" PG_CONFIG=$PG18_CONFIG; \
        make install PG_CONFIG=$PG18_CONFIG; \
        cp "$PKGLIBDIR18/vector.so" "$PKGLIBDIR18/vector_generic.so"; \
      elif [ "$PGVECTOR_BUILD" = "avx" ]; then \
        make clean PG_CONFIG=$PG18_CONFIG || true; \
        make OPTFLAGS="$PGVECTOR_AVX_OPTFLAGS" PG_CONFIG=$PG18_CONFIG; \
        make install PG_CONFIG=$PG18_CONFIG; \
        cp "$PKGLIBDIR18/vector.so" "$PKGLIBDIR18/vector_avx.so"; \
      elif [ "$PGVECTOR_BUILD" = "avx2" ]; then \
        make clean PG_CONFIG=$PG18_CONFIG || true; \
        make OPTFLAGS="$PGVECTOR_AVX2_OPTFLAGS" PG_CONFIG=$PG18_CONFIG; \
        make install PG_CONFIG=$PG18_CONFIG; \
        cp "$PKGLIBDIR18/vector.so" "$PKGLIBDIR18/vector_avx2.so"; \
      else \
        make clean PG_CONFIG=$PG18_CONFIG || true; \
        make OPTFLAGS="$PGVECTOR_GENERIC_OPTFLAGS" PG_CONFIG=$PG18_CONFIG; \
        make install PG_CONFIG=$PG18_CONFIG; \
        cp "$PKGLIBDIR18/vector.so" "$PKGLIBDIR18/vector_generic.so"; \
        make clean PG_CONFIG=$PG18_CONFIG || true; \
        make OPTFLAGS="$PGVECTOR_AVX_OPTFLAGS" PG_CONFIG=$PG18_CONFIG; \
        make install PG_CONFIG=$PG18_CONFIG; \
        cp "$PKGLIBDIR18/vector.so" "$PKGLIBDIR18/vector_avx.so"; \
        make clean PG_CONFIG=$PG18_CONFIG || true; \
        make OPTFLAGS="$PGVECTOR_AVX2_OPTFLAGS" PG_CONFIG=$PG18_CONFIG; \
        make install PG_CONFIG=$PG18_CONFIG; \
        cp "$PKGLIBDIR18/vector.so" "$PKGLIBDIR18/vector_avx2.so"; \
        cp -f "$PKGLIBDIR18/vector_generic.so" "$PKGLIBDIR18/vector.so"; \
      fi \
    && cd / && rm -rf pgvector-0.8.2 pgvector.tar.gz \
    && apk del --no-cache .pgvector-build-deps

# Remove setuid/setgid binaries for security (CIS Docker Benchmark 4.8)
# This reduces privilege escalation attack surface
RUN find / -perm /6000 -type f -exec chmod a-s {} \; 2>/dev/null || true

# Create non-root user for security
# Remove existing node user (UID/GID 1000) from base image to avoid conflicts
RUN deluser --remove-home node 2>/dev/null || true && \
    delgroup node 2>/dev/null || true && \
    addgroup -g 1000 classifarr && \
    adduser -u 1000 -G classifarr -s /bin/sh -D classifarr

# Allow the non-root classifarr user to overwrite vector.so at runtime when
# the PostgreSQL library path is writable. Some runtimes mount /usr read-only,
# so the entrypoint also needs to tolerate keeping the preinstalled variant.
RUN PG18_CONFIG="/usr/libexec/postgresql18/pg_config" && \
    PKGLIBDIR="$(${PG18_CONFIG} --pkglibdir)" && \
    chown classifarr:classifarr "${PKGLIBDIR}"/vector*.so

WORKDIR /app

# Copy built artifacts from builder stages
COPY --from=backend-builder --chown=classifarr:classifarr /build/server/node_modules ./node_modules
COPY --chown=classifarr:classifarr server/src ./src
COPY --chown=classifarr:classifarr server/package.json ./
COPY --from=frontend-builder --chown=classifarr:classifarr /build/client/dist ./public

# Copy database initialization files
COPY --chown=classifarr:classifarr database/ ./database/
COPY --chown=classifarr:classifarr scripts/lib ./scripts/lib

# Copy entrypoint script
COPY --chown=classifarr:classifarr docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Create directories for PostgreSQL data and runtime
RUN mkdir -p /app/data/postgres /run/postgresql && \
    chown -R classifarr:classifarr /app/data /run/postgresql

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
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:21324/health || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/docker-entrypoint.sh"]
