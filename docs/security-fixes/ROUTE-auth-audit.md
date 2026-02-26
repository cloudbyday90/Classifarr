# Route Authentication Audit Report

- **Generated:** 2026-02-24
- **Updated:** 2026-02-24
- **Tool:** Manual code review + grep search
- **Scope:** All routes in `server/src/routes/api.js`
- **Status:** Verification Complete

---

## Executive Summary

This audit identifies **17 unprotected routes** that lack authentication middleware (plus 1 deprecated route). These routes expose sensitive operations including:

- **Critical:** Batch reclassification (media moves in Radarr/Sonarr)
- **High:** Policy management, path mappings, rule builder, RAG operations
- **Medium:** Confidence weights, feedback/learning data, scheduler
- **Low:** Migration status, sync status

### Risk Assessment

| Route | Endpoints | Data Exposure | System Impact | Recommended Tier |
|-------|-----------|---------------|---------------|------------------|
| `/reclassification` | 11 | Classification history | **Critical** - Batch media moves | Tier 1 (Admin) |
| `/policies` | 13 | Policy rules | **High** - Affects all classifications | Tier 1 (Admin) |
| `/mappings` | 9 | Library mappings | **High** - Media routing | Tier 1 (Admin) |
| `/confidence` | 4 | Weight config | **High** - Classification decisions | Tier 1 (Admin) |
| `/rag` | 40+ | Embedding config | **High** - AI operations, costs | Tier 1 (Admin) |
| `/patterns` | 13 | Learned patterns | **High** - Learning system | Tier 1 (Admin) |
| `/scheduler` | 6 | Task config | **High** - Background operations | Tier 1 (Admin) |
| `/rule-builder` | 4 | Rule sessions | **High** - Classification rules | **Deprecated** (Removed) |
| `/settings/path-mappings` | 4 | Path config | **High** - Filesystem access | Tier 1 (Admin) |
| `/feedback` | 7 | Learning data | **Medium** - Contribute learning | Tier 2 (User) |
| `/prompts` | 4 | Clarification prompts | **Medium** - User interaction | Tier 2 (User) |
| `/presets` | 4 | Custom presets | **Medium** - User customization | Tier 2 (User) |
| `/requests` | 3 | TMDB search | **Medium** - Submit requests | Tier 2 (User) |
| `/suggestions` | 3 | Tuning suggestions | **Low** - Read-only | Tier 2 (User) |
| `/migration` | 3 | Migration status | **Low** - Read-only | Tier 2 (User) |
| `/rating-normalization` | 2 | Rating ops | **Low** - Normalization | Tier 2 (User) |
| `/sync` | 1 | Sync status | **Low** - Read-only | Tier 2 (User) |
| `/clarifications` | 2 | Clarification questions | **Low** - User interaction | Tier 2 (User) |

---

## Authentication Strategy

### Tier Classification

| Tier | Routes | Auth Method | Use Case |
|------|--------|-------------|----------|
| **Tier 1** | 9 routes | `authenticateToken` + `requireAdmin` | Admin-only operations |
| **Tier 2** | 9 routes | `authenticateToken` | Any logged-in user |
| **Existing** | 14 routes | Various (already protected) | Libraries, queue, stats, backup, etc. |

### Why JWT Only (No API Keys for Admin Routes)

**Current API Key System:**
- API keys have two permission levels: `read_only` and `read_write`
- No admin/user role distinction exists for API keys
- API keys are designed for integrations, not user impersonation

**Decision:** Admin routes require JWT with `role: 'admin'` (no API key support)

**Rationale:**
1. **Security:** Admin operations are sensitive - require user login
2. **Simplicity:** No database migration needed
3. **Audit:** JWT tokens are tied to specific users for logging
4. **Consistency:** User preference is to login for all operations

**Future Enhancement (if needed):**
```sql
-- Add admin permission to API keys
ALTER TABLE api_keys ADD COLUMN is_admin BOOLEAN DEFAULT false;
```

```javascript
// New middleware for future use
async function authenticateAdminTokenOrApiKey(req, res, next) {
  // Check for API key first
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    const validKey = await apiKeyService.validateApiKey(apiKey);
    if (validKey && validKey.is_admin) {
      req.apiKey = validKey;
      return next();
    }
    return res.status(403).json({ error: 'Admin API key required' });
  }
  
  // Fall back to JWT with requireAdmin
  return requireAdmin(req, res, next);
}
```

---

## Implementation Plan

### File: `server/src/routes/api.js`

```javascript
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ============================================================================
// TIER 1: ADMIN-ONLY ROUTES
// These routes require authenticated user with admin role
// ============================================================================

// Reclassification - batch media moves in Radarr/Sonarr
router.use('/reclassification', authenticateToken, requireAdmin, reclassificationRouter);

// Policies - classification rules CRUD
router.use('/policies', authenticateToken, requireAdmin, policiesRouter);

// Mappings - library-to-arr routing
router.use('/mappings', authenticateToken, requireAdmin, mappingsRouter);

// Confidence - weight/threshold configuration
router.use('/confidence', authenticateToken, requireAdmin, confidenceRouter);

// RAG - embedding, backfill, circuit breaker operations
router.use('/rag', authenticateToken, requireAdmin, ragRouter);

// Patterns - pattern mining, approval, rejection
router.use('/patterns', authenticateToken, requireAdmin, patternsRouter);

// Scheduler - background task management
router.use('/scheduler', authenticateToken, requireAdmin, schedulerRouter);

// Path Mappings - filesystem path configuration
router.use('/settings/path-mappings', authenticateToken, requireAdmin, pathMappingsRouter);

// ============================================================================
// TIER 2: AUTHENTICATED USER ROUTES
// These routes require login but not admin role
// ============================================================================

// Feedback - contribute learning data
router.use('/feedback', authenticateToken, feedbackRouter);

// Prompts - clarification prompt management
router.use('/prompts', authenticateToken, promptsRouter);

// Presets - custom preset CRUD
router.use('/presets', authenticateToken, presetsRouter);

// Requests - TMDB search and classification requests
router.use('/requests', authenticateToken, requestsRouter);

// Suggestions - tuning suggestions
router.use('/suggestions', authenticateToken, suggestionsRouter);

// Migration - legacy migration status
router.use('/migration', authenticateToken, migrationRouter);

// Rating Normalization - rating operations
router.use('/rating-normalization', authenticateToken, ratingNormalizationRouter);

// Sync - sync status
router.use('/sync', authenticateToken, syncRouter);

// Clarifications - clarification questions
router.use('/clarifications', authenticateToken, clarificationRouter);
```

### Routes Already Protected (No Changes Needed)

| Route | Auth Method | Location |
|-------|-------------|----------|
| `/libraries` | `authenticateTokenOrApiKey` | libraries.js:36 |
| `/queue` | `authenticateTokenOrApiKey` | queue.js:19 |
| `/stats` | `authenticateTokenOrApiKey` | stats.js:17 |
| `/media-sync` | `authenticateTokenOrApiKey` | mediaSync.js:30 |
| `/notifications` | `authenticateTokenOrApiKey` | notifications.js:26 |
| `/logs` | `authenticateToken` | logs.js:38 |
| `/system` | `authenticateToken` | system.js:105 |
| `/plex` | `authenticateToken` | plexOAuth.js:27 |
| `/jellyfin` | `authenticateToken` | jellyfinAuth.js:27 |
| `/emby` | `authenticateToken` | embyAuth.js:27 |
| `/backup` | `authenticateToken` + `requireAdmin` | backup.js:18-19 |
| `/keys` | `authenticateToken` (per-route) | apiKeys.js |

---

## Edge Cases & Considerations

### 1. Feedback Route - User Attribution

**Current Issue:** The feedback route manually validates `req.body.userId`:
```javascript
// feedback.js:219-220
if (rawUserId === undefined || rawUserId === null) {
    return res.status(401).json({ error: 'Authentication required: userId is missing' });
}
```

**After Fix:** With `authenticateToken` middleware, `req.user.id` will be available. Update to:
```javascript
const userId = req.user.id; // From JWT token, not request body
```

### 2. Double-Auth Check

Some routes may have internal auth that duplicates the new middleware. Verify no 401/403 is returned twice.

### 3. Webhook Route (Intentionally No Auth)

The `/webhook` route has optional authentication (secret key). This is intentional for external integrations. No changes needed.

---

## Testing Requirements

### Unit Tests

Create `server/src/__tests__/route-authentication.test.js`:

```javascript
const request = require('supertest');
const app = require('../index');

describe('Route Authentication', () => {
  let adminToken;
  let userToken;

  beforeAll(async () => {
    adminToken = await createTestUser({ role: 'admin' });
    userToken = await createTestUser({ role: 'user' });
  });

  // =========================================================================
  // TIER 1: ADMIN-ONLY ROUTES
  // =========================================================================
  describe('Tier 1: Admin-Only Routes', () => {
    const adminRoutes = [
      { method: 'POST', path: '/api/reclassification/batch', body: { items: [] } },
      { method: 'GET', path: '/api/reclassification/batches' },
      { method: 'GET', path: '/api/policies' },
      { method: 'POST', path: '/api/policies', body: { library_id: 1, name: 'Test' } },
      { method: 'GET', path: '/api/mappings/1' },
      { method: 'POST', path: '/api/mappings', body: {} },
      { method: 'GET', path: '/api/confidence/weights' },
      { method: 'PUT', path: '/api/confidence/weights', body: { weights: {} } },
      { method: 'GET', path: '/api/rag/status' },
      { method: 'POST', path: '/api/rag/warmup', body: {} },
      { method: 'GET', path: '/api/patterns' },
      { method: 'POST', path: '/api/patterns/discover', body: {} },
      { method: 'GET', path: '/api/scheduler' },
      { method: 'POST', path: '/api/scheduler', body: { name: 'Test', task_type: 'sync' } },
      { method: 'GET', path: '/api/settings/path-mappings' },
    ];

    adminRoutes.forEach(({ method, path, body }) => {
      describe(`${method} ${path}`, () => {
        it('should reject unauthenticated requests (401)', async () => {
          const res = await request(app)[method.toLowerCase()](path).send(body);
          expect(res.status).toBe(401);
        });

        it('should reject non-admin users (403)', async () => {
          const res = await request(app)
            [method.toLowerCase()](path)
            .set('Authorization', `Bearer ${userToken}`)
            .send(body);
          expect(res.status).toBe(403);
        });

        it('should allow admin users', async () => {
          const res = await request(app)
            [method.toLowerCase()](path)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(res.status).not.toBe(401);
          expect(res.status).not.toBe(403);
        });
      });
    });
  });

  // =========================================================================
  // TIER 2: AUTHENTICATED USER ROUTES
  // =========================================================================
  describe('Tier 2: Authenticated User Routes', () => {
    const userRoutes = [
      { method: 'POST', path: '/api/feedback', body: { tmdb_id: 1, selected_library_id: 1, selected_policy_id: 1 } },
      { method: 'GET', path: '/api/prompts/pending' },
      { method: 'GET', path: '/api/presets/custom' },
      { method: 'GET', path: '/api/requests/search?q=test' },
      { method: 'GET', path: '/api/suggestions' },
      { method: 'GET', path: '/api/migration/status' },
      { method: 'GET', path: '/api/rating-normalization/stats' },
      { method: 'GET', path: '/api/sync/status' },
    ];

    userRoutes.forEach(({ method, path, body }) => {
      describe(`${method} ${path}`, () => {
        it('should reject unauthenticated requests (401)', async () => {
          const res = await request(app)[method.toLowerCase()](path).send(body);
          expect(res.status).toBe(401);
        });

        it('should allow authenticated users', async () => {
          const res = await request(app)
            [method.toLowerCase()](path)
            .set('Authorization', `Bearer ${userToken}`)
            .send(body);
          expect(res.status).not.toBe(401);
        });

        it('should allow admin users', async () => {
          const res = await request(app)
            [method.toLowerCase()](path)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(res.status).not.toBe(401);
          expect(res.status).not.toBe(403);
        });
      });
    });
  });

  // =========================================================================
  // TOKEN VALIDATION
  // =========================================================================
  describe('Token Validation', () => {
    it('should reject invalid token (401)', async () => {
      const res = await request(app)
        .get('/api/policies')
        .set('Authorization', 'Bearer invalid_token');
      expect(res.status).toBe(401);
    });

    it('should reject expired token (401)', async () => {
      const expiredToken = await getExpiredToken();
      const res = await request(app)
        .get('/api/policies')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it('should reject malformed Authorization header (401)', async () => {
      const res = await request(app)
        .get('/api/policies')
        .set('Authorization', 'InvalidFormat');
      expect(res.status).toBe(401);
    });
  });
});
```

### Integration Tests

1. **End-to-end admin flow:**
   - Login as admin → GET /api/policies → 200 OK

2. **End-to-end user flow:**
   - Login as user → GET /api/policies → 403 Forbidden
   - Login as user → GET /api/feedback → 200 OK

3. **Token expiry:**
   - Wait for token expiry → GET /api/policies → 401 Unauthorized

### Manual Testing Checklist

- [ ] Admin login → access `/api/reclassification/batches` → 200 OK
- [ ] Admin login → access `/api/policies` → 200 OK
- [ ] User login → access `/api/reclassification/batches` → 403 Forbidden
- [ ] User login → access `/api/policies` → 403 Forbidden
- [ ] User login → access `/api/feedback` → 200 OK (with valid body)
- [ ] No token → access any protected route → 401 Unauthorized
- [ ] Invalid token → access any protected route → 401 Unauthorized

---

## Implementation Checklist

- [ ] Add `authenticateToken` + `requireAdmin` to Tier 1 routes (9 routes)
- [ ] Add `authenticateToken` to Tier 2 routes (9 routes)
- [ ] Update feedback route to use `req.user.id` instead of `req.body.userId`
- [ ] Create unit tests for route authentication
- [ ] Run existing test suite to verify no regressions
- [ ] Manual test each route category
- [ ] Update API documentation (Swagger)
- [ ] Update SECURITY_REVIEW.md to mark findings as fixed
- [ ] Update SECURITY_BENCHMARKS.md checklist

---

## Files Modified

| File | Change |
|------|--------|
| `server/src/routes/api.js` | Add auth middleware to 18 routes |
| `server/src/routes/feedback.js` | Use `req.user.id` for user attribution |
| `server/src/__tests__/route-authentication.test.js` | Create new test file |

---

## Rollback Plan

If issues arise:
1. Revert `server/src/routes/api.js` to previous version
2. Redeploy previous container image
3. Monitor logs for authentication errors
4. Check for any integrations that may have been using unprotected routes

---

## Future Enhancements

### API Key Admin Support (If Needed)

If automation scripts need admin access without user login:

1. **Database Migration:**
   ```sql
   ALTER TABLE api_keys ADD COLUMN is_admin BOOLEAN DEFAULT false;
   ```

2. **New Middleware:**
   ```javascript
   // middleware/adminAuth.js
   async function authenticateAdminTokenOrApiKey(req, res, next) {
     const apiKey = req.headers['x-api-key'];
     if (apiKey) {
       const validKey = await apiKeyService.validateApiKey(apiKey);
       if (validKey && validKey.is_admin) {
         req.apiKey = validKey;
         return next();
       }
       return res.status(403).json({ error: 'Admin API key required' });
     }
     return requireAdmin(req, res, next);
   }
   ```

3. **Update Routes:**
   ```javascript
   router.use('/policies', authenticateAdminTokenOrApiKey, policiesRouter);
   ```

---

## References

- Original security review: `docs/SECURITY_REVIEW.md`
- Security benchmarks: `docs/SECURITY_BENCHMARKS.md`
- Auth middleware: `server/src/middleware/auth.js`
- API key middleware: `server/src/middleware/apiKeyAuth.js`
- Protected routes pattern: `server/src/routes/backup.js`
