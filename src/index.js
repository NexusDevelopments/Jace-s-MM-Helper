require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const LIGHT_BLUE = 0x87cefa;
const PREFIX = 'j$';
const OWNER_ID = '1435310225010987088';
const BOT_TOKEN = process.env.BOT_TOKEN;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const PORT = process.env.PORT || 3000;
const ALLOWED_ROLE_IDS = (process.env.ALLOWED_ROLE_IDS || '')
  .split(',')
  .map((roleId) => roleId.trim())
  .filter(Boolean);
const SESSION_TTL_MS = 10 * 60 * 1000;

const sessions = new Map();
let botStartTime = null;
let client = null;
let sessionCleanupInterval = null;

function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseUserIds(input) {
  const matches = input.match(/\d{17,20}/g) || [];
  const unique = [...new Set(matches)];
  return unique.sort((a, b) => {
    const left = BigInt(a);
    const right = BigInt(b);
    if (left === right) return 0;
    return left < right ? -1 : 1;
  });
}

function makeBar(done, total, width = 20) {
  if (total <= 0) return '-------------------- 0%';
  const filled = Math.round((done / total) * width);
  const clamped = Math.max(0, Math.min(width, filled));
  const bar = `${'#'.repeat(clamped)}${'-'.repeat(width - clamped)}`;
  const percent = Math.round((done / total) * 100);
  return `${bar} ${percent}%`;
}

function hasAllowedRole(member, userId) {
  if (userId === OWNER_ID) return true;
  if (!ALLOWED_ROLE_IDS.length) return true;
  return member.roles.cache.some((role) => ALLOWED_ROLE_IDS.includes(role.id));
}

function getDemotionRoles(member) {
  const topRemovableRole = member.roles.cache
    .filter((role) => role.id !== member.guild.id && !role.managed && role.editable)
    .sort((left, right) => right.position - left.position)
    .first() || null;

  if (!topRemovableRole) {
    return { roleToRemove: null, roleToAdd: null, reason: 'no removable role found' };
  }

  const roleBelow = member.guild.roles.cache
    .filter((role) => role.id !== member.guild.id && !role.managed && role.editable)
    .sort((left, right) => right.position - left.position)
    .find((role) => role.position < topRemovableRole.position) || null;

  if (!roleBelow) {
    return {
      roleToRemove: topRemovableRole,
      roleToAdd: null,
      reason: 'no lower assignable role found'
    };
  }

  return { roleToRemove: topRemovableRole, roleToAdd: roleBelow, reason: null };
}

function getPromotionRoles(member) {
  const topRemovableRole = member.roles.cache
    .filter((role) => role.id !== member.guild.id && !role.managed && role.editable)
    .sort((left, right) => right.position - left.position)
    .first() || null;

  if (!topRemovableRole) {
    return { roleToRemove: null, roleToAdd: null, reason: 'no removable role found' };
  }

  const roleAbove = member.guild.roles.cache
    .filter((role) => role.id !== member.guild.id && !role.managed && role.editable)
    .sort((left, right) => left.position - right.position)
    .find((role) => role.position > topRemovableRole.position) || null;

  if (!roleAbove) {
    return {
      roleToRemove: topRemovableRole,
      roleToAdd: null,
      reason: 'no higher assignable role found'
    };
  }

  return { roleToRemove: topRemovableRole, roleToAdd: roleAbove, reason: null };
}

function buildFormatProgressEmbed(done, total) {
  return new EmbedBuilder()
    .setColor(LIGHT_BLUE)
    .setTitle('Formatting IDs')
    .setDescription(`Progress: ${done}/${total}\n${makeBar(done, total)}`);
}

function buildDemoteProgressEmbed(done, total) {
  return new EmbedBuilder()
    .setColor(LIGHT_BLUE)
    .setTitle('Running demo wave...')
    .setDescription(`Progress: ${done}/${total}\n${makeBar(done, total)}`);
}

function buildPromoteProgressEmbed(done, total) {
  return new EmbedBuilder()
    .setColor(LIGHT_BLUE)
    .setTitle('Running promo wave...')
    .setDescription(`Progress: ${done}/${total}\n${makeBar(done, total)}`);
}

function shortList(label, ids) {
  if (!ids.length) return `${label}: none`;
  const preview = ids.slice(0, 25).join(', ');
  const extra = ids.length > 25 ? ` ... +${ids.length - 25} more` : '';
  return `${label}: ${preview}${extra}`;
}

function getDemoStartPayload() {
  const embed = new EmbedBuilder()
    .setColor(LIGHT_BLUE)
    .setTitle('Demo Wave Setup')
    .setDescription('Send the list of user ids.');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('demo_paste_ids')
      .setLabel('Paste list of IDs')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function getPromoStartPayload() {
  const embed = new EmbedBuilder()
    .setColor(LIGHT_BLUE)
    .setTitle('Promo Wave Setup')
    .setDescription('Send the list of user ids.');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('promo_paste_ids')
      .setLabel('Paste list of IDs')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function setupBotHandlers() {
  client.removeAllListeners();

  client.once('ready', () => {
    botStartTime = Date.now();
    console.log(`Bot online as ${client.user.tag}`);

    if (sessionCleanupInterval) {
      clearInterval(sessionCleanupInterval);
    }

    sessionCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [userId, session] of sessions.entries()) {
        if (now - session.createdAt > SESSION_TTL_MS) {
          sessions.delete(userId);
        }
      }
    }, 60 * 1000);
  });

  client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.inGuild()) return;

  const content = message.content.trim().toLowerCase();
  
  if (content.startsWith(`${PREFIX}demo`)) {
    if (!hasAllowedRole(message.member, message.author.id)) {
      await message.reply('You do not have access to this command.');
      return;
    }
    await message.reply(getDemoStartPayload());
    return;
  }
  
  if (content.startsWith(`${PREFIX}promo`)) {
    if (!hasAllowedRole(message.member, message.author.id)) {
      await message.reply('You do not have access to this command.');
      return;
    }
    await message.reply(getPromoStartPayload());
    return;
  }
  
  if (content.startsWith(`${PREFIX}help`)) {
    const helpEmbed = new EmbedBuilder()
      .setColor(LIGHT_BLUE)
      .setTitle('Available Commands')
      .setDescription('Here are the commands you can use:')
      .addFields(
        { name: 'j$demo', value: 'Demote users by removing their highest role and giving them the role one level down.' },
        { name: 'j$promo', value: 'Promote users by removing their highest role and giving them the role one level up.' },
        { name: 'j$help', value: 'Shows this help message with all available commands.' }
      )
      .setTimestamp();
    
    await message.reply({ embeds: [helpEmbed] });
    return;
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId === 'demo_paste_ids') {
      const modal = new ModalBuilder().setCustomId('demo_ids_modal').setTitle('Paste IDs');

      const idsInput = new TextInputBuilder()
        .setCustomId('ids_input')
        .setLabel('User IDs')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Paste ids in any format')
        .setRequired(true);

      const modalRow = new ActionRowBuilder().addComponents(idsInput);
      modal.addComponents(modalRow);

      await interaction.showModal(modal);
      return;
    }
    
    if (interaction.isButton() && interaction.customId === 'promo_paste_ids') {
      const modal = new ModalBuilder().setCustomId('promo_ids_modal').setTitle('Paste IDs');

      const idsInput = new TextInputBuilder()
        .setCustomId('ids_input')
        .setLabel('User IDs')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Paste ids in any format')
        .setRequired(true);

      const modalRow = new ActionRowBuilder().addComponents(idsInput);
      modal.addComponents(modalRow);

      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'demo_ids_modal') {
      const raw = interaction.fields.getTextInputValue('ids_input');
      const ids = parseUserIds(raw);

      if (!ids.length) {
        await interaction.reply({
          content: 'No valid user IDs were found. Try again.',
          ephemeral: true
        });
        return;
      }

      sessions.set(interaction.user.id, {
        ids,
        createdAt: Date.now(),
        guildId: interaction.guildId,
        type: 'demo'
      });

      await interaction.reply({ content: 'Ids have been submitted!', ephemeral: true });

      const progressMessage = await interaction.followUp({
        embeds: [buildFormatProgressEmbed(0, ids.length)],
        ephemeral: true,
        fetchReply: true
      });

      for (let index = 0; index < ids.length; index += 1) {
        await sleep(280);
        await interaction.webhook.editMessage(progressMessage.id, {
          embeds: [buildFormatProgressEmbed(index + 1, ids.length)]
        });
      }

      const doneEmbed = new EmbedBuilder()
        .setColor(LIGHT_BLUE)
        .setTitle('Wave IDs formatted successfully')
        .setDescription(`Total IDs ready: ${ids.length}`);

      const submitRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('demo_submit_ids')
          .setLabel('Submit IDs')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.webhook.editMessage(progressMessage.id, {
        embeds: [doneEmbed],
        components: [submitRow]
      });
      return;
    }
    
    if (interaction.isModalSubmit() && interaction.customId === 'promo_ids_modal') {
      const raw = interaction.fields.getTextInputValue('ids_input');
      const ids = parseUserIds(raw);

      if (!ids.length) {
        await interaction.reply({
          content: 'No valid user IDs were found. Try again.',
          ephemeral: true
        });
        return;
      }

      sessions.set(interaction.user.id, {
        ids,
        createdAt: Date.now(),
        guildId: interaction.guildId,
        type: 'promo'
      });

      await interaction.reply({ content: 'Ids have been submitted!', ephemeral: true });

      const progressMessage = await interaction.followUp({
        embeds: [buildFormatProgressEmbed(0, ids.length)],
        ephemeral: true,
        fetchReply: true
      });

      for (let index = 0; index < ids.length; index += 1) {
        await sleep(280);
        await interaction.webhook.editMessage(progressMessage.id, {
          embeds: [buildFormatProgressEmbed(index + 1, ids.length)]
        });
      }

      const doneEmbed = new EmbedBuilder()
        .setColor(LIGHT_BLUE)
        .setTitle('Wave IDs formatted successfully')
        .setDescription(`Total IDs ready: ${ids.length}`);

      const submitRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('promo_submit_ids')
          .setLabel('Submit IDs')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.webhook.editMessage(progressMessage.id, {
        embeds: [doneEmbed],
        components: [submitRow]
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === 'demo_submit_ids') {
      const session = sessions.get(interaction.user.id);

      if (!session) {
        await interaction.reply({
          content: `No IDs saved for you yet. Run ${PREFIX}demo first.`,
          ephemeral: true
        });
        return;
      }

      if (session.guildId !== interaction.guildId) {
        await interaction.reply({
          content: 'Saved IDs belong to a different server session.',
          ephemeral: true
        });
        return;
      }

      if (Date.now() - session.createdAt > SESSION_TTL_MS) {
        sessions.delete(interaction.user.id);
        await interaction.reply({
          content: 'Your saved ids expired. Run j$demo again for a new wave.',
          ephemeral: true
        });
        return;
      }

      const total = session.ids.length;
      const succeeded = [];
      const failed = [];
      const notFound = [];

      await interaction.reply({
        embeds: [buildDemoteProgressEmbed(0, total)],
        ephemeral: true
      });

      for (let index = 0; index < total; index += 1) {
        const userId = session.ids[index];
        try {
          const member = await interaction.guild.members.fetch(userId);
          const { roleToRemove, roleToAdd, reason } = getDemotionRoles(member);

          if (roleToRemove && roleToAdd) {
            await member.roles.remove(roleToRemove.id, `Demo wave by ${interaction.user.tag}`);
            if (!member.roles.cache.has(roleToAdd.id)) {
              await member.roles.add(roleToAdd.id, `Demo wave by ${interaction.user.tag}`);
            }
            succeeded.push(userId);
          } else {
            failed.push(`${userId} (${reason || 'demotion step failed'})`);
          }
        } catch (error) {
          if (error.code === 10007) {
            notFound.push(userId);
          } else {
            failed.push(`${userId} (${error.message || 'unknown error'})`);
          }
        }

        await sleep(300);
        await interaction.editReply({
          embeds: [buildDemoteProgressEmbed(index + 1, total)]
        });
      }

      const completeEmbed = new EmbedBuilder()
        .setColor(LIGHT_BLUE)
        .setTitle('Wave demotes complete')
        .setDescription(
          `Total: ${total}\nSuccess: ${succeeded.length}\nNot found: ${notFound.length}\nFailed: ${failed.length}`
        );

      await interaction.editReply({ embeds: [completeEmbed] });

      if (LOG_CHANNEL_ID) {
        const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel && logChannel.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setColor(LIGHT_BLUE)
            .setTitle('Demo Wave Log')
            .addFields(
              { name: 'Run by', value: `${interaction.user.tag} (${interaction.user.id})` },
              { name: 'Guild', value: `${interaction.guild.name} (${interaction.guild.id})` },
              { name: 'Total IDs', value: String(total), inline: true },
              { name: 'Success', value: String(succeeded.length), inline: true },
              { name: 'Not found', value: String(notFound.length), inline: true },
              { name: 'Failed', value: String(failed.length), inline: true },
              { name: 'Summary', value: `${shortList('Success IDs', succeeded)}\n${shortList('Not found IDs', notFound)}` }
            )
            .setTimestamp();

          const logLines = [
            `Run by: ${interaction.user.tag} (${interaction.user.id})`,
            `Guild: ${interaction.guild.name} (${interaction.guild.id})`,
            `Total IDs: ${total}`,
            `Success: ${succeeded.length}`,
            `Not found: ${notFound.length}`,
            `Failed: ${failed.length}`,
            '',
            'Sorted IDs:',
            ...session.ids,
            '',
            'Success IDs:',
            ...(succeeded.length ? succeeded : ['none']),
            '',
            'Not found IDs:',
            ...(notFound.length ? notFound : ['none']),
            '',
            'Failed IDs:',
            ...(failed.length ? failed : ['none'])
          ];

          const attachment = new AttachmentBuilder(Buffer.from(logLines.join('\n'), 'utf8'), {
            name: `demo-wave-log-${Date.now()}.txt`
          });

          await logChannel.send({ embeds: [logEmbed], files: [attachment] });
        }
      }

      sessions.delete(interaction.user.id);
    }
    
    if (interaction.isButton() && interaction.customId === 'promo_submit_ids') {
      const session = sessions.get(interaction.user.id);

      if (!session) {
        await interaction.reply({
          content: `No IDs saved for you yet. Run ${PREFIX}promo first.`,
          ephemeral: true
        });
        return;
      }

      if (session.guildId !== interaction.guildId) {
        await interaction.reply({
          content: 'Saved IDs belong to a different server session.',
          ephemeral: true
        });
        return;
      }

      if (Date.now() - session.createdAt > SESSION_TTL_MS) {
        sessions.delete(interaction.user.id);
        await interaction.reply({
          content: 'Your saved ids expired. Run j$promo again for a new wave.',
          ephemeral: true
        });
        return;
      }

      const total = session.ids.length;
      const succeeded = [];
      const failed = [];
      const notFound = [];

      await interaction.reply({
        embeds: [buildPromoteProgressEmbed(0, total)],
        ephemeral: true
      });

      for (let index = 0; index < total; index += 1) {
        const userId = session.ids[index];
        try {
          const member = await interaction.guild.members.fetch(userId);
          const { roleToRemove, roleToAdd, reason } = getPromotionRoles(member);

          if (roleToRemove && roleToAdd) {
            await member.roles.remove(roleToRemove.id, `Promo wave by ${interaction.user.tag}`);
            if (!member.roles.cache.has(roleToAdd.id)) {
              await member.roles.add(roleToAdd.id, `Promo wave by ${interaction.user.tag}`);
            }
            succeeded.push(userId);
          } else {
            failed.push(`${userId} (${reason || 'promotion step failed'})`);
          }
        } catch (error) {
          if (error.code === 10007) {
            notFound.push(userId);
          } else {
            failed.push(`${userId} (${error.message || 'unknown error'})`);
          }
        }

        await sleep(300);
        await interaction.editReply({
          embeds: [buildPromoteProgressEmbed(index + 1, total)]
        });
      }

      const completeEmbed = new EmbedBuilder()
        .setColor(LIGHT_BLUE)
        .setTitle('Wave promotes complete')
        .setDescription(
          `Total: ${total}\nSuccess: ${succeeded.length}\nNot found: ${notFound.length}\nFailed: ${failed.length}`
        );

      await interaction.editReply({ embeds: [completeEmbed] });

      if (LOG_CHANNEL_ID) {
        const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel && logChannel.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setColor(LIGHT_BLUE)
            .setTitle('Promo Wave Log')
            .addFields(
              { name: 'Run by', value: `${interaction.user.tag} (${interaction.user.id})` },
              { name: 'Guild', value: `${interaction.guild.name} (${interaction.guild.id})` },
              { name: 'Total IDs', value: String(total), inline: true },
              { name: 'Success', value: String(succeeded.length), inline: true },
              { name: 'Not found', value: String(notFound.length), inline: true },
              { name: 'Failed', value: String(failed.length), inline: true },
              { name: 'Summary', value: `${shortList('Success IDs', succeeded)}\n${shortList('Not found IDs', notFound)}` }
            )
            .setTimestamp();

          const logLines = [
            `Run by: ${interaction.user.tag} (${interaction.user.id})`,
            `Guild: ${interaction.guild.name} (${interaction.guild.id})`,
            `Total IDs: ${total}`,
            `Success: ${succeeded.length}`,
            `Not found: ${notFound.length}`,
            `Failed: ${failed.length}`,
            '',
            'Sorted IDs:',
            ...session.ids,
            '',
            'Success IDs:',
            ...(succeeded.length ? succeeded : ['none']),
            '',
            'Not found IDs:',
            ...(notFound.length ? notFound : ['none']),
            '',
            'Failed IDs:',
            ...(failed.length ? failed : ['none'])
          ];

          const attachment = new AttachmentBuilder(Buffer.from(logLines.join('\n'), 'utf8'), {
            name: `promo-wave-log-${Date.now()}.txt`
          });

          await logChannel.send({ embeds: [logEmbed], files: [attachment] });
        }
      }

      sessions.delete(interaction.user.id);
    }
  } catch (error) {
    console.error('Interaction error:', error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Something broke while running that flow.',
        ephemeral: true
      });
      return;
    }

    if (interaction.isRepliable()) {
      await interaction.followUp({
        content: 'Something broke while running that flow.',
        ephemeral: true
      }).catch(() => null);
    }
  }
  });
}

async function startBot() {
  if (client && client.isReady()) {
    console.log('Bot is already running');
    return { success: false, message: 'Bot is already online' };
  }

  try {
    if (client) {
      await client.destroy().catch(() => {});
    }
    
    client = createClient();
    setupBotHandlers();
    await client.login(BOT_TOKEN);
    
    console.log('Bot started successfully');
    return { success: true, message: 'Bot started successfully' };
  } catch (error) {
    console.error('Failed to start bot:', error);
    return { success: false, message: error.message || 'Failed to start bot' };
  }
}

async function stopBot() {
  if (!client || !client.isReady()) {
    console.log('Bot is not running');
    return { success: false, message: 'Bot is not online' };
  }

  try {
    if (sessionCleanupInterval) {
      clearInterval(sessionCleanupInterval);
      sessionCleanupInterval = null;
    }
    
    await client.destroy();
    botStartTime = null;
    
    console.log('Bot stopped successfully');
    return { success: true, message: 'Bot stopped successfully' };
  } catch (error) {
    console.error('Failed to stop bot:', error);
    return { success: false, message: error.message || 'Failed to stop bot' };
  }
}

async function restartBot() {
  if (!client || !client.isReady()) {
    return await startBot();
  }

  try {
    console.log('Restarting bot...');
    await stopBot();
    
    // Wait a moment before restarting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return await startBot();
  } catch (error) {
    console.error('Failed to restart bot:', error);
    return { success: false, message: error.message || 'Failed to restart bot' };
  }
}

if (!BOT_TOKEN) {
  throw new Error('Missing BOT_TOKEN in env.');
}

// Initialize and start the bot
client = createClient();
setupBotHandlers();
client.login(BOT_TOKEN);

// Express Web Server
const app = express();
app.use(express.json());

// Serve static files from the React build
app.use(express.static(path.join(__dirname, '..', 'dist')));

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'jaces-promo-demo-bot' });
});

// API: Bot status
app.get('/api/bot/status', (req, res) => {
  if (!client || !client.isReady()) {
    return res.json({
      online: false,
      uptime: 0,
      username: null,
      guilds: 0,
      ping: null
    });
  }

  const uptime = botStartTime ? Math.floor((Date.now() - botStartTime) / 1000) : 0;

  res.json({
    online: true,
    uptime: uptime,
    username: client.user.tag,
    guilds: client.guilds.cache.size,
    ping: client.ws.ping
  });
});

// API: Server statistics
// API: Server statistics
app.get('/api/servers', async (req, res) => {
  if (!client || !client.isReady()) {
    return res.json({
      success: false,
      message: 'Bot is not online'
    });
  }

  try {
    const servers = [];

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        // Fetch owner information
        let ownerTag = 'Unknown';
        try {
          const owner = await guild.fetchOwner();
          ownerTag = owner.user.tag;
        } catch (e) {
          // Owner fetch failed, use Unknown
        }

        // Get bot member to check permissions
        const botMember = guild.members.me;
        const permissions = [];

        if (botMember) {
          const perms = botMember.permissions;
          
          // Check for key permissions
          if (perms.has('Administrator')) {
            permissions.push('Administrator');
          } else {
            if (perms.has('ManageGuild')) permissions.push('Manage Server');
            if (perms.has('ManageRoles')) permissions.push('Manage Roles');
            if (perms.has('ManageChannels')) permissions.push('Manage Channels');
            if (perms.has('KickMembers')) permissions.push('Kick Members');
            if (perms.has('BanMembers')) permissions.push('Ban Members');
            if (perms.has('ManageMessages')) permissions.push('Manage Messages');
            if (perms.has('ViewAuditLog')) permissions.push('View Audit Log');
            if (perms.has('SendMessages')) permissions.push('Send Messages');
            if (perms.has('EmbedLinks')) permissions.push('Embed Links');
            if (perms.has('AttachFiles')) permissions.push('Attach Files');
            if (perms.has('ReadMessageHistory')) permissions.push('Read Message History');
            if (perms.has('ManageNicknames')) permissions.push('Manage Nicknames');
          }
        }

        servers.push({
          id: guild.id,
          name: guild.name,
          ownerTag: ownerTag,
          memberCount: guild.memberCount,
          roleCount: guild.roles.cache.size,
          channelCount: guild.channels.cache.size,
          joinedAt: guild.joinedAt ? guild.joinedAt.getTime() : null,
          createdAt: guild.createdAt ? guild.createdAt.getTime() : null,
          permissions: permissions.length > 0 ? permissions : ['None']
        });
      } catch (error) {
        console.error(`Error fetching data for guild ${guildId}:`, error);
      }
    }

    // Sort by member count (largest first)
    servers.sort((a, b) => b.memberCount - a.memberCount);

    res.json({
      success: true,
      servers: servers
    });
  } catch (error) {
    console.error('Error fetching server stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch server statistics'
    });
  }
});

// API: Bot control (start, stop, restart)
app.post('/api/bot/control', async (req, res) => {
  const { action } = req.body;

  if (!['start', 'stop', 'restart'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Use: start, stop, or restart'
    });
  }

  try {
    let result;
    
    if (action === 'start') {
      result = await startBot();
    } else if (action === 'stop') {
      result = await stopBot();
    } else if (action === 'restart') {
      result = await restartBot();
    }

    res.json(result);
  } catch (error) {
    console.error('Control error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to execute action'
    });
  }
});

// Catch-all route to serve React app for client-side routing
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  
  // Check if the built React app exists
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback if build doesn't exist
    res.status(503).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Build Required</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              background: #000;
              color: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              text-align: center;
            }
            .container {
              max-width: 600px;
              padding: 40px;
            }
            h1 {
              font-size: 2.5rem;
              margin-bottom: 1rem;
            }
            p {
              font-size: 1.1rem;
              line-height: 1.6;
              opacity: 0.8;
            }
            code {
              background: rgba(255, 255, 255, 0.1);
              padding: 2px 8px;
              border-radius: 4px;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Build Required</h1>
            <p>The React application needs to be built first.</p>
            <p>Please run: <code>npm run build</code></p>
            <p>Or the server will automatically build on start with: <code>npm start</code></p>
          </div>
        </body>
      </html>
    `);
  }
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
  console.log(`Main page: http://localhost:${PORT}/`);
  console.log(`Bot status: http://localhost:${PORT}/botstatus`);
  console.log(`Server stats: http://localhost:${PORT}/serverstats`);
});
