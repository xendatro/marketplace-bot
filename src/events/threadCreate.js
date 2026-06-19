const { Events } = require('discord.js');
const { isMarketplacePost, applyTag, tagNote } = require('../forum');

module.exports = {
  name: Events.ThreadCreate,
  execute: async (thread, newlyCreated) => {
    if (!newlyCreated) return;
    if (!isMarketplacePost(thread)) return;

    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      const result = await applyTag(thread, 'unclaimed');
      if (result.missingTag) {
        await thread.send(`⚠️ Couldn't tag this post.${tagNote(result)}`);
      }
    } catch (err) {
      console.error('Failed to auto-tag new post:', err);
    }
  },
};
