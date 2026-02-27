import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from "@whiskeysockets/baileys";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import pino from "pino";
import { Boom } from "@hapi/boom";
import dotenv from "dotenv";

dotenv.config();

// =================== GESTION DE LA MÉMOIRE ===================
const MEMORY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MEMORY_LIMIT = 2500; // 2.5 GB

function checkMemoryUsage() {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);
  
  console.log(chalk.gray(`📊 Mémoire: RSS=${rssMB}MB | Heap=${heapUsedMB}/${heapTotalMB}MB`));
  
  if (heapUsedMB > MEMORY_LIMIT) {
    console.log(chalk.red(`🚨 Mémoire critique: ${heapUsedMB}MB > ${MEMORY_LIMIT}MB`));
    console.log(chalk.yellow("🔄 Redémarrage forcé dans 3 secondes..."));
    
    setTimeout(() => {
      process.exit(1);
    }, 3000);
  }
}

setInterval(checkMemoryUsage, MEMORY_CHECK_INTERVAL);

// Nettoyage du cache toutes les heures
setInterval(() => {
  try {
    for (const key in require.cache) {
      if (key.includes('/commands/')) {
        delete require.cache[key];
      }
    }
    
    if (global.gc) {
      global.gc();
      console.log(chalk.green("🧹 Garbage collector exécuté"));
    }
  } catch (e) {}
}, 60 * 60 * 1000);

// =================== CONFIGURATION ===================
const config = {
  PREFIXE_COMMANDE: process.env.PREFIXE || "!",
  DOSSIER_AUTH: process.env.DOSSIER_AUTH || "session",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  RECONNECT_DELAY: parseInt(process.env.RECONNECT_DELAY) || 5000
};

// =================== LOGGER ===================
const logger = pino({
  level: config.LOG_LEVEL,
  transport: {
    target: "pino-pretty",
    options: { colorize: true, ignore: "pid,hostname", translateTime: "HH:MM:ss" }
  },
  base: null
});

// =================== FICHIERS ===================
const SUDO_FILE = "./sudo.json";
const CONFIG_PATH = "./config.json";
const MODE_PREFIX_FILE = "./modeprefix.json";
const GROUP_CONFIG_PATH = "./group.json";
const JID_FILE = "./jid.json";
const RESPONS_FILE = "./respons.json";
const SESSION_CREDS_PATH = path.join(process.cwd(), "session", "creds.json");

// Init files
if (!fs.existsSync(CONFIG_PATH)) fs.writeFileSync(CONFIG_PATH, JSON.stringify({ users: {}, owners: [] }, null, 2));
if (!fs.existsSync(MODE_PREFIX_FILE)) fs.writeFileSync(MODE_PREFIX_FILE, JSON.stringify({ modeprefix: true }, null, 2));
if (!fs.existsSync(GROUP_CONFIG_PATH)) fs.writeFileSync(GROUP_CONFIG_PATH, JSON.stringify({ groups: {} }, null, 2));

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
  logger.info("respons.json créé avec l'URL audio par défaut");
}

// =================== UTILITAIRES ===================
const normalizeJid = (jid) => {
  if (!jid) return null;
  const base = String(jid).trim().split(":")[0];
  return base.includes("@") ? base : `${base}@s.whatsapp.net`;
};

const getBareNumber = (input) => {
  if (!input) return "";
  return String(input).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
};

const unwrapMessage = (m) => {
  return m?.ephemeralMessage?.message ||
         m?.viewOnceMessageV2?.message ||
         m?.viewOnceMessageV2Extension?.message ||
         m?.documentWithCaptionMessage?.message ||
         m?.viewOnceMessage?.message ||
         m;
};

const pickText = (m) => {
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
};

// =================== GESTION JID.JSON ===================
const saveOwnerLid = (lid) => {
  try {
    const jidData = fs.existsSync(JID_FILE) 
      ? JSON.parse(fs.readFileSync(JID_FILE, 'utf-8'))
      : {};
    jidData.ownerLid = lid;
    jidData.updatedAt = new Date().toISOString();
    fs.writeFileSync(JID_FILE, JSON.stringify(jidData, null, 2));
    logger.info(`Lid de l'owner sauvegardé dans jid.json: ${lid}`);
  } catch (error) {
    logger.error(`Erreur lors de la sauvegarde du lid: ${error.message}`);
  }
};

const readOwnerLid = () => {
  try {
    if (!fs.existsSync(JID_FILE)) return null;
    const jidData = JSON.parse(fs.readFileSync(JID_FILE, 'utf-8'));
    return jidData.ownerLid || null;
  } catch (error) {
    logger.error(`Erreur lors de la lecture du lid: ${error.message}`);
    return null;
  }
};

const readAudioUrl = () => {
  try {
    if (!fs.existsSync(RESPONS_FILE)) return "https://files.catbox.moe/mej4f0.mp3";
    const responsData = JSON.parse(fs.readFileSync(RESPONS_FILE, 'utf-8'));
    return responsData.audioUrl || "https://files.catbox.moe/mej4f0.mp3";
  } catch (error) {
    logger.error(`Erreur lors de la lecture de l'URL audio: ${error.message}`);
    return "https://files.catbox.moe/mej4f0.mp3";
  }
};

// =================== CONFIG / SUDO / MODE ===================
const getConfig = () => JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
const saveConfig = (cfg) => fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));

const setOwner = (user) => {
  const cfg = getConfig();
  if (!cfg.owners) cfg.owners = [];
  
  const add = (num) => { 
    if (num && !cfg.owners.includes(num)) {
      cfg.owners.push(num);
      logger.info(`Owner ajouté: ${num}`);
    }
  };
  
  if (user?.id) add(getBareNumber(user.id));
  if (user?.lid) add(getBareNumber(user.lid));
  
  saveConfig(cfg);
  global.owners = cfg.owners;
  logger.info(`Owners: ${cfg.owners.join(", ")}`);
};

// =================== CHARGEMENT LID ===================
const loadLidFromSessionCreds = () => {
  logger.info("🔍 Vérification du fichier session/creds.json pour le LID...");
  
  try {
    if (!fs.existsSync(SESSION_CREDS_PATH)) {
      logger.warn(`⚠️ Fichier non trouvé: ${SESSION_CREDS_PATH}`);
      return false;
    }

    const credsData = JSON.parse(fs.readFileSync(SESSION_CREDS_PATH, 'utf8'));
    const sessionLid = credsData?.me?.lid || '';
    
    if (!sessionLid) {
      logger.warn("⚠️ Aucun LID trouvé dans creds.json");
      return false;
    }

    const lidNumber = sessionLid.split(':')[0];
    
    if (!lidNumber) {
      logger.warn("⚠️ Format de LID invalide dans creds.json");
      return false;
    }

    const cfg = getConfig();
    if (!cfg.owners) cfg.owners = [];
    
    if (!cfg.owners.includes(lidNumber)) {
      cfg.owners.push(lidNumber);
      saveConfig(cfg);
      global.owners = cfg.owners;
      logger.info(`✅ LID ${lidNumber} ajouté à config.json depuis session/creds.json`);
      saveOwnerLid(lidNumber);
      return true;
    } else {
      logger.info(`ℹ️ LID ${lidNumber} déjà présent dans config.json`);
      return true;
    }
    
  } catch (error) {
    logger.error(`❌ Erreur lors du chargement du LID: ${error.message}`);
    return false;
  }
};

const loadModePrefix = () => {
  try {
    return JSON.parse(fs.readFileSync(MODE_PREFIX_FILE, "utf-8")).modeprefix ?? true;
  } catch { return true; }
};

const saveModePrefix = (state) => {
  fs.writeFileSync(MODE_PREFIX_FILE, JSON.stringify({ modeprefix: state }, null, 2));
  logger.info(`Mode prefix: ${state}`);
};
global.saveModePrefix = saveModePrefix;

export const loadSudo = () => {
  if (!fs.existsSync(SUDO_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(SUDO_FILE, "utf-8")); } catch { return []; }
};

export const isGroupAdmin = async (sock, groupJid, userJid) => {
  try {
    const meta = await sock.groupMetadata(groupJid);
    return meta.participants.find(p => p.id === userJid)?.admin !== null;
  } catch { return false; }
};

// =================== BANNER ===================
const afficherBanner = () => {
  try { console.clear(); } catch {}
  console.log(chalk.cyan(`
╔══════════════════════════════╗
║   KNUT MDX SYSTEM ONLINE     ║
╠══════════════════════════════╣
║  Based on Baileys + Node.js  ║
║  AI, Security, Automation    ║
╚══════════════════════════════╝
  `));
};

// =================== CHARGER COMMANDES ===================
async function loadCommands() {
  global.commands = {};

  let loadedCount = 0;

  // Chargement du dossier /commands
  const cmdDir = "./commands";
  if (fs.existsSync(cmdDir)) {
    const files = fs.readdirSync(cmdDir).filter(f => f.endsWith(".js"));
    
    for (const file of files) {
      try {
        const module = await import(path.resolve(cmdDir, file));
        
        // Format: export const name = "commande"; export async function execute() {}
        if (module.name && typeof module.execute === "function") {
          global.commands[module.name.toLowerCase()] = {
            name: module.name,
            description: module.description || "Aucune description",
            usage: module.usage || "Pas d'usage spécifié",
            execute: module.execute
          };
          loadedCount++;
          logger.info(`✅ Commande chargée: ${module.name}`);
        }
        
        // Format: export default { name, description, usage, execute }
        else if (module.default?.name && typeof module.default?.execute === "function") {
          const cmd = module.default;
          global.commands[cmd.name.toLowerCase()] = {
            name: cmd.name,
            description: cmd.description || "Aucune description",
            usage: cmd.usage || "Pas d'usage spécifié",
            execute: cmd.execute
          };
          loadedCount++;
          logger.info(`✅ Commande chargée: ${cmd.name}`);
        }
        
      } catch (err) {
        logger.warn(`⚠️ Erreur chargement ${file}: ${err.message}`);
      }
    }
  }

  logger.info(`📊 Commandes chargées: ${loadedCount}`);
  
  if (loadedCount > 0) {
    const cmdList = Object.keys(global.commands).join(', ');
    logger.info(`📝 Commandes: ${cmdList}`);
  } else {
    logger.warn(`⚠️ Aucune commande trouvée dans le dossier /commands`);
  }
  
  logger.info("🔄 Chargement du LID...");
  loadLidFromSessionCreds();
}

// =================== QUESTION ===================
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
    logger.info(`🎵 URL audio: ${global.audioUrl}`);

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

    if (!state.creds.registered) {
      console.log(chalk.yellow.bold("\n📲 Entrez votre numéro WhatsApp (ex: 2376XXXXXXXX)"));
      phoneNumber = await askQuestion("Numéro WhatsApp: ");
      const number = phoneNumber.replace(/[^0-9]/g, "");
      if (!number || number.length < 10) {
        logger.error("❌ Numéro invalide!");
        process.exit(1);
      }

      try {
        const pairingCode = await sock.requestPairingCode(number);
        console.log(chalk.greenBright("\n🔐 Code d'appairage: ") + chalk.yellowBright.bold(pairingCode));
        console.log(chalk.cyan("→ WhatsApp → Appareils liés → Lier avec le code\n"));
      } catch (err) {
        logger.error("❌ Erreur d'appairage:", err.message);
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

        await loadCommands();
        
        try {
          const { initProtections } = await import("./protections.js");
          initProtections(sock);
        } catch (e) {}
        
        try {
          const ownerJid = normalizeJid(global.owners[0] + "@s.whatsapp.net");
          await sock.sendMessage(ownerJid, {
            text: `✅ Bot démarré!\n📊 Commandes: ${Object.keys(global.commands).length}\n🥷 Mode: ${global.isPrefixMode ? 'Préfixe' : 'Sans préfixe'}`
          });
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
      
      if (!isOwner && !isSudo) return;

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

      try { 
        await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }); 
      } catch {}
      
      try { 
        await cmd.execute(sock, msg, args);
      } catch (err) {
        logger.error(`❌ Erreur dans ${cmdName}:`, err);
        await sock.sendMessage(from, { 
          text: `❌ Erreur: ${err.message}` 
        }, { quoted: msg });
      }
    });
  } catch (error) {
    logger.error("❌ Erreur fatale:", error);
    setTimeout(startBot, config.RECONNECT_DELAY);
  }
}

// =================== DÉMARRAGE ===================
startBot();

process.on("unhandledRejection", (reason) => {
  logger.error("❌ Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("❌ Uncaught Exception:", error);
});
