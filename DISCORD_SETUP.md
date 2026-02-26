# Discord Bot Setup Guide

This guide walks you through setting up a Discord bot for Classifarr from scratch. The bot enables real-time notifications when media is classified, and allows users to correct classifications directly from Discord.

## Table of Contents

1. [Create a Discord Application](#1-create-a-discord-application)
2. [Create the Bot](#2-create-the-bot)
3. [Get Your Bot Token](#3-get-your-bot-token)
4. [Configure Bot Permissions](#4-configure-bot-permissions)
5. [Invite Bot to Your Server](#5-invite-bot-to-your-server)
6. [Get Your Channel ID](#6-get-your-channel-id)
7. [Configure Classifarr](#7-configure-classifarr)
8. [Test the Bot](#8-test-the-bot)
9. [Troubleshooting](#troubleshooting)

---

## 1. Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Log in with your Discord account
3. Click the **"New Application"** button (top right)
4. Enter a name for your application (e.g., "Classifarr")
5. Accept the Discord Developer Terms of Service
6. Click **"Create"**

> **Note:** The application name will be your bot's display name in Discord.

---

## 2. Create the Bot

1. In your application's settings, click **"Bot"** in the left sidebar
2. Click **"Add Bot"**
3. Click **"Yes, do it!"** to confirm
4. Your bot is now created!

### Configure Bot Settings

Under the **Bot** section, configure these settings:

| Setting | Value | Reason |
|---------|-------|--------|
| **Public Bot** | ❌ Off | Only you should be able to add this bot |
| **Requires OAuth2 Code Grant** | ❌ Off | Not needed for this bot |
| **Presence Intent** | ❌ Off | Not needed |
| **Server Members Intent** | ❌ Off | Not needed |
| **Message Content Intent** | ✅ **ON** | Required for reading button interactions |

> **Important:** Make sure to enable **Message Content Intent** or button interactions may not work properly.

---

## 3. Get Your Bot Token

The bot token is like a password - it allows Classifarr to control your bot.

1. In the **Bot** section, find the **Token** area
2. Click **"Reset Token"** (or "Copy" if visible)
3. Click **"Yes, do it!"** to confirm
4. Click **"Copy"** to copy the token

⚠️ **SECURITY WARNING:**
- **Never share your bot token publicly**
- **Never commit it to git or post it online**
- If your token is exposed, immediately reset it in the Developer Portal

Save this token - you'll need it for Classifarr configuration.

---

## 4. Configure Bot Permissions

Classifarr needs specific permissions to function. Here's what each permission does:

### Required Permissions

| Permission | Numeric Value | Purpose |
|------------|---------------|---------|
| Send Messages | `2048` | Send classification notifications |
| Embed Links | `16384` | Display rich embeds with media info |
| Attach Files | `32768` | Attach poster images |
| Read Message History | `65536` | Read previous messages for context |
| Use External Emojis | `262144` | Display status emojis |
| Add Reactions | `64` | Add reaction confirmations |

### Combined Permission Integer

The combined permission integer for all required permissions is: **`379968`**

You'll use this when generating the invite URL.

---

## 5. Invite Bot to Your Server

1. In the Developer Portal, go to **OAuth2** → **URL Generator**
2. Under **Scopes**, select:
   - ✅ `bot`
   - ✅ `applications.commands` (optional, for future slash commands)

3. Under **Bot Permissions**, select:
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Read Message History
   - ✅ Use External Emojis
   - ✅ Add Reactions

4. Copy the generated URL at the bottom
5. Open the URL in your browser
6. Select your Discord server from the dropdown
7. Click **"Authorize"**
8. Complete the CAPTCHA

### Quick Invite URL

You can also construct the URL manually. Replace `YOUR_CLIENT_ID` with your application's Client ID (found in the **General Information** section):

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=379968&scope=bot
```

---

## 6. Get Your Channel ID

You need the Channel ID of where you want Classifarr notifications to appear.

### Enable Developer Mode

1. Open Discord (desktop app or browser)
2. Go to **User Settings** (gear icon near your username)
3. Navigate to **App Settings** → **Advanced**
4. Enable **"Developer Mode"**

### Copy Channel ID

1. Navigate to the channel you want to use for notifications
2. Right-click on the channel name in the sidebar
3. Click **"Copy Channel ID"**

The Channel ID is a long number like: `1234567890123456789`

> **Tip:** Create a dedicated channel like `#media-requests` for Classifarr notifications.

---

## 7. Configure Classifarr

1. Open Classifarr web UI (`http://your-server:21324`)
2. Log in with your admin account
3. Go to **Settings** → **Discord** (or **Notifications**)
4. Enter your configuration:

| Field | Value |
|-------|-------|
| **Bot Token** | The token you copied in Step 3 |
| **Channel ID** | The channel ID you copied in Step 6 |
| **Enable Notifications** | ✅ On |

### Optional Settings

| Setting | Description |
|---------|-------------|
| **Notify on Classification** | Send notification when media is classified |
| **Notify on Error** | Send notification when classification fails |
| **Notify on Correction** | Send notification when user corrects a classification |
| **Show Poster** | Include movie/show poster in embed |
| **Show Confidence** | Display AI confidence percentage |
| **Show Method** | Show which classification method was used |
| **Enable Corrections** | Add interactive buttons for corrections |

5. Click **"Test Connection"** to verify the bot works
6. Click **"Save"**

---

## 8. Test the Bot

To verify everything is working:

1. In Classifarr, go to **Settings** → **Discord**
2. Make sure you have:
   - Entered your Bot Token
   - Selected a Server
   - Selected a Channel
3. Click **"Test Connection"**
4. **Check your Discord channel** for a green test notification

### Expected Test Notification

If successful, you should see a message in your Discord channel like:

> **✅ Classifarr Test Notification**
> 
> Your Discord bot is configured correctly and can send notifications!
> 
> **Bot:** YourBotName | **Channel:** #your-channel | **Server:** Your Server Name
> 
> _This is a test message from Classifarr_

### What the Test Validates

The test connection will:
- ✅ Verify bot token is valid
- ✅ Check bot can access the specified channel  
- ✅ Validate all required permissions
- ✅ Send an actual notification to confirm delivery
- ✅ Display server and channel names

### Permission Validation

The test will check for these required permissions:
- **Send Messages** - Critical, required to send any notifications
- **Embed Links** - Critical, required for rich embeds
- **Attach Files** - For poster images
- **Read Message History** - For context in interactions
- **Use External Emojis** - For status indicators
- **Add Reactions** - For interactive confirmations

**Critical permissions** (Send Messages, Embed Links) must be present or the test will fail. Other permissions will generate warnings if missing but won't block the test.

### Test with a Real Request

After test passes:

1. Make a media request in Overseerr/Jellyseerr
2. Wait for Classifarr to process it
3. Check your Discord channel for the classification notification

---

## Troubleshooting

### Test Connection Fails - "Invalid bot token"

**Solution:**
1. Go to Discord Developer Portal → Your Application → Bot
2. Click **"Reset Token"**
3. Copy the new token
4. Paste it in Classifarr settings
5. Try testing again

### Test Connection Fails - "Channel not found"

**Causes:**
- Bot is not in the selected server
- Channel ID is incorrect
- Bot was removed from server

**Solution:**
1. Verify the bot is in your Discord server (you should see it in the member list)
2. If not, re-invite using the URL from Step 5
3. Double-check the Channel ID (Right-click channel → Copy Channel ID)
4. Try selecting the server and channel again from dropdowns

### Test Connection Fails - "Missing critical permissions"

**What it means:**  
Your bot lacks essential permissions (Send Messages or Embed Links) in the selected channel.

**Solution Option 1 - Re-invite with correct permissions:**
1. Remove bot from server (Server Settings → Members → Right-click bot → Kick)
2. Use invite URL from Step 5 with correct permissions
3. Authorize bot again
4. Test connection

**Solution Option 2 - Grant permissions manually:**
1. Right-click the channel → **Edit Channel**
2. Go to **Permissions** tab
3. Click **+ Add members or roles**
4. Find and select your bot
5. Enable these permissions:
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Read Message History
   - ✅ Use External Emojis
   - ✅ Add Reactions
6. Click **Save Changes**
7. Test connection again

### Test Connection Shows Warning - "Some optional permissions are missing"

**What it means:**  
Bot can send notifications but is missing non-critical permissions (like Add Reactions, Attach Files).

**Impact:**
- Notifications will work
- Some features may be limited (e.g., no poster images if Attach Files is missing)

**Solution:**
Follow the same steps as "Missing critical permissions" above to grant all recommended permissions for full functionality.

### No Test Notification in Discord

**Check:**
1. You selected the correct channel in Classifarr settings
2. Bot is actually in that Discord server (check member list)
3. No firewall/network blocking Discord API access from Classifarr
4. Check Classifarr logs for detailed error:
   ```bash
   docker logs classifarr
   ```

### Bot is offline in Discord

**Causes:**
- Classifarr container is not running
- Bot token is invalid or reset
- Network connectivity issues

**Solution:**
1. Verify Classifarr is running: `docker ps | grep classifarr`
2. Check bot token is still valid (not reset in Discord portal)
3. Restart Classifarr: `docker restart classifarr`
4. Check logs: `docker logs classifarr`

### No notifications appearing (after test passed)

**Check in Classifarr settings:**
1. ✅ "Enable Discord Notifications" is ON
2. ✅ "Notify on Classification" is ON
3. Channel ID is correct

**Check Discord settings:**
1. Channel notifications aren't muted
2. Bot has permission to send messages in the channel
3. No Discord server-wide role restrictions

**Check Classifarr is processing requests:**
1. Go to Classifarr → Queue or History
2. Verify media is being processed
3. Check logs for Discord-related errors

### Buttons not working in notifications

**Causes:**
- Message Content Intent not enabled
- Bot lacks permission to add components

**Solution:**
1. Discord Developer Portal → Your App → Bot
2. Enable **"Message Content Intent"** under Privileged Gateway Intents
3. Save changes
4. Restart Classifarr: `docker restart classifarr`
5. Verify "Add Reactions" permission is granted

### Rate limiting

Discord rate limits bots that send too many messages. If you see rate limit errors:
- Reduce notification frequency
- Disable less important notification types
- Consider using a webhook instead for high-volume scenarios

---

## Security Best Practices

1. **Dedicated Channel**: Create a private channel only for Classifarr notifications
2. **Minimal Permissions**: Only grant the permissions listed above
3. **Token Security**: Never share your bot token
4. **Regular Audits**: Periodically review bot permissions
5. **Private Bot**: Keep "Public Bot" disabled to prevent unauthorized use

---

## Quick Reference

### Required Information

| Item | Where to Get It |
|------|-----------------|
| Bot Token | Developer Portal → Bot → Token |
| Channel ID | Right-click channel → Copy Channel ID |
| Client ID | Developer Portal → General Information |

### Required Bot Permissions

```
Send Messages, Embed Links, Attach Files, 
Read Message History, Use External Emojis, Add Reactions
```

Permission Integer: `379968`

### Invite URL Template

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=379968&scope=bot
```

---

## Need Help?

- **GitHub Issues**: [Report a bug](https://github.com/cloudbyday90/Classifarr/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/cloudbyday90/Classifarr/discussions)
- **Discord**: Join our community server (coming soon)
