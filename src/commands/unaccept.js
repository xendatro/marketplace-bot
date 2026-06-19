const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { requireMarketplacePost, requirePostOwner } = require('../guards');
const { applyTag, tagNote } = require('../forum');
const { getPost, clearAccepted } = require('../db');
const { NO_PING } = require('../util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unaccept')
    .setDescription('Remove the currently accepted artist (their claim stays).'),
  execute: async (interaction) => {
    const thread = await requireMarketplacePost(interaction);
    if (!thread) return;
    if (!(await requirePostOwner(interaction, thread))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const post = await getPost(thread.id);
    if (!post || !post.accepted_artist_id) {
      return interaction.editReply('No one is currently accepted for this task.');
    }

    const artistId = post.accepted_artist_id;
    await clearAccepted(thread.id);
    const result = await applyTag(thread, 'unclaimed');
    await thread.send({
      content: `↩️ <@${artistId}> is no longer accepted for this task (their application still stands). It's open again.${tagNote(result)}`,
      ...NO_PING,
    });
    return interaction.editReply('Artist unaccepted — the task is open again.');
  },
};
