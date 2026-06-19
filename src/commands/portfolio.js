const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { requireArtist } = require('../guards');
const { setPortfolio } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('portfolio')
    .setDescription('Set or clear your portfolio link (artists only).')
    .addStringOption((opt) =>
      opt.setName('link').setDescription('Your portfolio URL (leave blank to clear)').setRequired(false)
    ),
  execute: async (interaction) => {
    if (!(await requireArtist(interaction))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const link = interaction.options.getString('link');
    if (!link) {
      await setPortfolio(interaction.user.id, null);
      return interaction.editReply('Your portfolio link has been cleared.');
    }
    if (!/^https?:\/\//i.test(link)) {
      return interaction.editReply(
        "That doesn't look like a valid link — please include the full URL (starting with http:// or https://)."
      );
    }
    await setPortfolio(interaction.user.id, link);
    return interaction.editReply(`Your portfolio link has been set to: ${link}`);
  },
};
