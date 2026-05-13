# Classifarr Pre-Release Security Checklist

- **Source of truth:** [`docs/SECURITY_BENCHMARKS.md`](SECURITY_BENCHMARKS.md) (CIS, OWASP, SANS CWE Top 25, Node.js, NIST CSF 2.0)
- **Baseline review:** [`docs/SECURITY_REVIEW.md`](SECURITY_REVIEW.md) (31 findings, all remediated)
- **Version:** 1.0.0
- **Living document** — append new items as new risks are identified; do **not** delete old items

## How to Use

Work through every section before tagging a release. All automated gates (Section A) must produce clean output. All manual checks must be verified and initialled in the Sign-off block at the bottom. A failing check **blocks the release** unless noted as "acknowledged design decision."

Verification commands are written for the repository root unless otherwise noted.

---

## A. Automated Gates

All gates must be green before proceeding to manual checks.

### A1. Server dependency audit (Finding #9, #10)
```bash
npm --prefix server audit
```
**Pass:** exit 0, `found 0 vulnerabilities`

### A2. Client dependency audit (Finding #9, #10)
```bash
npm --prefix client audit
```
**Pass:** exit 0, `found 0 vulnerabilities`

### A3. Server test suite (all findings)
```bash
npm --prefix server test
```
**Pass:** all tests pass, no failures

### A4. Client test suite (all findings)
```bash
npm --prefix client test
```
**Pass:** all tests pass, no failures

### A5. Coverage ratchet gate (quality floor)
```bash
npm run coverage:ratchet:check
```
**Pass:** exit 0; if it fails, add tests — do not lower the ratchet unless the reduction is intentional and approved

### A6. Copyright headers (CONTRIBUTORS.md compliance)
```bash
npm run check-copyright
```
**Pass:** exit 0

### A7. ESLint security scan / SAST (Post-review 2026-02-25)
```bash
npm --prefix server run lint
npm --prefix client run lint
```
**Pass:** no `eslint-plugin-security` errors; warnings acceptable only if pre-existing

### A8. Full CI script (optional, catches anything missed above)
```bash
npm run test:ci
```
**Pass:** exit 0

---

## B. Route Authentication Audit

Verify `server/src/routes/api.js` has not regressed. Grep the file and confirm every route matches expected middleware.

```bash
grep "router.use(" server/src/routes/api.js
```

### B1 — Admin-only routes (authenticateToken + requireAdmin)

| Route | Expected middleware | Finding |
|---|---|---|
| `/media-server` | `authenticateToken, requireAdmin` | #3 |
| `/classification/progress` | `authenticateToken, requireAdmin` | #32 |
| `/classification` | `authenticateToken, requireAdmin` | #2 |
| `/settings` | `authenticateToken, requireAdmin` | #1 |
| `/reclassification` | `authenticateToken, requireAdmin` | #14 |
| `/policies` | `authenticateToken, requireAdmin` | #15 |
| `/mappings` | `authenticateToken, requireAdmin` | #16 |
| `/confidence` | `authenticateToken, requireAdmin` | #17 |
| `/rag` | `authenticateToken, requireAdmin` | #18 |
| `/patterns` | `authenticateToken, requireAdmin` | #19 |
| `/scheduler` | `authenticateToken, requireAdmin` | #20 |
| `/settings/path-mappings` | `authenticateToken, requireAdmin` | #21 |
| `/keys` | `authenticateToken, requireAdmin` | #22 |
| `/backup` | `authenticateToken, requireAdmin` | #23 |

**Pass:** all 14 routes include both `authenticateToken` and `requireAdmin` in the middleware chain; no route above is mounted without auth middleware.

### B2 — Tier 2 authenticated routes (authenticateToken only)

| Route | Expected middleware | Finding |
|---|---|---|
| `/clarifications` | `authenticateToken` | #24 |
| `/requests` | `authenticateToken` | #25 |
| `/feedback` | `authenticateToken` | #26 |
| `/prompts` | `authenticateToken` | #27 |
| `/presets` | `authenticateToken` | #28 |
| `/suggestions` | `authenticateToken` | #29 |
| `/migration` | `authenticateToken` | #30 |
| `/rating-normalization` | `authenticateToken` | #31 |
| `/sync` | `authenticateToken` | #31 |
| `/notifications` | `authenticateToken` | post-review |

**Pass:** all 10 routes include `authenticateToken`; none are mounted without auth middleware.

### B3 — Routes with own auth flows (cannot use standard middleware check)

| Route | Auth mechanism | Finding |
|---|---|---|
| `/webhook` | Internal HMAC `whsec_` secret; constant-time compare | #4 |
| `/plex` | Plex OAuth flow (`authenticateToken` inside handler) | baseline |
| `/jellyfin` | Jellyfin auth flow (`authenticateToken` inside handler) | baseline |
| `/emby` | Emby auth flow (`authenticateToken` inside handler) | baseline |
| `/libraries` | `authenticateTokenOrApiKey` | baseline |
| `/logs` | `authenticateToken` (internal router-level guard) | baseline |
| `/media-sync` | `authenticateTokenOrApiKey` | baseline |
| `/queue` | `authenticateTokenOrApiKey` | baseline |
| `/stats` | `authenticateTokenOrApiKey` | baseline |
| `/system` | `authenticateToken` (internal router-level guard) | baseline |

**Pass:** grep confirms these routes remain on their own auth paths; no plain `router.use('/webhook')` without subsequent auth validation in the handler.

---

## C. Webhook & External Auth Hardening (Finding #4, Post-review 2026-02-25)

### C1. Webhook secret required
```bash
grep -n "webhookSecret\|signature\|validateAuth\|HMAC" server/src/routes/webhook.js | head -20
```
**Pass:** `validateAuth` is `await`ed before processing body; secret is read from encrypted store (not plain `process.env`).

### C2. Constant-time compare for unequal-length secrets
```bash
grep -n "timingSafeEqual\|subtle.timingEqual\|constantTimeEqual" server/src/routes/webhook.js
```
**Pass:** at least one constant-time comparison function is used; plain string `===` is not used for secret comparison.

### C3. Webhook secret encrypted at rest (`whsec_` prefix)
```bash
grep -n "whsec_" server/src/routes/webhook.js server/src/services/webhook*.js 2>/dev/null | head -5
```
**Pass:** `whsec_` prefix present in encryption handling; raw secret not stored plaintext in DB.

---

## D. HTTP Security Headers (Findings #5, #6)

### D1. Content Security Policy
```bash
grep -rn "contentSecurityPolicy\|Content-Security-Policy\|helmet" server/src/middleware/ server/src/index.js | head -10
```
**Pass:** CSP is configured with no `unsafe-eval` and no `unsafe-inline` for scripts; `helmet` is present.

### D2. CORS origin restriction
```bash
grep -n "CORS_ORIGIN\|cors(" server/src/index.js server/src/middleware/cors* 2>/dev/null | head -10
```
**Pass:** CORS origin is driven by `CORS_ORIGIN` environment variable; wildcard `*` is not used in production path.
Empty `CORS_ORIGIN` is an intentional unrestricted mode, while explicit origins enable the allowlist path.

---

## E. Session & Token Security (Findings #7, #8)

### E1. JWT stored in httpOnly cookie
```bash
grep -n "httpOnly\|sameSite\|secure" server/src/routes/auth*.js server/src/middleware/auth* 2>/dev/null | head -15
```
**Pass:** `httpOnly: true`; `sameSite: 'strict'` or `'lax'`; `secure` flag controlled by `FORCE_SECURE_COOKIES` for HTTP dev environments.

### E2. Refresh token implementation
```bash
grep -rn "refreshToken\|refresh_token" server/src/routes/ | head -10
```
**Pass:** refresh token issue/rotation logic present; access token short-lived.

### E3. CSRF double-submit token (Post-review 2026-02-25)
```bash
grep -rn "csrf\|X-CSRF-Token\|classifarr_csrf" server/src/middleware/ server/src/routes/ | head -10
```
**Pass:** `classifarr_csrf_token` cookie and `X-CSRF-Token` header verified on mutating (POST/PUT/PATCH/DELETE) cookie-authenticated requests.

---

## F. Credential Handling (Finding #13, Post-review 2026-03-05)

### F1. API key not written to server logs
```bash
grep -rn "console.log\|logger\." server/src/routes/apiKeys*.js server/src/services/apiKey*.js 2>/dev/null | grep -iv "key_id\|created\|deleted" | head -10
```
**Pass:** no statement that logs the raw API key value; masked/truncated display only.

### F2. API key encrypted at rest
```bash
grep -rn "encrypt\|decrypt\|cipher" server/src/services/apiKey*.js server/src/models/apiKey*.js 2>/dev/null | head -10
```
**Pass:** encryption/decryption calls present; raw key not inserted directly into DB.

### F3. No secrets in environment or config files committed
```bash
git diff --name-only HEAD~1 HEAD | xargs grep -l "password\|secret\|apikey\|token" 2>/dev/null
```
**Pass:** any matches are in `.env.example` with placeholder values, not real credentials. Check `.gitignore` covers `.env`.

---

## G. Debug Artifacts & Git Hygiene (Finding #12, Post-review 2026-03-05)

### G1. No debug scripts tracked in git
```bash
git ls-files | grep -E "^(debug_|check_|test_|scratch_)" | head -20
```
**Pass:** no output (or only intentional, reviewed scripts). Files matching these prefixes should be in `.gitignore`.

### G2. Log files not tracked
```bash
git ls-files | grep -E "\.(log|txt)$" | grep -v "^docs\|^templates\|^\.github\|\.md\.backup" | head -20
```
**Pass:** no `*.log` or loose `*.txt` data files tracked. Verify `.gitignore` has `logs*.txt` and `*.log` patterns.

### G3. Debug endpoint production-gated (Finding #12)
```bash
grep -rn "NODE_ENV.*production\|debugRouter\|\/debug" server/src/routes/ server/src/index.js | head -10
```
**Pass:** debug endpoints gated with `process.env.NODE_ENV !== 'production'`; not mounted unconditionally.

---

## H. Error Handling & Information Disclosure (CWE-200, Post-review 2026-03-05)

### H1. healthCheck() sanitizes error in production
```bash
grep -n "Database connection failed\|sanitize\|production" server/src/config/database.mjs | head -10
```
**Pass:** production path returns `'Database connection failed'` (generic); raw `err.message` only returned in non-production.

### H2. Global error handler does not leak stack traces
```bash
grep -rn "err.stack\|error.stack\|stack:" server/src/middleware/error* server/src/index.js 2>/dev/null | head -10
```
**Pass:** stack traces only returned when `NODE_ENV !== 'production'`; production returns generic error message.

### H3. 404 handler does not echo path details
```bash
grep -n "req.path\|req.url\|404" server/src/index.js server/src/middleware/notFound* 2>/dev/null | head -10
```
**Pass:** 404 response body is generic ("Not Found" or similar); does not echo the requested path back to the client.

---

## I. Input Validation & Injection Prevention (CWE-89, CWE-20)

### I1. Parameterized queries (no string interpolation in SQL)
```bash
grep -rn "query(\`\|query('" server/src/services/ server/src/config/database.mjs | grep -v "//\|test" | head -20
```
**Pass:** all SQL queries use parameterized form (`$1`, `$2`, etc.); no template-literal SQL construction with user input.

### I2. No use of `eval()` or `Function()` constructor with user data
```bash
grep -rn "eval(\|new Function(" server/src/ | grep -v "//\|node_modules\|test" | head -10
```
**Pass:** no matches, or only in clearly sandboxed tooling contexts.

### I3. File path operations validate against traversal
```bash
grep -rn "\.\.\/\|path\.join\|readFile\|writeFile" server/src/routes/ server/src/services/ | grep -v "test\|spec\|__tests__" | head -20
```
**Pass:** user-supplied path segments are normalized and validated against an allowlist or base directory; no raw join of user input.

---

## J. Container & Runtime Security (Finding #11, CIS Docker)

### J1. Non-root user in Dockerfile (acknowledged design decision)
```bash
grep -n "USER\|useradd\|gosu\|su-exec" Dockerfile docker-entrypoint.sh | head -10
```
**Pass (acknowledged):** Dockerfile uses `gosu` / `su-exec` to drop to non-root before exec; or confirmed design decision is still current. If still running as root, document the rationale.

### J2. No `--privileged` flag in compose files
```bash
grep -rn "privileged:" docker-compose*.yml | head -5
```
**Pass:** no `privileged: true` in any compose file used in production.

### J3. Trivy / OSV scan green in CI for release tag
Check the latest CI run for the release tag on GitHub Actions:
- `OSV Dependency Scan` workflow: **success**
- Trivy image scan (if present): **success** or **acknowledged**

---

## K. Dependency & Supply Chain (Findings #9, #10)

### K1. No high/critical audit findings (re-gate from A1/A2)
Gate already run in Section A. Record final counts here:
- Server: `_ critical, _ high, _ moderate`
- Client: `_ critical, _ high, _ moderate`

**Pass:** 0 critical, 0 high

### K2. No known-malicious packages via OSV
Checked via CI `OSV Dependency Scan` workflow — confirm run is green for the commit being released.

### K3. No new `devDependency` in `dependencies` field
```bash
grep -A200 '"dependencies"' server/package.json | head -60
grep -A200 '"dependencies"' client/package.json | head -60
```
**Pass:** no test/dev-only packages (jest, vitest, eslint, etc.) listed under `dependencies`.

---

## L. Gitleaks & Secret Scanning (Post-review 2026-02-25)

### L1. Gitleaks workflow present and green
```bash
cat .github/workflows/*.yml | grep -l "gitleaks" 2>/dev/null || ls .github/workflows/
```
**Pass:** a workflow file invokes gitleaks; last run for the release commit is **success**.

### L2. No hardcoded secrets in new/changed files
```bash
git diff HEAD~1 HEAD -- '*.js' '*.ts' '*.vue' '*.json' | grep -iE "(password|secret|apikey|token)\s*[:=]\s*['\"][^'\"]+" | grep -v "example\|placeholder\|process\.env\|config\." | head -10
```
**Pass:** no matches, or all matches are config-file references (not literal values).

---

## M. bcrypt & Password Storage (Node.js Security Best Practices)

### M1. bcrypt rounds ≥ 12
```bash
grep -rn "bcrypt\|saltRounds\|genSalt" server/src/ | grep -v test | head -10
```
**Pass:** `saltRounds` or `genSalt` argument is 12 or higher.

### M2. Password not returned in API responses
```bash
grep -rn "password" server/src/routes/ | grep -v "test\|spec\|login\|register\|compareSync\|hash" | grep "res\.\|json\|send" | head -10
```
**Pass:** no route serializes a `password` field into a response body.

---

## N. Rate Limiting (OWASP API4, Node.js Security)

### N1. Rate limiting on auth endpoints
```bash
grep -rn "rateLimit\|rate_limit\|express-rate-limit" server/src/routes/auth*.js server/src/index.js | head -10
```
**Pass:** `express-rate-limit` (or equivalent) applied to `/auth/login` and `/auth/register` at minimum.

### N2. Rate limiting on sensitive write endpoints
```bash
grep -rn "rateLimit" server/src/routes/ | head -10
```
**Pass:** at least login, registration, and webhook endpoints have rate limiting configured.

---

## Sign-off

Complete after all sections pass. Copy and fill this block into your release ticket or commit message.

```
## Security Checklist Sign-off — vX.X.X-alpha
Date: YYYY-MM-DD
Reviewer: [name/handle]

A. Automated Gates ............. [ ] all green
B. Route Authentication ........ [ ] no regressions
C. Webhook Auth ................ [ ] HMAC + constant-time confirmed
D. HTTP Security Headers ........ [ ] CSP + CORS verified
E. Session & Token Security ..... [ ] httpOnly + CSRF confirmed
F. Credential Handling .......... [ ] no raw key/secret exposure
G. Debug Artifacts & Git ........ [ ] no debug scripts or logs tracked
H. Error Handling ............... [ ] production sanitization confirmed
I. Input Validation .............. [ ] parameterized queries verified
J. Container & Runtime .......... [ ] non-root or design decision current
K. Dependencies ................. [ ] 0 critical/high; OSV green
L. Secret Scanning .............. [ ] gitleaks green; no hardcoded secrets
M. Password Storage ............. [ ] bcrypt ≥12; no password in response
N. Rate Limiting ................ [ ] auth endpoints rate-limited

Notes / exceptions:
```

---

## Checklist Changelog

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.1.0 | 2026-03-22 | — | Added finding #32: `/classification/progress` route was mounted unauthenticated in `index.js` outside `apiRouter`; fixed by moving into `api.js` Tier 1 block with `authenticateToken + requireAdmin`. Added `/classification/progress` row to B1 table (14 Tier 1 routes). Updated pass criterion count from 13 to 14. |
| 1.0.0 | 2026-03-05 | — | Initial checklist created from 31 baseline findings in `SECURITY_REVIEW.md` plus 3 post-review findings (2026-03-05). Covers all CIS Docker, OWASP API Top 10, SANS CWE Top 25, Node.js, and NIST CSF 2.0 mappings from `SECURITY_BENCHMARKS.md`. |
