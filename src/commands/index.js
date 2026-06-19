const { Collection } = require('discord.js');

const modules = [
  require('./post'),
  require('./apply'),
  require('./withdraw'),
  require('./withdrawall'),
  require('./accept'),
  require('./unaccept'),
  require('./resign'),
  require('./paid'),
  require('./done'),
  require('./close'),
  require('./current'),
  require('./leaderboard'),
  require('./view'),
  require('./portfolio'),
  require('./createartist'),
  require('./stats'),
];

const commands = new Collection();
for (const mod of modules) {
  for (const cmd of Array.isArray(mod) ? mod : [mod]) {
    commands.set(cmd.data.name, cmd);
  }
}

module.exports = commands;
