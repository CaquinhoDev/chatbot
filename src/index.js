const fs = require("fs");
const P = require("pino")({ level: "silent" });
const {
  DisconnectReason,
  useMultiFileAuthState,
  isJidGroup,
  fetchLatestBaileysVersion,
  delay,
  jidNormalizedUser,
  areJidsSameUser,
} = require("@whiskeysockets/baileys");
const makeWASocket = require("@whiskeysockets/baileys").default;

const config = require("./config");
const { spin_text, rl } = require("./utils/utils");
const createOrUpdateEnv = require("./utils/envHandler");

const modoDev = process.argv.includes("--dev") || config.devMode;
const usarQrCode = process.argv.includes("--qrcode") || config.useQrCode;

let cliente;
let conversaSimSimi;

// Interface de linha de comando
const pergunta = (texto) =>
  new Promise((resolve) => rl.question(texto, resolve));

// Função para obter o corpo da mensagem
function obterCorpo(mensagem) {
  return (
    mensagem.message.extendedTextMessage?.text ||
    mensagem.message.conversation ||
    mensagem.message.ephemeralMessage?.message?.extendedTextMessage?.text ||
    mensagem.message.ephemeralMessage?.message?.conversation ||
    ""
  );
}

// Função para obter JIDs mencionados na mensagem
function obterJidsMencionados(mensagem) {
  const jidMencionado =
    mensagem.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  const jidEphemeralMencionado =
    mensagem.message?.ephemeralMessage?.message?.extendedTextMessage
      ?.contextInfo?.mentionedJid;
  return jidMencionado || jidEphemeralMencionado;
}

// Função para obter a expiração da mensagem
function obterExpiracaoMensagem(mensagem) {
  return (
    mensagem.message?.ephemeralMessage?.message?.extendedTextMessage
      ?.contextInfo?.expiration ||
    mensagem.message?.extendedTextMessage?.contextInfo?.expiration
  );
}

// Função para obter o telefone a partir do JID
function obterTelefoneDoJid(jid) {
  return jidNormalizedUser(jid).split("@")[0];
}

// Função para reagir à mensagem com um emoji
async function reagirMensagem(mensagem, reacao) {
  const mensagemReacao = {
    react: {
      text: reacao,
      key: mensagem.key,
    },
  };
  return await cliente.sendMessage(mensagem.key.remoteJid, mensagemReacao);
}

// Função para reagir à mensagem com um emoji aleatório
async function reagirMensagemAleatoria(mensagem) {
  const emojis = [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "😂",
    "🤣",
    "😊",
    "😇",
    "🙂",
    "🙃",
    "😉",
    "😌",
    "😍",
    "🥰",
    "😘",
    "😗",
    "😙",
    "😚",
    "🥲",
    "😋",
    "😛",
    "😜",
    "🤪",
    "😝",
    "🤑",
    "🤗",
    "🤭",
    "🤫",
    "🤔",
    "🤐",
    "🤨",
    "😐",
    "😑",
    "😶",
    "😶‍🌫️",
    "😏",
    "😒",
    "🙄",
    "😬",
    "😮‍💨",
    "🤥",
    "😌",
    "😔",
    "😪",
    "🤤",
    "😴",
    "😷",
    "🤒",
    "🤕",
    "🤢",
    "🤮",
    "🤧",
    "🥵",
    "🥶",
    "🥴",
    "😵",
    "😵‍💫",
    "🤯",
    "🤠",
    "🥳",
    "🥸",
    "😎",
    "🤓",
    "🧐",
    "😕",
    "😟",
    "🙁",
    "☹️",
    "😮",
    "😯",
    "😲",
    "😳",
    "🥺",
    "😦",
    "😧",
    "😨",
    "😰",
    "😥",
    "😢",
    "😭",
    "😱",
    "😖",
    "😣",
    "😞",
    "😓",
    "😩",
    "😫",
    "🥱",
    "😤",
    "😡",
    "😠",
    "🤬",
    "😈",
    "👿",
    "💀",
    "☠️",
    "💩",
    "🤡",
    "👹",
    "👺",
    "👻",
    "👽",
    "👾",
    "🤖",
    "😺",
    "😸",
    "😹",
    "😻",
    "😼",
    "😽",
    "🙀",
    "😿",
    "😾",
  ];
  const emojiAleatorio = emojis[Math.floor(Math.random() * emojis.length)];
  return await reagirMensagem(mensagem, emojiAleatorio);
}

// Função para enviar uma mensagem
async function enviarMensagem(mensagem, resposta) {
  const expiracao = obterExpiracaoMensagem(mensagem);
  await delay(resposta.length * 100);
  await cliente.sendPresenceUpdate("paused", mensagem.key.remoteJid);
  return cliente.sendMessage(
    mensagem.key.remoteJid,
    { text: resposta },
    { quoted: mensagem, ephemeralExpiration: expiracao }
  );
}

// Função para determinar se deve responder à mensagem
function deveResponder(mensagem) {
  const ehGrupo = isJidGroup(mensagem.key.remoteJid);

  if (!ehGrupo) {
    return true;
  }

  const jidCliente = jidNormalizedUser(cliente.user?.id);
  const jidsMencionados = obterJidsMencionados(mensagem);
  const participante =
    mensagem.message?.extendedTextMessage?.contextInfo?.participant ||
    mensagem.message?.ephemeralMessage?.message?.extendedTextMessage
      ?.contextInfo?.participant;

  return (
    jidsMencionados?.includes(jidCliente) ||
    areJidsSameUser(participante, jidCliente)
  );
}

// Função para lidar com a mensagem recebida
async function lidarComMensagemRecebida(mensagem) {
  if (
    mensagem.key.fromMe ||
    !mensagem.message ||
    !mensagem.key.remoteJid ||
    mensagem.key.remoteJid === "status@broadcast" ||
    mensagem.message.reactionMessage
  ) {
    return;
  }

  const corpo = obterCorpo(mensagem);
  if (corpo && deveResponder(mensagem)) {
    const telefoneCliente = "@" + obterTelefoneDoJid(cliente.user?.id);
    const mensagemRemetente = corpo.replace(telefoneCliente, "").trim();
    console.log(mensagem.pushName + " disse: " + mensagemRemetente);

    let resposta;

    if (modoDev) {
      resposta = "Modo desenvolvedor está ativo!";
      reagirMensagem(mensagem, spin_text("{🛠|⚙|🔧|⚒|🪚|🤖}"));
    } else {
      // aparecer "digitando..." no whatsapp
      // await cliente.presenceSubscribe(mensagem.key.remoteJid);
      // await delay(500);
      // await cliente.sendPresenceUpdate("composing", mensagem.key.remoteJid);
      resposta = await conversaSimSimi(mensagemRemetente);
    }

    if (!resposta) {
      resposta = "Desculpe, não consegui entender sua mensagem.";
      await cliente.sendPresenceUpdate("paused", mensagem.key.remoteJid);
    }

    console.log("O bot respondeu: " + resposta);
    await enviarMensagem(mensagem, resposta);

    // Reage com um emoji aleatório no modo normal
    if (!modoDev) {
      await reagirMensagemAleatoria(mensagem);
    }
  }
}

// Função de lógica de conexão
async function logicaConexao() {
  console.log("Iniciando...");
  conversaSimSimi = require("./simSimi");
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version, isLatest } = await fetchLatestBaileysVersion();
  cliente = makeWASocket({
    version: version,
    logger: P,
    printQRInTerminal: usarQrCode,
    mobile: false,
    browser: ["Chrome (Linux)", "", ""],
    auth: state,
  });

  if (!usarQrCode && !cliente.authState.creds.registered) {
    const numeroTelefone = await pergunta(
      "Por favor, insira seu número de telefone móvel:\n"
    );
    const codigo = await cliente.requestPairingCode(
      numeroTelefone.replace(/[^0-9]/g, "")
    );
    console.log(`Código de emparelhamento: ${codigo}`);
  }

  cliente.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update || {};

    if (connection) {
      console.log(`Status da Conexão: ${connection}`);
    }

    if (usarQrCode && qr) {
      console.log(qr);
    }

    if (connection == "close") {
      console.log("Conexão perdida!");
      const deveReconectar =
        lastDisconnect?.error?.output?.statusCode != DisconnectReason.loggedOut;

      if (deveReconectar) {
        console.log("Reconectando...");
        logicaConexao();
      }
    }
  });

  cliente.ev.on("messages.upsert", async (evento) => {
    for (const mensagem of evento.messages) {
      if (modoDev) {
        console.log("Mensagem recebida no modo desenvolvedor.");
      }
      await lidarComMensagemRecebida(mensagem);
    }
  });

  cliente.ev.on("creds.update", saveCreds);
}

// Função principal
(async () => {
  try {
    await logicaConexao();
  } catch (erro) {
    console.error("Erro ao iniciar a conexão:", erro);
  }
})();
