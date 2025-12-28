const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  Events,
  Partials,
  ApplicationCommandOptionType,
} = require('discord.js');

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
  c.application.commands
    .set([
      {
        name: 'download',
        description: 'Download Lua from Junkie and send as .lua text',
        dm_permission: true,
        options: [
          {
            name: 'url',
            description: 'Junkie URL',
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
    ])
    .catch((e) => console.error('Failed to register commands', e));
});

function extractJunkieUrl(content) {
  if (!content) return null;
  const match = content.match(/https?:\/\/api\.junkie-development\.de[^\s"'()]+/i);
  if (!match) return null;
  const raw = match[0];
  const trimmed = raw.replace(/[)"']+$/, '');
  try {
    const u = new URL(trimmed);
    if (u.host !== 'api.junkie-development.de') return null;
    return u;
  } catch {
    return null;
  }
}

async function handleDownload(urlObj) {
  const response = await fetch(urlObj.href, {
    headers: {
      'User-Agent': 'Volcano',
    },
  });
  if (!response.ok) {
    return { error: `Failed to download file. HTTP ${response.status} ${response.statusText}` };
  }
  const luaText = await response.text();

  let base = urlObj.pathname.split('/').filter(Boolean).pop() || 'script';
  base = base.replace(/\.\w+$/, '');
  const filename = `${base}.lua`;
  const buffer = Buffer.from(luaText, 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: filename });
  return { attachment };
}

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (message.guildId) return;

    const urlObj = extractJunkieUrl(message.content || '');
    if (!urlObj) {
      await message.reply('Send a valid Junkie API URL or use /download.');
      return;
    }

    await message.channel.sendTyping();
    const result = await handleDownload(urlObj);
    if (result.error) {
      await message.reply(result.error);
      return;
    }
    await message.reply({ content: 'Here is your Lua script.', files: [result.attachment] });
  } catch (err) {
    console.error(err);
    try {
      await message.reply('Unexpected error while downloading the file.');
    } catch (_) {
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'download') return;
    if (interaction.guildId) {
      await interaction.reply({ content: 'This command works only in DMs.', ephemeral: true });
      return;
    }
    const urlStr = interaction.options.getString('url', true);
    const urlObj = extractJunkieUrl(urlStr);
    if (!urlObj) {
      await interaction.reply('Only URLs from api.junkie-development.de are allowed.');
      return;
    }
    await interaction.deferReply();
    const result = await handleDownload(urlObj);
    if (result.error) {
      await interaction.editReply(result.error);
      return;
    }
    await interaction.editReply({ content: 'Here is your Lua script.', files: [result.attachment] });
  } catch (err) {
    console.error(err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('Unexpected error while downloading the file.');
    } else {
      await interaction.reply('Unexpected error while downloading the file.');
    }
  }
});

client.login(token);
