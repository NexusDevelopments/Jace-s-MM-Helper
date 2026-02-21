require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
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
const TICKETS_STATE_PATH = path.join(__dirname, '..', 'data', 'tickets-state.json');

const sessions = new Map();
let botStartTime = null;
let serverStartTime = Date.now();
let autoStarted = false;
let client = null;
let sessionCleanupInterval = null;
let ticketsState = {
  configs: {},
  counters: {},
  openTickets: {},
  logs: {}
};

function loadTicketsState() {
  if (!fs.existsSync(TICKETS_STATE_PATH)) return;

  try {
    const raw = fs.readFileSync(TICKETS_STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    ticketsState = {
      configs: parsed.configs || {},
      counters: parsed.counters || {},
      openTickets: parsed.openTickets || {},
      logs: parsed.logs || {}
    };
  } catch (error) {
    console.error('Failed to load tickets state:', error);
  }
}

function saveTicketsState() {
  try {
    fs.mkdirSync(path.dirname(TICKETS_STATE_PATH), { recursive: true });
    fs.writeFileSync(TICKETS_STATE_PATH, JSON.stringify(ticketsState, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save tickets state:', error);
  }
}

loadTicketsState();

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

function parseDiscordId(input) {
  if (!input) return null;
  const match = String(input).match(/\d{17,20}/);
  return match ? match[0] : null;
}

function getTicketConfig(guildId) {
  return ticketsState.configs[guildId] || null;
}

function setTicketConfig(guildId, config) {
  ticketsState.configs[guildId] = {
    ...ticketsState.configs[guildId],
    ...config,
    updatedAt: Date.now()
  };
  saveTicketsState();
}

function isSupportStaff(member, guildId, userId) {
  if (userId === OWNER_ID) return true;
  const config = getTicketConfig(guildId);
  if (!config || !config.supportRoleId || !member) return false;
  return member.roles.cache.has(config.supportRoleId);
}

function getTicketLogs(guildId) {
  return ticketsState.logs[guildId] || [];
}

function appendTicketLog(guildId, entry) {
  if (!ticketsState.logs[guildId]) ticketsState.logs[guildId] = [];
  ticketsState.logs[guildId].unshift({
    ...entry,
    createdAt: Date.now()
  });
  ticketsState.logs[guildId] = ticketsState.logs[guildId].slice(0, 300);
  saveTicketsState();
}

function normalizeForMatch(input) {
  return String(input || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshteinDistance(a, b) {
  const left = normalizeForMatch(a);
  const right = normalizeForMatch(b);
  const matrix = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

async function findBestTradeMember(guild, input) {
  const query = String(input || '').trim();
  if (!query) return null;

  const maybeId = parseDiscordId(query);
  if (maybeId) {
    const byId = await guild.members.fetch(maybeId).catch(() => null);
    if (byId) return { member: byId, confidence: 'exact-id' };
  }

  const fetched = await guild.members.fetch({ query: query.slice(0, 32), limit: 20 }).catch(() => null);
  const candidates = fetched ? [...fetched.values()] : [];

  const normalizedQuery = normalizeForMatch(query);
  const exact = candidates.find((member) => {
    const username = normalizeForMatch(member.user.username);
    const displayName = normalizeForMatch(member.displayName || '');
    const tag = normalizeForMatch(member.user.tag || '');
    return username === normalizedQuery || displayName === normalizedQuery || tag === normalizedQuery;
  });

  if (exact) return { member: exact, confidence: 'exact-name' };
  if (!candidates.length) return null;

  const best = candidates
    .map((member) => {
      const usernameScore = levenshteinDistance(query, member.user.username || '');
      const displayScore = levenshteinDistance(query, member.displayName || '');
      const tagScore = levenshteinDistance(query, member.user.tag || '');
      return {
        member,
        score: Math.min(usernameScore, displayScore, tagScore)
      };
    })
    .sort((left, right) => left.score - right.score)[0];

  return best ? { member: best.member, confidence: 'closest-match' } : null;
}

function getNextTicketNumber(guildId) {
  const next = (ticketsState.counters[guildId] || 0) + 1;
  ticketsState.counters[guildId] = next;
  saveTicketsState();
  return next;
}

function getTicketPanelPayload(config) {
  const embed = new EmbedBuilder()
    .setColor(LIGHT_BLUE)
    .setTitle(config.panelTitle || 'Support Tickets')
    .setDescription(
      config.panelDescription ||
      'Need help? Click **Open Ticket** and our team will assist you.'
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_open')
      .setLabel('Open Ticket')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function normalizeTicketPriority(input) {
  const value = String(input || 'normal').toLowerCase();
  if (['low', 'normal', 'high', 'urgent'].includes(value)) return value;
  return null;
}

function formatTicketText(value, fallback) {
  const raw = String(value || fallback || '').trim();
  if (!raw) return 'N/A';
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function buildTicketStatusEmbed(ticketMeta) {
  return new EmbedBuilder()
    .setColor(LIGHT_BLUE)
    .setTitle(`Ticket #${ticketMeta.ticketNumber}`)
    .setDescription('Support will be with you shortly. Use the controls below to manage this ticket.')
    .addFields(
      { name: 'Status', value: formatTicketText(ticketMeta.status, 'Open'), inline: true },
      { name: 'Priority', value: formatTicketText(ticketMeta.priority, 'Normal'), inline: true },
      { name: 'Claimed by', value: ticketMeta.claimedBy ? `<@${ticketMeta.claimedBy}>` : 'Unclaimed', inline: true },
      { name: 'Trading With', value: ticketMeta.tradePartnerId ? `<@${ticketMeta.tradePartnerId}>` : (ticketMeta.tradeTargetRaw || 'Pending confirmation'), inline: false },
      { name: 'Trade Offer', value: ticketMeta.tradeDetails || 'Not provided', inline: false }
    )
    .setTimestamp();
}

function getTicketActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel('Claim Ticket')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket_done')
      .setLabel('Trade Done')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
  );
}

async function postTicketStatusMessage(channel, ticketMeta) {
  await channel.send({ embeds: [buildTicketStatusEmbed(ticketMeta)], components: [getTicketActionRow()] });
}

async function sendTicketPanel(guild, config) {
  const panelChannel = await guild.channels.fetch(config.panelChannelId).catch(() => null);
  if (!panelChannel || !panelChannel.isTextBased() || typeof panelChannel.send !== 'function') {
    throw new Error('Configured panel channel is invalid or not text-based');
  }

  await panelChannel.send(getTicketPanelPayload(config));
}

function buildTicketPermissionOverwrites(guild, openerId, supportRoleId) {
  const overwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: openerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  if (supportRoleId) {
    overwrites.push({
      id: supportRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    });
  }

  return overwrites;
}

async function createTicketForUser(guild, userId, options = {}) {
  const config = getTicketConfig(guild.id);
  if (!config) {
    throw new Error('Ticket system is not configured for this server');
  }

  const existing = Object.entries(ticketsState.openTickets).find(
    ([, ticket]) => ticket.guildId === guild.id && ticket.openerId === userId
  );

  if (existing) {
    const existingChannel = await guild.channels.fetch(existing[0]).catch(() => null);
    if (existingChannel) return existingChannel;
    delete ticketsState.openTickets[existing[0]];
    saveTicketsState();
  }

  const ticketNumber = getNextTicketNumber(guild.id);
  const channelName = `ticket-${String(ticketNumber).padStart(4, '0')}`;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: config.categoryId || null,
    permissionOverwrites: buildTicketPermissionOverwrites(guild, userId, config.supportRoleId || null),
    topic: `Ticket ${ticketNumber} | Opened by ${userId}`
  });

  ticketsState.openTickets[channel.id] = {
    guildId: guild.id,
    openerId: userId,
    ticketNumber,
    status: 'Open',
    priority: 'normal',
    claimedBy: null,
    firstResponseAt: null,
    closeReason: null,
    tradeDetails: options.tradeDetails ? String(options.tradeDetails).slice(0, 500) : null,
    tradeTargetRaw: options.tradeTargetRaw ? String(options.tradeTargetRaw).slice(0, 120) : null,
    tradePartnerId: options.tradePartnerId || null,
    pendingTradePartnerId: options.pendingTradePartnerId || null,
    createdAt: Date.now()
  };
  saveTicketsState();

  await channel.send({ content: `<@${userId}>` });
  await postTicketStatusMessage(channel, ticketsState.openTickets[channel.id]);

  appendTicketLog(guild.id, {
    type: 'opened',
    ticketNumber,
    openerId: userId,
    channelId: channel.id,
    status: 'Open',
    tradeDetails: ticketsState.openTickets[channel.id].tradeDetails,
    tradeTargetRaw: ticketsState.openTickets[channel.id].tradeTargetRaw
  });

  return channel;
}

async function closeTicketChannel(channel, closedByTag, closeReason) {
  const ticketMeta = ticketsState.openTickets[channel.id];
  if (!ticketMeta) {
    throw new Error('This channel is not tracked as an open ticket');
  }

  if (closeReason) {
    ticketMeta.closeReason = String(closeReason).slice(0, 500);
  }
  ticketMeta.status = 'Closed';

  appendTicketLog(ticketMeta.guildId, {
    type: 'closed',
    ticketNumber: ticketMeta.ticketNumber,
    openerId: ticketMeta.openerId,
    channelId: channel.id,
    closedBy: closedByTag || 'Unknown',
    closeReason: ticketMeta.closeReason || 'No reason provided',
    priority: ticketMeta.priority || 'normal',
    claimedBy: ticketMeta.claimedBy || null,
    tradeStatus: ticketMeta.status,
    tradePartnerId: ticketMeta.tradePartnerId || null,
    tradeDetails: ticketMeta.tradeDetails || null
  });

  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  const sorted = messages ? [...messages.values()].sort((left, right) => left.createdTimestamp - right.createdTimestamp) : [];
  const transcriptLines = sorted.map((message) => {
    const content = (message.content || '[non-text message]').replace(/\s+/g, ' ').trim();
    return `[${new Date(message.createdTimestamp).toISOString()}] ${message.author.tag}: ${content || '[empty]'}`;
  });

  const transcriptAttachment = new AttachmentBuilder(Buffer.from(transcriptLines.join('\n') || 'No messages.', 'utf8'), {
    name: `ticket-${ticketMeta.ticketNumber}-transcript.txt`
  });

  const config = getTicketConfig(ticketMeta.guildId);
  const logTargetId = (config && config.logChannelId) || LOG_CHANNEL_ID || DEFAULT_MOVEMENT_LOG_CHANNEL_ID;

  if (logTargetId) {
    const logChannel = await channel.guild.channels.fetch(logTargetId).catch(() => null);
    if (logChannel && logChannel.isTextBased() && typeof logChannel.send === 'function') {
      const closeEmbed = new EmbedBuilder()
        .setColor(LIGHT_BLUE)
        .setTitle(`Ticket #${ticketMeta.ticketNumber} Closed`)
        .addFields(
          { name: 'Ticket channel', value: `${channel.name} (${channel.id})` },
          { name: 'Opened by', value: `<@${ticketMeta.openerId}> (${ticketMeta.openerId})` },
          { name: 'Closed by', value: closedByTag || 'Unknown' },
          { name: 'Priority', value: formatTicketText(ticketMeta.priority, 'Normal'), inline: true },
          { name: 'Claimed by', value: ticketMeta.claimedBy ? `<@${ticketMeta.claimedBy}>` : 'Unclaimed', inline: true },
          { name: 'Reason', value: ticketMeta.closeReason || 'No reason provided' }
        )
        .setTimestamp();

      await logChannel.send({ embeds: [closeEmbed], files: [transcriptAttachment] });
    }
  }

  delete ticketsState.openTickets[channel.id];
  saveTicketsState();

  await channel.send('Closing ticket in 5 seconds...').catch(() => null);
  await sleep(5000);
  await channel.delete(`Ticket closed by ${closedByTag || 'unknown'}`).catch(() => null);
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

  const rawContent = message.content.trim();
  const content = rawContent.toLowerCase();
  
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
        { name: 'j$ticket help', value: 'Show ticket commands and usage.' },
        { name: 'j$help', value: 'Shows this help message with all available commands.' }
      )
      .setTimestamp();
    
    await message.reply({ embeds: [helpEmbed] });
    return;
  }

  if (content.startsWith(`${PREFIX}ticket`)) {
    const args = rawContent.slice(`${PREFIX}ticket`.length).trim().split(/\s+/).filter(Boolean);
    const subcommand = (args[0] || 'help').toLowerCase();

    if (subcommand === 'help') {
      const ticketHelp = new EmbedBuilder()
        .setColor(LIGHT_BLUE)
        .setTitle('Ticket Commands')
        .setDescription('Prefix: j$')
        .addFields(
          { name: 'j$ticket setup <panelChannelId> <categoryId> [supportRoleId] [logChannelId]', value: 'Configure ticket system for this guild.' },
          { name: 'j$ticket panel', value: 'Post the ticket creation panel in the configured panel channel.' },
          { name: 'j$ticket create', value: 'Create a ticket for yourself.' },
          { name: 'j$ticket close [reason]', value: 'Close the current ticket channel with an optional reason.' },
          { name: 'j$ticket claim', value: 'Claim this ticket as staff.' },
          { name: 'j$ticket unclaim', value: 'Remove current ticket claim.' },
          { name: 'j$ticket priority <low|normal|high|urgent>', value: 'Set ticket priority level.' },
          { name: 'j$ticket status <text>', value: 'Update trade status text (Support only).' },
          { name: 'j$ticket done', value: 'Mark ticket trade status as Done (Support only).' },
          { name: 'j$ticket add <userId|@mention>', value: 'Grant access to a user in this ticket.' },
          { name: 'j$ticket remove <userId|@mention>', value: 'Remove access from a user in this ticket.' },
          { name: 'j$ticket transcript', value: 'Generate a transcript preview of recent messages.' }
        )
        .setTimestamp();

      await message.reply({ embeds: [ticketHelp] });
      return;
    }

    if (subcommand === 'create') {
      const config = getTicketConfig(message.guild.id);
      if (!config) {
        await message.reply('Ticket system is not configured yet. Ask staff to run `j$ticket setup ...` first.');
        return;
      }

      const tradeTargetRaw = args[1];
      const tradeDetails = args.slice(2).join(' ').trim();
      if (!tradeTargetRaw || !tradeDetails) {
        await message.reply('Usage: `j$ticket create <usernameOrUserId> <whatYouAreTrading>`');
        return;
      }

      try {
        const match = await findBestTradeMember(message.guild, tradeTargetRaw);
        const ticketChannel = await createTicketForUser(message.guild, message.author.id, {
          tradeTargetRaw,
          tradeDetails,
          tradePartnerId: match && match.confidence.startsWith('exact') ? match.member.id : null,
          pendingTradePartnerId: match ? match.member.id : null
        });

        if (match && !ticketChannel.permissionsFor(match.member.id)?.has(PermissionFlagsBits.ViewChannel)) {
          const promptRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`ticket_confirm_target:${match.member.id}`)
              .setLabel('Yes')
              .setStyle(ButtonStyle.Primary)
          );

          await ticketChannel.send({
            content: `<@${message.author.id}> is this the right username? ${match.member} (${match.member.user.tag})`,
            components: [promptRow]
          });
        } else if (match && match.member.id) {
          await ticketChannel.permissionOverwrites.edit(match.member.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true
          });
        } else {
          await ticketChannel.send('I could not confidently match that user from this server. Support can add them with `j$ticket add <userId>` once verified.');
        }

        await message.reply(`✅ Ticket created: ${ticketChannel}`);
      } catch (error) {
        await message.reply(`❌ ${error.message || 'Failed to create ticket.'}`);
      }
      return;
    }

    const supportOnlyCommands = new Set(['close', 'claim', 'unclaim', 'priority', 'status', 'done', 'add', 'remove']);
    const isSupport = isSupportStaff(message.member, message.guild.id, message.author.id);

    if (supportOnlyCommands.has(subcommand)) {
      if (!isSupport) {
        await message.reply('❌ Only Support can run this ticket command.');
        return;
      }
    } else if (!hasAllowedRole(message.member, message.author.id)) {
      await message.reply('❌ You do not have permission to manage tickets. Administrator permissions required.');
      return;
    }

    if (subcommand === 'setup') {
      const panelChannelId = parseDiscordId(args[1]);
      const categoryId = parseDiscordId(args[2]);
      const supportRoleId = parseDiscordId(args[3]);
      const logChannelId = parseDiscordId(args[4]);

      if (!panelChannelId || !categoryId) {
        await message.reply('Usage: `j$ticket setup <panelChannelId> <categoryId> [supportRoleId] [logChannelId]`');
        return;
      }

      setTicketConfig(message.guild.id, {
        panelChannelId,
        categoryId,
        supportRoleId: supportRoleId || null,
        logChannelId: logChannelId || null,
        panelTitle: 'Support Tickets',
        panelDescription: 'Need help? Click **Open Ticket** and our team will assist you.'
      });

      await message.reply('✅ Ticket configuration saved. Use `j$ticket panel` to deploy the panel.');
      return;
    }

    if (subcommand === 'panel') {
      const config = getTicketConfig(message.guild.id);
      if (!config) {
        await message.reply('Ticket system is not configured yet. Run `j$ticket setup ...` first.');
        return;
      }

      try {
        await sendTicketPanel(message.guild, config);
        await message.reply('✅ Ticket panel deployed.');
      } catch (error) {
        await message.reply(`❌ ${error.message || 'Failed to send ticket panel.'}`);
      }
      return;
    }

    if (subcommand === 'close') {
      const ticketMeta = ticketsState.openTickets[message.channel.id];
      if (!ticketMeta) {
        await message.reply('This command only works inside an open ticket channel.');
        return;
      }

      if (!isSupportStaff(message.member, message.guild.id, message.author.id)) {
        await message.reply('❌ Only Support can close tickets.');
        return;
      }

      try {
        const reason = args.slice(1).join(' ').trim();
        await closeTicketChannel(message.channel, message.author.tag, reason || null);
      } catch (error) {
        await message.reply(`❌ ${error.message || 'Failed to close ticket.'}`);
      }
      return;
    }

    if (subcommand === 'claim' || subcommand === 'unclaim') {
      const ticketMeta = ticketsState.openTickets[message.channel.id];
      if (!ticketMeta) {
        await message.reply('This command only works inside an open ticket channel.');
        return;
      }

      if (!isSupportStaff(message.member, message.guild.id, message.author.id)) {
        await message.reply('❌ Only Support can claim tickets.');
        return;
      }

      if (subcommand === 'claim') {
        if (ticketMeta.claimedBy && ticketMeta.claimedBy !== message.author.id) {
          await message.reply(`❌ This ticket is already claimed by <@${ticketMeta.claimedBy}>.`);
          return;
        }

        ticketMeta.claimedBy = message.author.id;
        ticketMeta.firstResponseAt = ticketMeta.firstResponseAt || Date.now();
        ticketMeta.status = 'Claimed';
        saveTicketsState();
        await message.reply(`✅ Ticket claimed by ${message.author}.`);
      } else {
        if (ticketMeta.claimedBy && ticketMeta.claimedBy !== message.author.id && message.author.id !== OWNER_ID) {
          await message.reply('❌ Only the support member who claimed this ticket can unclaim it.');
          return;
        }
        ticketMeta.claimedBy = null;
        ticketMeta.status = 'Open';
        saveTicketsState();
        await message.reply('✅ Ticket is now unclaimed.');
      }

      await postTicketStatusMessage(message.channel, ticketMeta);
      return;
    }

    if (subcommand === 'priority') {
      const ticketMeta = ticketsState.openTickets[message.channel.id];
      if (!ticketMeta) {
        await message.reply('This command only works inside an open ticket channel.');
        return;
      }

      if (!isSupportStaff(message.member, message.guild.id, message.author.id)) {
        await message.reply('❌ Only Support can change ticket priority.');
        return;
      }

      const priority = normalizeTicketPriority(args[1]);
      if (!priority) {
        await message.reply('Usage: `j$ticket priority <low|normal|high|urgent>`');
        return;
      }

      ticketMeta.priority = priority;
      saveTicketsState();
      await message.reply(`✅ Ticket priority set to **${formatTicketText(priority, 'Normal')}**.`);
      await postTicketStatusMessage(message.channel, ticketMeta);
      return;
    }

    if (subcommand === 'status' || subcommand === 'done') {
      const ticketMeta = ticketsState.openTickets[message.channel.id];
      if (!ticketMeta) {
        await message.reply('This command only works inside an open ticket channel.');
        return;
      }

      if (!isSupportStaff(message.member, message.guild.id, message.author.id)) {
        await message.reply('❌ Only Support can update ticket trade status.');
        return;
      }

      const nextStatus = subcommand === 'done' ? 'Done' : args.slice(1).join(' ').trim();
      if (!nextStatus) {
        await message.reply('Usage: `j$ticket status <text>`');
        return;
      }

      ticketMeta.status = String(nextStatus).slice(0, 120);
      saveTicketsState();
      await message.reply(`✅ Trade status updated to **${ticketMeta.status}**.`);
      await postTicketStatusMessage(message.channel, ticketMeta);
      return;
    }

    if (subcommand === 'add' || subcommand === 'remove') {
      const userId = parseDiscordId(args[1]);
      if (!userId) {
        await message.reply(`Usage: \`j$ticket ${subcommand} <userId|@mention>\``);
        return;
      }

      if (!ticketsState.openTickets[message.channel.id]) {
        await message.reply('This command only works inside an open ticket channel.');
        return;
      }

      if (!isSupportStaff(message.member, message.guild.id, message.author.id)) {
        await message.reply(`❌ Only Support can ${subcommand} users in tickets.`);
        return;
      }

      const perms = {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true
      };

      if (subcommand === 'add') {
        await message.channel.permissionOverwrites.edit(userId, perms);
        await message.reply(`✅ Added <@${userId}> to this ticket.`);
      } else {
        await message.channel.permissionOverwrites.delete(userId).catch(() => null);
        await message.reply(`✅ Removed <@${userId}> from this ticket.`);
      }
      return;
    }

    if (subcommand === 'transcript') {
      if (!ticketsState.openTickets[message.channel.id]) {
        await message.reply('This command only works inside an open ticket channel.');
        return;
      }

      const messages = await message.channel.messages.fetch({ limit: 30 }).catch(() => null);
      const sorted = messages ? [...messages.values()].sort((left, right) => left.createdTimestamp - right.createdTimestamp) : [];
      const lines = sorted.map((entry) => {
        const contentLine = (entry.content || '[non-text message]').replace(/\s+/g, ' ').slice(0, 120);
        return `${entry.author.tag}: ${contentLine}`;
      });

      const attachment = new AttachmentBuilder(Buffer.from(lines.join('\n') || 'No messages.', 'utf8'), {
        name: `ticket-preview-${Date.now()}.txt`
      });

      await message.reply({ content: 'Transcript preview generated:', files: [attachment] });
      return;
    }

    await message.reply('Unknown ticket command. Use `j$ticket help`.');
    return;
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId === 'ticket_claim') {
      const ticketMeta = ticketsState.openTickets[interaction.channelId];
      if (!ticketMeta) {
        await interaction.reply({ content: 'This is not an active ticket channel.', ephemeral: true });
        return;
      }

      const canManage = isSupportStaff(interaction.member, interaction.guildId, interaction.user.id);

      if (!canManage) {
        await interaction.reply({ content: 'Only Support can claim this ticket.', ephemeral: true });
        return;
      }

      if (ticketMeta.claimedBy && ticketMeta.claimedBy !== interaction.user.id) {
        await interaction.reply({ content: `This ticket is already claimed by <@${ticketMeta.claimedBy}>.`, ephemeral: true });
        return;
      }

      ticketMeta.claimedBy = interaction.user.id;
      ticketMeta.firstResponseAt = ticketMeta.firstResponseAt || Date.now();
      ticketMeta.status = 'Claimed';
      saveTicketsState();

      await interaction.reply({ content: `✅ Ticket claimed by <@${interaction.user.id}>.`, ephemeral: true });
      await postTicketStatusMessage(interaction.channel, ticketMeta);
      return;
    }

    if (interaction.isButton() && interaction.customId === 'ticket_open') {
      const config = getTicketConfig(interaction.guildId);
      if (!config) {
        await interaction.reply({
          content: 'Ticket system is not configured yet.',
          ephemeral: true
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('ticket_open_modal')
        .setTitle('Open Trade Ticket');

      const tradeTargetInput = new TextInputBuilder()
        .setCustomId('ticket_trade_target')
        .setLabel('Username or User ID you are trading with')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Username, tag, or numeric user ID');

      const tradeDetailsInput = new TextInputBuilder()
        .setCustomId('ticket_trade_details')
        .setLabel('What are you trading?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Describe your side of the trade...');

      modal.addComponents(
        new ActionRowBuilder().addComponents(tradeTargetInput),
        new ActionRowBuilder().addComponents(tradeDetailsInput)
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_open_modal') {
      const config = getTicketConfig(interaction.guildId);
      if (!config) {
        await interaction.reply({ content: 'Ticket system is not configured yet.', ephemeral: true });
        return;
      }

      const tradeTargetRaw = interaction.fields.getTextInputValue('ticket_trade_target');
      const tradeDetails = interaction.fields.getTextInputValue('ticket_trade_details');

      if (!String(tradeTargetRaw || '').trim() || !String(tradeDetails || '').trim()) {
        await interaction.reply({ content: 'Both trade target and trade details are required.', ephemeral: true });
        return;
      }

      const match = await findBestTradeMember(interaction.guild, tradeTargetRaw);
      const channel = await createTicketForUser(interaction.guild, interaction.user.id, {
        tradeTargetRaw,
        tradeDetails,
        tradePartnerId: match && match.confidence.startsWith('exact') ? match.member.id : null,
        pendingTradePartnerId: match ? match.member.id : null
      });

      if (match && !channel.permissionsFor(match.member.id)?.has(PermissionFlagsBits.ViewChannel)) {
        const promptRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_confirm_target:${match.member.id}`)
            .setLabel('Yes')
            .setStyle(ButtonStyle.Primary)
        );

        await channel.send({
          content: `<@${interaction.user.id}> is this the right username? ${match.member} (${match.member.user.tag})`,
          components: [promptRow]
        });
      } else if (match && match.member.id) {
        await channel.permissionOverwrites.edit(match.member.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true
        });
      } else {
        await channel.send('I could not confidently match that user from this server. Support can add them with `j$ticket add <userId>` once verified.');
      }

      await interaction.reply({
        content: `✅ Your ticket is ready: ${channel}`,
        ephemeral: true
      });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('ticket_confirm_target:')) {
      const ticketMeta = ticketsState.openTickets[interaction.channelId];
      if (!ticketMeta) {
        await interaction.reply({ content: 'This is not an active ticket channel.', ephemeral: true });
        return;
      }

      const targetUserId = interaction.customId.split(':')[1];
      const isAllowedConfirmer =
        interaction.user.id === ticketMeta.openerId ||
        isSupportStaff(interaction.member, interaction.guildId, interaction.user.id);

      if (!isAllowedConfirmer) {
        await interaction.reply({ content: 'Only the ticket opener or Support can confirm this user.', ephemeral: true });
        return;
      }

      await interaction.channel.permissionOverwrites.edit(targetUserId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true
      });

      ticketMeta.tradePartnerId = targetUserId;
      ticketMeta.pendingTradePartnerId = null;
      ticketMeta.status = 'User Confirmed';
      saveTicketsState();

      await interaction.reply({ content: `✅ Added <@${targetUserId}> to the ticket.`, ephemeral: true });
      await postTicketStatusMessage(interaction.channel, ticketMeta);
      return;
    }

    if (interaction.isButton() && interaction.customId === 'ticket_done') {
      const ticketMeta = ticketsState.openTickets[interaction.channelId];
      if (!ticketMeta) {
        await interaction.reply({ content: 'This is not an active ticket channel.', ephemeral: true });
        return;
      }

      if (!isSupportStaff(interaction.member, interaction.guildId, interaction.user.id)) {
        await interaction.reply({ content: 'Only Support can mark this trade as done.', ephemeral: true });
        return;
      }

      ticketMeta.status = 'Done';
      saveTicketsState();
      await interaction.reply({ content: '✅ Trade status set to Done.', ephemeral: true });
      await postTicketStatusMessage(interaction.channel, ticketMeta);
      return;
    }

    if (interaction.isButton() && interaction.customId === 'ticket_close') {
      const ticketMeta = ticketsState.openTickets[interaction.channelId];
      if (!ticketMeta) {
        await interaction.reply({
          content: 'This is not an active ticket channel.',
          ephemeral: true
        });
        return;
      }

      const canClose = isSupportStaff(interaction.member, interaction.guildId, interaction.user.id);

      if (!canClose) {
        await interaction.reply({
          content: 'Only Support can close this ticket.',
          ephemeral: true
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('ticket_close_reason_modal')
        .setTitle('Close Ticket');

      const reasonInput = new TextInputBuilder()
        .setCustomId('ticket_close_reason')
        .setLabel('Close reason (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder('Resolved / Duplicate / Handled in DM...');

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_close_reason_modal') {
      const ticketMeta = ticketsState.openTickets[interaction.channelId];
      if (!ticketMeta) {
        await interaction.reply({ content: 'This is not an active ticket channel.', ephemeral: true });
        return;
      }

      const canClose = isSupportStaff(interaction.member, interaction.guildId, interaction.user.id);

      if (!canClose) {
        await interaction.reply({ content: 'Only Support can close this ticket.', ephemeral: true });
        return;
      }

      const closeReason = interaction.fields.getTextInputValue('ticket_close_reason');
      await interaction.reply({ content: 'Closing ticket...', ephemeral: true });
      await closeTicketChannel(interaction.channel, interaction.user.tag, closeReason || null);
      return;
    }

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

// API: Tickets config and deployment
app.get('/api/tickets/config', (req, res) => {
  const guildId = parseDiscordId(req.query.guildId);
  if (!guildId) {
    return res.status(400).json({ success: false, message: 'guildId query parameter is required' });
  }

  res.json({
    success: true,
    config: getTicketConfig(guildId) || null
  });
});

app.post('/api/tickets/config', (req, res) => {
  const guildId = parseDiscordId(req.body.guildId);
  const panelChannelId = parseDiscordId(req.body.panelChannelId);
  const categoryId = parseDiscordId(req.body.categoryId);
  const supportRoleId = parseDiscordId(req.body.supportRoleId);
  const logChannelId = parseDiscordId(req.body.logChannelId);

  if (!guildId || !panelChannelId || !categoryId) {
    return res.status(400).json({
      success: false,
      message: 'guildId, panelChannelId, and categoryId are required'
    });
  }

  setTicketConfig(guildId, {
    panelChannelId,
    categoryId,
    supportRoleId: supportRoleId || null,
    logChannelId: logChannelId || null,
    panelTitle: String(req.body.panelTitle || 'Support Tickets').slice(0, 120),
    panelDescription: String(req.body.panelDescription || 'Need help? Click **Open Ticket** and our team will assist you.').slice(0, 1500)
  });

  res.json({ success: true, message: 'Ticket configuration saved', config: getTicketConfig(guildId) });
});

app.get('/api/tickets/logs', (req, res) => {
  const guildId = parseDiscordId(req.query.guildId);
  if (!guildId) {
    return res.status(400).json({ success: false, message: 'guildId query parameter is required' });
  }

  res.json({
    success: true,
    logs: getTicketLogs(guildId)
  });
});

app.post('/api/tickets/panel', async (req, res) => {
  const guildId = parseDiscordId(req.body.guildId);
  if (!guildId) {
    return res.status(400).json({ success: false, message: 'guildId is required' });
  }

  if (!client || !client.isReady()) {
    return res.status(503).json({ success: false, message: 'Bot is not online' });
  }

  const config = getTicketConfig(guildId);
  if (!config) {
    return res.status(404).json({ success: false, message: 'Ticket config not found for guild' });
  }

  try {
    const guild = await client.guilds.fetch(guildId);
    await sendTicketPanel(guild, config);
    res.json({ success: true, message: 'Ticket panel deployed' });
  } catch (error) {
    console.error('Ticket panel deploy error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to deploy ticket panel' });
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
