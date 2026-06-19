const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const CONFIG = require('../../config');
const { requireMarketplacePost, requirePostOwner } = require('../guards');
const { applyTag, tagNote } = require('../forum');
const { getPost, incrementCompletion, deletePost } = require('../db');
const { updateLevelRole } = require('../levels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('done')
    .setDescription('Mark this task completed, credit the artist, then close it.'),
  execute: async (interaction) => {
    const thread = await requireMarketplacePost(interaction);
    if (!thread) return;
    if (!(await requirePostOwner(interaction, thread))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const post = await getPost(thread.id);
    if (!post || !post.accepted_artist_id) {
      return interaction.editReply('No one is accepted yet — run **/accept @artist** before marking it done.');
    }

    const artistId = post.accepted_artist_id;
    const result = await applyTag(thread, 'done');
    const count = await incrementCompletion(artistId);
    await deletePost(thread.id);
    await updateLevelRole(interaction.guild, artistId, count);
    await thread.send({
      content: `Transaction complete — marked **${CONFIG.tags.done}** and the post is now closed. Thanks <@${artistId}>!${tagNote(result)}`,
      allowedMentions: { users: [artistId] },
    });
    await interaction.editReply('Marked complete and closed.');
    await thread.setLocked(true);
    await thread.setArchived(true);
  },
};
