const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const theme = require('../../utils/theme');
const { formatDuration } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Display bot latency, Discord WebSocket ping, and system diagnostics'),

  async execute(interaction) {
    const sent = await interaction.deferReply({ fetchReply: true });
    const roundTrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = interaction.client.ws.ping;

    // Check voice ping if active in this guild
    const player = musicManager.getPlayer(interaction.guildId);
    let voicePingStr = 'N/A (Not Connected)';
    if (player && player.voiceConnection) {
      const ping = player.voiceConnection.ping.ws;
      voicePingStr = ping !== undefined ? `${ping}ms` : 'Connecting...';
    }

    const memory = process.memoryUsage();
    const heapUsedMB = (memory.heapUsed / 1024 / 1024).toFixed(1);
    const rssMB = (memory.rss / 1024 / 1024).toFixed(1);

    const embed = theme.createEmbed(theme.colors.secondary)
      .setTitle('🏓 HYDRA Diagnostics & Latency')
      .addFields(
        { name: '📡 API Roundtrip', value: `\`${roundTrip}ms\``, inline: true },
        { name: '⚡ WebSocket Heartbeat', value: `\`${wsPing}ms\``, inline: true },
        { name: '🔊 Voice Connection Ping', value: `\`${voicePingStr}\``, inline: true },
        { name: '💾 Memory Usage', value: `\`${heapUsedMB} MB (Heap) / ${rssMB} MB (RSS)\``, inline: true },
        { name: '⏱️ Bot Uptime', value: `\`${formatDuration(process.uptime())}\``, inline: true },
        { name: '🟢 Node.js Engine', value: `\`${process.version}\``, inline: true }
      );

    return interaction.editReply({ embeds: [embed] });
  },
};
