const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { requireMarketplacePost } = require('../guards');
const { getPost, hasClaim, removeClaim } = require('../db');
const { NO_PING } = require('../util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Withdraw your pending application from this task.'),
  execute: async (interaction) => {
    const thread = await requireMarketplacePost(interaction);
    if (!thread) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const artistId = interaction.user.id;
    if (!(await hasClaim(thread.id, artistId))) {
      const post = await getPost(thread.id);
      if (post && post.accepted_artist_id === artistId) {
        return interaction.editReply("You're the accepted artist here — use **/resign** to step down, not /withdraw.");
      }
      return interaction.editReply("You haven't applied to this task, so there's nothing to withdraw.");
    }

    await removeClaim(thread.id, artistId);
    await thread.send({ content: `↩️ <@${artistId}> withdrew their application.`, ...NO_PING });
    return interaction.editReply('Your application has been withdrawn.');
  },
};
