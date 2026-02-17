# Demo / Promo Discord Bot

A Discord bot with web dashboard for managing role promotions and demotions.

## Quick Setup

1. Create `.env`
2. Fill your bot token + IDs:
   ```
   BOT_TOKEN=your_bot_token_here
   LOG_CHANNEL_ID=channel_id_for_logs
   ALLOWED_ROLE_IDS=role1_id,role2_id
   AUTO_START=false
   PORT=3000
   ```
3. Install deps:
   - `npm install`
4. Run bot:
   - `npm start`
5. Access web dashboard at `http://localhost:3000`

## Features

**Discord Commands:**
- `j$demo` - Demote users by removing their highest role and giving them the role one level down
- `j$promo` - Promote users by removing their highest role and giving them the role one level up  
- `j$help` - Shows all available commands

**Web Dashboard:**
- **Bot Status** (`/botstatus`) - View bot status, uptime, and control the bot (start/stop/restart)
- **Server Stats** (`/serverstats`) - View all servers the bot is in with member counts and permissions
- **Invite Bot** (`/invite`) - Generate invite links with proper permissions

## Bot Control

By default, the bot does NOT auto-start when the server launches. You must start it via the web dashboard at `/botstatus`.

To enable auto-start on server launch, set `AUTO_START=true` in your `.env` file.

Once started (either via web or auto-start), the bot will stay online 24/7 until manually stopped.

## Config

- `BOT_TOKEN`: Your Discord bot token (required)
- `ALLOWED_ROLE_IDS`: Comma-separated role IDs that can use demo/promo commands
- `LOG_CHANNEL_ID`: Channel where logs are sent
- `AUTO_START`: Set to `true` to auto-start bot on server launch (default: false)
- `PORT`: Web server port (default: 3000)

## Requirements

- Bot needs proper permissions in server
- Bot can only manage roles below its highest role (role hierarchy matters)
- Enable **Server Members Intent** in Discord Developer Portal  
- Enable **Message Content Intent** in Discord Developer Portal

## Hosting

This bot needs a persistent process for 24/7 operation. Use Railway, Render, VPS, or PM2.

Deploy on Railway (easy):
1. Push this repo to GitHub
2. Create new Railway project from your repo
3. Railway will auto-detect `railway.json`
4. Add env vars in Railway:
   - `BOT_TOKEN`
   - `LOG_CHANNEL_ID`
   - `ALLOWED_ROLE_IDS`
5. Deploy and keep it running 24/7

Deploy on Render:
1. Push this repo to GitHub
2. Create a new **Worker** service on Render
3. Render reads `render.yaml` settings
4. Add env vars:
   - `BOT_TOKEN`
   - `LOG_CHANNEL_ID`
   - `ALLOWED_ROLE_IDS`
5. Deploy

Run on your own machine with PM2:
1. `npm install`
2. `npm install -g pm2`
3. `pm2 start ecosystem.config.cjs`
4. `pm2 save`

Files added for hosting:
- `railway.json`
- `render.yaml`
- `Dockerfile`
- `Procfile`
- `ecosystem.config.cjs`
