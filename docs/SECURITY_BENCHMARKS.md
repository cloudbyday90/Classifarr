# Classifarr Security Benchmarks

- **Version:** 1.6.0
- **Last Updated:** 2026-02-25
- **Scope:** All Classifarr components (API, Container, Dependencies)

---

## Overview

This document maps Classifarr's security posture against industry-standard benchmarks. Each section includes:

- **Benchmark requirements** from authoritative sources
- **Classifarr implementation** with code references
- **Compliance status** and remediation steps for gaps

### Benchmark Sources

| Source | Version | Focus | Depth |
|--------|---------|-------|-------|
| CIS Docker Benchmark | v1.6.0 | Container security | Full |
| OWASP API Security Top 10 | 2023 | API-specific risks | Full |
| OWASP REST Security Cheat Sheet | Latest | REST best practices | Full |
| SANS/CWE Top 25 | 2024 | Common software errors | Summary |
| Node.js Security Best Practices | Latest | Backend security | Summary |
| NIST Cybersecurity Framework | 2.0 | Security program | Summary |

---

## Compliance Summary Dashboard

### Overall Status

| Category | Compliant | Partial | Non-Compliant | Score |
|----------|-----------|---------|---------------|-------|
| CIS Docker Benchmark | 37 | 10 | 0 | 79% |
| OWASP API Security Top 10 | 10 | 0 | 0 | 100% |
| OWASP REST Security | 15 | 0 | 0 | 100% |
| SANS/CWE Top 25 | 14 | 0 | 0 | 100% |
| Node.js Security | 21 | 0 | 0 | 100% |
| NIST CSF | 16 | 2 | 0 | 89% |

### Critical Gaps

| Gap | Benchmark | Priority | Status |
|-----|-----------|----------|--------|
| Container runs as root initially | CIS 5.30 | Medium | Acknowledged (privileges dropped) |
| ~~setuid/setgid binaries not removed~~ | CIS 4.8 | Medium | ✅ Fixed |

---

## CIS Docker Benchmark (Full)

**Source:** https://www.cisecurity.org/benchmark/docker

### 1. Host Configuration

#### 1.1 Ensure a separate partition for containers has been created

**Requirement:** Containers should run on a separate partition to prevent resource exhaustion attacks on the host.

**Classifarr Implementation:** Host-level configuration. User responsibility during deployment.

**Status:** ⚠️ N/A (User responsibility)

**Notes:** Document in deployment guide recommending separate partition/LVM for `/var/lib/docker`.

---

#### 1.2 Ensure the container host has been hardened

**Requirement:** Host OS should be minimal and hardened for container workloads.

**Classifarr Implementation:** Uses Alpine Linux (minimal attack surface) in container. Host hardening is user responsibility.

**Status:** ⚠️ Partial

**Notes:** Container uses minimal base image. Host hardening guide recommended in docs.

---

### 2. Docker Daemon Configuration

#### 2.1 Ensure network traffic is restricted between containers on the default bridge

**Requirement:** Containers on default bridge should not communicate by default.

**Classifarr Implementation:** Uses custom network `classifarr_internal` instead of default bridge.

**Code Reference:** `docker-compose.yml:42-47`
```yaml
networks:
  classifarr_internal:
    name: classifarr_internal
```

**Status:** ✅ Compliant

---

#### 2.2 Ensure the logging level is set to 'info'

**Requirement:** Docker daemon logging should be set appropriately.

**Classifarr Implementation:** Uses default 'info' level. Application logs structured via Winston.

**Code Reference:** `server/src/utils/logger.js`

**Status:** ✅ Compliant

---

#### 2.3 Ensure Docker is allowed to make changes to iptables

**Requirement:** Docker should manage iptables for network isolation.

**Classifarr Implementation:** Default Docker behavior (user responsibility).

**Status:** ✅ Compliant

---

#### 2.4 Ensure insecure registries are not used

**Requirement:** Only trusted registries should be used.

**Classifarr Implementation:** Uses `ghcr.io` (GitHub Container Registry) only.

**Code Reference:** `docker-compose.yml:6`
```yaml
image: ghcr.io/cloudbyday90/classifarr:latest
```

**Status:** ✅ Compliant

---

#### 2.5 Ensure aufs storage driver is not used

**Requirement:** Avoid aufs due to security concerns.

**Classifarr Implementation:** Alpine uses overlay2 by default.

**Status:** ✅ Compliant

---

#### 2.6 Ensure TLS authentication for Docker daemon is configured

**Requirement:** Docker daemon should use TLS for remote access.

**Classifarr Implementation:** Local Docker socket only (no remote daemon access).

**Status:** ✅ Compliant

---

#### 2.7 Ensure the default ulimit is configured appropriately

**Requirement:** Set appropriate ulimits for containers.

**Classifarr Implementation:** Uses defaults. Ulimits can be set via docker-compose if needed.

**Status:** ⚠️ Partial

**Remediation:** Add ulimits to docker-compose if file descriptor limits needed.

---

### 3. Docker Daemon Configuration Files

#### 3.1 Ensure that the docker.service file ownership is set to root:root

**Requirement:** Docker service file should be owned by root.

**Classifarr Implementation:** Host-level configuration. User responsibility.

**Status:** ⚠️ N/A (User responsibility)

---

#### 3.2 Ensure that docker.service file permissions are set to 644 or more restrictive

**Requirement:** Docker service file should not be world-writable.

**Classifarr Implementation:** Host-level configuration. User responsibility.

**Status:** ⚠️ N/A (User responsibility)

---

### 4. Container Images and Build File

#### 4.1 Ensure a user for the container has been created

**Requirement:** Containers should run as non-root user.

**Classifarr Implementation:** 
- Creates `classifarr` user (UID 1000, GID 1000)
- Entrypoint drops privileges before running app
- docker-compose specifies `user: "1000:1000"`

**Code Reference:** `Dockerfile:116-121`
```dockerfile
RUN addgroup -g 1000 classifarr && \
    adduser -u 1000 -G classifarr -s /bin/sh -D classifarr
```

**Code Reference:** `docker-compose.yml:9`
```yaml
user: "1000:1000"
```

**Status:** ✅ Compliant

---

#### 4.2 Ensure that containers use trusted base images

**Requirement:** Use only verified base images from trusted sources.

**Classifarr Implementation:** Uses official `node:24.11.0-alpine` from Docker Hub.

**Code Reference:** `Dockerfile:7-8`
```dockerfile
FROM node:24.11.0-alpine AS frontend-builder
```

**Status:** ✅ Compliant

---

#### 4.3 Ensure unnecessary packages are not installed in the container

**Requirement:** Minimize installed packages to reduce attack surface.

**Classifarr Implementation:** 
- Uses Alpine Linux (minimal packages)
- Multi-stage build discards build dependencies
- Only runtime essentials in final image

**Code Reference:** `Dockerfile:63-73, 77-114`

**Status:** ✅ Compliant

---

#### 4.4 Ensure images are scanned and rebuilt to include security patches

**Requirement:** Regularly scan images for vulnerabilities.

**Classifarr Implementation:** 
- Dependabot for npm dependencies
- `npm audit` in CI pipeline
- Trivy vulnerability scanning enforced in CI (`.github/workflows/trivy.yml`)

**Code Reference:** `.github/dependabot.yml`, `.github/workflows/trivy.yml`, `.github/workflows/osv-scanner.yml`

**Status:** ✅ Compliant

---

#### 4.5 Ensure Content Trust for Docker is enabled

**Requirement:** Verify image integrity via Docker Content Trust.

**Classifarr Implementation:** Not enabled by default. Operators can enable via `DOCKER_CONTENT_TRUST=1`.

**Status:** ⚠️ Partial

**Remediation:** Document Docker Content Trust in deployment guides.

**Documentation Reference:** `README.md` (Quick Start production security notes)

---

#### 4.6 Ensure HEALTHCHECK instructions have been added to the container image

**Requirement:** Container should have health check defined.

**Classifarr Implementation:** Health check defined in both Dockerfile and docker-compose.

**Code Reference:** `Dockerfile:156-158`
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:21324/health || exit 1
```

**Code Reference:** `docker-compose.yml:36-41`

**Status:** ✅ Compliant

---

#### 4.7 Ensure update instructions are not used alone in the Dockerfile

**Requirement:** Don't use `apt-get upgrade` or similar; use specific versions.

**Classifarr Implementation:** Uses specific package versions and `apk add --no-cache` without upgrade.

**Status:** ✅ Compliant

---

#### 4.8 Ensure setuid and setgid permissions are removed in the images

**Requirement:** Remove setuid/setgid binaries to prevent privilege escalation.

**Classifarr Implementation:** setuid/setgid binaries removed during image build.

**Code Reference:** `Dockerfile:116-117`
```dockerfile
# Remove setuid/setgid binaries for security (CIS Docker Benchmark 4.8)
RUN find / -perm /6000 -type f -exec chmod a-s {} \; 2>/dev/null || true
```

**Status:** ✅ Compliant

---

### 5. Container Runtime

#### 5.1 Ensure apparmor profile is enabled if applicable

**Requirement:** Use AppArmor or SELinux for mandatory access control.

**Classifarr Implementation:** Not explicitly configured. Depends on host configuration.

**Status:** ⚠️ Partial

**Remediation:** Add `--security-opt apparmor=docker-default` or custom profile.

---

#### 5.2 Ensure SELinux security options are set if applicable

**Requirement:** Use SELinux if available on host.

**Classifarr Implementation:** Not configured. Host-dependent.

**Status:** ⚠️ N/A (Host-dependent)

---

#### 5.3 Ensure Linux Kernel capabilities are restricted

**Requirement:** Drop all unnecessary kernel capabilities.

**Classifarr Implementation:** Drops all capabilities and adds back only essentials (CHOWN, SETUID, SETGID).

**Code Reference:** `docker-compose.yml:40-45`

**Status:** ✅ Compliant

---

#### 5.4 Ensure privileged containers are not used

**Requirement:** Containers should not run with `--privileged` flag.

**Classifarr Implementation:** No `privileged: true` in docker-compose.

**Status:** ✅ Compliant

---

#### 5.5 Ensure sensitive host system directories are not mounted

**Requirement:** Don't mount `/`, `/etc`, `/usr`, etc. into containers.

**Classifarr Implementation:** Only mounts:
- `./data:/app/data` (application data)
- Optional media paths for re-classification

**Code Reference:** `docker-compose.yml:16-31`

**Status:** ✅ Compliant

---

#### 5.6 Ensure ssh is not run within containers

**Requirement:** No SSH daemon in containers.

**Classifarr Implementation:** No SSH installed in image.

**Status:** ✅ Compliant

---

#### 5.7 Ensure privileged ports are not mapped within containers

**Requirement:** Only map ports > 1024.

**Classifarr Implementation:** Uses port 21324 (non-privileged).

**Code Reference:** `docker-compose.yml:10-11`
```yaml
ports:
  - "21324:21324"
```

**Status:** ✅ Compliant

---

#### 5.8 Ensure only needed ports are open on the container

**Requirement:** Expose only required ports.

**Classifarr Implementation:** Only port 21324 exposed.

**Status:** ✅ Compliant

---

#### 5.9 Ensure the host's network namespace is not shared

**Requirement:** Don't use `--network host`.

**Classifarr Implementation:** Uses custom bridge network, not host networking.

**Status:** ✅ Compliant

---

#### 5.10 Ensure memory usage for container is limited

**Requirement:** Set memory limits to prevent DoS.

**Classifarr Implementation:** Memory limit set to 2G in docker-compose.

**Code Reference:** `docker-compose.yml:46-49`

**Status:** ✅ Compliant

---

#### 5.11 Ensure CPU priority is set appropriately

**Requirement:** Set CPU shares/priority.

**Classifarr Implementation:** Not configured.

**Status:** ⚠️ Partial

**Remediation:** Add `cpu_shares` in docker-compose if needed.

---

#### 5.12 Ensure the container's root filesystem is mounted as read only

**Requirement:** Mount root filesystem as read-only.

**Classifarr Implementation:** Root filesystem mounted read-only. Tmpfs used for writable paths.

**Code Reference:** `docker-compose.yml:36-39`

**Status:** ✅ Compliant

---

#### 5.13 Ensure incoming container traffic is bound to a specific host interface

**Requirement:** Bind to specific interface, not 0.0.0.0.

**Classifarr Implementation:** Binds to all interfaces (0.0.0.0) by default.

**Status:** ⚠️ Partial

**Remediation:** Document binding to specific IP:
```yaml
ports:
  - "127.0.0.1:21324:21324"
```

**Documentation Reference:** `README.md` (Quick Start production security notes)

---

#### 5.14 Ensure 'on-failure' container restart policy is being used

**Requirement:** Use appropriate restart policy.

**Classifarr Implementation:** Uses `unless-stopped` restart policy.

**Code Reference:** `docker-compose.yml:33`
```yaml
restart: unless-stopped
```

**Status:** ✅ Compliant

---

#### 5.15 Ensure the host's process namespace is not shared

**Requirement:** Don't share host PID namespace.

**Classifarr Implementation:** Not configured (default is not shared).

**Status:** ✅ Compliant

---

#### 5.16 Ensure the host's IPC namespace is not shared

**Requirement:** Don't share host IPC namespace.

**Classifarr Implementation:** Not configured (default is not shared).

**Status:** ✅ Compliant

---

#### 5.17 Ensure host devices are not directly exposed to containers

**Requirement:** Don't expose host devices unless necessary.

**Classifarr Implementation:** No host devices exposed.

**Status:** ✅ Compliant

---

#### 5.18 Ensure the default ulimit is configured appropriately at runtime

**Requirement:** Set ulimits for containers.

**Classifarr Implementation:** Uses defaults.

**Status:** ⚠️ Partial

**Remediation:** Add ulimits if needed for file descriptors.

---

#### 5.19 Ensure mount propagation mode is not set to shared

**Requirement:** Don't use shared mount propagation.

**Classifarr Implementation:** Uses default (slave/private).

**Status:** ✅ Compliant

---

#### 5.20 Ensure the host's UTS namespace is not shared

**Requirement:** Don't share host UTS namespace.

**Classifarr Implementation:** Not configured (default is not shared).

**Status:** ✅ Compliant

---

#### 5.21 Ensure the default seccomp profile is not disabled

**Requirement:** Use seccomp for syscall filtering.

**Classifarr Implementation:** Uses default seccomp profile.

**Status:** ✅ Compliant

---

#### 5.22 Ensure docker exec commands are not used with privileged option

**Requirement:** Don't use `--privileged` with docker exec.

**Classifarr Implementation:** Operational practice. No exec in automation.

**Status:** ✅ Compliant

---

#### 5.23 Ensure docker exec commands are not used with user option

**Requirement:** Be careful with user option in exec.

**Classifarr Implementation:** Operational practice.

**Status:** ✅ Compliant

---

#### 5.24 Ensure cgroup usage is confirmed

**Requirement:** Don't use `--cgroup-parent` unless needed.

**Classifarr Implementation:** Uses default cgroup.

**Status:** ✅ Compliant

---

#### 5.25 Ensure container is restricted from acquiring additional privileges

**Requirement:** Use `--security-opt=no-new-privileges`.

**Classifarr Implementation:** Configured in docker-compose.

**Code Reference:** `docker-compose.yml:34-35`

**Status:** ✅ Compliant

---

#### 5.26 Ensure container health is checked at runtime

**Requirement:** Monitor container health.

**Classifarr Implementation:** Health check configured in both Dockerfile and docker-compose.

**Status:** ✅ Compliant

---

#### 5.27 Ensure docker commands always get the latest version of the image

**Requirement:** Use specific image versions or `--pull always`.

**Classifarr Implementation:** Uses `:latest` tag. Should document using specific versions for production.

**Status:** ⚠️ Partial

**Remediation:** Document pinning to specific version:
```yaml
image: ghcr.io/cloudbyday90/classifarr:v1.2.3
```

**Documentation Reference:** `README.md` (Quick Start production security notes)

---

#### 5.28 Ensure pid cgroup limit is used

**Requirement:** Limit PIDs to prevent fork bombs.

**Classifarr Implementation:** Not configured.

**Status:** ⚠️ Partial

**Remediation:** Add `pids_limit` if needed.

---

#### 5.29 Ensure Docker's secret management capabilities are used for managing secrets

**Requirement:** Use Docker secrets, not environment variables for secrets.

**Classifarr Implementation:** Uses environment variables for config. Secrets stored in database.

**Status:** ⚠️ Partial

**Notes:** API keys and credentials stored encrypted in database. Docker secrets could be used for JWT_SECRET.

---

#### 5.30 Ensure container is started with least privileges

**Requirement:** Containers should start with minimal privileges.

**Classifarr Implementation:** 
- Container starts as root (for PUID/PGID setup)
- Privileges dropped via `su-exec` before app runs
- App runs as `classifarr` user (UID 1000)

**Code Reference:** `docker-entrypoint.sh`

**Status:** ⚠️ Acknowledged

**Notes:** Root required for dynamic user/group creation (NAS compatibility). Privileges dropped before Node.js runs.

---

### 6. Docker Security Operations

#### 6.1 Ensure image vulnerability scanning is performed

**Requirement:** Scan images for vulnerabilities.

**Classifarr Implementation:** 
- `npm audit` in CI
- Dependabot enabled
- Trivy filesystem vulnerability scan in CI (`.github/workflows/trivy.yml`)
- OSV dependency scanning workflow (`.github/workflows/osv-scanner.yml`)
- Gitleaks secret scan workflow (`.github/workflows/gitleaks.yml`)

**Status:** ✅ Compliant

---

#### 6.2 Ensure containers are restarted automatically

**Requirement:** Use restart policy.

**Classifarr Implementation:** `restart: unless-stopped` configured.

**Status:** ✅ Compliant

---

### 7. Docker Swarm Configuration

*Not applicable - Classifarr does not use Docker Swarm.*

---

## OWASP API Security Top 10 (2023) (Full)

**Source:** https://owasp.org/API-Security/editions/2023/en/0x11-t10/

### API1:2023 - Broken Object Level Authorization

**Requirement:** API endpoints should verify the user has permission to access the requested object.

**Classifarr Implementation:**
- All routes require authentication (`authenticateToken` middleware)
- Admin routes require `requireAdmin` middleware
- User-specific operations validate `req.user.id`

**Code Reference:** `server/src/middleware/auth.js`

**Status:** ✅ Compliant

---

### API2:2023 - Broken Authentication

**Requirement:** Implement proper authentication mechanisms.

**Classifarr Implementation:**
- bcrypt password hashing (12 rounds)
- JWT tokens stored in httpOnly cookies
- Refresh token rotation
- Rate limiting on auth endpoints
- Strong password policy enforced

**Code Reference:** 
- `server/src/services/auth.js`
- `server/src/middleware/auth.js`
- `server/src/routes/auth.js`

**Status:** ✅ Compliant

---

### API3:2023 - Broken Object Property Level Authorization

**Requirement:** Prevent unauthorized access to object properties.

**Classifarr Implementation:**
- API responses filter sensitive fields
- API keys masked in responses (`server/src/utils/tokenMasking.js`)
- Webhook secrets encrypted and shown once

**Code Reference:** `server/src/utils/tokenMasking.js`

**Status:** ✅ Compliant

---

### API4:2023 - Unrestricted Resource Consumption

**Requirement:** Limit resource consumption to prevent DoS.

**Classifarr Implementation:**
- Rate limiting on sensitive endpoints
- Pagination on list endpoints
- Query result limits
- Docker memory limits (2G) configured

**Code Reference:** 
- `server/src/routes/auth.js` (rate limiting)
- `docker-compose.yml:47-50` (memory limits)

**Status:** ✅ Compliant

---

### API5:2023 - Broken Function Level Authorization

**Requirement:** Deny by default; validate authorization at route level.

**Classifarr Implementation:**
- All routes require authentication by default
- Admin-only routes protected with `requireAdmin`
- Two-tier auth strategy (Admin vs User)
- No anonymous access to protected resources

**Code Reference:** `server/src/routes/api.js:72-97`

**Status:** ✅ Compliant

---

### API6:2023 - Unrestricted Access to Sensitive Business Flows

**Requirement:** Protect business-critical API flows.

**Classifarr Implementation:**
- Reclassification (media moves) requires admin
- Rate limiting on classification endpoints
- Audit logging for sensitive operations

**Code Reference:** `server/src/routes/api.js:76`

**Status:** ✅ Compliant

---

### API7:2023 - Server Side Request Forgery

**Requirement:** Validate and sanitize URLs; don't allow arbitrary requests.

**Classifarr Implementation:**
- External URLs (Radarr, Sonarr, Plex) validated
- No user-controlled URL fetching
- Webhook URLs validated

**Code Reference:** `server/src/services/radarr.js`, `server/src/services/sonarr.js`

**Status:** ✅ Compliant

---

### API8:2023 - Security Misconfiguration

**Requirement:** Secure configuration at all levels.

**Classifarr Implementation:**
- CSP enabled
- CORS configurable
- Error messages sanitized in production
- Debug endpoints gated with NODE_ENV
- No default credentials

**Code Reference:** `server/src/index.js` (CSP, CORS)

**Status:** ✅ Compliant

---

### API9:2023 - Improper Inventory Management

**Requirement:** Maintain API inventory; deprecate old versions.

**Classifarr Implementation:**
- API version in responses (`version: '1.0.0'`)
- Deprecated routes documented and removed
- API discovery endpoint

**Code Reference:** `server/src/routes/api.js:100-126`

**Status:** ✅ Compliant

---

### API10:2023 - Unsafe Consumption of APIs

**Requirement:** Validate third-party API responses.

**Classifarr Implementation:**
- External API responses validated
- Circuit breaker pattern for external services
- Error handling for malformed responses

**Code Reference:** `server/src/services/circuitBreaker.js`

**Status:** ✅ Compliant

---

## OWASP REST Security Cheat Sheet (Full)

**Source:** https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html

### 1. Access Control

#### 1.1 Authentication

**Requirement:** Use strong authentication mechanisms.

**Classifarr Implementation:**
- JWT-based authentication
- httpOnly cookies (not localStorage)
- Refresh token rotation
- Rate limiting on login

**Status:** ✅ Compliant

---

#### 1.2 Authorization

**Requirement:** Implement proper authorization checks.

**Classifarr Implementation:**
- Route-level authorization middleware
- Admin role separation
- API key permissions (read_only, read_write, webhook_only, admin)

**Status:** ✅ Compliant

---

#### 1.3 Principle of Least Privilege

**Requirement:** Grant minimum necessary permissions.

**Classifarr Implementation:**
- API keys have specific permission levels
- Admin routes require explicit admin role
- Users cannot access other users' data

**Status:** ✅ Compliant

---

### 2. Input Validation

#### 2.1 Validate All Input

**Requirement:** Validate all input data.

**Classifarr Implementation:**
- Request body validation on all endpoints
- Parameterized SQL queries (no injection)
- Path traversal protection
- Integer validation with bounds checking

**Status:** ✅ Compliant

---

#### 2.2 Sanitize Output

**Requirement:** Sanitize data before output.

**Classifarr Implementation:**
- API keys masked in responses
- Sensitive fields excluded
- XSS protection via CSP

**Status:** ✅ Compliant

---

### 3. Transport Security

#### 3.1 Use HTTPS

**Requirement:** All communications over HTTPS.

**Classifarr Implementation:**
- Application designed for reverse proxy (Traefik, Caddy, nginx)
- HTTPS is recommended for production; local/LAN HTTP deployments remain supported via configuration (`FORCE_SECURE_COOKIES=false`)

**Status:** ✅ Compliant

---

#### 3.2 HSTS

**Requirement:** Enable HTTP Strict Transport Security.

**Classifarr Implementation:** Handled by reverse proxy.

**Status:** ✅ Compliant (Reverse proxy responsibility)

---

### 4. Content Security

#### 4.1 Content Security Policy

**Requirement:** Implement CSP headers.

**Classifarr Implementation:**
```javascript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:", "blob:"],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
    frameAncestors: ["'none'"],
  },
}
```

**Code Reference:** `server/src/index.js`

**Status:** ✅ Compliant

---

#### 4.2 CORS

**Requirement:** Configure CORS appropriately.

**Classifarr Implementation:**
- CORS configurable via `CORS_ORIGIN` env var
- Credentials allowed
- Warning in production if not configured

**Code Reference:** `server/src/index.js`

**Status:** ✅ Compliant

---

### 5. Error Handling

#### 5.1 Don't Expose Stack Traces

**Requirement:** Hide internal error details from users.

**Classifarr Implementation:**
- Stack traces hidden in production
- Generic error messages returned
- Detailed errors logged server-side only

**Code Reference:** `server/src/middleware/errorHandler.js`

**Status:** ✅ Compliant

---

#### 5.2 Use Appropriate Status Codes

**Requirement:** Return correct HTTP status codes.

**Classifarr Implementation:**
- 200 for success
- 201 for created
- 400 for bad request
- 401 for unauthorized
- 403 for forbidden
- 404 for not found
- 500 for server errors

**Status:** ✅ Compliant

---

### 6. Rate Limiting

#### 6.1 Implement Rate Limiting

**Requirement:** Rate limit to prevent abuse.

**Classifarr Implementation:**
- Login: 5 attempts per 15 minutes
- Password change: 3 attempts per hour
- Setup: 10 attempts per hour
- API: Configurable limits

**Code Reference:** `server/src/middleware/rateLimiter.js`

**Status:** ✅ Compliant

---

### 7. Logging and Monitoring

#### 7.1 Log Security Events

**Requirement:** Log authentication and authorization events.

**Classifarr Implementation:**
- Login attempts logged
- API key usage audited
- Backup operations logged
- Classification operations logged

**Code Reference:** `server/src/utils/logger.js`

**Status:** ✅ Compliant

---

### 8. Data Protection

#### 8.1 Encrypt Sensitive Data at Rest

**Requirement:** Encrypt sensitive data in database.

**Classifarr Implementation:**
- API keys encrypted with AES-256-GCM
- Webhook secrets encrypted
- Passwords hashed with bcrypt

**Code Reference:** `server/src/utils/encryption.js`

**Status:** ✅ Compliant

---

#### 8.2 Don't Expose Sensitive Data in Logs

**Requirement:** Don't log passwords, tokens, keys.

**Classifarr Implementation:**
- Tokens masked in logs
- Passwords never logged
- API keys not logged after creation

**Status:** ✅ Compliant

---

## SANS/CWE Top 25 (Summary)

**Source:** https://www.sans.org/top25-software-errors/

### Coverage Summary

| CWE | Name | Classifarr Protection | Status |
|-----|------|----------------------|--------|
| CWE-79 | Cross-site Scripting | CSP enabled, input validation | ✅ |
| CWE-89 | SQL Injection | Parameterized queries | ✅ |
| CWE-20 | Improper Input Validation | Request validation on all endpoints | ✅ |
| CWE-125 | Buffer Over-read | Node.js memory-safe | ✅ |
| CWE-78 | OS Command Injection | No shell commands with user input | ✅ |
| CWE-306 | Missing Authentication | All routes authenticated | ✅ |
| CWE-862 | Missing Authorization | Route-level auth middleware | ✅ |
| CWE-200 | Information Exposure | Error messages sanitized | ✅ |
| CWE-352 | CSRF | SameSite cookies + double-submit CSRF token (`classifarr_csrf_token` + `X-CSRF-Token`) | ✅ |
| CWE-22 | Path Traversal | Path validation in backup routes | ✅ |
| CWE-434 | Unrestricted File Upload | No file upload feature | ✅ |
| CWE-502 | Deserialization | No unsafe deserialization | ✅ |
| CWE-190 | Integer Overflow | JavaScript number handling | ✅ |
| CWE-287 | Improper Authentication | JWT + bcrypt implementation | ✅ |

**Overall Status:** ✅ All applicable CWEs addressed

---

## Node.js Security Best Practices (Summary)

**Source:** https://github.com/goldbergyoni/nodebestpractices#6-implementing-security-best-practices

### 6.1 Security Best Practices

| Practice | Implementation | Status |
|----------|---------------|--------|
| Use Helmet | Helmet 8.x with CSP | ✅ |
| Rate limiting | express-rate-limit | ✅ |
| Input validation | Manual validation + parameterized queries | ✅ |
| Output sanitization | Token masking, field filtering | ✅ |
| Secure headers | CSP, CORS, X-Frame-Options | ✅ |
| Error handling | Centralized error handler | ✅ |
| Dependency auditing | npm audit in CI, Dependabot | ✅ |
| Secret management | .env files, database encryption | ✅ |
| HTTPS enforcement | Reverse proxy | ✅ |
| Session security | httpOnly cookies, short expiry | ✅ |
| Logging | Winston structured logging | ✅ |
| Process management | tini init system | ✅ |

### 6.2 Express Security

| Practice | Implementation | Status |
|----------|---------------|--------|
| Disable x-powered-by | Helmet removes header | ✅ |
| Use stable Express | Express 5.x | ✅ |
| Limit request size | Body parser limits | ✅ |
| Handle errors | Error handler middleware | ✅ |

### 6.3 Authentication Best Practices

| Practice | Implementation | Status |
|----------|---------------|--------|
| Strong password hashing | bcrypt with 12 rounds | ✅ |
| Password policy | 8+ chars, upper, lower, number, special | ✅ |
| JWT in cookies | httpOnly, secure, SameSite | ✅ |
| Refresh tokens | Stored hashed in DB, rotated | ✅ |
| Rate limit auth | Login: 5/15min, Password: 3/hour | ✅ |

---

## NIST Cybersecurity Framework 2.0 (Summary)

**Source:** https://www.nist.gov/cyberframework

### GOVERN (GV)

| Function | Category | Classifarr Implementation | Status |
|----------|----------|--------------------------|--------|
| GV.OC | Organizational Context | Single-purpose app, defined scope | ✅ |
| GV.RM | Risk Management | Security review, dependency auditing | ✅ |
| GV.PO | Policy | Security policy/disclosure in SECURITY.md and SECURITY_REVIEW.md | ✅ |
| GV.SC | Supply Chain | Dependabot, npm audit | ✅ |

### IDENTIFY (ID)

| Function | Category | Classifarr Implementation | Status |
|----------|----------|--------------------------|--------|
| ID.AM | Asset Management | Docker image, database, config files | ✅ |
| ID.RA | Risk Assessment | Security review with 31 baseline findings + 2026-02-25 follow-up fixes | ✅ |
| ID.IM | Improvement | Ongoing security updates | ✅ |

### PROTECT (PR)

| Function | Category | Classifarr Implementation | Status |
|----------|----------|--------------------------|--------|
| PR.AA | Identity Management | JWT auth, API keys, roles | ✅ |
| PR.AT | Awareness | N/A (single developer) | N/A |
| PR.DS | Data Security | Encryption at rest, TLS, backups | ✅ |
| PR.PS | Platform Security | Docker hardening, Alpine | ✅ |
| PR.IR | Technology Infrastructure | Network isolation, health checks | ✅ |

### DETECT (DE)

| Function | Category | Classifarr Implementation | Status |
|----------|----------|--------------------------|--------|
| DE.CM | Continuous Monitoring | Health endpoints, logging | ✅ |
| DE.DP | Adverse Event Analysis | Error logging, structured logs | ✅ |

### RESPOND (RS)

| Function | Category | Classifarr Implementation | Status |
|----------|----------|--------------------------|--------|
| RS.MA | Incident Management | Manual process | ⚠️ |
| RS.AN | Incident Analysis | Log analysis | ✅ |
| RS.CO | Incident Communication | N/A | N/A |

### RECOVER (RC)

| Function | Category | Classifarr Implementation | Status |
|----------|----------|--------------------------|--------|
| RC.RP | Recovery Planning | Backup/restore functionality | ✅ |
| RC.CO | Incident Recovery | Database backups, Docker restart | ✅ |

---

## Compliance Action Items

### High Priority

| Item | Benchmark | Effort | Status |
|------|-----------|--------|--------|
| ~~Add `no-new-privileges`~~ | CIS 5.25 | Low | ✅ Fixed |
| ~~Add memory limits~~ | CIS 5.10 | Low | ✅ Fixed |
| ~~Remove setuid/setgid binaries~~ | CIS 4.8 | Low | ✅ Fixed |

### Medium Priority

| Item | Benchmark | Effort | Status |
|------|-----------|--------|--------|
| ~~Read-only root filesystem~~ | CIS 5.12 | Medium | ✅ Fixed |
| ~~Add capability restrictions~~ | CIS 5.3 | Medium | ✅ Fixed |
| Document Docker Content Trust | CIS 4.5 | Low | Documented |
| Bind to specific interface | CIS 5.13 | Low | Documented |
| Image version pinning | CIS 5.27 | Low | Documented |

### Low Priority

| Item | Benchmark | Effort | Status |
|------|-----------|--------|--------|
| Add ulimits to compose | CIS 2.7/5.18 | Low | Optional |
| Add cpu_shares | CIS 5.11 | Low | Optional |
| Add pids_limit | CIS 5.28 | Low | Optional |
| Add AppArmor profile | CIS 5.1 | Medium | Optional |
| Migrate to Docker secrets | CIS 5.29 | Medium | Optional |

---

## Verification Commands

Run these from repo root when re-validating benchmark claims:

```bash
# Dependency risk checks
npm --prefix server audit --omit=dev
npm --prefix client audit --omit=dev

# Security linting (server code)
npm --prefix server run lint:security

# Test lint policy conformance
npm --prefix server run lint:tests

# Render effective compose config
docker compose config
```

---

## Related Documents

- **SECURITY_REVIEW.md** - Complete security audit findings
- **SECURITY.md** - Vulnerability disclosure and reporting policy
- **security-fixes/CRITICAL-AUTH-BYPASS-FIX.md** - Authentication fix documentation
- **security-fixes/ROUTE-auth-audit.md** - Route authentication audit
- **.env.example** - Configuration reference
- **docker-compose.yml** - Container configuration

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-05 | 1.7.0 | Unreleased security hardening: (1) `check_ollama_config.js` and `logs.txt` removed from git tracking—`check_ollama_config.js` was a debug script doing `SELECT * FROM ollama_config` with `process.exit()`; (2) `db.healthCheck()` now returns a generic `'Database connection failed'` string in `NODE_ENV=production` instead of the raw pg `err.message` (which can contain internal host IPs/ports); `check_*.js` and `logs*.txt` patterns added to `.gitignore`. CWE-200 (Information Exposure) posture strengthened for future unauthenticated `/health` endpoint use. |
| 2026-02-25 | 1.6.0 | Aligned benchmark claims with current docs and deployment behavior: documented Docker Content Trust, interface binding, and image pinning guidance in README; updated NIST GV.PO to compliant with SECURITY.md coverage; clarified HTTPS wording for local HTTP compatibility; added verification command checklist |
| 2026-02-25 | 1.5.0 | Added enforced CI security gates for gitleaks and Trivy, integrated server SAST linting (`eslint-plugin-security`), and aligned benchmark scan language with implemented workflows |
| 2026-02-25 | 1.4.0 | Implemented CSRF middleware for cookie-authenticated write requests (double-submit cookie/header), restored CWE-352 compliance, and documented local HTTP compatibility via `FORCE_SECURE_COOKIES=false` |
| 2026-02-25 | 1.3.0 | Synced benchmark claims with implementation: corrected CWE-352 status (SameSite-only, no CSRF token middleware), updated SANS/CWE score to 93%, and aligned risk-assessment wording with post-review fixes |
| 2026-02-24 | 1.2.0 | Fixed CIS 4.8 (setuid/setgid removal) in Dockerfile; fixed tmpfs permissions for PostgreSQL; updated CIS score to 79% |
| 2026-02-24 | 1.1.0 | Verified all items against working tree; updated scores: CIS 74%→76%, OWASP API 90%→100%; identified CIS 4.8 as not implemented |
| 2026-02-24 | 1.0.0 | Initial recreation with CIS, OWASP, SANS, Node.js, NIST benchmarks |
