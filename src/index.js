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
const DEFAULT_MOVEMENT_LOG_CHANNEL_ID = '1473485037876809915';
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
let serverStartTime = Date.now();
let autoStarted = false;
let client = null;
let sessionCleanupInterval = null;
let globalBotSetup = {
  companyName: 'Securify',
  clientId: '',
  clientSecret: '',
  botToken: '',
  redirectUri: '',
  scopes: 'identify guilds',
  modules: [
    { id: 'moderation', name: 'Moderation', enabled: true },
    { id: 'automod', name: 'Auto moderation', enabled: true },
    { id: 'roles', name: 'Role management', enabled: true },
    { id: 'welcome', name: 'Welcome & goodbye', enabled: true },
    { id: 'logging', name: 'Logging', enabled: true },
    { id: 'utility', name: 'Utility', enabled: true },
    { id: 'security', name: 'Security anti-raid', enabled: true }
  ],
  auth: {
    connected: false,
    user: null,
    connectedAt: null,
    lastError: null
  },
  configured: false,
  updatedAt: null
};

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
  // Check if user is the bot owner
  if (userId === OWNER_ID) return true;
  
  // Check if user has Administrator permission
  if (member.permissions.has('Administrator')) return true;
  
  // Fallback to role-based check if ALLOWED_ROLE_IDS are configured
  if (ALLOWED_ROLE_IDS.length > 0) {
    return member.roles.cache.some((role) => ALLOWED_ROLE_IDS.includes(role.id));
  }
  
  // If no allowed roles configured, require administrator permission
  return false;
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
      await message.reply('❌ You do not have permission to use this command. Administrator permissions required.');
      return;
    }
    await message.reply(getDemoStartPayload());
    return;
  }
  
  if (content.startsWith(`${PREFIX}promo`)) {
    if (!hasAllowedRole(message.member, message.author.id)) {
      await message.reply('❌ You do not have permission to use this command. Administrator permissions required.');
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

// Initialize the client (bot auto-starts on server launch)
// This ensures the bot is always online when Railway/server restarts
client = createClient();
setupBotHandlers();

// Auto-start bot on server launch (default behavior)
const shouldAutoStart = process.env.AUTO_START !== 'false';

if (shouldAutoStart) {
  client.login(BOT_TOKEN).then(() => {
    console.log('Bot auto-started on server launch');
    autoStarted = true;
  }).catch((error) => {
    console.error('Failed to auto-start bot:', error);
    autoStarted = false;
  });
} else {
  console.log('Auto-start disabled. Use web interface to start bot.');
}

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
      botId: null,
      guilds: 0,
      ping: null,
      serverStartTime: serverStartTime,
      autoStarted: autoStarted
    });
  }

  const uptime = botStartTime ? Math.floor((Date.now() - botStartTime) / 1000) : 0;

  res.json({
    online: true,
    uptime: uptime,
    username: client.user.tag,
    botId: client.user.id,
    guilds: client.guilds.cache.size,
    ping: client.ws.ping,
    serverStartTime: serverStartTime,
    autoStarted: autoStarted
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

// API: Advanced bot controls
app.get('/api/bot/controls/invite', (req, res) => {
  if (!client || !client.isReady()) {
    return res.status(503).json({
      success: false,
      message: 'Bot must be online to generate invite links'
    });
  }

  const botId = client.user.id;

  res.json({
    success: true,
    botId,
    inviteUrl: `https://discord.com/api/oauth2/authorize?client_id=${botId}&permissions=268445760&scope=bot`,
    adminInviteUrl: `https://discord.com/api/oauth2/authorize?client_id=${botId}&permissions=8&scope=bot`
  });
});

app.post('/api/bot/controls/send-message', async (req, res) => {
  const { channelId, message } = req.body;

  if (!client || !client.isReady()) {
    return res.status(503).json({ success: false, message: 'Bot is not online' });
  }

  if (!channelId || !message) {
    return res.status(400).json({ success: false, message: 'channelId and message are required' });
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || typeof channel.send !== 'function') {
      return res.status(400).json({ success: false, message: 'Invalid text channel' });
    }

    await channel.send({ content: String(message).slice(0, 2000) });
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to send message' });
  }
});

app.post('/api/bot/controls/send-embed', async (req, res) => {
  const { channelId, title, description, color } = req.body;

  if (!client || !client.isReady()) {
    return res.status(503).json({ success: false, message: 'Bot is not online' });
  }

  if (!channelId || !title || !description) {
    return res.status(400).json({
      success: false,
      message: 'channelId, title, and description are required'
    });
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || typeof channel.send !== 'function') {
      return res.status(400).json({ success: false, message: 'Invalid text channel' });
    }

    const normalized = String(color || '').replace('#', '').trim();
    const parsedColor = /^[0-9a-fA-F]{6}$/.test(normalized)
      ? parseInt(normalized, 16)
      : LIGHT_BLUE;

    const embed = new EmbedBuilder()
      .setColor(parsedColor)
      .setTitle(String(title).slice(0, 256))
      .setDescription(String(description).slice(0, 4096))
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    res.json({ success: true, message: 'Embed sent successfully' });
  } catch (error) {
    console.error('Send embed error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to send embed' });
  }
});

app.post('/api/bot/controls/send-image', async (req, res) => {
  const { channelId, imageUrl, caption } = req.body;

  if (!client || !client.isReady()) {
    return res.status(503).json({ success: false, message: 'Bot is not online' });
  }

  if (!channelId || !imageUrl) {
    return res.status(400).json({ success: false, message: 'channelId and imageUrl are required' });
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || typeof channel.send !== 'function') {
      return res.status(400).json({ success: false, message: 'Invalid text channel' });
    }

    const embed = new EmbedBuilder()
      .setColor(LIGHT_BLUE)
      .setImage(String(imageUrl).trim())
      .setTimestamp();

    await channel.send({
      content: caption ? String(caption).slice(0, 2000) : undefined,
      embeds: [embed]
    });

    res.json({ success: true, message: 'Image sent successfully' });
  } catch (error) {
    console.error('Send image error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to send image' });
  }
});

app.post('/api/bot/controls/movement', async (req, res) => {
  const { guildId, targetChannelId, snapshotChannelId, logChannelId, webhookUrl } = req.body || {};

  if (!client || !client.isReady()) {
    return res.status(503).json({ success: false, message: 'Bot is not online' });
  }

  if (!guildId || !targetChannelId) {
    return res.status(400).json({
      success: false,
      message: 'guildId and targetChannelId are required'
    });
  }

  try {
    const guild = await client.guilds.fetch(String(guildId));
    const targetChannel = await guild.channels.fetch(String(targetChannelId));

    if (!targetChannel) {
      return res.status(404).json({ success: false, message: 'Target channel not found' });
    }

    if (!targetChannel.isVoiceBased()) {
      return res.status(400).json({
        success: false,
        message: 'Bot movement target must be a voice channel'
      });
    }

    const botMember = guild.members.me || await guild.members.fetch(client.user.id);
    await botMember.voice.setChannel(targetChannel.id);

    const snapshotTargetId = snapshotChannelId || targetChannel.id;
    const snapshotChannel = await guild.channels.fetch(String(snapshotTargetId)).catch(() => null);

    const reportLines = [
      'Bot Movement Report',
      `Guild: ${guild.name} (${guild.id})`,
      `Moved to voice channel: ${targetChannel.name} (${targetChannel.id})`,
      `Snapshot channel: ${snapshotChannel ? `${snapshotChannel.name} (${snapshotChannel.id})` : 'Unavailable'}`,
      `Timestamp: ${new Date().toISOString()}`
    ];

    if (snapshotChannel && snapshotChannel.isTextBased()) {
      const messages = await snapshotChannel.messages.fetch({ limit: 10 }).catch(() => null);
      if (messages && messages.size > 0) {
        reportLines.push('', 'Recent Messages:');
        const ordered = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        for (const message of ordered) {
          const preview = (message.content || '[non-text message]').replace(/\s+/g, ' ').slice(0, 120);
          reportLines.push(`- ${message.author.tag}: ${preview}`);
        }
      }
    }

    const reportText = reportLines.join('\n').slice(0, 1800);

    const destinationLogChannelId = logChannelId || LOG_CHANNEL_ID || DEFAULT_MOVEMENT_LOG_CHANNEL_ID;
    if (destinationLogChannelId) {
      const destination = await guild.channels.fetch(String(destinationLogChannelId)).catch(() => null);
      if (destination && destination.isTextBased() && typeof destination.send === 'function') {
        await destination.send({
          content: `\`\`\`\n${reportText}\n\`\`\``
        });
      }
    }

    if (webhookUrl) {
      await fetch(String(webhookUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `\`\`\`\n${reportText}\n\`\`\`` })
      }).catch(() => null);
    }

    res.json({
      success: true,
      message: 'Bot movement completed and snapshot report sent',
      reportPreview: reportText
    });
  } catch (error) {
    console.error('Bot movement error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to run bot movement'
    });
  }
});

function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function getEffectiveRedirectUri(req) {
  return globalBotSetup.redirectUri || `${getBaseUrl(req)}/api/global/oauth/callback`;
}

function buildOAuthUrl(req) {
  if (!globalBotSetup.clientId) return null;
  return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(globalBotSetup.clientId)}&response_type=code&redirect_uri=${encodeURIComponent(getEffectiveRedirectUri(req))}&scope=${encodeURIComponent(globalBotSetup.scopes)}`;
}

// API: Global bot onboarding setup
app.get('/api/global/setup', (req, res) => {
  res.json({
    success: true,
    setup: {
      companyName: globalBotSetup.companyName,
      clientId: globalBotSetup.clientId,
      redirectUri: getEffectiveRedirectUri(req),
      scopes: globalBotSetup.scopes,
      configured: globalBotSetup.configured,
      hasClientSecret: Boolean(globalBotSetup.clientSecret),
      hasBotToken: Boolean(globalBotSetup.botToken),
      updatedAt: globalBotSetup.updatedAt,
      auth: globalBotSetup.auth
    },
    oauthUrl: buildOAuthUrl(req),
    modules: globalBotSetup.modules,
    commandCatalog: globalBotSetup.modules.map((module) => module.name)
  });
});

app.post('/api/global/setup', (req, res) => {
  const {
    companyName,
    clientId,
    clientSecret,
    botToken,
    redirectUri,
    scopes
  } = req.body || {};

  if (!clientId || !clientSecret || !botToken) {
    return res.status(400).json({
      success: false,
      message: 'clientId, clientSecret, and botToken are required'
    });
  }

  globalBotSetup = {
    ...globalBotSetup,
    companyName: String(companyName || 'Securify').trim() || 'Securify',
    clientId: String(clientId).trim(),
    clientSecret: String(clientSecret).trim(),
    botToken: String(botToken).trim(),
    redirectUri: String(redirectUri || '').trim(),
    scopes: String(scopes || 'identify guilds').trim() || 'identify guilds',
    configured: true,
    updatedAt: Date.now()
  };

  res.json({
    success: true,
    message: 'Global bot setup saved',
    oauthUrl: buildOAuthUrl(req)
  });
});

app.post('/api/global/modules', (req, res) => {
  const { modules } = req.body || {};

  if (!Array.isArray(modules)) {
    return res.status(400).json({
      success: false,
      message: 'modules array is required'
    });
  }

  const existingById = new Map(globalBotSetup.modules.map((module) => [module.id, module]));
  const normalized = modules
    .filter((module) => module && typeof module.id === 'string' && existingById.has(module.id))
    .map((module) => ({
      ...existingById.get(module.id),
      enabled: Boolean(module.enabled)
    }));

  if (!normalized.length) {
    return res.status(400).json({
      success: false,
      message: 'No valid modules provided'
    });
  }

  globalBotSetup.modules = normalized;
  globalBotSetup.updatedAt = Date.now();

  res.json({
    success: true,
    message: 'Module settings updated',
    modules: globalBotSetup.modules
  });
});

app.get('/api/global/oauth/callback', async (req, res) => {
  const code = String(req.query.code || '');

  if (!code) {
    return res.redirect('/global?oauth=missing_code');
  }

  if (!globalBotSetup.clientId || !globalBotSetup.clientSecret) {
    return res.redirect('/global?oauth=missing_credentials');
  }

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: globalBotSetup.clientId,
        client_secret: globalBotSetup.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: getEffectiveRedirectUri(req)
      }).toString()
    });

    if (!tokenResponse.ok) {
      const failedText = await tokenResponse.text();
      throw new Error(`Discord token exchange failed: ${failedText}`);
    }

    const tokenData = await tokenResponse.json();
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    if (!userResponse.ok) {
      const failedUser = await userResponse.text();
      throw new Error(`Discord user fetch failed: ${failedUser}`);
    }

    const userData = await userResponse.json();
    globalBotSetup.auth = {
      connected: true,
      user: {
        id: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        avatar: userData.avatar
      },
      connectedAt: Date.now(),
      lastError: null
    };
    globalBotSetup.updatedAt = Date.now();

    return res.redirect('/global?oauth=success');
  } catch (error) {
    console.error('Discord OAuth callback error:', error);
    globalBotSetup.auth = {
      connected: false,
      user: null,
      connectedAt: null,
      lastError: error.message || 'OAuth failed'
    };
    return res.redirect('/global?oauth=failed');
  }
});

// API: Get list of source files
app.get('/api/source/files', (req, res) => {
  try {
    const rootDir = path.join(__dirname, '..');
    const files = [];

    // Get all files recursively from the entire project
    function getFiles(dir, basePath = '') {
      let items;
      try {
        items = fs.readdirSync(dir);
      } catch (error) {
        // Skip directories we can't read
        return;
      }
      
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const relativePath = basePath ? path.join(basePath, item) : item;
        
        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch (error) {
          // Skip files we can't stat
          return;
        }
        
        // Skip node_modules, dist, .git, and other build/dependency folders
        if (item === 'node_modules' || item === 'dist' || item === '.git' || 
            item === '.vscode' || item === 'build' || item === 'coverage' ||
            item === 'out' || item === 'target' || item === '.next' ||
            item === '.cache' || item === 'tmp' || item === 'temp') {
          return;
        }
        
        if (stat.isDirectory()) {
          getFiles(fullPath, relativePath);
        } else if (stat.isFile()) {
          // Include ALL files (not just specific extensions)
          files.push(relativePath);
        }
      });
    }

    // Scan entire project from root
    getFiles(rootDir);

    // Sort files alphabetically
    files.sort();

    res.json({ success: true, files, totalFiles: files.length });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ success: false, message: 'Failed to list files' });
  }
});

// API: Get file content
app.get('/api/source/file', (req, res) => {
  try {
    const { path: filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ success: false, message: 'File path required' });
    }

    // Security: prevent directory traversal
    const rootDir = path.join(__dirname, '..');
    const fullPath = path.join(rootDir, filePath);
    
    // Ensure the resolved path is within the project directory
    if (!fullPath.startsWith(rootDir)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    // Read file content
    const content = fs.readFileSync(fullPath, 'utf8');

    res.json({ success: true, content });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ success: false, message: 'Failed to read file' });
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
