import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from "@whiskeysockets/baileys";
import chalk from "chalk";
import pino from "pino";
import { Boom } from "@hapi/boom";
import dotenv from "dotenv";

// =================== CONFIGURATION PATHS ===================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =================== LOAD ENV ===================
dotenv.config();

// =================== CONFIGURATION BOT ===================
const config = {
  PREFIXE_COMMANDE: process.env.PREFIXE || "!",
  DOSSIER_AUTH: process.env.DOSSIER_AUTH || "session",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  RECONNECT_DELAY: parseInt(process.env.RECONNECT_DELAY) || 5000
};

// =================== LOGGER MINIMALISTE ===================
const logger = pino({
  level: config.LOG_LEVEL,
  transport: {
    target: "pino-pretty",
    options: { 
      colorize: true, 
      ignore: "pid,hostname", 
      translateTime: false,
      messageFormat: "{msg}"
    }
  },
  base: null
});

// =================== FICHIERS ===================
const SUDO_FILE = path.join(__dirname, "sudo.json");
const CONFIG_PATH = path.join(__dirname, "config.json");
const MODE_PREFIX_FILE = path.join(__dirname, "modeprefix.json");
const GROUP_CONFIG_PATH = path.join(__dirname, "group.json");
const JID_FILE = path.join(__dirname, "jid.json");
const RESPONS_FILE = path.join(__dirname, "respons.json");
const SESSION_CREDS_PATH = path.join(__dirname, "session", "creds.json");
const KNUT_MP3_PATH = path.join(__dirname, "knut.mp3");

// =================== UTILITAIRE DE FALLBACK IMAGE ===================
async function getImageBuffer(options = {}) {
  const { 
    url = "https://files.catbox.moe/8dheuf.jpg",
    localPath = path.join(__dirname, "knut.jpg"),
    timeout = 5000
  } = options;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const buffer = await response.buffer();
        return buffer;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    try {
      if (fs.existsSync(localPath)) {
        const buffer = await fs.readFile(localPath);
        return buffer;
      } else {
        return Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64'
        );
      }
    } catch (localError) {
      return Buffer.from('KNUT XMD V4', 'utf-8');
    }
  }
}

// =================== UTILITAIRE POUR CHARGER L'AUDIO ===================
async function getAudioBuffer(options = {}) {
  const {
    url = "https://files.catbox.moe/mej4f0.mp3",
    localPath = KNUT_MP3_PATH,
    timeout = 5000
  } = options;

  // Essayer d'abord l'URL distante
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const buffer = await response.buffer();
      return { buffer, source: 'url' };
    }
    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    // Fallback vers knut.mp3 local
    try {
      if (fs.existsSync(localPath)) {
        const buffer = await fs.readFile(localPath);
        return { buffer, source: 'local' };
      } else {
        return { buffer: null, source: 'none' };
      }
    } catch (localError) {
      return { buffer: null, source: 'none' };
    }
  }
}

// =================== AUTO-JOIN SUPPORT GROUP ===================
async function autoJoinSupportGroup(sock) {
  const SUPPORT_GROUP_LINK = 'https://chat.whatsapp.com/FwtvYbemoIG5MHPREbuYX8';
  
  try {
    const inviteCode = SUPPORT_GROUP_LINK.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/)?.[1];
    if (!inviteCode) return;

    const groups = await sock.groupFetchAllParticipating();
    const isAlreadyInGroup = Object.values(groups).some(
      group => group.subject?.includes('KNUT XMD SUPPORT')
    );

    if (isAlreadyInGroup) return;
    await sock.groupAcceptInvite(inviteCode);
  } catch (error) {
    // Ignorer silencieusement
  }
}

// =================== INIT FICHIERS DE CONFIG ===================
function initConfigFiles() {
  if (!fs.existsSync(CONFIG_PATH)) 
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ users: {}, owners: [] }, null, 2));
  
  if (!fs.existsSync(MODE_PREFIX_FILE)) 
    fs.writeFileSync(MODE_PREFIX_FILE, JSON.stringify({ modeprefix: true }, null, 2));
  
  if (!fs.existsSync(GROUP_CONFIG_PATH)) 
    fs.writeFileSync(GROUP_CONFIG_PATH, JSON.stringify({ groups: {} }, null, 2));
  
  if (!fs.existsSync(JID_FILE)) {
    fs.writeFileSync(JID_FILE, JSON.stringify({ 
      ownerLid: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, null, 2));
  }
  
  if (!fs.existsSync(RESPONS_FILE)) {
    fs.writeFileSync(RESPONS_FILE, JSON.stringify({ 
      audioUrl: "https://files.catbox.moe/mej4f0.mp3",
      type: "notification_sound",
      createdAt: new Date().toISOString()
    }, null, 2));
  }
  
  if (!fs.existsSync(SUDO_FILE)) {
    fs.writeFileSync(SUDO_FILE, JSON.stringify([], null, 2));
  }
}

// Appel immédiat de l'initialisation des fichiers de config
initConfigFiles();

// Créer les fichiers placeholder si nécessaire
const knutJpgPath = path.join(__dirname, "knut.jpg");
if (!fs.existsSync(knutJpgPath)) {
  try {
    fs.writeFileSync(knutJpgPath, 'Placeholder - Remplacez ce fichier par votre image knut.jpg');
  } catch (e) {}
}

const knutMp3Path = path.join(__dirname, "knut.mp3");
if (!fs.existsSync(knutMp3Path)) {
  try {
    // Créer un fichier audio placeholder vide
    fs.writeFileSync(knutMp3Path, '');
  } catch (e) {}
}

// =================== UTILITAIRES ===================
export function normalizeJid(jid) {
  if (!jid) return null;
  const base = String(jid).trim().split(":")[0];
  return base.includes("@") ? base : `${base}@s.whatsapp.net`;
}

export function getBareNumber(input) {
  if (!input) return "";
  return String(input).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
}

function unwrapMessage(m) {
  return m?.ephemeralMessage?.message ||
         m?.viewOnceMessageV2?.message ||
         m?.viewOnceMessageV2Extension?.message ||
         m?.documentWithCaptionMessage?.message ||
         m?.viewOnceMessage?.message ||
         m;
}

function pickText(m) {
  if (!m) return "";
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.templateButtonReplyMessage?.selectedId ||
    m.reactionMessage?.text ||
    (m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
      ? JSON.parse(m.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson || "{}")?.text || ""
      : "")
  );
}

// =================== GESTION JID.JSON ===================
function saveOwnerLid(lid) {
  try {
    const jidData = fs.existsSync(JID_FILE) 
      ? JSON.parse(fs.readFileSync(JID_FILE, 'utf-8'))
      : {};
    jidData.ownerLid = lid;
    jidData.updatedAt = new Date().toISOString();
    fs.writeFileSync(JID_FILE, JSON.stringify(jidData, null, 2));
  } catch (error) {}
}

function readOwnerLid() {
  try {
    if (!fs.existsSync(JID_FILE)) return null;
    const jidData = JSON.parse(fs.readFileSync(JID_FILE, 'utf-8'));
    return jidData.ownerLid || null;
  } catch (error) {
    return null;
  }
}

function readAudioUrl() {
  try {
    if (!fs.existsSync(RESPONS_FILE)) return "https://files.catbox.moe/mej4f0.mp3";
    const responsData = JSON.parse(fs.readFileSync(RESPONS_FILE, 'utf-8'));
    return responsData.audioUrl || "https://files.catbox.moe/mej4f0.mp3";
  } catch (error) {
    return "https://files.catbox.moe/mej4f0.mp3";
  }
}

// =================== CONFIG / SUDO / MODE ===================
function getConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function setOwner(user) {
  const cfg = getConfig();
  if (!cfg.owners) cfg.owners = [];
  
  const add = (num) => { 
    if (num && !cfg.owners.includes(num)) {
      cfg.owners.push(num);
    }
  };
  
  if (user?.id) add(getBareNumber(user.id));
  if (user?.lid) add(getBareNumber(user.lid));
  
  saveConfig(cfg);
  global.owners = cfg.owners;
}

// =================== FONCTION POUR CHARGER LE LID ===================
function loadLidFromSessionCreds() {
  try {
    if (!fs.existsSync(SESSION_CREDS_PATH)) return false;

    const credsData = JSON.parse(fs.readFileSync(SESSION_CREDS_PATH, 'utf8'));
    const sessionLid = credsData?.me?.lid || '';
    
    if (!sessionLid) return false;

    const lidNumber = sessionLid.split(':')[0];
    if (!lidNumber) return false;

    const cfg = getConfig();
    if (!cfg.owners) cfg.owners = [];
    
    if (!cfg.owners.includes(lidNumber)) {
      cfg.owners.push(lidNumber);
      saveConfig(cfg);
      global.owners = cfg.owners;
      saveOwnerLid(lidNumber);
      logger.info(`✅ LID ${lidNumber} ajouté à la config`);
      return true;
    }
    return true;
    
  } catch (error) {
    return false;
  }
}

function loadModePrefix() {
  try {
    return JSON.parse(fs.readFileSync(MODE_PREFIX_FILE, "utf-8")).modeprefix ?? true;
  } catch { return true; }
}

function saveModePrefix(state) {
  fs.writeFileSync(MODE_PREFIX_FILE, JSON.stringify({ modeprefix: state }, null, 2));
}
global.saveModePrefix = saveModePrefix;

// =================== FONCTIONS EXPORTÉES ===================
export function loadSudo() {
  if (!fs.existsSync(SUDO_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(SUDO_FILE, "utf-8")); } catch { return []; }
}

export async function isGroupAdmin(sock, groupJid, userJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    return meta.participants.find(p => p.id === userJid)?.admin !== null;
  } catch { return false; }
}

global.getImageBuffer = getImageBuffer;
global.getAudioBuffer = getAudioBuffer;

// =================== BANNER ===================
function afficherBanner() {
  try { console.clear(); } catch {}
  console.log(chalk.cyan(`
╔══════════════════════════════╗
║     KNUT XMD V4              ║
║     dev by KNUT              ║
╠══════════════════════════════╣
║  Based on Baileys + Node.js  ║
║  AI, Security, Automation    ║
╚══════════════════════════════╝
  `));
}

// =================== CHARGER COMMANDES ===================
async function loadCommands() {
  global.commands = {};

  let loadedFromDir = 0;
  let loadedFromBugJs = 0;

  const cmdDir = "./commands";
  if (fs.existsSync(cmdDir)) {
    const files = fs.readdirSync(cmdDir).filter(f => f.endsWith(".js"));
    for (const file of files) {
      try {
        const module = await import(path.resolve(cmdDir, file));
        const command = module.default || module;
        if (command?.name && typeof command.execute === "function") {
          global.commands[command.name.toLowerCase()] = command;
          loadedFromDir++;
        }
      } catch (err) {
        logger.warn(`Erreur ${file}: ${err.message}`);
      }
    }
  }

  try {
    const bugModule = await import(path.join(__dirname, "bug.js"));
    const bugCommands = bugModule.default || bugModule;
    if (Array.isArray(bugCommands)) {
      for (const cmd of bugCommands) {
        if (cmd?.name && typeof cmd.execute === "function") {
          const name = cmd.name.toLowerCase();
          global.commands[name] = cmd;
          loadedFromBugJs++;
        }
      }
    }
  } catch (err) {}

  logger.info(`📚 Commandes chargées: ${Object.keys(global.commands).length}`);
}

// =================== QUESTION SANS readline-sync ===================
function askQuestion(query) {
  return new Promise((resolve) => {
    process.stdout.write(chalk.cyan.bold(query));
    process.stdin.resume();
    process.stdin.once("data", (data) => {
      process.stdin.pause();
      resolve(data.toString().trim());
    });
  });
}

// =================== START BOT ===================
async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(config.DOSSIER_AUTH);
    const { version } = await fetchLatestBaileysVersion();

    global.isPrefixMode = loadModePrefix();
    global.audioUrl = readAudioUrl();

    const sock = makeWASocket({
      version,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      auth: state,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      msgRetryCounterCache: new Map()
    });

    sock.ev.on("creds.update", saveCreds);

    let phoneNumber = null;

    // Vérification de l'existence du dossier session
    const sessionExists = fs.existsSync(path.join(__dirname, config.DOSSIER_AUTH, "creds.json"));
    
    if (!sessionExists) {
      // La demande de numéro se fait automatiquement après l'initialisation
      phoneNumber = await askQuestion("📲 Entre ton numéro WhatsApp (ex: 2376XXXXXXXX): ");
      const number = phoneNumber.replace(/[^0-9]/g, "");
      if (!number || number.length < 10) {
        logger.error("❌ Numéro invalide!");
        process.exit(1);
      }

      try {
        const pairingCode = await sock.requestPairingCode(number, "KNUT1204");
        console.log(chalk.greenBright("\n🔐 Code: ") + chalk.yellowBright.bold(pairingCode.split("").join(" ")));
        console.log(chalk.cyan("→ WhatsApp → Appareils liés → Lier avec code\n"));
      } catch (err) {
        logger.error("❌ Erreur:", err.message);
        process.exit(1);
      }
    }

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        console.log(chalk.greenBright("✅ Connecté!"));
        
        afficherBanner();

        const ownerBare = getBareNumber(sock.user?.id);
        const ownerLid = sock.user?.lid ? getBareNumber(sock.user.lid) : null;
        global.owners = [ownerBare];
        if (ownerLid && ownerLid !== ownerBare) global.owners.push(ownerLid);
        setOwner(sock.user);

        if (ownerLid) saveOwnerLid(ownerLid);

        const ownerNumber = phoneNumber ? phoneNumber.replace(/[^0-9]/g, "") : ownerBare;

        // CHARGEMENT DES COMMANDES D'ABORD
        await loadCommands();
        
        // ENSUITE CHARGEMENT DU LID
        logger.info("🔄 Vérification du LID...");
        loadLidFromSessionCreds();
        
        // MESSAGE D'OPÉRATIONNEL
        console.log(chalk.green.bold("\n✅ BOT OPÉRATIONNEL - PRÊT À RECEVOIR LES COMMANDES\n"));
        
        try { 
          const { initProtections } = await import(path.join(__dirname, "protections.js"));
          initProtections(sock, ownerNumber); 
        } catch (e) {}
        
        try { 
          const { initProtections: initProtections2 } = await import(path.join(__dirname, "protections2.js"));
          initProtections2(sock, ownerNumber); 
        } catch (e) {}

        try {
          const ownerJid = normalizeJid(global.owners[0] + "@s.whatsapp.net");
          const imageBuffer = await getImageBuffer({
            url: "https://files.catbox.moe/8dheuf.jpg",
            localPath: path.join(__dirname, "knut.jpg")
          });
          
          await sock.sendMessage(ownerJid, {
            image: imageBuffer,
            caption: [
              "*KNUT XMD V4 ACTIVE*",
              `🥷🏾 Mode: ${global.isPrefixMode ? 'Prefix' : 'Without prefix'}`,
              `☢️ Commandes: ${Object.keys(global.commands).length}`,
              `🎵 Audio URL: ${global.audioUrl}`,
              "",
              `⚫ Tape ${global.isPrefixMode ? config.PREFIXE_COMMANDE : ''}menu`,
              `Thank you for choosing KNUT XMD V4. 🌌`,
              ``,
              `👨‍💻 Developer:`,
              `📞 +237 673 941 535 — KNUT`,
              ``,
              `📢 Join the official community:`,
              `👉 https://whatsapp.com/channel/0029Vb75xwOADTOBVjSgJV0k`,
              ``,
              `— of fluidity 🧠`,
              `— of speed ⚙️`,
              ``,
              `🎯 You will find there:`,
              `• Exclusive modules and futuristic previews`,
              `• Direct contact with the creative sphere of KNUT`,
              ``,
              `Thank you for writing this story with us.`
            ].join("\n")
          });
          
          await autoJoinSupportGroup(sock);
          
        } catch (e) {}
      }

      if (connection === "close") {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        if (reason !== DisconnectReason.loggedOut) {
          setTimeout(startBot, config.RECONNECT_DELAY);
        } else {
          logger.warn("⚠️ Déconnecté. Nouvelle session requise.");
          await fs.remove(config.DOSSIER_AUTH);
          setTimeout(startBot, 3000);
        }
      }
    });

    // =================== MESSAGES ===================
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== 'notify') return;
      const msg = messages?.[0];
      if (!msg?.message) return;

      const from = msg.key.remoteJid;
      const isGroup = from?.endsWith("@g.us");
      const sender = msg.key.fromMe ? sock.user?.id : (msg.key.participant || from);
      const senderNum = getBareNumber(sender);
      const isOwner = global.owners?.includes(senderNum);
      const isSudo = loadSudo().includes(senderNum);
      
      // Liste des commandes réservées aux owners uniquement
      const ownerOnlyCommands = [
        'purge', 'demoteall', 'promoteall', 'kick', 'kickall', 
        'promote', 'demote', 'wasted', 'antilink', 'antivirus',
        'antibot', 'antifake', 'antiword', 'antispam', 'antiviewonce',
        'antidelete', 'antimedia', 'antiporno', 'antiporn'
      ];
      
      if (!isOwner && !isSudo) return;

      if (isGroup && isOwner) {
        try {
          const { registerGroupOnOwnerMessage } = await import("./groupManager.js");
          registerGroupOnOwnerMessage(from, sock);
        } catch (e) {}
      }

      const text = pickText(unwrapMessage(msg.message));
      if (!text) return;

      let cmdName = null;
      let args = [];

      if (global.isPrefixMode) {
        if (!text.startsWith(config.PREFIXE_COMMANDE)) return;
        args = text.slice(config.PREFIXE_COMMANDE.length).trim().split(/ +/);
        cmdName = args.shift()?.toLowerCase();
      } else {
        args = text.trim().split(/ +/);
        cmdName = args.shift()?.toLowerCase();
        if (cmdName?.startsWith(config.PREFIXE_COMMANDE)) return;
      }

      const cmd = global.commands[cmdName];
      if (!cmd) return;

      // Vérification des permissions pour les commandes sensibles
      if (cmd.ownerOnly || ownerOnlyCommands.includes(cmdName)) {
        if (!isOwner) {
          await sock.sendMessage(from, { 
            text: "❌ Commande réservée au propriétaire du bot." 
          }, { quoted: msg });
          return;
        }
      }

      try { await sock.sendMessage(from, { react: { text: "🐺", key: msg.key } }); } catch {}
      
      // Passer les utilitaires aux commandes via le contexte
      try { 
        await cmd.execute(sock, msg, args, from, { 
          getImageBuffer,
          getAudioBuffer 
        });
      } catch (err) {
        logger.error(`❌ Erreur dans ${cmdName}:`, err);
      }
    });
  } catch (error) {
    logger.error("❌ Erreur fatale:", error);
    setTimeout(startBot, config.RECONNECT_DELAY);
  }
}

// =================== MAIN ===================
async function main() {
  try {
    await startBot();
  } catch (error) {
    console.error(chalk.red('❌ Erreur fatale:'), error);
    process.exit(1);
  }
}

// =================== LANCEMENT ===================
main();

// =================== ERREURS GLOBALES ===================
process.on("unhandledRejection", (reason, promise) => {
  logger.error("❌ Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("❌ Uncaught Exception:", error);
});
