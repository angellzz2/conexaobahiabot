# Syncore • MTA Server Status Bot

Bot de Discord inspirado no painel de status enviado como referência, mas feito para ser totalmente configurável pelo próprio Discord.

## O que ele faz

- `/painel` envia o painel público no canal atual.
- `/configurar` abre um painel administrativo privado.
- Edita título, descrição, nome do servidor, comando F8, textos do status, cor, rodapé, thumbnail e imagem.
- Edita os botões `Conectar-se` e `Site`.
- Guarda tudo em `data/config.json`.
- Depois de publicado, o painel é atualizado automaticamente.
- Status pode ser:
  - `manual`: você define `true` ou `false`.
  - `api`: o bot consulta uma URL HTTP que devolva JSON.

## Exemplo de API para status

Se a URL responder:

```json
{
  "online": true
}
```

No painel de configuração:
- Modo: `api`
- URL da API: `https://seusite.com/api/status`
- Campo JSON: `online`

Se a resposta for:

```json
{
  "server": {
    "online": true
  }
}
```

Use o campo:

`server.online`

## Instalação

1. Instale Node.js 18 ou superior.
2. Abra a pasta do bot.
3. Rode:

```bash
npm install
```

4. Copie `.env.example` para `.env`.
5. Preencha:

```env
DISCORD_TOKEN=TOKEN
CLIENT_ID=ID_DA_APLICACAO
GUILD_ID=ID_DO_SEU_DISCORD
```

6. Inicie:

```bash
npm start
```

## Discord Developer Portal

O bot precisa, no mínimo, das permissões:
- View Channels
- Send Messages
- Embed Links
- Read Message History

Para usar `/painel` e `/configurar`, o usuário precisa ter permissão de Administrador.

## Como usar

### `/configurar`

Abre um painel explicado com:

- 📝 Conteúdo
- 📡 Conexão
- 🔘 Botões
- 🎨 Aparência
- 🟢 Status
- 📤 Publicar / Atualizar painel

As respostas de configuração são privadas e só aparecem para quem executou o comando.

### `/painel`

Publica o painel no canal onde o comando foi executado.  
Se já existir um painel salvo, o bot edita a mensagem existente em vez de criar várias cópias.

## Hospedagem

Start command:

```bash
npm start
```

ou:

```bash
node index.js
```

Se a plataforma possuir a opção **Worker / Background Worker**, ela é ideal para este bot. Caso a host só ofereça Web Service, ela pode exigir uma porta HTTP; nesse caso será necessário adicionar um pequeno servidor HTTP.


## Conexão direta com o MTA

O painel já vem configurado para o servidor:

`mtasa://200.9.154.250:22325`

O texto exibido na embed usa esse endereço e o botão **🚀 Conectar-se** também aponta para ele.

Em um computador com MTA:SA instalado e com o protocolo `mtasa://` registrado, clicar no botão solicita a abertura do MTA diretamente no servidor. O Discord/sistema operacional ainda pode exibir uma confirmação de segurança antes de abrir outro aplicativo; isso é controlado pelo cliente e não pelo bot.


## Permissões dos comandos

Acesso permitido para:

- Usuário: `980286104852914257`
- Cargo: `1537146633978912898`

Quem não estiver em uma dessas duas condições recebe uma embed de **Acesso negado**. A proteção também vale para botões e formulários do painel administrativo.
