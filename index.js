require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

const events = [
  require('./src/events/ready'),
  require('./src/events/threadCreate'),
  require('./src/events/threadDelete'),
  require('./src/events/interactionCreate'),
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

for (const event of events) {
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.login(process.env.DISCORD_TOKEN);
