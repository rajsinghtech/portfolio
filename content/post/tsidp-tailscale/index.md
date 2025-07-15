---
title: "tsidp Just Got a UI, and Managing SSO Has Never Been Easier"
date: 2025-07-15 00:00:00+0000
slug: tsidp-ui-tailscale
categories:
  - Tailscale
tags:
  - tailscale
  - authentication
  - oidc
  - ui
description: "Introducing a web UI for tsidp that makes turning your Tailscale network into a single sign-on provider as easy as clicking a button"
featured: true
toc: true
weight: 1
---

## tsidp Now Has a Web UI!

If you've been following Tailscale's experimental features, you might have heard about tsidp—the tool that turns your tailnet into an OpenID Connect provider. It's brilliant: use your Tailscale identity to log into Grafana, Portainer, or any OIDC-compatible app. No more passwords. No more separate user management.

The latest update brings something game-changing: **a built-in web UI for managing OIDC clients**. No more JSON files, no more command-line configuration. Just a clean, simple interface that makes SSO setup as easy as clicking buttons.

Let me show you how much easier authentication just got.

## Before: Manual Configuration Hell

Previously, managing OIDC clients in tsidp meant:

```bash
# Option 1: Edit JSON files directly
vim /var/lib/tsidp/oidc-clients.json

# Option 2: Use curl to make API calls
curl -X POST https://idp.ts.net/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"grafana","redirect_uris":["https://grafana.ts.net/oauth/callback"]}'

# Hope you saved that secret somewhere...
```

No visual feedback. No easy way to see all your clients. Just raw JSON and API calls.

## After: Click, Type, Done

With the new UI, here's the same process:

1. Open `https://idp.your-tailnet.ts.net`
2. Click "New Client"
3. Type in a name and redirect URI
4. Copy the generated secret
5. Save

That's it. No JSON. No command line. No manual secret generation.

## What the UI Brings to the Table

![tsidp client dashboard](clients.png)

### Client Management Dashboard
The main screen shows all your OIDC clients at a glance. No more guessing what's configured—everything's right there:
- Client names and IDs
- When they were created
- Quick edit and delete buttons

### One-Click Client Creation
Adding a new app to your SSO setup is now ridiculously simple:

![Creating a new OIDC client](client-create.png)

1. Click "New Client"
2. Give it a friendly name (like "Grafana" or "Portainer")
3. Add your redirect URIs
4. Hit save

The UI generates a cryptographically secure secret and shows it exactly once. This isn't me being paranoid—it's good security practice that prevents accidental secret exposure.

![Client created successfully with one-time secret display](client-create-sucess.png)

### Visual Feedback That Makes Sense
- Clear success messages when clients are created
- Obvious warnings about one-time secret viewing
- Form validation that catches errors before they happen
- Dark theme that matches Tailscale's aesthetic (because consistency matters)

## Real-World Usage: From Setup to Login in 3 Minutes

Let me walk you through setting up Grafana with tsidp using the new UI:

### Step 1: Create the Client (30 seconds)

1. Navigate to your tsidp UI
2. Click "New Client"
3. Name: "Grafana"
4. Redirect URI: `https://grafana.ts.net/login/generic_oauth`
5. Save and copy that secret!

### Step 2: Configure Grafana (2 minutes)

Add this to your `grafana.ini`:

```ini
[auth.generic_oauth]
enabled = true
name = Tailscale
client_id = [your-client-id-from-ui]
client_secret = [that-secret-you-copied]
scopes = openid email profile
auth_url = https://idp.your-tailnet.ts.net/authorize
token_url = https://idp.your-tailnet.ts.net/token
api_url = https://idp.your-tailnet.ts.net/userinfo
```

### Step 3: There Is No Step 3

Restart Grafana. Click "Sign in with Tailscale". You're in. No passwords. No 2FA dance. Just your tailnet doing what it does best.

<video src="grafana-login.mov" controls style="width: 100%; max-width: 800px;">
  Your browser does not support the video tag.
</video>

## Who This Is For

### The Homelab Hero
Running 20+ services with different passwords? The UI makes it trivial to migrate them all to Tailscale-based auth. No more password resets, no more forgotten credentials.

### The Small Team Lead
Managing access for a small team? Add their Tailscale emails to your network, and they automatically get access to all your internal tools. When someone leaves, remove them from Tailscale—done.

### The Security-Conscious Developer
Want SSO without the complexity of enterprise solutions? The UI makes tsidp accessible without compromising security. One-time secret viewing, secure generation, clear audit trails.

## Getting Started in 5 Minutes

Ready to simplify your authentication? Here's the quickest way with Docker:

### 1. Run tsidp with Docker (1 minute)

```bash
docker run -d \
    --name tsidp \
    -p 443:443 \
    -e TS_AUTHKEY=tskey-auth-krxBUk3kED11CNTRL-JrD6Kq5tqUB2ykyBgYxkUB9x3vTLpsZ9a \
    -e TAILSCALE_USE_WIP_CODE=1 \
    -v tsidp-data:/var/lib/tsidp \
    tailscale/tsidp:unstable \
    tsidp --hostname=idp --dir=/var/lib/tsidp
```

Replace the `TS_AUTHKEY` with your actual Tailscale auth key from [the admin console](https://login.tailscale.com/admin/settings/keys).

### 2. Access the UI (10 seconds)

Once it's running, open your browser to `https://idp.your-tailnet.ts.net`

You'll see the clean client management dashboard:

![tsidp client dashboard](clients.png)

### 3. Create Your First Client (1 minute)

Click "New Client" and fill in:
- **Name**: Your app's name (e.g., "Grafana")
- **Redirect URI**: Your app's OAuth callback URL
- Click save and **copy that secret immediately!**

### 4. Configure Your App (2-3 minutes)

Each app needs these tsidp endpoints:
- **Authorization**: `https://idp.your-tailnet.ts.net/authorize`
- **Token**: `https://idp.your-tailnet.ts.net/token`
- **User Info**: `https://idp.your-tailnet.ts.net/userinfo`

### 5. Test It Out

Log out of your app, click "Sign in with Tailscale", and enjoy password-free access!

## Common Apps That Work Great

Here are some popular services that work seamlessly with tsidp:

- **Grafana** - Monitoring dashboards
- **Portainer** - Container management
- **Proxmox** - Virtualization platform
- **Wiki.js** - Documentation
- **Gitea** - Git hosting
- **NextCloud** - File sharing
- **Jellyfin/Plex** - Media servers
- **Home Assistant** - Home automation

Basically, if it supports OIDC, it works with tsidp.

---

*tsidp is experimental and requires `TAILSCALE_USE_WIP_CODE=1`. Perfect for homelabs and internal tools, but not recommended for production use yet.*

*The UI is open source and contributions are welcome! Find it on [GitHub](https://github.com/tailscale/tailscale) and help make authentication even simpler.*