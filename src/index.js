const { Client, GatewayIntentBits, AttachmentBuilder, Events, Partials } = require('discord.js');

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('DISCORD_TOKEN environment variable is missing.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (message.guildId) return;

    const content = message.content || '';

    const match = content.match(/https?:\/\/\S+/i);
    const url = match ? match[0].replace(/[")\]]+$/, '') : null;

    if (!url) {
      await message.reply('Send a valid Junkie API URL or loadstring(...) containing it.');
      return;
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      await message.reply('Invalid URL format.');
      return;
    }

    if (parsed.host !== 'api.junkie-development.de') {
      await message.reply('Only URLs from api.junkie-development.de are allowed.');
      return;
    }

    await message.channel.sendTyping();

    const response = await fetch(parsed.href, {
      headers: {
        'User-Agent': 'Volcano',
      },
    });

    if (!response.ok) {
      await message.reply(
        `Failed to download file. HTTP ${response.status} ${response.statusText}`
      );
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let filename = 'downloaded.file';

    const cd = response.headers.get('content-disposition');
    const cdMatch = cd && cd.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i);
    if (cdMatch) {
      filename = decodeURIComponent(cdMatch[1] || cdMatch[2]);
    } else {
      try {
        const last = parsed.pathname.split('/').filter(Boolean).pop();
        if (last) filename = last;
      } catch {
      }
    }

    const attachment = new AttachmentBuilder(buffer, { name: filename });
    await message.reply({
      content: 'Here is your downloaded file.',
      files: [attachment],
    });
  } catch (err) {
    console.error(err);
    try {
      await message.reply('Unexpected error while downloading the file.');
    } catch (_) {
    }
  }
});

client.login(token);
