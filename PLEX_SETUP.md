# Plex Setup Guide

Connect Classifarr to your Plex Media Server to enable library-based classification.

## Quick Setup (OAuth - Recommended)

Classifarr supports **Plex OAuth** for easy one-click authentication.

1. **Open Classifarr Settings**
   - Navigate to `http://your-classifarr-server:21324`
   - Go to **Settings** → **Media Server**

2. **Select Plex**
   - Choose **Plex** as your server type

3. **Click "Sign in with Plex"**
   - A popup window opens to Plex's login page
   - Sign in with your Plex account
   - Authorize Classifarr to access your account

4. **Select Your Server**
   - After authorization, a list of your Plex servers appears
   - Select the server you want to use
   - If you have multiple connections (local IP, remote, etc.), choose the one Classifarr can reach

5. **Test Connection**
   - Click **Test Connection** to verify
   - You should see "Connection successful!" with your server name

6. **Save and Sync**
   - Click **Save**
   - Go to **Libraries** → **Sync Libraries**

---

## Manual Configuration (Alternative)

If OAuth doesn't work (network restrictions, etc.), you can configure Plex manually.

### What You Need

| Item | Example |
|------|---------|
| **Server URL** | `http://192.168.1.100:32400` |
| **Plex Token** | `xxxxxxxxxxxxxxxxxxxx` |

### Finding Your Plex Token

**Method 1: From Plex Web App**

1. Open [app.plex.tv](https://app.plex.tv) and sign in
2. Navigate to any movie or TV show
3. Click the **⋮** menu → **Get Info**
4. Click **View XML** (usually bottom-left)
5. In the URL bar, find `X-Plex-Token=YOUR_TOKEN_HERE`

**Method 2: From Plex Preferences File**

| Platform | File Location |
|----------|---------------|
| **Windows** | `%LOCALAPPDATA%\Plex Media Server\Preferences.xml` |
| **Linux** | `/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Preferences.xml` |
| **Docker** | `docker exec plex cat "/config/Library/Application Support/Plex Media Server/Preferences.xml"` |

Look for `PlexOnlineToken="YOUR_TOKEN"` in the file.

### Finding Your Server URL

Your Plex server URL is typically `http://[IP]:32400`.

| Setup | URL |
|-------|-----|
| Same machine | `http://localhost:32400` |
| Local network | `http://192.168.1.100:32400` |
| Docker (same network) | `http://plex:32400` |
| Docker (host access) | `http://host.docker.internal:32400` |

---

## Syncing Libraries

After connecting Plex:

1. Go to **Libraries** in the sidebar
2. Click **Sync Libraries**
3. Classifarr imports all movie and TV show libraries
4. Click each library to configure:
   - Radarr/Sonarr instance
   - Root folder
   - Quality profile

---

## Troubleshooting

### OAuth Popup Blocked
- Check browser popup settings
- Try a different browser
- Use manual configuration instead

### Connection Failed
- ✅ Correct: `http://192.168.1.100:32400`
- ❌ Wrong: `http://192.168.1.100:32400/` (trailing slash)
- ❌ Wrong: `192.168.1.100:32400` (missing http://)

### Docker Network Issues

If Classifarr can't reach Plex in Docker:

1. **Same Docker network** - Use container name: `http://plex:32400`
2. **Different networks** - Use host IP or `http://host.docker.internal:32400`

### Invalid Token
- Generate a new token using the XML method
- Make sure you own the Plex server (not just a shared user)

---

## Security Notes

> ⚠️ Your Plex token provides full access to your server. Keep it secure!

- Classifarr stores tokens encrypted in the database
- Never share your token publicly
- If compromised, sign out of all devices in Plex account settings

---

## Need Help?

- [GitHub Issues](https://github.com/cloudbyday90/Classifarr/issues)
- [Plex Forums](https://forums.plex.tv/)
