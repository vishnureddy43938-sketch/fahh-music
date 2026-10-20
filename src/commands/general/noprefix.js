const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const database = require('../../database/Database');
const theme = require('../../utils/theme');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('noprefix')
    .setDescription('Manage No-Prefix (NP) command execution permissions')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Grant No-Prefix permissions to a user')
        .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName('scope')
            .setDescription('Scope of permission (global requires bot owner)')
            .addChoices({ name: 'Server Only', value: 'server' }, { name: 'Global (Owner Only)', value: 'global' })
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Revoke No-Prefix permissions from a user')
        .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName('scope')
            .setDescription('Scope of permission')
            .addChoices({ name: 'Server Only', value: 'server' }, { name: 'Global (Owner Only)', value: 'global' })
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List authorized No-Prefix users in this server')),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction|import('discord.js').Message} context 
   * @param {string[]} [args]
   */
  async execute(context, args = []) {
    const isInteraction = typeof context.isChatInputCommand === 'function' && context.isChatInputCommand();
    const user = isInteraction ? context.user : context.author;
    const guild = context.guild;
    const isOwner = String(user.id) === String(config.ownerId);

    // Permission check: Must be bot owner or have Administrator permissions
    const member = context.member;
    const isAdmin = member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isOwner && !isAdmin) {
      const errEmbed = theme.createErrorEmbed(
        'You need Administrator or Bot Owner permissions to manage No-Prefix access.',
        'Permission Denied'
      );
      return isInteraction ? context.reply({ embeds: [errEmbed], ephemeral: true }) : context.reply({ embeds: [errEmbed] });
    }

    let subcommand, targetUser, scope;

    if (isInteraction) {
      subcommand = context.options.getSubcommand();
      targetUser = context.options.getUser('user');
      scope = context.options.getString('scope') || 'server';
    } else {
      subcommand = args[0]?.toLowerCase();
      const mentionMatch = args[1]?.match(/^<@!?(\d+)>$/);
      const targetId = mentionMatch ? mentionMatch[1] : args[1];
      targetUser = targetId ? await context.client.users.fetch(targetId).catch(() => null) : null;
      scope = args[2]?.toLowerCase() === 'global' ? 'global' : 'server';
    }

    if (!subcommand || !['add', 'remove', 'list'].includes(subcommand)) {
      const helpEmbed = theme.createEmbed(theme.colors.secondary)
        .setTitle('⚙️ No-Prefix (NP) Access Management')
        .setDescription(
          `**Usage:**\n` +
          `\`${config.prefix}noprefix add <@user> [global|server]\`\n` +
          `\`${config.prefix}noprefix remove <@user> [global|server]\`\n` +
          `\`${config.prefix}noprefix list\`\n\n` +
          `*Note: Global NP permissions can only be granted by the bot owner (<@${config.ownerId}>).*`
        );
      return isInteraction ? context.reply({ embeds: [helpEmbed] }) : context.reply({ embeds: [helpEmbed] });
    }

    switch (subcommand) {
      case 'add': {
        if (!targetUser) {
          const err = theme.createErrorEmbed('Please specify a valid user to grant No-Prefix permissions.');
          return isInteraction ? context.reply({ embeds: [err], ephemeral: true }) : context.reply({ embeds: [err] });
        }

        if (scope === 'global' && !isOwner) {
          const err = theme.createErrorEmbed('Only the bot owner can grant Global No-Prefix permissions.', 'Owner Required');
          return isInteraction ? context.reply({ embeds: [err], ephemeral: true }) : context.reply({ embeds: [err] });
        }

        const targetGuildId = scope === 'global' ? null : guild.id;
        await database.addNP(targetUser.id, targetGuildId, user.id);

        const embed = theme.createSuccessEmbed(
          `Granted **${scope.toUpperCase()}** No-Prefix access to <@${targetUser.id}>.\nThey can now run music commands with or without the \`${config.prefix}\` prefix!`,
          'No-Prefix Access Granted'
        );
        return isInteraction ? context.reply({ embeds: [embed] }) : context.reply({ embeds: [embed] });
      }

      case 'remove': {
        if (!targetUser) {
          const err = theme.createErrorEmbed('Please specify a valid user to revoke No-Prefix permissions.');
          return isInteraction ? context.reply({ embeds: [err], ephemeral: true }) : context.reply({ embeds: [err] });
        }

        if (scope === 'global' && !isOwner) {
          const err = theme.createErrorEmbed('Only the bot owner can revoke Global No-Prefix permissions.', 'Owner Required');
          return isInteraction ? context.reply({ embeds: [err], ephemeral: true }) : context.reply({ embeds: [err] });
        }

        const targetGuildId = scope === 'global' ? null : guild.id;
        const removed = await database.removeNP(targetUser.id, targetGuildId);

        if (!removed) {
          const warn = theme.createWarningEmbed(`<@${targetUser.id}> does not have ${scope} No-Prefix permissions.`);
          return isInteraction ? context.reply({ embeds: [warn], ephemeral: true }) : context.reply({ embeds: [warn] });
        }

        const embed = theme.createSuccessEmbed(
          `Revoked **${scope.toUpperCase()}** No-Prefix access from <@${targetUser.id}>.`,
          'No-Prefix Access Revoked'
        );
        return isInteraction ? context.reply({ embeds: [embed] }) : context.reply({ embeds: [embed] });
      }

      case 'list': {
        const list = await database.getNPList(guild?.id);
        const ownerMention = `<@${config.ownerId}> (Global Bot Owner - Permanent)`;

        const globalEntries = list.filter((i) => !i.guild_id).map((i) => `• <@${i.user_id}> (Global)`);
        const serverEntries = list.filter((i) => i.guild_id === guild?.id).map((i) => `• <@${i.user_id}> (Server)`);

        const embed = theme.createEmbed(theme.colors.secondary)
          .setTitle('👑 Authorized No-Prefix (NP) Users')
          .addFields(
            { name: '🛡️ Permanent Owner', value: ownerMention, inline: false },
            { name: '🌐 Global NP Users', value: globalEntries.length > 0 ? globalEntries.join('\n') : '*No additional global users*', inline: false },
            { name: '🏠 Server NP Users', value: serverEntries.length > 0 ? serverEntries.join('\n') : '*No server-specific NP users*', inline: false }
          )
          .setFooter({ text: 'Users with NP can invoke commands without typing the prefix' });

        return isInteraction ? context.reply({ embeds: [embed] }) : context.reply({ embeds: [embed] });
      }
    }
  },
};
