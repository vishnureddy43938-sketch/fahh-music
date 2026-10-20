const { Events } = require('discord.js');
const musicManager = require('../music/MusicManager');
const theme = require('../utils/theme');
const logger = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,

  /**
   * @param {import('discord.js').Interaction} interaction 
   */
  async execute(interaction) {
    // 1. Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        logger.warn(`No command matching ${interaction.commandName} was found.`);
        return interaction.reply({
          content: 'This command is no longer registered.',
          ephemeral: true,
        });
      }

      try {
        logger.debug(
          `[Command] /${interaction.commandName} executed by ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guildId}`
        );
        await command.execute(interaction);
      } catch (err) {
        logger.error(`Error executing /${interaction.commandName}:`, err);

        const errorEmbed = theme.createErrorEmbed(
          'An unexpected error occurred while executing this command. Please try again later.',
          'Execution Error'
        );

        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => {});
        } else {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    // 2. Fallback router for Buttons (when collector has ended or for persistent controls)
    if (interaction.isButton() && interaction.customId.startsWith('hydra_btn_')) {
      const player = musicManager.getPlayer(interaction.guildId);
      if (!player) {
        return interaction.reply({
          content: `${theme.emojis.error} There is no active playback in this server.`,
          ephemeral: true,
        });
      }

      await musicManager.handleButtonInteraction(interaction, player);
      return;
    }
  },
};
