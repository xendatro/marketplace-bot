const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { removeAllClaimsForArtist } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('withdraw-all')
    .setDescription('Withdraw all your pending applications (keeps accepted tasks).'),
  execute: async (interaction) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const n = await removeAllClaimsForArtist(interaction.user.id);
    if (!n) {
      return interaction.editReply('You have no pending applications to withdraw.');
    }
    return interaction.editReply(
      `Withdrew **${n}** application${n === 1 ? '' : 's'}. Your accepted tasks are untouched.`
    );
  },
};
