
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const CONFIG_PATH = path.join(__dirname, 'data', 'config.json');

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

function normalizeHex(value, fallback = '#4169E1') {
  const v = String(value || '').trim();
  return /^#[0-9A-F]{6}$/i.test(v) ? v : fallback;
}

function getByPath(obj, p) {
  return p.split('.').reduce((acc, key) => acc?.[key], obj);
}

function setByPath(obj, p, value) {
  const keys = p.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
  cur[keys[keys.length - 1]] = value;
}

async function resolveOnline(cfg) {
  if (cfg.status.mode !== 'api' || !cfg.status.apiUrl) {
    return Boolean(cfg.status.manualOnline);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(cfg.status.apiUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return false;

    const data = await res.json();
    const field = String(cfg.status.apiOnlineField || 'online');
    const value = getByPath(data, field);

    return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'online';
  } catch {
    return false;
  }
}

async function buildPanel() {
  const cfg = loadConfig();
  const online = await resolveOnline(cfg);

  const embed = new EmbedBuilder()
    .setColor(normalizeHex(cfg.embed.color))
    .setTitle(cfg.embed.title || 'Informações')
    .setDescription(cfg.embed.description || null)
    .addFields(
      {
        name: cfg.embed.serverNameLabel || 'Nome do servidor:',
        value: cfg.embed.serverName || 'Não configurado',
        inline: false
      },
      {
        name: cfg.embed.statusLabel || 'Status:',
        value: online ? cfg.status.onlineText : cfg.status.offlineText,
        inline: false
      },
      {
        name: cfg.embed.connectLabel || 'Conectar:',
        value: `\`${cfg.embed.connectCommand || 'connect IP'}\``,
        inline: false
      }
    );

  if (cfg.embed.thumbnail) embed.setThumbnail(cfg.embed.thumbnail);
  if (cfg.embed.image) embed.setImage(cfg.embed.image);
  if (cfg.embed.footer) embed.setFooter({ text: cfg.embed.footer });

  const row = new ActionRowBuilder();

  if (cfg.buttons.connectEnabled && cfg.buttons.connectUrl) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel(cfg.buttons.connectLabel || 'Conectar-se')
        .setStyle(ButtonStyle.Link)
        .setURL(cfg.buttons.connectUrl)
    );
  }

  if (cfg.buttons.siteEnabled && cfg.buttons.siteUrl) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel(cfg.buttons.siteLabel || 'Site')
        .setStyle(ButtonStyle.Link)
        .setURL(cfg.buttons.siteUrl)
    );
  }

  return {
    embeds: [embed],
    components: row.components.length ? [row] : []
  };
}

async function sendOrUpdatePanel(channel) {
  const cfg = loadConfig();
  const payload = await buildPanel();

  if (cfg.panel.channelId && cfg.panel.messageId) {
    try {
      const oldChannel = await client.channels.fetch(cfg.panel.channelId);
      const oldMessage = await oldChannel.messages.fetch(cfg.panel.messageId);
      await oldMessage.edit(payload);
      return oldMessage;
    } catch {}
  }

  const msg = await channel.send(payload);
  cfg.panel.channelId = channel.id;
  cfg.panel.messageId = msg.id;
  saveConfig(cfg);
  return msg;
}

async function refreshSavedPanel() {
  const cfg = loadConfig();
  if (!cfg.panel.channelId || !cfg.panel.messageId) return;

  try {
    const channel = await client.channels.fetch(cfg.panel.channelId);
    const message = await channel.messages.fetch(cfg.panel.messageId);
    await message.edit(await buildPanel());
  } catch {}
}

const ALLOWED_USER_ID = '980286104852914257';
const ALLOWED_ROLE_ID = '1537146633978912898';

function hasBotPermission(interaction) {
  if (interaction.user?.id === ALLOWED_USER_ID) return true;

  const roles = interaction.member?.roles;
  if (roles?.cache?.has?.(ALLOWED_ROLE_ID)) return true;
  if (Array.isArray(roles) && roles.includes(ALLOWED_ROLE_ID)) return true;

  return false;
}

function noPermissionPayload() {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🔒 Acesso negado')
        .setDescription(
          'Você não possui permissão suficiente para utilizar os comandos administrativos deste bot.\n\n' +
          'Somente o **usuário autorizado** ou membros com o **cargo permitido** podem acessar estas funções.'
        )
        .addFields({
          name: '🧩 Syncore • Segurança',
          value: 'Esta proteção evita alterações não autorizadas nas configurações e no painel público.'
        })
        .setFooter({ text: 'Syncore Development • Controle de acesso' })
        .setTimestamp()
    ],
    ephemeral: true
  };
}

function configHome() {
  const embed = new EmbedBuilder()
    .setColor('#4169E1')
    .setTitle('⚙️ Configuração do Painel MTA')
    .setDescription(
      '**Use os botões abaixo para editar o painel sem mexer no código.**\n\n' +
      '📝 **Conteúdo** — título, descrição e nome do servidor.\n' +
      '📡 **Conexão** — comando F8 e textos do status.\n' +
      '🔘 **Botões** — links e nomes de Conectar/Site.\n' +
      '🎨 **Aparência** — cor, imagem, thumbnail e rodapé.\n' +
      '🟢 **Status** — manual ou via API HTTP.\n' +
      '📤 **Publicar** — envia/atualiza o painel no canal atual.\n\n' +
      'Todas as alterações ficam salvas em `data/config.json`.'
    );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg_content').setLabel('📝 Conteúdo').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfg_connection').setLabel('📡 Conexão').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfg_buttons').setLabel('🔘 Botões').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cfg_appearance').setLabel('🎨 Aparência').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cfg_status').setLabel('🟢 Status').setStyle(ButtonStyle.Success)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg_publish').setLabel('📤 Publicar / Atualizar painel').setStyle(ButtonStyle.Success)
      )
    ],
    ephemeral: true
  };
}

function makeInput(id, label, value, style = TextInputStyle.Short, required = false) {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label.slice(0, 45))
      .setStyle(style)
      .setRequired(required)
      .setValue(String(value ?? '').slice(0, style === TextInputStyle.Paragraph ? 4000 : 4000))
  );
}

function modalContent() {
  const c = loadConfig();
  return new ModalBuilder()
    .setCustomId('modal_content')
    .setTitle('Editar conteúdo do painel')
    .addComponents(
      makeInput('title', 'Título da embed', c.embed.title),
      makeInput('description', 'Descrição', c.embed.description, TextInputStyle.Paragraph),
      makeInput('serverNameLabel', 'Título do campo servidor', c.embed.serverNameLabel),
      makeInput('serverName', 'Nome do servidor', c.embed.serverName, TextInputStyle.Paragraph)
    );
}

function modalConnection() {
  const c = loadConfig();
  return new ModalBuilder()
    .setCustomId('modal_connection')
    .setTitle('Editar conexão')
    .addComponents(
      makeInput('connectLabel', 'Título do campo conexão', c.embed.connectLabel),
      makeInput('connectCommand', 'Comando para F8', c.embed.connectCommand),
      makeInput('statusLabel', 'Título do campo status', c.embed.statusLabel),
      makeInput('onlineText', 'Texto quando online', c.status.onlineText),
      makeInput('offlineText', 'Texto quando offline', c.status.offlineText)
    );
}

function modalButtons() {
  const c = loadConfig();
  return new ModalBuilder()
    .setCustomId('modal_buttons')
    .setTitle('Editar botões')
    .addComponents(
      makeInput('connectButtonLabel', 'Nome do botão Conectar', c.buttons.connectLabel),
      makeInput('connectUrl', 'URL do botão Conectar', c.buttons.connectUrl),
      makeInput('siteButtonLabel', 'Nome do botão Site', c.buttons.siteLabel),
      makeInput('siteUrl', 'URL do site', c.buttons.siteUrl)
    );
}

function modalAppearance() {
  const c = loadConfig();
  return new ModalBuilder()
    .setCustomId('modal_appearance')
    .setTitle('Editar aparência')
    .addComponents(
      makeInput('color', 'Cor HEX (#4169E1)', c.embed.color),
      makeInput('footer', 'Rodapé', c.embed.footer),
      makeInput('thumbnail', 'URL da thumbnail (opcional)', c.embed.thumbnail),
      makeInput('image', 'URL da imagem grande (opcional)', c.embed.image)
    );
}

function modalStatus() {
  const c = loadConfig();
  return new ModalBuilder()
    .setCustomId('modal_status')
    .setTitle('Configurar status')
    .addComponents(
      makeInput('mode', 'Modo: manual ou api', c.status.mode),
      makeInput('manualOnline', 'Manual: true ou false', String(c.status.manualOnline)),
      makeInput('apiUrl', 'URL da API (modo api)', c.status.apiUrl),
      makeInput('apiOnlineField', 'Campo JSON de online', c.status.apiOnlineField),
      makeInput('refreshSeconds', 'Intervalo em segundos', String(c.status.refreshSeconds))
    );
}

const commands = [
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Envia ou atualiza o painel público de status do MTA.'),

  new SlashCommandBuilder()
    .setName('configurar')
    .setDescription('Abre o painel completo de configuração do bot.')
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  if (process.env.GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
  } else {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
  }
}

client.once('ready', async () => {
  console.log(`✅ Online como ${client.user.tag}`);
  await registerCommands();
  console.log('✅ Comandos registrados.');

  const loop = async () => {
    try { await refreshSavedPanel(); } catch {}
    const cfg = loadConfig();
    setTimeout(loop, Math.max(30, Number(cfg.status.refreshSeconds) || 120) * 1000);
  };
  loop();
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (!hasBotPermission(interaction)) {
        return interaction.reply(noPermissionPayload());
      }

      if (interaction.commandName === 'painel') {
        await interaction.deferReply({ ephemeral: true });
        const msg = await sendOrUpdatePanel(interaction.channel);
        return interaction.editReply(`✅ Painel enviado/atualizado: ${msg.url}`);
      }

      if (interaction.commandName === 'configurar') {
        return interaction.reply(configHome());
      }
    }

    if (interaction.isButton()) {
      if (!hasBotPermission(interaction)) {
        return interaction.reply(noPermissionPayload());
      }

      if (interaction.customId === 'cfg_content') return interaction.showModal(modalContent());
      if (interaction.customId === 'cfg_connection') return interaction.showModal(modalConnection());
      if (interaction.customId === 'cfg_buttons') return interaction.showModal(modalButtons());
      if (interaction.customId === 'cfg_appearance') return interaction.showModal(modalAppearance());
      if (interaction.customId === 'cfg_status') return interaction.showModal(modalStatus());

      if (interaction.customId === 'cfg_publish') {
        await interaction.deferReply({ ephemeral: true });
        const msg = await sendOrUpdatePanel(interaction.channel);
        return interaction.editReply(`✅ Painel publicado/atualizado com sucesso.\n${msg.url}`);
      }
    }

    if (interaction.isModalSubmit()) {
      if (!hasBotPermission(interaction)) {
        return interaction.reply(noPermissionPayload());
      }

      const cfg = loadConfig();

      if (interaction.customId === 'modal_content') {
        cfg.embed.title = interaction.fields.getTextInputValue('title');
        cfg.embed.description = interaction.fields.getTextInputValue('description');
        cfg.embed.serverNameLabel = interaction.fields.getTextInputValue('serverNameLabel');
        cfg.embed.serverName = interaction.fields.getTextInputValue('serverName');
      }

      if (interaction.customId === 'modal_connection') {
        cfg.embed.connectLabel = interaction.fields.getTextInputValue('connectLabel');
        cfg.embed.connectCommand = interaction.fields.getTextInputValue('connectCommand');
        cfg.embed.statusLabel = interaction.fields.getTextInputValue('statusLabel');
        cfg.status.onlineText = interaction.fields.getTextInputValue('onlineText');
        cfg.status.offlineText = interaction.fields.getTextInputValue('offlineText');
      }

      if (interaction.customId === 'modal_buttons') {
        cfg.buttons.connectLabel = interaction.fields.getTextInputValue('connectButtonLabel');
        cfg.buttons.connectUrl = interaction.fields.getTextInputValue('connectUrl');
        cfg.buttons.siteLabel = interaction.fields.getTextInputValue('siteButtonLabel');
        cfg.buttons.siteUrl = interaction.fields.getTextInputValue('siteUrl');
      }

      if (interaction.customId === 'modal_appearance') {
        cfg.embed.color = normalizeHex(interaction.fields.getTextInputValue('color'), cfg.embed.color);
        cfg.embed.footer = interaction.fields.getTextInputValue('footer');
        cfg.embed.thumbnail = interaction.fields.getTextInputValue('thumbnail');
        cfg.embed.image = interaction.fields.getTextInputValue('image');
      }

      if (interaction.customId === 'modal_status') {
        const mode = interaction.fields.getTextInputValue('mode').trim().toLowerCase();
        cfg.status.mode = mode === 'api' ? 'api' : 'manual';
        cfg.status.manualOnline = interaction.fields.getTextInputValue('manualOnline').trim().toLowerCase() === 'true';
        cfg.status.apiUrl = interaction.fields.getTextInputValue('apiUrl').trim();
        cfg.status.apiOnlineField = interaction.fields.getTextInputValue('apiOnlineField').trim() || 'online';
        cfg.status.refreshSeconds = Math.max(30, Number(interaction.fields.getTextInputValue('refreshSeconds')) || 120);
      }

      saveConfig(cfg);
      await refreshSavedPanel();

      return interaction.reply({
        content: '✅ Configuração salva. Se o painel já estiver publicado, ele também foi atualizado.',
        ephemeral: true
      });
    }
  } catch (err) {
    console.error(err);

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply('❌ Ocorreu um erro ao executar esta ação. Veja o console do bot.').catch(() => {});
    }

    return interaction.reply({
      content: '❌ Ocorreu um erro ao executar esta ação. Veja o console do bot.',
      ephemeral: true
    }).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
