# Securify Bot

Discord management bot with a web dashboard.

## What it does

- Role workflow commands:
  - `j$demo`
  - `j$promo`
- Ticket system:
  - Configure and deploy ticket panel from the website
  - Ticket commands with `j$ticket ...`
  - Open/close ticket flow with transcript logging
- Bot controls from dashboard:
  - Start, stop, restart
  - Send messages, embeds, and images
  - Bot movement report to log channel/webhook
- Server and status monitoring pages

## Basic setup

1. Create `.env`
2. Add required values:

   ```
   BOT_TOKEN=your_bot_token_here
   LOG_CHANNEL_ID=your_log_channel_id
   ALLOWED_ROLE_IDS=role1_id,role2_id
   AUTO_START=false
   PORT=3000
   ```

3. Install and run:

   ```
   npm install
   npm start
   ```

4. Open dashboard at `http://localhost:3000`

## Creator

Created by CrxxrDev.
