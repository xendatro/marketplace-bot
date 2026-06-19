const { Events } = require('discord.js');
const { deletePost } = require('../db');

module.exports = {
  name: Events.ThreadDelete,
  execute: async (thread) => {
    try {
      await deletePost(thread.id);
    } catch (err) {
      console.error('Failed to clean up deleted thread:', err);
    }
  },
};
