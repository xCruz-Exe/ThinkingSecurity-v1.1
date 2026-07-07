const { AuditLogEvent } = require('discord.js');
const { sendLog } = require('./logger');

const COLORS = {
  delete: 0xed4245,
  edit: 0xfaa61a,
  join: 0x57f287,
  leave: 0xed4245,
  ban: 0x992d22,
  unban: 0x57f287,
  timeout: 0xfaa61a,
  role: 0x5865f2,
  channel: 0x5865f2,
  voice: 0x5865f2,
  server: 0x5865f2,
};

function truncate(text, max = 1000) {
  if (!text) return '(no content)';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function registerEventLogging(client, config) {
  // ---------- MESSAGES ----------

  client.on('messageDelete', async (message) => {
    if (!message.guild || message.author?.bot) return;
    await sendLog(message.guild, config, {
      title: 'Message Deleted',
      color: COLORS.delete,
      description: `**Author:** ${message.author?.tag ?? 'Unknown'} (${message.author?.id ?? 'n/a'})\n` +
                   `**Channel:** <#${message.channel.id}>`,
      fields: [
        { name: 'Content', value: truncate(message.content) },
      ],
    });
  });

  client.on('messageDeleteBulk', async (messages) => {
    const first = messages.first();
    if (!first?.guild) return;
    await sendLog(first.guild, config, {
      title: 'Bulk Message Delete',
      color: COLORS.delete,
      description: `**Channel:** <#${first.channel.id}>\n**Messages removed:** ${messages.size}`,
    });
  });

  client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return; // ignore embed-only updates
    await sendLog(newMessage.guild, config, {
      title: 'Message Edited',
      color: COLORS.edit,
      description: `**Author:** ${newMessage.author?.tag ?? 'Unknown'} (${newMessage.author?.id ?? 'n/a'})\n` +
                   `**Channel:** <#${newMessage.channel.id}>`,
      fields: [
        { name: 'Before', value: truncate(oldMessage.content) },
        { name: 'After', value: truncate(newMessage.content) },
      ],
    });
  });

  // ---------- MEMBERS ----------

  client.on('guildMemberAdd', async (member) => {
    const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
    await sendLog(member.guild, config, {
      title: 'Member Joined',
      color: COLORS.join,
      description: `**User:** ${member.user.tag} (${member.user.id})`,
      fields: [
        { name: 'Account Created', value: `${accountAgeDays} days ago`, inline: true },
        { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true },
      ],
    });
  });

  client.on('guildMemberRemove', async (member) => {
    await sendLog(member.guild, config, {
      title: 'Member Left',
      color: COLORS.leave,
      description: `**User:** ${member.user.tag} (${member.user.id})`,
      fields: [
        { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true },
      ],
    });
  });

  client.on('guildBanAdd', async (ban) => {
    await sendLog(ban.guild, config, {
      title: 'Member Banned',
      color: COLORS.ban,
      description: `**User:** ${ban.user.tag} (${ban.user.id})`,
    });
  });

  client.on('guildBanRemove', async (ban) => {
    await sendLog(ban.guild, config, {
      title: 'Member Unbanned',
      color: COLORS.unban,
      description: `**User:** ${ban.user.tag} (${ban.user.id})`,
    });
  });

  // Nickname changes, role changes, and timeouts all come through guildMemberUpdate
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      await sendLog(newMember.guild, config, {
        title: 'Nickname Changed',
        color: COLORS.edit,
        description: `**User:** ${newMember.user.tag} (${newMember.user.id})`,
        fields: [
          { name: 'Before', value: oldMember.nickname ?? '(none)', inline: true },
          { name: 'After', value: newMember.nickname ?? '(none)', inline: true },
        ],
      });
    }

    // Role changes
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    const added = newRoles.filter((r) => !oldRoles.has(r.id));
    const removed = oldRoles.filter((r) => !newRoles.has(r.id));
    if (added.size || removed.size) {
      const fields = [];
      if (added.size) fields.push({ name: 'Roles Added', value: added.map((r) => r.name).join(', ') });
      if (removed.size) fields.push({ name: 'Roles Removed', value: removed.map((r) => r.name).join(', ') });
      await sendLog(newMember.guild, config, {
        title: 'Member Roles Updated',
        color: COLORS.role,
        description: `**User:** ${newMember.user.tag} (${newMember.user.id})`,
        fields,
      });
    }

    // Timeout change
    const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
    const newTimeout = newMember.communicationDisabledUntilTimestamp;
    if (oldTimeout !== newTimeout) {
      if (newTimeout && newTimeout > Date.now()) {
        await sendLog(newMember.guild, config, {
          title: 'Member Timed Out',
          color: COLORS.timeout,
          description: `**User:** ${newMember.user.tag} (${newMember.user.id})`,
          fields: [
            { name: 'Timed Out Until', value: `<t:${Math.floor(newTimeout / 1000)}:F>` },
          ],
        });
      } else if (oldTimeout && (!newTimeout || newTimeout <= Date.now())) {
        await sendLog(newMember.guild, config, {
          title: 'Member Timeout Removed',
          color: COLORS.unban,
          description: `**User:** ${newMember.user.tag} (${newMember.user.id})`,
        });
      }
    }
  });

  // ---------- CHANNELS ----------

  client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    await sendLog(channel.guild, config, {
      title: 'Channel Created',
      color: COLORS.channel,
      description: `**Name:** ${channel.name}\n**Type:** ${channel.type}`,
    });
  });

  client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    await sendLog(channel.guild, config, {
      title: 'Channel Deleted',
      color: COLORS.channel,
      description: `**Name:** ${channel.name}\n**Type:** ${channel.type}`,
    });
  });

  client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (!newChannel.guild) return;
    if (oldChannel.name === newChannel.name) return;
    await sendLog(newChannel.guild, config, {
      title: 'Channel Renamed',
      color: COLORS.channel,
      description: `**Before:** ${oldChannel.name}\n**After:** ${newChannel.name}`,
    });
  });

  // ---------- ROLES ----------

  client.on('roleCreate', async (role) => {
    await sendLog(role.guild, config, {
      title: 'Role Created',
      color: COLORS.role,
      description: `**Name:** ${role.name}`,
    });
  });

  client.on('roleDelete', async (role) => {
    await sendLog(role.guild, config, {
      title: 'Role Deleted',
      color: COLORS.role,
      description: `**Name:** ${role.name}`,
    });
  });

  client.on('roleUpdate', async (oldRole, newRole) => {
    if (oldRole.name === newRole.name && oldRole.permissions.bitfield === newRole.permissions.bitfield) return;
    await sendLog(newRole.guild, config, {
      title: 'Role Updated',
      color: COLORS.role,
      description: `**Role:** ${newRole.name}`,
      fields: [
        { name: 'Name Changed', value: oldRole.name !== newRole.name ? `${oldRole.name} → ${newRole.name}` : 'No', inline: true },
        { name: 'Permissions Changed', value: oldRole.permissions.bitfield !== newRole.permissions.bitfield ? 'Yes' : 'No', inline: true },
      ],
    });
  });

  // ---------- VOICE ----------

  client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member ?? oldState.member;
    if (!member) return;

    if (!oldState.channelId && newState.channelId) {
      await sendLog(newState.guild, config, {
        title: 'Voice Channel Joined',
        color: COLORS.voice,
        description: `**User:** ${member.user.tag}\n**Channel:** ${newState.channel?.name}`,
      });
    } else if (oldState.channelId && !newState.channelId) {
      await sendLog(oldState.guild, config, {
        title: 'Voice Channel Left',
        color: COLORS.voice,
        description: `**User:** ${member.user.tag}\n**Channel:** ${oldState.channel?.name}`,
      });
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      await sendLog(newState.guild, config, {
        title: 'Voice Channel Switched',
        color: COLORS.voice,
        description: `**User:** ${member.user.tag}\n**From:** ${oldState.channel?.name}\n**To:** ${newState.channel?.name}`,
      });
    }
  });

  // ---------- SERVER ----------

  client.on('guildUpdate', async (oldGuild, newGuild) => {
    if (oldGuild.name === newGuild.name) return;
    await sendLog(newGuild, config, {
      title: 'Server Name Changed',
      color: COLORS.server,
      description: `**Before:** ${oldGuild.name}\n**After:** ${newGuild.name}`,
    });
  });
}

module.exports = { registerEventLogging };
