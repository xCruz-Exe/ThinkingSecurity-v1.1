const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
} = require('discord.js');
const { sha256, pHash, hammingDistance } = require('./hashUtil');
const { registerEventLogging } = require('./eventLogger');
const { sendLog } = require('./logger');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const DB_PATH = path.join(__dirname, 'scam-hashes.json');

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

let config = loadJSON(CONFIG_PATH);
let db = loadJSON(DB_PATH);

// Reload the scam-hash database from disk without restarting the bot
// (so you can add new reference images with add-hash.js while it's running)
function reloadDb() {
  db = loadJSON(DB_PATH);
}
fs.watchFile(DB_PATH, { interval: 5000 }, reloadDb);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,   // ban add/remove events
    GatewayIntentBits.GuildVoiceStates,  // voice join/leave/switch events
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Watching for ${db.sha256.length} exact + ${db.phash.length} perceptual scam-image hashes.`);
  if (!config.notifyChannelId || config.notifyChannelId.startsWith('PASTE_')) {
    console.warn('WARNING: notifyChannelId is not set in config.json — server activity logs will not be sent anywhere.');
  } else {
    console.log(`Logging all server activity to channel ID ${config.notifyChannelId}`);
  }
});

registerEventLogging(client, config);

async function isKnownScamImage(buffer) {
  const sha = sha256(buffer);
  if (db.sha256.includes(sha)) {
    return { match: true, type: 'exact' };
  }

  const ph = await pHash(buffer);
  for (const knownHash of db.phash) {
    const dist = hammingDistance(ph, knownHash);
    if (dist <= config.hammingThreshold) {
      return { match: true, type: 'similar', distance: dist };
    }
  }
  return { match: false };
}

function containsScamKeywords(text) {
  if (!config.keywordFilterEnabled || !text) return false;
  const lower = text.toLowerCase();
  return config.scamKeywords.some((kw) => lower.includes(kw.toLowerCase()));
}

async function punishMember(message, reason) {
  const member = message.member;
  const channel = message.channel;

  // Delete the offending message first
  try {
    await message.delete();
  } catch (err) {
    console.error('Could not delete message:', err.message);
  }

  // Send a public warning in the same channel mentioning the spammer
  try {
    const { EmbedBuilder } = require('discord.js');
    const warningEmbed = new EmbedBuilder()
      .setColor(0xff3333)
      .setTitle('🚫 Spam Detected & Removed')
      .setDescription(
        `${message.author} **${message.author.username}** sent a scam message that was automatically removed.\n\n` +
        `⏱️ They have been timed out for **${config.timeoutMinutes} minutes**.\n\n` +
        `*Stay safe — do not click any suspicious links or offers!*`
      )
      .setFooter({ text: '🛡️ Protected by Thinking Security Bot' })
      .setTimestamp();

    let warningMsg;
    try {
      warningMsg = await channel.send({ embeds: [warningEmbed] });
    } catch (embedErr) {
      console.warn('Embed sending failed, attempting plain text fallback:', embedErr.message);
      // Fallback to plain text message if the bot doesn't have "Embed Links" permission
      warningMsg = await channel.send(
        `🚫 ${message.author} (**${message.author.username}**) sent a scam/invite link that was automatically removed! ` +
        `They have been timed out for **${config.timeoutMinutes} minutes**.`
      );
    }

    // Auto-delete the warning after 15 seconds to keep the channel clean
    setTimeout(() => {
      warningMsg.delete().catch(() => {});
    }, 15000);
  } catch (err) {
    console.error('Could not send public warning:', err.message);
  }

  // Timeout the member, if the bot has permission and they aren't an admin
  if (member && member.moderatable) {
    try {
      const ms = config.timeoutMinutes * 60 * 1000;
      await member.timeout(ms, reason);
    } catch (err) {
      console.error('Could not timeout member:', err.message);
    }
  }

  // Log the action to the configured log channel
  await sendLog(message.guild, config, {
    title: 'Scam Message Removed',
    color: 0x992d22,
    description: `**User:** ${message.author.tag} (${message.author.id})\n**Channel:** <#${message.channel.id}>`,
    fields: [
      { name: 'Reason', value: reason },
      { name: 'Action Taken', value: `Timed out for ${config.timeoutMinutes} minutes` },
    ],
  });
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // Never act on server admins/mods so the bot can't be used to lock them out
  if (message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) return;

  // 0) Discord invite link check
  const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)[a-zA-Z0-9-]+/i;
  if (inviteRegex.test(message.content)) {
    await punishMember(message, 'Posted an unauthorized Discord invite link.');
    return;
  }

  // 1) Keyword check on the message text
  if (containsScamKeywords(message.content)) {
    await punishMember(message, 'Message matched known crypto-scam keywords.');
    return;
  }


  // 2) Image check on attachments
  for (const attachment of message.attachments.values()) {
    const isImage = attachment.contentType?.startsWith('image/');
    if (!isImage) continue;

    try {
      const res = await fetch(attachment.url);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const result = await isKnownScamImage(buffer);
      if (result.match) {
        await punishMember(
          message,
          `Posted a known crypto-scam image (${result.type} match).`
        );
        return; // one strike is enough per message
      }
    } catch (err) {
      console.error('Error checking attachment:', err.message);
    }
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err.message);
  if (err.message.includes('ENOTFOUND') || err.message.includes('TIMEOUT') || err.message.includes('timeout') || err.message.includes('ECONNRESET')) {
    console.log('Network error detected. Keeping process alive and letting Discord.js handle reconnection...');
  } else {
    process.exit(1);
  }
});

async function startBot(retries = 99999, delay = 5000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await client.login(config.token);
      return;
    } catch (err) {
      console.error(`Login attempt ${i} failed: ${err.message}`);
      if (i < retries) {
        console.log(`Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error('All login attempts failed. Exiting.');
        process.exit(1);
      }
    }
  }
}

startBot();
