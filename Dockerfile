# ===========================================
# CLASSIFARR DOCKERFILE
# Optimized for production with Alpine 3.23 + Node.js 24 LTS
# ===========================================

# Stage 1: Frontend Builder
FROM node:24-alpine AS frontend-builder

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
FROM node:24-alpine AS backend-builder

WORKDIR /build/server

# Install build dependencies for bcrypt and other native modules
RUN apk add --no-cache python3 make g++

# Copy package files first for better caching
COPY server/package*.json ./
RUN npm ci --only=production

# Rebuild bcrypt for Alpine's musl libc
RUN npm rebuild bcrypt --build-from-source

# Stage 3: Production Runtime
FROM node:24-alpine AS production

# Labels for OCI compliance
LABEL org.opencontainers.image.title="Classifarr"
LABEL org.opencontainers.image.description="AI-powered media classification for the *arr ecosystem"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="cloudbyday90"
LABEL org.opencontainers.image.source="https://github.com/cloudbyday90/Classifarr"
LABEL org.opencontainers.image.licenses="GPL-3.0"

# Install runtime dependencies including PostgreSQL
RUN apk add --no-cache \
    tini \
    curl \
    tzdata \
    netcat-openbsd \
    postgresql17 \
    postgresql17-contrib \
    su-exec \
    shadow \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
# Remove existing node user (UID/GID 1000) from base image to avoid conflicts
RUN deluser --remove-home node 2>/dev/null || true && \
    delgroup node 2>/dev/null || true && \
    addgroup -g 1000 classifarr && \
    adduser -u 1000 -G classifarr -s /bin/sh -D classifarr

WORKDIR /app

# Copy built artifacts from builder stages
COPY --from=backend-builder --chown=classifarr:classifarr /build/server/node_modules ./node_modules
COPY --chown=classifarr:classifarr server/src ./src
COPY --chown=classifarr:classifarr server/package.json ./
COPY --from=frontend-builder --chown=classifarr:classifarr /build/client/dist ./public

# Copy database initialization files
COPY --chown=classifarr:classifarr database/ ./database/

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
