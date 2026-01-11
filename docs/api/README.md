# Classifarr API Reference

## Overview

The Classifarr API provides RESTful endpoints for managing policies, presets, tuning suggestions, statistics, and legacy rule migration.

**Base URL:** `http://localhost:21324/api`

**Authentication:** Most endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

---

## API Categories

- [Policies API](./policies.md) - Policy CRUD and preset management
- [Presets API](./presets.md) - Content preset discovery and filtering
- [Suggestions API](./suggestions.md) - Tuning suggestion management
- [Stats API](./stats.md) - Policy statistics and analytics
- [Migration API](./migration.md) - Legacy rule migration tools

> **Note:** Additional APIs for presets, suggestions, statistics, and legacy rule migration are available in the service, but their detailed documentation is not yet included in this reference and will be added in a future revision.

---

## Common Response Formats

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## Authentication

### Login

**POST** `/api/auth/login`

```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

---

## Pagination

Endpoints that return lists support pagination:

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)

**Response:**

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 168,
    "totalPages": 4
  }
}
```

---

## Filtering

Many endpoints support filtering via query parameters:

**Example:**

```
GET /api/policies?library_id=123&active=true
GET /api/presets?category=genre&search=action
```

---

## Rate Limiting

- **Default:** 100 requests per 15 minutes per IP
- **Authentication endpoints:** 5 requests per 15 minutes per IP

Rate limit headers:
- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset time (Unix timestamp)

---

## Versioning

Current API version: **v1**

The API version is included in the response headers:

```
X-API-Version: 1.0.0
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Missing or invalid authentication token |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid request parameters |
| `CONFLICT` | Resource conflict (e.g., duplicate) |
| `INTERNAL_ERROR` | Server error |

---

## OpenAPI Specification

Full OpenAPI 3.0 specification available at:

```
GET /api/docs
```

Interactive Swagger UI:

```
http://localhost:21324/api/docs
```

---

## Examples

### Creating a Policy

```bash
curl -X POST http://localhost:21324/api/policies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "library_id": 123,
    "name": "Kids Movies Policy",
    "auto_classify_threshold": 85,
    "prompt_threshold": 60,
    "preset_ids": [1, 2, 3]
  }'
```

### Getting Statistics

```bash
curl -X GET http://localhost:21324/api/stats/overview \
  -H "Authorization: Bearer $TOKEN"
```

### Applying a Suggestion

```bash
curl -X POST http://localhost:21324/api/suggestions/456/apply \
  -H "Authorization: Bearer $TOKEN"
```

---

## WebSocket Events

Real-time events are available via WebSocket:

**Endpoint:** `ws://localhost:21324/ws`

**Events:**
- `policy:decision` - New classification decision
- `pattern:discovered` - New pattern detected
- `suggestion:created` - New tuning suggestion
- `stats:updated` - Statistics updated

**Example:**

```javascript
const ws = new WebSocket('ws://localhost:21324/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log(event.type, event.payload);
});
```

---

## Best Practices

1. **Always use HTTPS in production**
2. **Store tokens securely** (e.g., httpOnly cookies)
3. **Implement retry logic** for transient errors
4. **Cache frequently accessed data** (presets, policies)
5. **Use pagination** for large datasets
6. **Handle rate limits** gracefully

---

## Support

- [GitHub Issues](https://github.com/cloudbyday90/Classifarr/issues)
- [Discord Community](https://discord.gg/classifarr)
- [Documentation](https://github.com/cloudbyday90/Classifarr/tree/main/docs)
