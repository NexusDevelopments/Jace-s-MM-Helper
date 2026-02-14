require('dotenv').config();
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
const BOT_TOKEN = process.env.BOT_TOKEN;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const ALLOWED_ROLE_IDS = (process.env.ALLOWED_ROLE_IDS || '')
  .split(',')
  .map((roleId) => roleId.trim())
  .filter(Boolean);
const SESSION_TTL_MS = 10 * 60 * 1000;

const sessions = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

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

function hasAllowedRole(member) {
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

client.once('ready', () => {
  console.log(`Bot online as ${client.user.tag}`);

  setInterval(() => {
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
  if (!content.startsWith(`${PREFIX}demo`)) return;

  if (!hasAllowedRole(message.member)) {
    await message.reply('You do not have access to this command.');
    return;
  }

  await message.reply(getDemoStartPayload());
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
        guildId: interaction.guildId
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

if (!BOT_TOKEN) {
  throw new Error('Missing BOT_TOKEN in env.');
}

client.login(BOT_TOKEN);
