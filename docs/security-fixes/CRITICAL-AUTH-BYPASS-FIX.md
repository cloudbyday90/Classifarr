# Critical Security Fix: Authentication Bypass on Protected Routes

- **Issue ID:** SECURITY-001
- **Severity:** Critical
- **Status:** ✅ Complete
- **Created:** 2026-02-24
- **Fixed:** 2026-02-24 (All routes protected, 1 deprecated)
- **Related Findings:** #1-31 from SECURITY_REVIEW.md (30 Fixed, 1 Deprecated)

---

## Executive Summary

All authentication bypass vulnerabilities have been **fixed** on 2026-02-24:

1. **Settings routes** ✅ FIXED - All configuration including API keys
2. **Classification routes** ✅ FIXED - History, corrections, re-classification operations
3. **Media server routes** ✅ FIXED - Plex/Jellyfin/Emby configuration and sync
4. **17 additional routes** ✅ FIXED - All Tier 1 and Tier 2 routes now protected
5. **Rule builder** ⚠️ DEPRECATED - Replaced by Policy Engine

**Root Cause:** In `server/src/routes/api.js`, routers were mounted without applying the `authenticateToken` middleware that exists and is used correctly elsewhere in the codebase.

---

## Fixed Routes (✅)

### Finding #1: Settings Routes ✅ FIXED

**File:** `server/src/routes/api.js:63`

**Fixed Code:**
```javascript
router.use('/settings', authenticateToken, requireAdmin, settingsRouter);
```

---

### Finding #2: Classification Routes ✅ FIXED

**File:** `server/src/routes/api.js:61`

**Fixed Code:**
```javascript
router.use('/classification', authenticateToken, requireAdmin, classificationRouter);
```

---

### Finding #3: Media Server Routes ✅ FIXED

**File:** `server/src/routes/api.js:59`

**Fixed Code:**
```javascript
router.use('/media-server', authenticateToken, requireAdmin, mediaServerRouter);
```

---

## Additional Routes Protected (✅)

All routes from `ROUTE-AUTH-AUDIT.md` have been protected:

| Route | Line | Severity | Status |
|-------|------|----------|--------|
| `/reclassification` | 76 | Critical | ✅ Fixed |
| `/policies` | 83 | High | ✅ Fixed |
| `/settings/path-mappings` | 77 | High | ✅ Fixed |
| `/rule-builder` | 62 | High | ⚠️ Deprecated |
| `/mappings` | 75 | High | ✅ Fixed |
| `/confidence` | 78 | Medium | ✅ Fixed |
| `/rag` | 79 | Medium | ✅ Fixed |
| `/patterns` | 80 | Medium | ✅ Fixed |
| `/feedback` | 81 | Medium | ✅ Fixed |
| `/prompts` | 82 | Medium | ✅ Fixed |
| `/presets` | 84 | Medium | ✅ Fixed |
| `/suggestions` | 85 | Low | ✅ Fixed |
| `/migration` | 86 | Low | ✅ Fixed |
| `/rating-normalization` | 87 | Low | ✅ Fixed |
| `/sync` | 88 | Low | ✅ Fixed |
| `/clarifications` | 66 | Low | ✅ Fixed |
| `/requests` | 71 | Medium | ✅ Fixed |
| `/scheduler` | 73 | Medium | ✅ Fixed |

> **Note:** `/rule-builder` was deprecated on 2026-02-24. The route and service have been completely removed. Rule preview functionality is now available at `POST /api/libraries/:id/rules/preview`.

---

## Decision: Admin-Only for Sensitive Routes

**Decision:** Option B - `authenticateToken` + `requireAdmin`

**Rationale:** 
- Matches `backup.js` pattern for sensitive operations
- Settings contain API keys and external service configurations
- Classification and media-server operations can modify media libraries
- Consistent security posture across all sensitive routes

**Applied:** 2026-02-24

---

## Test Requirements

### Unit Tests Required

Create `server/src/__tests__/route-authentication.test.js`:

```javascript
describe('Route Authentication', () => {
  describe('Fixed Routes (should reject unauthenticated)', () => {
    const fixedRoutes = [
      'GET /api/settings',
      'GET /api/classification/history',
      'GET /api/media-server',
    ];

    fixedRoutes.forEach(route => {
      it(`should reject unauthenticated ${route}`, async () => {
        const res = await request(app).get(route.replace('GET ', ''));
        expect(res.status).toBe(401);
      });
    });
  });

  describe('Unprotected Routes (NEW - need auth)', () => {
    const unprotectedRoutes = [
      'GET /api/reclassification/batch',
      'GET /api/policies',
      'GET /api/settings/path-mappings',
      'GET /api/mappings/1',
      'GET /api/confidence/weights',
      'GET /api/rag/status',
      'GET /api/patterns',
      'POST /api/feedback',
      'GET /api/prompts/pending',
      'GET /api/presets/custom',
      'GET /api/suggestions',
      'GET /api/migration/status',
      'GET /api/rating-normalization/stats',
      'GET /api/sync/status',
      'GET /api/clarifications/1',
      'GET /api/requests/search',
      'GET /api/scheduler',
    ];

    unprotectedRoutes.forEach(route => {
      it(`should reject unauthenticated ${route}`, async () => {
        const res = await request(app).get(route.replace('GET ', '').replace('POST ', ''));
        expect(res.status).toBe(401);
      });
    });
  });
});
```

### Integration Tests Required

1. Full login flow → settings access
2. Token expiry → 401 response
3. Invalid token → 401 response
4. Non-admin with requireAdmin route → 403 response

### Test File Updates Required

| Test File | Update Required |
|-----------|-----------------|
| `settings.test.js` | Add auth rejection tests |
| `classification-routes.test.js` | Add auth rejection tests |
| `policies-routes.coverage.test.js` | Add auth rejection tests |
| `pathMappings.test.js` | Add auth rejection tests |
| `reclassification.test.js` | Create new test file with auth tests |

---

## Security Benchmark References

### OWASP API Security Top 10 (2023)

| Risk | Requirement | Fixed Routes | Open Routes |
|------|-------------|--------------|-------------|
| **API1:2023** Broken Object Level Authorization | Verify authorization for every object access | ✅ | ❌ |
| **API5:2023** Broken Function Level Authorization | Deny by default, validate at route level | ✅ | ❌ |

Source: https://owasp.org/API-Security/editions/2023/en/0x11-t10/

### OWASP REST Security Cheat Sheet

| Requirement | Description | Fixed | Open |
|-------------|-------------|-------|------|
| Access control at each endpoint | Every API endpoint must check authorization | ✅ | ❌ |
| Centralize authentication | Use consistent middleware | ✅ | ❌ |

Source: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html

### SANS Top 25 Software Errors

| Error | Description | Fixed | Open |
|-------|-------------|-------|------|
| CWE-306: Missing Authentication | No access control | ✅ | ❌ |
| CWE-862: Missing Authorization | No permission checks | ✅ | ❌ |

Source: https://www.sans.org/top25-software-errors/

---

## Rollback Plan

If issues arise after deployment:

1. **Immediate rollback:** Revert the three `router.use()` changes in api.js
2. **Partial rollback:** Remove auth from specific routes if needed
3. **Hotfix:** Add specific endpoints to allowlist if required

---

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Security Review | | | Pending |
| Code Review | | | Pending |
| Testing | | | Pending |
| Deployment | | | Pending |

---

## Related Documents

- `ROUTE-AUTH-AUDIT.md` - Detailed audit of all 18 unprotected routes
- `SECURITY_REVIEW.md` - Full security review with all findings
- `SECURITY_BENCHMARKS.md` - Security benchmarks and checklists
