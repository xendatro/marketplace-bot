const { Events, MessageFlags } = require('discord.js');
const commands = require('../commands');
const post = require('../commands/post');

module.exports = {
  name: Events.InteractionCreate,
  execute: async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = commands.get(interaction.commandName);
        if (command) await command.execute(interaction);
        return;
      }

      if ((interaction.isStringSelectMenu() || interaction.isButton()) && interaction.customId.startsWith('post:')) {
        await post.handleComponent(interaction);
        return;
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith('post:')) {
        await post.handleModal(interaction);
        return;
      }
    } catch (err) {
      // 10062 = Unknown interaction, 40060 = already acknowledged. These almost
      // always mean a second copy of the bot is running on the same token and
      // beat this one to the response. The interaction is dead, so don't try to
      // reply (that would just throw again).
      if (err && (err.code === 10062 || err.code === 40060)) {
        console.warn(
          `Stale interaction (code ${err.code}) — this usually means more than one instance of the bot is running on the same token.`
        );
        return;
      }
      console.error(err);
      const msg =
        'Something went wrong — make sure I have the right permissions, that my role is high enough, ' +
        'and that the database is reachable.';
      if (typeof interaction.isRepliable === 'function' && !interaction.isRepliable()) return;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg).catch(() => {});
      } else {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  },
};
