# System Health API

Monitor all connected services in real-time with comprehensive health endpoints. The System Health API provides detailed status information, trend indicators, and Kubernetes-compatible probes.

**Version:** v0.41.0-alpha adds trend indicators and enhanced service monitoring.

---

## Table of Contents

1. [Overview](#overview)
2. [Endpoints](#endpoints)
3. [Service Status Values](#service-status-values)
4. [Trend Indicators](#trend-indicators)
5. [Response Fields](#response-fields)
6. [Kubernetes Probes](#kubernetes-probes)
7. [Examples](#examples)

---

## Overview

The System Health API provides:

- **Real-time monitoring** of all connected services
- **Trend indicators** showing improving/degrading/stable health
- **Last successful check** tracking for reliability analysis
- **Latency monitoring** with historical comparison
- **Kubernetes-compatible** liveness and readiness probes
- **Auto-refresh** support for dashboards

### Authentication

- **Liveness/Readiness probes:** No authentication required
- **All other health endpoints:** Require JWT token or API key

---

## Endpoints

### GET /api/system/status

Authenticated application/database version and startup observations. The existing
`pgvector` fields (`build`, `selectedVariant`, `cpuAvx`, `cpuAvx2`, `lastChecked`)
remain available. Its additive `selection` object contains `status` and `report`.
`GET /api/rag/status` exposes the same object as `pgvectorSelection`, alongside
its existing flat pgvector fields. No new mutation endpoint is introduced.

| Selection status | Meaning |
| --- | --- |
| `current_process` | Reporter and database-start time match this reader; legacy settings agree |
| `other_process` | Another application process or an earlier run saved the report |
| `database_changed` | Database-start time differs from the saved report |
| `settings_changed` | Legacy selection settings no longer agree with the report |
| `unavailable` | Database context or settings could not be read |
| `legacy` | No detailed report was saved |
| `invalid` | Unsupported, malformed, oversized or inconsistent report |

A validated version-1 `report` contains `reporterId` (opaque application-run UUID),
`recordedAt`, `selectedAt`, `databaseStartedAt` (UTC timestamps; the latter two
are nullable when unknown), `databaseScope` (`embedded_entrypoint` or `unverified`), `reason`,
`selectedVariant`, `build`, `cpuAvx` and `cpuAvx2`. Missing/invalid reports are
`null`. No hostnames, paths, connection strings or credentials are included.
Database lookup failure still returns `pgvector: null` from system status.

This is a bounded latest observation, not loaded-binary verification, an ownership
lease, a health result or tamper-proof evidence. Only a current embedded report
can support specific staging guidance. Older servers may omit it entirely.
See the [design and reason policy](../architecture/pgvector-startup-report-design.md).

System presents these observations in **pgvector startup compatibility**, outside
the service-health totals. Only current embedded evidence supports a CPU comparison;
generic selection is not a health result. Database connectivity and RAG catalog/
index readiness remain separate checks. Neither the startup report nor catalog
presence proves which native binary a database session loaded. See the
[compatibility/health separation design](../architecture/pgvector-health-separation-design.md).

### GET /api/system/health

Get database-focused readiness with a service breakdown. Its top-level `status`
and HTTP result are not an aggregate of optional services. Use the detailed
services endpoint below for that summary; liveness/readiness semantics are unchanged.

**Authentication:** Required (API Key or JWT)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `refresh` | boolean | `false` | Force fresh health checks (bypasses cache) |

**Success Response (200):**
```json
{
  "status": "healthy",
  "version": "0.41.0-alpha",
  "uptime": 3600,
  "database": "connected",
  "mediaServer": "connected",
  "radarr": "connected",
  "sonarr": "connected",
  "ollama": "not_configured",
  "tmdb": "connected",
  "omdb": "connected",
  "discordBot": "not_configured",
  "tavily": "not_configured",
  "queueWorker": "healthy",
  "details": {
    "database": {
      "status": "connected",
      "responseTime": 5,
      "lastCheck": "2026-02-01T12:00:00Z"
    },
    "mediaServer": {
      "status": "connected",
      "type": "Plex",
      "responseTime": 120,
      "lastCheck": "2026-02-01T12:00:00Z"
    }
  },
  "timestamp": "2026-02-01T12:00:00Z"
}
```

**Error Response (503):**
```json
{
  "status": "unhealthy",
  "error": "Database connection failed",
  "timestamp": "2026-02-01T12:00:00Z"
}
```

**Example:**
```bash
# Get cached health status
curl -X GET http://localhost:21324/api/system/health \
  -H "X-API-Key: clf_your_key"

# Force fresh health checks
curl -X GET "http://localhost:21324/api/system/health?refresh=true" \
  -H "X-API-Key: clf_your_key"
```

---

### GET /api/system/health/services

Get detailed health status of all services with trends and latency tracking.

**Authentication:** Required (API Key or JWT)

**Success Response (200):**
```json
{
  "overall": "degraded",
  "services": [
    {
      "name": "PostgreSQL",
      "status": "healthy",
      "latency": 5,
      "lastSuccessfulCheck": "2026-02-01T12:00:00Z",
      "previousStatus": "healthy",
      "previousResponseTime": 6,
      "trend": "improving",
      "timestamp": "2026-02-01T12:00:00Z"
    },
    {
      "name": "Plex",
      "status": "healthy",
      "latency": 120,
      "lastSuccessfulCheck": "2026-02-01T11:59:00Z",
      "previousStatus": "degraded",
      "previousResponseTime": 250,
      "trend": "improving",
      "timestamp": "2026-02-01T12:00:00Z"
    },
    {
      "name": "Radarr (4K Movies)",
      "status": "healthy",
      "latency": 85,
      "lastSuccessfulCheck": "2026-02-01T12:00:00Z",
      "previousStatus": "healthy",
      "previousResponseTime": 80,
      "trend": "stable",
      "timestamp": "2026-02-01T12:00:00Z",
      "instance": {
        "id": 1,
        "name": "4K Movies",
        "url": "http://radarr-4k:7878"
      }
    },
    {
      "name": "Sonarr (TV Shows)",
      "status": "degraded",
      "latency": 450,
      "lastSuccessfulCheck": "2026-02-01T11:55:00Z",
      "previousStatus": "healthy",
      "previousResponseTime": 100,
      "trend": "degrading",
      "error": "High latency detected",
      "timestamp": "2026-02-01T12:00:00Z"
    }
  ],
  "summary": {
    "total": 4,
    "active": 4,
    "healthy": 3,
    "failed": 0,
    "degraded": 1,
    "unknown": 0,
    "disabled": 0,
    "notConfigured": 0,
    "unhealthy": 1
  },
  "timestamp": "2026-02-01T12:00:00Z"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `overall` | string | Returned service observations: `healthy`, `degraded`, `unhealthy`, `unknown` |
| `services[]` | array | Array of service health objects |
| `services[].name` | string | Service display name (e.g., "Plex", "Radarr (4K Movies)") |
| `services[].status` | string | Current health status (see [Service Status Values](#service-status-values)) |
| `services[].latency` | integer | Response time in milliseconds |
| `services[].lastSuccessfulCheck` | string | ISO timestamp of last successful health check |
| `services[].previousStatus` | string | Previous health status for trend calculation |
| `services[].previousResponseTime` | integer | Previous latency for trend detection |
| `services[].trend` | string | Health trend: `improving`, `degrading`, `stable` |
| `services[].timestamp` | string | ISO timestamp of this health check |
| `services[].error` | string | Error message (only present if status is unhealthy/degraded) |
| `services[].instance` | object | Instance details for multi-instance services (Radarr/Sonarr) |
| `summary.total` | integer | Total number of services |
| `summary.healthy` | integer | Number of healthy services |
| `summary.unhealthy` | integer | Number of unhealthy/degraded services |
| `summary.active` | integer | Total excluding explicitly disabled/not-configured rows; includes unknown rows |
| `summary.failed` | integer | Unhealthy rows, excluding degraded rows |
| `summary.degraded` | integer | Degraded rows |
| `summary.unknown` | integer | Unknown, missing or unsupported statuses |
| `summary.disabled` | integer | Explicitly disabled rows |
| `summary.notConfigured` | integer | Explicitly not-configured rows |

Aggregation precedence is unhealthy, degraded, unknown, then healthy. Healthy
requires at least one active row and every active row to report healthy. Empty
and inactive-only lists are unknown, not healthy. `summary.unhealthy` now counts
`failed + degraded`; previously it counted every non-healthy row, including
unknown/inactive states. Consumers that need unresolved observations must also
check `summary.unknown` or `overall`, not just `summary.unhealthy`.

Counts describe the returned rows, not a complete installation inventory. The
existing endpoint filters out some unconfigured services and disabled RAG and
expands Radarr/Sonarr instances. The System page instead presents fixed service
categories, so its denominator may differ while following the same status policy.

The System page labels its response receipt time separately from individual
probe times. Failed polling or forced refresh makes its summary unavailable
and labels retained cards as last received results. Receipt time is not proof
of a new check: responses may contain cached service observations. This change
does not impose a new cache-age threshold or change probe cadence.

**Example:**
```bash
curl -X GET http://localhost:21324/api/system/health/services \
  -H "X-API-Key: clf_your_key"
```

---

### GET /api/system/health/live

Liveness probe for Kubernetes/Docker health checks.

**Authentication:** Not required (public endpoint)

**Success Response (200):**
```json
{
  "status": "alive",
  "timestamp": "2026-02-01T12:00:00Z"
}
```

**Usage:**

This endpoint is designed for container orchestration platforms to verify the application is running.

**Docker Compose:**
```yaml
services:
  classifarr:
    image: cloudbyday90/classifarr:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:21324/api/system/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

**Kubernetes:**
```yaml
livenessProbe:
  httpGet:
    path: /api/system/health/live
    port: 21324
  initialDelaySeconds: 60
  periodSeconds: 30
  timeoutSeconds: 10
  failureThreshold: 3
```

**Example:**
```bash
curl -X GET http://localhost:21324/api/system/health/live
```

---

### GET /api/system/health/ready

Readiness probe for Kubernetes/Docker to determine if the service can handle traffic.

**Authentication:** Not required (public endpoint)

**Success Response (200):**
```json
{
  "status": "ready",
  "database": "connected",
  "timestamp": "2026-02-01T12:00:00Z"
}
```

**Not Ready Response (503):**
```json
{
  "status": "not_ready",
  "database": "disconnected",
  "timestamp": "2026-02-01T12:00:00Z"
}
```

**Usage:**

This endpoint checks if the database is connected. Use this for readiness probes to prevent traffic from being routed to an instance that isn't ready.

**Kubernetes:**
```yaml
readinessProbe:
  httpGet:
    path: /api/system/health/ready
    port: 21324
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

**Example:**
```bash
curl -X GET http://localhost:21324/api/system/health/ready
```

---

### POST /api/system/health/refresh

Force refresh all health checks immediately (bypasses cache).

**Authentication:** Required (API Key or JWT)

**Success Response (200):**
```json
{
  "success": true,
  "health": {
    "database": { "status": "connected", "responseTime": 5 },
    "mediaServer": { "status": "connected", "responseTime": 120 }
  }
}
```

**Error Response (500):**
```json
{
  "error": "Failed to refresh health checks"
}
```

**Example:**
```bash
curl -X POST http://localhost:21324/api/system/health/refresh \
  -H "X-API-Key: clf_your_key"
```

---

## Service Status Values

All services report one of these status values:

| Status | Description | Color | Icon |
|--------|-------------|-------|------|
| `healthy` | Service is fully operational | Green | ✅ |
| `degraded` | Service is functioning but with issues (high latency, partial failures) | Yellow | ⚠️ |
| `unhealthy` | Service is not functioning | Red | ❌ |
| `not_configured` | Service is not set up | Gray | ⚙️ |
| `disabled` | Service is explicitly disabled | Gray | ⏸️ |
| `unknown` | Status cannot be determined | Gray | ❓ |

### Status Mapping

The system maps internal service states to these standard statuses:

```javascript
// From service check results:
'healthy' | 'connected' | 'available' → 'healthy'
'partial' | 'degraded' | 'configured' | 'circuit_open' → 'degraded'
'unhealthy' | 'error' | 'disconnected' | 'unavailable' → 'unhealthy'
'not configured' | 'not_configured' → 'not_configured'
'disabled' → 'disabled'
// Any missing, malformed or unsupported value becomes 'unknown'.
```

---

## Trend Indicators

**New in v0.41.0-alpha:** Trend indicators show whether service health is improving, degrading, or stable.

### Trend Values

| Trend | Symbol | Description |
|-------|--------|-------------|
| `improving` | ↗️ | Service health is getting better |
| `degrading` | ↘️ | Service health is getting worse |
| `stable` | → | No significant changes |

### Trend Calculation

Trends are calculated by comparing:

1. **Current status** vs. **Previous status**
2. **Current latency** vs. **Previous latency**

**Improving:**
- Status changed from `unhealthy` → `degraded` or `healthy`
- Status changed from `degraded` → `healthy`
- Latency decreased by more than 20%

**Degrading:**
- Status changed from `healthy` → `degraded` or `unhealthy`
- Status changed from `degraded` → `unhealthy`
- Latency increased by more than 20%

**Stable:**
- Status unchanged and latency variation < 20%
- No previous data available (first check)

### Example Trend Scenarios

**Scenario 1: Service Recovering**
```json
{
  "name": "Plex",
  "status": "healthy",
  "latency": 100,
  "previousStatus": "degraded",
  "previousResponseTime": 500,
  "trend": "improving"
}
```

**Scenario 2: Service Degrading**
```json
{
  "name": "Radarr",
  "status": "degraded",
  "latency": 2000,
  "previousStatus": "healthy",
  "previousResponseTime": 150,
  "trend": "degrading"
}
```

**Scenario 3: Stable Service**
```json
{
  "name": "PostgreSQL",
  "status": "healthy",
  "latency": 5,
  "previousStatus": "healthy",
  "previousResponseTime": 6,
  "trend": "stable"
}
```

---

## Response Fields

### New Fields in v0.41.0-alpha

The following fields were added to track service health over time:

#### lastSuccessfulCheck

**Type:** ISO 8601 timestamp (string)

**Description:** When the service was last confirmed healthy. This helps identify:
- How long a service has been down
- Reliability of services over time
- Whether a service has ever been healthy

**Example:**
```json
{
  "name": "Radarr",
  "status": "unhealthy",
  "lastSuccessfulCheck": "2026-02-01T10:30:00Z",
  "timestamp": "2026-02-01T12:00:00Z"
}
```
*Service has been down for 1.5 hours*

#### previousStatus

**Type:** string (service status value)

**Description:** The status from the previous health check, used to calculate trends.

#### previousResponseTime

**Type:** integer (milliseconds)

**Description:** The latency from the previous health check, used to detect performance degradation.

#### trend

**Type:** string (`improving`, `degrading`, `stable`)

**Description:** Indicates whether service health is getting better, worse, or staying the same.

---

## Kubernetes Probes

### Complete Configuration Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: classifarr
spec:
  replicas: 1
  selector:
    matchLabels:
      app: classifarr
  template:
    metadata:
      labels:
        app: classifarr
    spec:
      containers:
      - name: classifarr
        image: cloudbyday90/classifarr:latest
        ports:
        - containerPort: 21324
          name: http
        
        # Liveness probe - restart if unhealthy
        livenessProbe:
          httpGet:
            path: /api/system/health/live
            port: 21324
            scheme: HTTP
          initialDelaySeconds: 60
          periodSeconds: 30
          timeoutSeconds: 10
          successThreshold: 1
          failureThreshold: 3
        
        # Readiness probe - remove from service if not ready
        readinessProbe:
          httpGet:
            path: /api/system/health/ready
            port: 21324
            scheme: HTTP
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          successThreshold: 1
          failureThreshold: 3
        
        # Startup probe - allow extra time for initialization
        startupProbe:
          httpGet:
            path: /api/system/health/live
            port: 21324
            scheme: HTTP
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          successThreshold: 1
          failureThreshold: 30  # 30 * 10s = 5 minutes for startup
        
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

---

## Examples

### Monitor Service Health (JavaScript)

```javascript
const CLASSIFARR_URL = 'http://localhost:21324';
const API_KEY = process.env.CLASSIFARR_API_KEY;

async function checkHealth() {
  const response = await fetch(`${CLASSIFARR_URL}/api/system/health/services`, {
    headers: {
      'X-API-Key': API_KEY
    }
  });
  
  const data = await response.json();
  
  // Check overall health
  if (data.overall !== 'healthy') {
    console.warn('System is unhealthy!');
  }
  
  // Find degrading services
  const degrading = data.services.filter(s => s.trend === 'degrading');
  if (degrading.length > 0) {
    console.warn('Services degrading:', degrading.map(s => s.name));
  }
  
  // Alert on high latency
  data.services.forEach(service => {
    if (service.latency > 1000) {
      console.warn(`High latency on ${service.name}: ${service.latency}ms`);
    }
  });
  
  return data;
}

// Poll health every 30 seconds
setInterval(checkHealth, 30000);
```

### Monitor Service Health (Python)

```python
import requests
import time
from datetime import datetime, timedelta

CLASSIFARR_URL = 'http://localhost:21324'
API_KEY = os.environ['CLASSIFARR_API_KEY']

def check_health():
    """Check system health and alert on issues"""
    response = requests.get(
        f'{CLASSIFARR_URL}/api/system/health/services',
        headers={'X-API-Key': API_KEY}
    )
    response.raise_for_status()
    data = response.json()
    
    # Check overall health
    if data['overall'] != 'healthy':
        print(f'⚠️  System is {data["overall"]}')
    
    # Analyze each service
    for service in data['services']:
        # Alert on degrading services
        if service['trend'] == 'degrading':
            print(f'↘️  {service["name"]} is degrading')
        
        # Alert on unhealthy services
        if service['status'] in ['unhealthy', 'degraded']:
            last_success = service.get('lastSuccessfulCheck')
            if last_success:
                down_since = datetime.fromisoformat(last_success.replace('Z', '+00:00'))
                duration = datetime.now(down_since.tzinfo) - down_since
                print(f'❌ {service["name"]} has been down for {duration}')
            else:
                print(f'❌ {service["name"]} is {service["status"]}')
    
    return data

# Monitor continuously
while True:
    try:
        check_health()
    except Exception as e:
        print(f'Health check failed: {e}')
    
    time.sleep(30)
```

### Dashboard Auto-Refresh

```javascript
// Dashboard component with auto-refresh
function HealthDashboard() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchHealth() {
      try {
        const response = await fetch('/api/system/health/services', {
          headers: { 'X-API-Key': API_KEY }
        });
        const data = await response.json();
        setServices(data.services);
      } catch (error) {
        console.error('Health check failed:', error);
      } finally {
        setLoading(false);
      }
    }
    
    // Initial fetch
    fetchHealth();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div className="health-dashboard">
      {services.map(service => (
        <ServiceCard
          key={service.name}
          name={service.name}
          status={service.status}
          latency={service.latency}
          trend={service.trend}
        />
      ))}
    </div>
  );
}
```

---

## Related Documentation

- [Authentication Guide](./authentication.md)
- [Error Handling Guide](./errors.md)
- [API Overview](./README.md)
