const { SlashCommandBuilder } = require('discord.js');
const { getCount, getPortfolio } = require('../db');
const { levelFor } = require('../levels');
const { NO_PING } = require('../util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view')
    .setDescription("View an artist's profile and completion count.")
    .addUserOption((opt) =>
      opt.setName('artist').setDescription('The artist to look up').setRequired(true)
    ),
  execute: async (interaction) => {
    await interaction.deferReply();

    const artistUser = interaction.options.getUser('artist');
    const artistMember = interaction.options.getMember('artist');
    const count = await getCount(artistUser.id);
    const level = levelFor(count).role;
    const portfolio = await getPortfolio(artistUser.id);
    const displayName = artistMember?.displayName ?? artistUser.username;
    const portfolioLine = portfolio
      ? portfolio
      : "Not linked — this artist hasn't added a portfolio yet. Ask them directly if you'd like to see their work.";

    const content = [
      `**Display Name:** ${displayName}`,
      `**Username:** ${artistUser.username}`,
      `**Level:** ${level}`,
      `**Completions:** ${count}`,
      `**Portfolio:** ${portfolioLine}`,
    ].join('\n');

    return interaction.editReply({ content, ...NO_PING });
  },
};
