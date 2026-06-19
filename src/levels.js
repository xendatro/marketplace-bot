const CONFIG = require('../config');
const { findRole } = require('./roles');

function levelFor(count) {
  let chosen = CONFIG.levels[0];
  for (const lvl of CONFIG.levels) {
    if (count >= lvl.min) chosen = lvl;
  }
  return chosen;
}

function maxAcceptedFor(count) {
  return levelFor(count).maxAccepted ?? 1;
}

async function updateLevelRole(guild, artistId, count) {
  if (!guild) return;
  const targetName = levelFor(count).role;
  const targetRole = findRole(guild, targetName);
  if (!targetRole) {
    console.error(`Level role "${targetName}" not found — create it or check spelling.`);
    return;
  }
  let member;
  try {
    member = await guild.members.fetch(artistId);
  } catch {
    return;
  }
  const levelNames = new Set(CONFIG.levels.map((l) => l.role.toLowerCase()));
  const removeIds = member.roles.cache
    .filter((r) => levelNames.has(r.name.toLowerCase()) && r.id !== targetRole.id)
    .map((r) => r.id);
  try {
    if (removeIds.length) await member.roles.remove(removeIds);
    if (!member.roles.cache.has(targetRole.id)) await member.roles.add(targetRole);
  } catch (err) {
    console.error('Failed to update level role (check Manage Roles + role hierarchy):', err);
  }
}

module.exports = { levelFor, maxAcceptedFor, updateLevelRole };
