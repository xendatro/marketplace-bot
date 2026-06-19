const CONFIG = require('../config');

function hasRole(member, roleName) {
  if (!member || !member.roles) return false;
  return member.roles.cache.some(
    (r) => r.name.toLowerCase() === roleName.toLowerCase()
  );
}

function isAdmin(member) {
  return hasRole(member, CONFIG.adminRole);
}

function isOwnerOrAdmin(interaction, thread) {
  return interaction.user.id === thread.ownerId || isAdmin(interaction.member);
}

function findRole(guild, roleName) {
  return guild.roles.cache.find(
    (r) => r.name.toLowerCase() === roleName.toLowerCase()
  );
}

function claimRoleFor(forum) {
  if (!forum) return CONFIG.artistRole;
  return CONFIG.forumRoles[forum.name.toLowerCase()] ?? CONFIG.artistRole;
}

module.exports = { hasRole, isAdmin, isOwnerOrAdmin, findRole, claimRoleFor };
