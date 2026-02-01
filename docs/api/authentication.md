# Authentication Guide

Classifarr provides two authentication methods for different use cases: **JWT tokens** for web UI access and **API Keys** for integrations and automation.

---

## Table of Contents

1. [Authentication Methods](#authentication-methods)
2. [JWT Tokens (Web UI)](#jwt-tokens-web-ui)
3. [API Keys (Integrations)](#api-keys-integrations)
4. [Creating API Keys](#creating-api-keys)
5. [Permission Levels](#permission-levels)
6. [Security Best Practices](#security-best-practices)
7. [Default API Key](#default-api-key-on-first-startup)
8. [Code Examples](#code-examples)

---

## Authentication Methods

| Method | Use Case | Header | Format |
|--------|----------|--------|--------|
| **JWT Token** | Web UI, browser sessions | `Authorization` | `Bearer <token>` |
| **API Key** | Integrations, automation, scripts | `X-API-Key` | `clf_<key>` |

Both methods provide secure access to the Classifarr API with different permission levels.

---

## JWT Tokens (Web UI)

JWT (JSON Web Token) authentication is used primarily by the web interface for session management.

### Obtaining a JWT Token

**Endpoint:** `POST /api/auth/login`

**Request:**
```bash
curl -X POST http://localhost:21324/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-password"
  }'
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

### Using JWT Tokens

Include the token in the `Authorization` header with `Bearer` prefix:

```bash
curl -X GET http://localhost:21324/api/libraries \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Token Expiration

- JWT tokens expire after a configured duration (default: 24 hours)
- The web UI automatically refreshes tokens as needed
- For API access, use API Keys for long-lived authentication

---

## API Keys (Integrations)

API Keys provide secure, long-lived authentication for integrations, automation scripts, and third-party applications.

### Key Format

All API keys follow the format: `clf_<random_string>`

Example: `clf_1a2b3c4d5e6f7g8h9i0j`

### Using API Keys

Include the API key in the `X-API-Key` header:

```bash
curl -X GET http://localhost:21324/api/libraries \
  -H "X-API-Key: clf_1a2b3c4d5e6f7g8h9i0j"
```

### Key Features

- **Long-lived:** No expiration unless explicitly set
- **Revocable:** Can be deleted at any time
- **Named:** Each key has a descriptive name
- **Permission-based:** Read-only or read-write access
- **Retrievable:** Full key can be revealed again in settings (encrypted storage)

---

## Creating API Keys

API keys must be created through the web UI by authenticated users.

### Via Web UI

1. Log in to Classifarr
2. Navigate to **Settings** → **Security**
3. Click **Create API Key**
4. Enter:
   - **Name:** Descriptive name (e.g., "Automation Script", "Monitoring Tool")
   - **Permissions:** `read_only` or `read_write`
   - **Expiration:** Optional expiration date
5. Click **Create**
6. **Copy the key immediately** - it's shown in full

### Via API (Requires JWT Authentication)

**Endpoint:** `POST /api/keys`

**Request:**
```bash
curl -X POST http://localhost:21324/api/keys \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Automation Script",
    "permissions": "read_write",
    "expires_at": "2026-12-31T23:59:59Z"
  }'
```

**Response:**
```json
{
  "id": 1,
  "name": "Automation Script",
  "key": "clf_1a2b3c4d5e6f7g8h9i0j",
  "key_prefix": "clf_1a2b",
  "permissions": "read_write",
  "expires_at": "2026-12-31T23:59:59Z",
  "is_active": true,
  "created_at": "2026-02-01T12:00:00Z"
}
```

---

## Permission Levels

### `read_only`

**Allowed Operations:**
- View system health and status
- List libraries, policies, presets
- View classification history
- Get sync status
- View webhooks configuration

**Restricted Operations:**
- Cannot create, update, or delete resources
- Cannot trigger syncs or classifications
- Cannot modify settings or configurations

**Example Use Cases:**
- Monitoring dashboards
- Read-only integrations
- Reporting tools

### `read_write`

**Allowed Operations:**
- All `read_only` operations
- Create, update, delete libraries
- Trigger syncs and classifications
- Manage policies and presets
- Modify webhooks and settings
- Clear queues

**Example Use Cases:**
- Automation scripts
- Integration tools (Overseerr, etc.)
- Administrative tasks

---

## Security Best Practices

### API Key Management

1. **Use Descriptive Names:** Clearly identify each key's purpose
2. **Principle of Least Privilege:** Use `read_only` when write access isn't needed
3. **Set Expiration Dates:** For temporary integrations or testing
4. **Rotate Regularly:** Periodically create new keys and revoke old ones
5. **One Key Per Integration:** Don't share keys across multiple services

### Key Storage

1. **Never commit keys to Git:** Use environment variables
2. **Use Secret Managers:** Store in Vault, AWS Secrets Manager, etc.
3. **Environment Variables:** Store as `CLASSIFARR_API_KEY`
4. **Encrypted Config:** If storing in files, encrypt them

### Network Security

1. **Use HTTPS in Production:** Never send keys over unencrypted connections
2. **Restrict Network Access:** Use firewalls and VPNs
3. **Monitor Usage:** Check logs for unauthorized access attempts
4. **Revoke Compromised Keys:** Immediately delete keys if compromised

### Monitoring

1. **Track Last Used:** Monitor when keys were last accessed
2. **Review Inactive Keys:** Delete keys that haven't been used in 90+ days
3. **Audit Logs:** Periodically review API access logs
4. **Alert on Failures:** Set up alerts for authentication failures

---

## Default API Key on First Startup

On **first startup**, Classifarr automatically creates a default API key:

- **Name:** `Default API Key`
- **Permissions:** `read_write`
- **Key Prefix:** `clf_...` (displayed in logs)

**Security Warning:** The default key is logged once during first startup. You should:

1. Copy this key from the startup logs if needed
2. Create custom API keys for your integrations
3. **Revoke the default key** after setting up your own keys

**Finding the Default Key:**

Check the startup logs:
```bash
docker logs classifarr 2>&1 | grep "Default API Key created"
```

Or reveal it through the API:
```bash
# List all keys
curl -X GET http://localhost:21324/api/keys \
  -H "Authorization: Bearer <jwt_token>"

# Reveal full key by ID
curl -X GET http://localhost:21324/api/keys/1/reveal \
  -H "Authorization: Bearer <jwt_token>"
```

---

## Code Examples

### cURL

**Using API Key:**
```bash
# Get system health
curl -X GET http://localhost:21324/api/system/health \
  -H "X-API-Key: clf_your_api_key_here"

# List libraries
curl -X GET http://localhost:21324/api/libraries \
  -H "X-API-Key: clf_your_api_key_here"

# Trigger sync (requires read_write)
curl -X POST http://localhost:21324/api/media-sync/sync/1 \
  -H "X-API-Key: clf_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"incremental": false}'
```

**Using JWT Token:**
```bash
# Login
TOKEN=$(curl -X POST http://localhost:21324/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  | jq -r '.token')

# Use token
curl -X GET http://localhost:21324/api/libraries \
  -H "Authorization: Bearer $TOKEN"
```

### JavaScript

**Using API Key:**
```javascript
const CLASSIFARR_URL = 'http://localhost:21324';
const API_KEY = process.env.CLASSIFARR_API_KEY;

async function getLibraries() {
  const response = await fetch(`${CLASSIFARR_URL}/api/libraries`, {
    headers: {
      'X-API-Key': API_KEY
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  return await response.json();
}

// Usage
getLibraries()
  .then(libraries => console.log('Libraries:', libraries))
  .catch(error => console.error('Error:', error));
```

**Using JWT Token:**
```javascript
async function login(username, password) {
  const response = await fetch(`${CLASSIFARR_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  return data.token;
}

async function getLibrariesWithToken(token) {
  const response = await fetch(`${CLASSIFARR_URL}/api/libraries`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
}

// Usage
const token = await login('admin', 'password');
const libraries = await getLibrariesWithToken(token);
```

### Python

**Using API Key:**
```python
import os
import requests

CLASSIFARR_URL = 'http://localhost:21324'
API_KEY = os.environ['CLASSIFARR_API_KEY']

def get_libraries():
    response = requests.get(
        f'{CLASSIFARR_URL}/api/libraries',
        headers={'X-API-Key': API_KEY}
    )
    response.raise_for_status()
    return response.json()

# Usage
try:
    libraries = get_libraries()
    print('Libraries:', libraries)
except requests.exceptions.HTTPError as e:
    print(f'Error: {e}')
```

**Using JWT Token:**
```python
def login(username, password):
    response = requests.post(
        f'{CLASSIFARR_URL}/api/auth/login',
        json={'username': username, 'password': password}
    )
    response.raise_for_status()
    return response.json()['token']

def get_libraries_with_token(token):
    response = requests.get(
        f'{CLASSIFARR_URL}/api/libraries',
        headers={'Authorization': f'Bearer {token}'}
    )
    response.raise_for_status()
    return response.json()

# Usage
token = login('admin', 'password')
libraries = get_libraries_with_token(token)
```

---

## Troubleshooting

### 401 Unauthorized

**Symptom:** API returns `401 Unauthorized`

**Possible Causes:**
1. API key is invalid or revoked
2. JWT token has expired
3. Missing authentication header
4. Incorrect header format

**Solutions:**
- Verify the API key is active: `GET /api/keys`
- Check for typos in the key
- Ensure header is `X-API-Key` (case-sensitive)
- For JWT, login again to get a fresh token

### 403 Forbidden

**Symptom:** API returns `403 Forbidden`

**Possible Causes:**
1. API key has `read_only` permissions for a write operation
2. Rate limit exceeded

**Solutions:**
- Check key permissions: `GET /api/keys`
- Use a `read_write` key for write operations
- Wait for rate limit window to reset (15 minutes)

### Key Not Working After Creation

**Symptom:** Newly created key returns 401

**Possible Causes:**
1. Key was not copied correctly
2. Extra spaces or line breaks in the key
3. Key was created but not activated

**Solutions:**
- Reveal the key again: `GET /api/keys/:id/reveal`
- Trim whitespace from the key
- Verify key status is `is_active: true`

---

## Related Documentation

- [System Health API](./system.md)
- [Libraries API](./libraries.md)
- [Error Handling Guide](./errors.md)
- [Code Examples](./examples/)
