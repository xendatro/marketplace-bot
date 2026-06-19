const NO_PING = { allowedMentions: { parse: [] } };

function plural(n) {
  return `${n} completion${n === 1 ? '' : 's'}`;
}

function disciplineOption(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

module.exports = { NO_PING, plural, disciplineOption };
