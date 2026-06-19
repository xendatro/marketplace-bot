const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { requireMarketplacePost } = require('../guards');
const { applyTag, tagNote } = require('../forum');
const { getPost, clearAccepted } = require('../db');
const { NO_PING } = require('../util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resign')
    .setDescription('Step down from a task you were accepted for.'),
  execute: async (interaction) => {
    const thread = await requireMarketplacePost(interaction);
    if (!thread) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const post = await getPost(thread.id);
    if (!post || post.accepted_artist_id !== interaction.user.id) {
      return interaction.editReply(
        "You're not the accepted artist on this task. (If you applied but weren't accepted, use **/withdraw**.)"
      );
    }

    await clearAccepted(thread.id);
    const result = await applyTag(thread, 'unclaimed');
    await thread.send({
      content: `🚪 <@${interaction.user.id}> has resigned from this task — it's open again. Artists can **/apply**.${tagNote(result)}`,
      ...NO_PING,
    });
    return interaction.editReply('You have resigned from this task.');
  },
};
