# 🛡️ Thinking Security v1.1

A Discord bot that automatically detects and removes crypto-scam screenshots (fake casino promotions, fake giveaways, fake withdrawal-success images, etc.) and times out the user who posted them.

---

## ✨ Features

1. **Exact Image Match** — If someone posts the exact same scam image (identical file), the bot catches it instantly.
2. **Perceptual Match (pHash)** — Even if the image has been resized, cropped, re-saved, or re-compressed (which scammers commonly do), the bot still detects it.
3. **Keyword Filter** *(optional)* — If a message contains scam phrases like `"withdrawal success"`, `"crypto casino"`, `"claim your bonus"`, etc., the bot catches it.
4. **Auto-Action** — On detection: the message is deleted and the member is timed out (default: 10 minutes). Server admins/moderators are never affected.

---

## 📋 Full Server Activity Logging

The bot logs **all** important server events to a single log channel as clean Discord embeds:

- ✉️ Message deleted / edited / bulk deleted
- 👤 Member joined / left / banned / unbanned
- 🏷️ Nickname changed
- 🎭 Roles added or removed from a member
- ⏱️ Member timed out / timeout removed
- 📢 Channel created / deleted / renamed
- 🔑 Role created / deleted / updated
- 🔊 Voice channel joined / left / switched
- 🏠 Server name changed
- 🚫 Scam-image / scam-keyword auto-moderation actions

All events are sent to the channel configured as `notifyChannelId` in `config.json`.

---

## ⚙️ Setup Guide

### 1. Create a Discord Application & Bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. Navigate to the **Bot** tab → **Add Bot** → **Reset Token** → copy the token (this goes into `config.json`)
3. Under **Privileged Gateway Intents**, enable:
   - `MESSAGE CONTENT INTENT`
   - `SERVER MEMBERS INTENT`
4. Go to **OAuth2 → URL Generator**, select scope `bot`, and enable these permissions:
   - `Manage Messages`
   - `Moderate Members` *(required for timeouts)*
   - `View Channels`, `Send Messages` *(for log channel)*
   - `View Audit Log` *(optional, improves log accuracy)*
5. Use the generated URL to invite the bot to your server.

---

### 2. Position the Bot Role

Go to **Server Settings → Roles** and move the bot's role **above** any roles you want it to be able to time out. If the bot's role is below a member's role, timeouts will fail.

---

### 3. Install Node.js

Requires **Node.js 18+** → [nodejs.org](https://nodejs.org)

---

### 4. Install Dependencies

```bash
npm install
```

This downloads `discord.js` and `sharp`. An internet connection is required.

---

### 5. Configure the Bot

Open `config.json` and fill in your values:

```json
{
  "token": "YOUR_BOT_TOKEN_HERE",
  "timeoutMinutes": 10,
  "hammingThreshold": 8,
  "notifyChannelId": "PASTE_YOUR_LOG_CHANNEL_ID_HERE",
  "keywordFilterEnabled": true,
  "scamKeywords": [
    "withdrawal success",
    "crypto casino",
    "promo code",
    "rakeback",
    "claim your bonus",
    "free giveaway",
    "double your crypto",
    "send crypto to receive",
    "verify your wallet"
  ]
}
```

**How to get your Log Channel ID:**
1. In Discord: **User Settings → Advanced → Developer Mode** → turn ON
2. Right-click the log channel → **Copy Channel ID**
3. Paste it as the value of `notifyChannelId`
4. Make sure the bot has **View Channel** and **Send Messages** permissions in that channel.

---

### 6. Add Reference Scam Images *(Most Important Step)*

You need to teach the bot which images are scams by hashing them:

```bash
node add-hash.js path/to/scam1.png path/to/scam2.png
```

Save any known scam screenshots (fake Kai Cenat crypto casino posts, fake withdrawal success screens, etc.) as image files and pass them to this command. The hashes are saved to `scam-hashes.json`. You can run this command even while the bot is running — it auto-reloads within 5 seconds.

---

### 7. Run the Bot

```bash
npm start
```

**For 24/7 background hosting**, use [pm2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start index.js --name scam-guard
pm2 save
pm2 startup
```

---

## 🔧 Tuning Options

| Setting | Description |
|---|---|
| `hammingThreshold` | Controls perceptual match sensitivity. Lower (e.g. `4`) = stricter, fewer false positives. Higher (e.g. `12`) = looser, catches more variants. Default `8` is balanced. |
| `scamKeywords` | Add any common phrases you see in scam messages in your server. |
| `timeoutMinutes` | Duration of the timeout applied to scammers. Default is `10`. |

---

## 📁 Project Structure

```
├── index.js          # Main bot logic (image detection, keyword filter, punishment)
├── eventLogger.js    # Full server activity logging
├── logger.js         # Discord embed log sender
├── hashUtil.js       # SHA-256 and pHash utilities
├── add-hash.js       # CLI tool to add reference scam images
├── scam-hashes.json  # Database of known scam image hashes
├── config.json       # Bot configuration (token, settings)
└── ref-images/       # Reference scam images (local, not required at runtime)
```

---

## ⚠️ Note

This bot is intended for moderating your own server. If you encounter a large-scale scam campaign involving real-world fraud, please also report it to **Discord Trust & Safety**: [dis.gd/report](https://dis.gd/report)

---

## 📄 License

MIT — free to use, modify, and distribute.
