# Authentication Guide

Classifarr includes a secure authentication system to protect your media classification setup.

## First-Run Setup

When you first access Classifarr, you'll be prompted to create your admin account:

1. Navigate to `http://your-server:21324`
2. You'll be redirected to the setup wizard
3. Create your admin username, email, and password
4. Password must meet security requirements:
   - At least 8 characters
   - One uppercase letter
   - One lowercase letter
   - One number
   - One special character (!@#$%^&*)
5. After creating your account, you'll be automatically logged in
6. Complete the TMDB and optional AI Provider/Discord configuration

## Login

After initial setup, access the application at `http://your-server:21324` and log in with your credentials.

- You can log in using either your **username** or **email**
- Your session will remain active for 7 days
- Logout from the user menu to end your session

## Password Management

### Changing Your Password

1. Navigate to Settings → General (or User Profile when available)
2. Click "Change Password"
3. Enter your current password
4. Enter and confirm your new password (must meet security requirements)
5. Click "Save"

### Password Requirements

All passwords must meet the following criteria:
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*(),.?":{}|<>)

## Security Features

### JWT Authentication

Classifarr uses JSON Web Tokens (JWT) for authentication:
- Tokens are valid for 7 days
- Tokens are signed with a secure random secret stored in the database
- Tokens are automatically refreshed on activity

### Password Security

- Passwords are hashed using bcrypt with 12 salt rounds
- Password hashes are never exposed via the API
- Failed login attempts are logged for security monitoring

### Audit Logging

All security-related events are logged:
- User logins (successful and failed)
- Password changes
- Account creation
- Logout events

Access audit logs through the database:
```sql
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 50;
```

## API Authentication

To make authenticated API requests, include the JWT token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:21324/api/auth/me
```

## User Roles

Currently, Classifarr supports two roles:
- **admin**: Full access to all features and settings
- **user**: (Reserved for future multi-user support)

## Troubleshooting

### Forgot Password

Currently, there is no password reset mechanism. If you forget your admin password:

1. Access your database directly:
   ```bash
   docker exec -it classifarr psql -U classifarr -d classifarr
   ```

2. Generate a new password hash using bcrypt (12 rounds)

3. Update the database:
   ```sql
   UPDATE users SET password_hash = 'YOUR_NEW_HASH' WHERE username = 'admin';
   ```

### Locked Out

If you're locked out and can't access the database, you can reset the setup:

1. Stop the containers
2. Remove the database volume (this will delete ALL data)
3. Restart and go through the setup wizard again

⚠️ **Warning**: This will delete all your configuration and classification history.

## HTTPS Configuration

Classifarr supports two approaches for securing access with HTTPS:

### Option 1: Reverse Proxy (Recommended)

If you're using Nginx Proxy Manager, Traefik, Caddy, or another reverse proxy, this is the recommended approach:

1. **Keep Classifarr's built-in HTTPS disabled** (default setting)
2. Configure your reverse proxy to:
   - Listen on port 443 with your SSL certificate
   - Proxy traffic to `http://classifarr:21324`
3. The reverse proxy handles TLS termination

#### Nginx Proxy Manager Example

1. Add a new proxy host in NPM
2. **Details Tab:**
   - Domain Names: `classifarr.yourdomain.com`
   - Scheme: `http` (not https)
   - Forward Hostname/IP: `classifarr` (or container IP)
   - Forward Port: `21324`
3. **SSL Tab:**
   - SSL Certificate: Request a new SSL Certificate with Let's Encrypt
   - Force SSL: ✓ Enabled
   - HTTP/2 Support: ✓ Enabled
   - HSTS Enabled: ✓ Enabled

#### Traefik Example

```yaml
services:
  classifarr:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.classifarr.rule=Host(`classifarr.yourdomain.com`)"
      - "traefik.http.routers.classifarr.entrypoints=websecure"
      - "traefik.http.routers.classifarr.tls=true"
      - "traefik.http.routers.classifarr.tls.certresolver=letsencrypt"
      - "traefik.http.services.classifarr.loadbalancer.server.port=21324"
```

#### Caddy Example

```
classifarr.yourdomain.com {
    reverse_proxy classifarr:21324
}
```

### Option 2: Direct HTTPS

If you want Classifarr to serve HTTPS directly (no reverse proxy):

#### 1. Prepare Your Certificate Files

You'll need:
- **Certificate file** (cert.pem): Your domain's SSL certificate
- **Private key file** (key.pem): The private key for your certificate
- **CA certificate** (ca.pem, optional): For mutual TLS authentication

Generate self-signed certificates for testing:
```bash
mkdir certs
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes
```

#### 2. Update Docker Compose

Uncomment the certificate volume mount in `docker-compose.yml`:

```yaml
services:
  classifarr:
    ports:
      - "21324:21324"   # HTTP
      - "21325:21325"   # HTTPS
    volumes:
      - app_data:/app/data
      - ./certs:/app/certs:ro  # Mount your certificate directory
```

#### 3. Configure in Classifarr

1. Navigate to **Settings → SSL/HTTPS**
2. Enable "Direct HTTPS on port 21325"
3. Set certificate paths:
   - Certificate Path: `/app/certs/cert.pem`
   - Private Key Path: `/app/certs/key.pem`
   - CA Certificate Path: `/app/certs/ca.pem` (optional)
4. Optional settings:
   - **Redirect HTTP to HTTPS**: Force all HTTP traffic to HTTPS
   - **Enable HSTS**: Tell browsers to always use HTTPS
   - **Require Client Certificate**: Enable mutual TLS (mTLS)
5. Click "Test Certificates" to verify your certificates are valid
6. Click "Save Configuration"
7. Restart Classifarr:
   ```bash
   docker-compose restart classifarr
   ```

#### 4. Access via HTTPS

Access Classifarr at `https://your-server:21325`

**Note**: If using self-signed certificates, your browser will show a security warning. You can:
- Add an exception in your browser
- Import the certificate into your system's trust store
- Use a proper certificate from Let's Encrypt or another CA

### Mutual TLS (mTLS)

For high-security environments, you can require clients to present a valid certificate:

1. Generate a CA certificate
2. Generate and sign client certificates with your CA
3. In Classifarr SSL settings:
   - Set CA Certificate Path to your CA cert
   - Enable "Require Client Certificate"
4. Configure clients to present their certificate when connecting

### Certificate Renewal

#### With Reverse Proxy
Your reverse proxy (like Nginx Proxy Manager) handles renewal automatically with Let's Encrypt.

#### With Direct HTTPS
You're responsible for renewing certificates:
1. Replace certificate files in the `./certs` directory
2. Restart Classifarr: `docker-compose restart classifarr`

### Troubleshooting

#### "Certificate file not found"
- Verify the certificate path in SSL settings matches the actual file location
- Ensure files are mounted in docker-compose.yml
- Check file permissions (should be readable by the container)

#### "Invalid certificate or key"
- Ensure the certificate and key match
- Verify the certificate format (PEM)
- Check the certificate hasn't expired

#### Browser shows "Not Secure"
- If using self-signed certificates, this is expected
- Add a security exception or use a proper CA-signed certificate
- Verify your domain matches the certificate's Common Name (CN) or Subject Alternative Name (SAN)

### Security Best Practices

1. **Use a reverse proxy** for production deployments
2. **Enable HSTS** to prevent SSL stripping attacks
3. **Use strong certificates** with at least 2048-bit RSA or 256-bit ECDSA
4. **Keep certificates updated** - renew before expiration
5. **Protect private keys** - never share or commit them to version control
6. **Use mTLS** for highly sensitive deployments
7. **Monitor certificate expiration** dates

