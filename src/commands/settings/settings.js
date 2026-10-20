const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const database = require('../../database/Database');
const theme = require('../../utils/theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Configure HYDRA music settings for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View current server music settings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('djrole')
        .setDescription('Set or clear the DJ role')
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to designate as DJ (leave empty to remove)'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('announce')
        .setDescription('Set or clear the Now Playing announcement channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Text channel for now playing announcements')
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('botchannel')
        .setDescription('Restrict music commands to a specific text channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Allowed text channel for music commands (leave empty to allow all)')
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('volume')
        .setDescription('Set default playback volume for this server')
        .addIntegerOption((opt) =>
          opt.setName('level').setDescription('Default volume (1 to 150)').setMinValue(1).setMaxValue(150).setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('idletimeout')
        .setDescription('Set idle disconnect countdown in seconds')
        .addIntegerOption((opt) =>
          opt.setName('seconds').setDescription('Seconds before leaving empty voice (10 to 3600)').setMinValue(10).setMaxValue(3600).setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('reset').setDescription('Reset all settings to default values')
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [theme.createErrorEmbed('You need the `Manage Server` permission to configure HYDRA settings.')],
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const current = await database.getSettings(interaction.guildId);

    switch (subcommand) {
      case 'view': {
        const embed = theme.createEmbed(theme.colors.secondary)
          .setTitle(`${theme.emojis.settings} HYDRA Settings for ${interaction.guild.name}`)
          .addFields(
            { name: '🎧 DJ Role', value: current.dj_role_id ? `<@&${current.dj_role_id}>` : '*Disabled (All members)*', inline: true },
            { name: '📢 Announce Channel', value: current.announce_channel_id ? `<#${current.announce_channel_id}>` : '*Same as command*', inline: true },
            { name: '🔒 Command Channel', value: current.bot_channel_id ? `<#${current.bot_channel_id}>` : '*All channels permitted*', inline: true },
            { name: '🔊 Default Volume', value: `${current.default_volume}%`, inline: true },
            { name: '⏱️ Idle Disconnect', value: `${current.idle_timeout} seconds`, inline: true },
            { name: '♾️ 24/7 Presence', value: current.mode_247 ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: '📻 Autoplay', value: current.autoplay_enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: '📦 Max Queue Size', value: `${current.max_queue_size} tracks`, inline: true }
          );

        return interaction.reply({ embeds: [embed] });
      }

      case 'djrole': {
        const role = interaction.options.getRole('role');
        const updated = await database.setSettings(interaction.guildId, {
          dj_role_id: role ? role.id : null,
        });

        return interaction.reply({
          embeds: [
            theme.createSuccessEmbed(
              role
                ? `DJ role set to <@&${role.id}>.`
                : 'DJ role cleared. All members can now use playback controls.',
              'DJ Role Updated'
            ),
          ],
        });
      }

      case 'announce': {
        const channel = interaction.options.getChannel('channel');
        await database.setSettings(interaction.guildId, {
          announce_channel_id: channel ? channel.id : null,
        });

        return interaction.reply({
          embeds: [
            theme.createSuccessEmbed(
              channel
                ? `Now Playing announcements will be posted in <#${channel.id}>.`
                : 'Now Playing announcements will post in whichever channel commands are used.',
              'Announcement Channel Updated'
            ),
          ],
        });
      }

      case 'botchannel': {
        const channel = interaction.options.getChannel('channel');
        await database.setSettings(interaction.guildId, {
          bot_channel_id: channel ? channel.id : null,
        });

        return interaction.reply({
          embeds: [
            theme.createSuccessEmbed(
              channel
                ? `HYDRA commands are now restricted to <#${channel.id}>.`
                : 'HYDRA commands can now be run in all permitted text channels.',
              'Command Channel Updated'
            ),
          ],
        });
      }

      case 'volume': {
        const level = interaction.options.getInteger('level');
        await database.setSettings(interaction.guildId, { default_volume: level });

        return interaction.reply({
          embeds: [theme.createSuccessEmbed(`Default startup volume set to **${level}%**.`, 'Default Volume Updated')],
        });
      }

      case 'idletimeout': {
        const seconds = interaction.options.getInteger('seconds');
        await database.setSettings(interaction.guildId, { idle_timeout: seconds });

        return interaction.reply({
          embeds: [
            theme.createSuccessEmbed(
              `Idle disconnect timeout set to **${seconds}** seconds.`,
              'Idle Timeout Updated'
            ),
          ],
        });
      }

      case 'reset': {
        await database.resetSettings(interaction.guildId);
        return interaction.reply({
          embeds: [theme.createSuccessEmbed('All server settings have been reset to factory defaults.', 'Settings Reset')],
        });
      }

      default:
        return interaction.reply({ content: 'Unknown settings action.', ephemeral: true });
    }
  },
};
