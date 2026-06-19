const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { requireMarketplacePost, requirePostOwner } = require('../guards');
const { applyTag, tagNote } = require('../forum');
const { getPost, setPaidStatus } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('paid')
    .setDescription('Mark this task as paid (asset not yet received).'),
  execute: async (interaction) => {
    const thread = await requireMarketplacePost(interaction);
    if (!thread) return;
    if (!(await requirePostOwner(interaction, thread))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const post = await getPost(thread.id);
    if (!post || !post.accepted_artist_id) {
      return interaction.editReply('No one is accepted yet — run **/accept @artist** before marking it paid.');
    }

    await setPaidStatus(thread.id);
    const result = await applyTag(thread, 'paid');
    await thread.send({
      content: `<@${interaction.user.id}> has paid. <@${post.accepted_artist_id}>, please send the asset over via DM to finish this process.${tagNote(result)}`,
      allowedMentions: { users: [post.accepted_artist_id] },
    });
    return interaction.editReply('Marked as paid.');
  },
};
