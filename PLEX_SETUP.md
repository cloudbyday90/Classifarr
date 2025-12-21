# Plex Setup Guide

This guide explains how to configure Plex with Classifarr, including how to find your Plex token and server URL.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Finding Your Plex Token](#finding-your-plex-token)
3. [Finding Your Plex Server URL](#finding-your-plex-server-url)
4. [Configuring Classifarr](#configuring-classifarr)
5. [Syncing Libraries](#syncing-libraries)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

To connect Classifarr to Plex, you need:

| Item | Example | Where to Get It |
|------|---------|-----------------|
| **Server URL** | `http://192.168.1.100:32400` | Your Plex server's IP and port |
| **Plex Token** | `xxxxxxxxxxxxxxxxxxxx` | From Plex Web App (see below) |

---

## Finding Your Plex Token

The Plex token (also called `X-Plex-Token`) is a unique authentication key that allows applications like Classifarr to access your Plex server.

### Method 1: From Plex Web App (Easiest)

1. **Open Plex Web App**
   - Go to [app.plex.tv](https://app.plex.tv) in your browser
   - Sign in to your Plex account

2. **Navigate to Any Media Item**
   - Browse to any movie or TV show in your library
   - Click on the item to view its details

3. **Open the Media Info**
   - Click the **three dots** (⋮) menu button
   - Select **"Get Info"** or **"View Info"**

4. **View XML**
   - In the info window, look for **"View XML"** link (usually bottom-left)
   - Click it to open a new tab

5. **Extract Your Token**
   - Look at the URL in your browser's address bar
   - Find `X-Plex-Token=` at the end
   - Copy everything after the equals sign

   **Example URL:**
   ```
   https://192.168.1.100:32400/library/metadata/12345?X-Plex-Token=abc123xyz789
   ```
   
   **Your token:** `abc123xyz789`

### Method 2: From Plex Settings (Alternative)

1. Go to [plex.tv/claim](https://www.plex.tv/claim/) while signed in
2. This shows your claim token (different from auth token)
3. For the full token, use the XML method above

### Method 3: From Plex Preferences File

**Windows:**
```
%LOCALAPPDATA%\Plex Media Server\Preferences.xml
```

**Linux:**
```
/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Preferences.xml
```

**macOS:**
```
~/Library/Application Support/Plex Media Server/Preferences.xml
```

**Docker:**
```bash
docker exec -it plex cat "/config/Library/Application Support/Plex Media Server/Preferences.xml" | grep -oP 'PlexOnlineToken="\K[^"]+'
```

Look for `PlexOnlineToken="YOUR_TOKEN_HERE"` in the file.

---

## Finding Your Plex Server URL

Your Plex server URL is typically:

```
http://[SERVER_IP]:32400
```

### Common Examples

| Setup | URL Example |
|-------|-------------|
| Same machine as Classifarr | `http://localhost:32400` |
| Local network IP | `http://192.168.1.100:32400` |
| Docker (same network) | `http://plex:32400` |
| Docker (host network) | `http://host.docker.internal:32400` |
| With HTTPS | `https://192.168.1.100:32400` |

### How to Find Your Server IP

**From Plex Settings:**
1. Open Plex Web App
2. Go to **Settings** → **Remote Access**
3. Look for "Private IP address"

**From Plex Server:**
```bash
# Linux
hostname -I | awk '{print $1}'

# Windows PowerShell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}).IPAddress

# Docker
docker inspect plex | grep IPAddress
```

---

## Configuring Classifarr

1. **Open Classifarr**
   - Navigate to `http://your-classifarr-server:21324`
   - Log in with your admin account

2. **Go to Media Server Settings**
   - Click **Settings** in the sidebar
   - Select **Media Server** tab

3. **Enter Configuration**

   | Field | Value |
   |-------|-------|
   | **Server Type** | Plex |
   | **Server Name** | My Plex Server (or any name) |
   | **Server URL** | `http://192.168.1.100:32400` |
   | **Plex Token** | Your token from above |

4. **Test Connection**
   - Click **"Test Connection"**
   - You should see "Connection successful!" with your server name

5. **Save Configuration**
   - Click **"Save"**

---

## Syncing Libraries

After configuring Plex:

1. **Go to Libraries Page**
   - Click **Libraries** in the sidebar

2. **Sync Libraries**
   - Click **"Sync Libraries"** button
   - Classifarr will import all movie and TV libraries from Plex

3. **Map Libraries to Radarr/Sonarr**
   - Click on each library
   - Configure which Radarr/Sonarr instance to use
   - Set quality profile and root folder

---

## Troubleshooting

### "Connection Failed" or "Unable to Connect"

**Check the URL format:**
- ✅ Correct: `http://192.168.1.100:32400`
- ❌ Wrong: `http://192.168.1.100:32400/` (no trailing slash)
- ❌ Wrong: `192.168.1.100:32400` (missing protocol)
- ❌ Wrong: `http://192.168.1.100` (missing port)

**Check network connectivity:**
```bash
# From the Classifarr container
curl -s http://192.168.1.100:32400/identity

# If using Docker, try the container name
curl -s http://plex:32400/identity
```

**Check firewall:**
- Ensure port 32400 is accessible
- Check Plex Settings → Network → "Allowed networks"

### "Unauthorized" or "Invalid Token"

1. **Generate a new token** using the XML method above
2. **Check token validity** - tokens don't expire unless you sign out everywhere
3. **Make sure you're the server owner** - the token must belong to the account that owns the server

### "SSL Certificate Error"

If using HTTPS:
1. Try HTTP instead: `http://...` instead of `https://...`
2. Or, disable SSL verification (not recommended for production)
3. Use a proper SSL certificate

### Docker Network Issues

**Classifarr can't reach Plex container:**

1. **Same Docker network:**
   ```yaml
   services:
     classifarr:
       networks:
         - media-network
     plex:
       networks:
         - media-network
   networks:
     media-network:
   ```
   Use URL: `http://plex:32400`

2. **Different networks (host access):**
   ```yaml
   services:
     classifarr:
       extra_hosts:
         - "host.docker.internal:host-gateway"
   ```
   Use URL: `http://host.docker.internal:32400`

3. **Bridge mode (use host IP):**
   ```bash
   # Find host IP
   ip route | grep default | awk '{print $3}'
   ```
   Use that IP with port 32400

### "Library Sync Returns Empty"

1. Check that libraries exist in Plex
2. Verify libraries are "movie" or "show" type (not music, photos, etc.)
3. Check Plex logs for errors
4. Try refreshing libraries in Plex first

### Token Security

> ⚠️ **Important**: Your Plex token provides full access to your Plex server. Keep it secure!

- Never share your token publicly
- Don't commit it to git
- Classifarr stores tokens encrypted in the database
- If compromised, sign out of all devices in Plex account settings

---

## Quick Reference

### Requirements

- Plex Media Server (any recent version)
- Network access from Classifarr to Plex (port 32400)
- Plex account that owns the server

### Token Format

- 20 characters, alphanumeric
- Example: `ABCD1234xyz789token01`

### API Endpoints Used

Classifarr uses these Plex API endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/identity` | Test connection |
| `/library/sections` | List libraries |
| `/library/sections/{id}/all` | List library items |
| `/library/sections/{id}/collections` | List collections |

---

## Need Help?

- **GitHub Issues**: [Report a bug](https://github.com/cloudbyday90/Classifarr/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/cloudbyday90/Classifarr/discussions)
- **Plex Support**: [Plex Forums](https://forums.plex.tv/)
