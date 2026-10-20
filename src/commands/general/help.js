const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} = require('discord.js');
const theme = require('../../utils/theme');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display the interactive HYDRA command manual and features guide')
    .addStringOption((option) =>
      option.setName('command').setDescription('Specific command name to view detailed instructions for')
    ),

  async execute(interaction) {
    const specificCmd = interaction.options.getString('command');

    const categories = {
      playback: {
        label: 'Music Playback',
        emoji: '🎵',
        description: 'Commands for playing and controlling audio streams',
        commands: [
          { name: '/play <query>', desc: 'Play a track, playlist, or search query (YouTube, SoundCloud, Spotify)' },
          { name: '/search <query>', desc: 'Search for music and choose from interactive top results' },
          { name: '/pause', desc: 'Pause current audio playback' },
          { name: '/resume', desc: 'Resume paused audio playback' },
          { name: '/skip', desc: 'Skip the currently playing track' },
          { name: '/previous', desc: 'Replay the previous track from history' },
          { name: '/stop', desc: 'Stop playback, clear queue, and leave voice channel' },
          { name: '/seek <timestamp>', desc: 'Seek to a position in track (e.g. 1:30 or 90)' },
          { name: '/nowplaying', desc: 'Show currently playing track with interactive controls' },
          { name: '/join', desc: 'Summon HYDRA to your current voice channel' },
          { name: '/leave', desc: 'Disconnect HYDRA from the voice channel' },
          { name: '/lyrics [song]', desc: 'Display song lyrics with auto-pagination' },
        ],
      },
      queue: {
        label: 'Queue Management',
        emoji: '📜',
        description: 'Commands for organizing and looping your music queue',
        commands: [
          { name: '/queue [page]', desc: 'View paginated upcoming tracks with navigation buttons' },
          { name: '/shuffle', desc: 'Randomize the upcoming queue order' },
          { name: '/loop [mode]', desc: 'Set loop mode (off, track, queue)' },
          { name: '/volume [level]', desc: 'Adjust playback volume (1% to 150%)' },
          { name: '/remove <pos>', desc: 'Remove a specific track by queue position' },
          { name: '/move <from> <to>', desc: 'Move a track from one position to another' },
          { name: '/clear', desc: 'Clear all upcoming tracks from queue' },
          { name: '/247', desc: 'Toggle continuous 24/7 voice presence' },
          { name: '/autoplay', desc: 'Toggle smart recommendations when queue finishes' },
        ],
      },
      settings: {
        label: 'Configuration & Settings',
        emoji: '⚙️',
        description: 'Server customization and admin controls',
        commands: [
          { name: '/settings view', desc: 'View all server music preferences' },
          { name: '/settings djrole', desc: 'Designate a DJ role for playback controls' },
          { name: '/settings announce', desc: 'Set dedicated Now Playing announcement channel' },
          { name: '/settings botchannel', desc: 'Restrict bot commands to a specific text channel' },
          { name: '/settings volume', desc: 'Set default startup volume (1-150)' },
          { name: '/settings idletimeout', desc: 'Set idle disconnect countdown in seconds' },
          { name: '/settings reset', desc: 'Reset all server settings to defaults' },
        ],
      },
      general: {
        label: 'General & Support',
        emoji: '✨',
        description: 'Bot diagnostics, invite links, and help resources',
        commands: [
          { name: '/help [cmd]', desc: 'Display this interactive help manual' },
          { name: '/ping', desc: 'Check WebSocket latency, API roundtrip, and voice ping' },
          { name: '/invite', desc: 'Get official HYDRA bot invite link' },
          { name: '/support', desc: 'Join the community support and update server' },
        ],
      },
    };

    // If specific command requested
    if (specificCmd) {
      const cleanName = specificCmd.toLowerCase().replace('/', '');
      let found = null;
      for (const cat of Object.values(categories)) {
        const cmd = cat.commands.find((c) => c.name.toLowerCase().includes(cleanName));
        if (cmd) {
          found = cmd;
          break;
        }
      }

      if (found) {
        const embed = theme.createEmbed(theme.colors.secondary)
          .setTitle(`Command Details: \`${found.name}\``)
          .setDescription(found.desc);
        return interaction.reply({ embeds: [embed] });
      }
    }

    // Main interactive guide
    const buildCategoryEmbed = (catKey) => {
      const cat = categories[catKey] || categories.playback;
      const embed = theme.createEmbed(theme.colors.primary)
        .setTitle(`${cat.emoji} ${cat.label}`)
        .setDescription(`${cat.description}\n\n` + cat.commands.map((c) => `\`${c.name}\`\n↳ ${c.desc}`).join('\n\n'))
        .setFooter({ text: 'Use the dropdown menu below to navigate command categories' });
      return embed;
    };

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('hydra_help_category')
      .setPlaceholder('Select a category...');

    Object.entries(categories).forEach(([key, cat]) => {
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(cat.label)
          .setDescription(cat.description)
          .setEmoji(cat.emoji)
          .setValue(key)
      );
    });

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const replyMsg = await interaction.reply({
      embeds: [buildCategoryEmbed('playback')],
      components: [row],
      fetchReply: true,
    });

    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.user.id === interaction.user.id,
      time: 90_000,
    });

    collector.on('collect', async (menuInteraction) => {
      const chosenCat = menuInteraction.values[0];
      await menuInteraction.update({
        embeds: [buildCategoryEmbed(chosenCat)],
        components: [row],
      });
    });

    collector.on('end', async () => {
      await interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
