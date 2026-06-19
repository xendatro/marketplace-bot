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
