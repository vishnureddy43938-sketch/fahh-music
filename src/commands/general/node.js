const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const theme = require('../../utils/theme');
const config = require('../../config');
const { formatDuration } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('node')
    .setDescription('Display Lavalink node status and diagnostics')
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('View connection status and node health')
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction|import('discord.js').Message} context 
   */
  async execute(context) {
    const isInteraction = typeof context.isChatInputCommand === 'function' && context.isChatInputCommand();
    const user = isInteraction ? context.user : context.author;
    const isOwner = String(user.id) === String(config.ownerId);

    const diagnostics = musicManager.lavalink.getDiagnostics();

    // 1. Ordinary User View (Safe, general availability message only)
    if (!isOwner) {
      const publicEmbed = theme.createEmbed(
        diagnostics.isAvailable ? theme.colors.success : theme.colors.secondary
      )
        .setTitle('🔊 HYDRA Music Engine Status')
        .setDescription(
          diagnostics.isAvailable
            ? '✅ High-fidelity audio streaming node is online and operational.'
            : '⚡ Direct internal streaming engine is operational.'
        )
        .addFields(
          { name: '🎵 Playback Status', value: 'Ready to play songs via `/play` or `.play`', inline: true },
          { name: '🌐 Server Regions', value: 'Global Low-Latency Routing', inline: true }
        )
        .setFooter({ text: 'HYDRA Audio Engine • Public Status' });

      if (isInteraction) {
        return context.reply({ embeds: [publicEmbed], ephemeral: true });
      } else {
        return context.reply({ embeds: [publicEmbed] });
      }
    }

    // 2. Owner-Only Detailed Diagnostics View (Secrets strictly hidden)
    let stateEmoji = '🔴';
    let stateColor = theme.colors.error;

    if (diagnostics.state === 'CONNECTED') {
      stateEmoji = '🟢';
      stateColor = theme.colors.success;
    } else if (diagnostics.state === 'CONNECTING') {
      stateEmoji = '🟡';
      stateColor = theme.colors.warning;
    }

    const embed = theme.createEmbed(stateColor)
      .setTitle(`🛠️ Lavalink Node Diagnostics: ${diagnostics.name}`)
      .setDescription(`Detailed telemetry for node administrator <@${user.id}>.`)
      .addFields(
        { name: '🏷️ Node Name', value: `\`${diagnostics.name}\``, inline: true },
        { name: '📡 Endpoint', value: `\`${diagnostics.endpoint}\``, inline: true },
        { name: '🔒 SSL / TLS', value: diagnostics.secure ? 'Enabled (`https`)' : 'Disabled (`http`)', inline: true },
        { name: '📶 Connection State', value: `${stateEmoji} **${diagnostics.state}**`, inline: true },
        { name: '🚀 Server Version', value: `\`${diagnostics.version}\``, inline: true },
        { name: '🎧 Active Players', value: `\`${diagnostics.activePlayers}\``, inline: true },
        { name: '🔑 Password Status', value: diagnostics.hasAuthSet ? 'Configured (`[PROTECTED]`)' : '❌ Missing `NODE_AUTH`', inline: true }
      );

    if (diagnostics.stats) {
      const cpu = diagnostics.stats.cpu
        ? `${(diagnostics.stats.cpu.lavalinkLoad * 100).toFixed(1)}% (Lavalink) / ${(diagnostics.stats.cpu.systemLoad * 100).toFixed(1)}% (System)`
        : 'N/A';
      const mem = diagnostics.stats.memory
        ? `${Math.round(diagnostics.stats.memory.used / 1024 / 1024)} MB / ${Math.round(diagnostics.stats.memory.allocated / 1024 / 1024)} MB`
        : 'N/A';
      const uptime = diagnostics.stats.uptime ? formatDuration(Math.floor(diagnostics.stats.uptime / 1000)) : 'N/A';

      embed.addFields(
        { name: '📊 CPU Load', value: `\`${cpu}\``, inline: true },
        { name: '💾 Memory Load', value: `\`${mem}\``, inline: true },
        { name: '⏱️ Node Uptime', value: `\`${uptime}\``, inline: true }
      );
    }

    if (diagnostics.lastError) {
      embed.addFields({
        name: '⚠️ Last Error Notice',
        value: `\`${diagnostics.lastError.slice(0, 200)}\``,
        inline: false,
      });
    }

    if (diagnostics.lastDisconnectReason) {
      embed.addFields({
        name: '🔌 Last Disconnect Reason',
        value: `\`${diagnostics.lastDisconnectReason.slice(0, 200)}\``,
        inline: false,
      });
    }

    embed.setFooter({ text: 'HYDRA Node Diagnostics • Owner Confidential' });

    if (isInteraction) {
      return context.reply({ embeds: [embed], ephemeral: true });
    } else {
      return context.reply({ embeds: [embed] });
    }
  },
};
