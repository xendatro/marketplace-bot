const { Events } = require('discord.js');
const { initDb, getAllPostThreadIds, deletePost } = require('../db');
const commands = require('../commands');

// On startup, drop any tracked posts whose thread no longer exists — catches
// deletions that happened while the bot was offline (their ThreadDelete events
// are never replayed), which would otherwise leave artists "stuck" as accepted.
async function reconcilePosts(client) {
  const ids = await getAllPostThreadIds();
  let cleaned = 0;
  for (const threadId of ids) {
    try {
      await client.channels.fetch(threadId);
    } catch (err) {
      if (err && err.code === 10003) {
        await deletePost(threadId);
        cleaned += 1;
      }
    }
  }
  console.log(cleaned ? `Reconciled ${cleaned} orphaned post(s).` : 'Post reconciliation: nothing to clean.');
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute: async (client) => {
    console.log(`Logged in as ${client.user.tag}`);

    try {
      await initDb();
      console.log('Database ready.');
    } catch (err) {
      console.error('Failed to initialise database:', err);
    }

    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      await guild.commands.set([...commands.values()].map((c) => c.data.toJSON()));
      console.log('Slash commands registered.');
    } catch (err) {
      console.error('Failed to register commands:', err);
    }

    try {
      await reconcilePosts(client);
    } catch (err) {
      console.error('Post reconciliation failed:', err);
    }
  },
};
