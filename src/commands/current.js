const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { requireAdmin } = require('../guards');
const { getClaimsForArtist } = require('../db');
const { NO_PING } = require('../util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('current')
    .setDescription("List an artist's current applications and accepted tasks.")
    .addUserOption((opt) =>
      opt.setName('artist').setDescription('The artist to look up').setRequired(true)
    ),
  execute: async (interaction) => {
    if (!(await requireAdmin(interaction))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const artist = interaction.options.getUser('artist');
    const rows = await getClaimsForArtist(artist.id);

    if (rows.length === 0) {
      return interaction.editReply({ content: `<@${artist.id}> has no active applications.`, ...NO_PING });
    }

    const list = rows
      .map((r, i) => {
        const state = r.accepted_artist_id === artist.id ? 'Accepted — In-Progress' : 'Applied';
        return `${i + 1}. ${r.title} — *${state}*`;
      })
      .join('\n');
    return interaction.editReply({
      content: `**<@${artist.id}> (${rows.length} active):**\n${list}`,
      ...NO_PING,
    });
  },
};
