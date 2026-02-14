# Demo / Promo Discord Bot

Quick setup fr:

1. Create `.env`
2. Fill your bot token + IDs
3. Install deps:
   - `npm install`
4. Run bot:
   - `npm start`

What it does:
- `j$demo` starts the flow (prefix only)
- asks for IDs with button + popup
- auto pulls IDs from any messy text, sorts them, shows live progress
- lets you submit IDs to run a demo wave (demote by 1 role each)
- sends run log details to your log channel ID
- auto-cleans stale saved ID sessions after 10 minutes

Config spots:
- `ALLOWED_ROLE_IDS`: only these roles can use `j$demo`
- `LOG_CHANNEL_ID`: where logs go

Heads up:
- Bot needs proper perms in server
- Bot can only remove roles it can manage (role hierarchy still matters)
- Turn on Server Members Intent in Discord Developer Portal
- Turn on Message Content Intent in Discord Developer Portal for `j$demo`

Hosting note:
- Prefix bots need a persistent process, so Vercel is not the right host for this mode.
- Use Railway, Render, a VPS, or PM2 on your own machine for 24/7 hosting.
