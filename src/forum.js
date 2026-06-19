const { ChannelType } = require('discord.js');
const CONFIG = require('../config');

function isMarketplacePost(channel) {
  if (!channel || !channel.isThread()) return false;
  const forum = channel.parent;
  if (!forum || forum.type !== ChannelType.GuildForum) return false;
  const category = forum.parent;
  return (
    !!category &&
    category.name.toLowerCase() === CONFIG.categoryName.toLowerCase()
  );
}

function findTagId(forum, tagName) {
  const tag = forum.availableTags.find(
    (t) => t.name.toLowerCase() === tagName.toLowerCase()
  );
  return tag ? tag.id : null;
}

function stateTagIds(forum) {
  const ids = new Set();
  for (const name of Object.values(CONFIG.tags)) {
    const id = findTagId(forum, name);
    if (id) ids.add(id);
  }
  return ids;
}

// Swap the lifecycle state tag while preserving any descriptive tags (e.g. the
// poly tags chosen at post time). Discord caps applied tags at 5.
async function applyTag(thread, stateKey) {
  const tagName = CONFIG.tags[stateKey];
  const tagId = findTagId(thread.parent, tagName);
  if (tagId === null) {
    return { missingTag: true, tagName };
  }
  const states = stateTagIds(thread.parent);
  const kept = thread.appliedTags.filter((id) => !states.has(id));
  const next = [tagId, ...kept].slice(0, 5);
  await thread.setAppliedTags(next);
  return { missingTag: false, tagName };
}

function tagNote({ missingTag, tagName }) {
  return missingTag ? ` (No **${tagName}** tag found in this forum — create it.)` : '';
}

function findForum(guild, forumName) {
  return guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildForum &&
      c.name.toLowerCase() === forumName.toLowerCase() &&
      c.parent &&
      c.parent.name.toLowerCase() === CONFIG.categoryName.toLowerCase()
  );
}

module.exports = { isMarketplacePost, findTagId, applyTag, tagNote, findForum };
