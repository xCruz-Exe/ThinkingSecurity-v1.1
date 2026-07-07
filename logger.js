const { EmbedBuilder } = require('discord.js');

async function getLogChannel(guild, config) {
  if (!config.notifyChannelId || config.notifyChannelId.startsWith('PASTE_')) return null;
  try {
    return await guild.channels.fetch(config.notifyChannelId);
  } catch {
    return null;
  }
}

async function sendLog(guild, config, { title, description, color = 0x5865f2, fields = [], footer }) {
  const channel = await getLogChannel(guild, config);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp();

  if (description) embed.setDescription(description);
  if (fields.length) embed.addFields(fields);
  if (footer) embed.setFooter({ text: footer });

  channel.send({ embeds: [embed] }).catch((err) => {
    console.error('Failed to send log message:', err.message);
  });
}

module.exports = { sendLog, getLogChannel };
