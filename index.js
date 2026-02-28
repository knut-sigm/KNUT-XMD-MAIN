import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from "@whiskeysockets/baileys";
import chalk from "chalk";
import fs from "fs-extra"; // Changé de 'fs' à 'fs-extra'
import path from "path";
import pino from "pino";
import { Boom } from "@hapi/boom";
import dotenv from "dotenv";
import { initProtections } from "./protections.js";
import { initProtections as initProtections2 } from "./protections2.js";
import { registerGroupOnOwnerMessage } from "./groupManager.js";
import bugCommands from "./bug.js";

// Import avec fallback pour Node 18
let translate;
try {
  translate = (await import("@vitalets/google-translate-api")).default;
} catch {
  translate = null;
}

dotenv.config();

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

// Polyfill pour fetch si nécessaire (Node 18+ l'a natif)
if (!globalThis.fetch) {
  globalThis.fetch = (await import('node-fetch')).default;
}

// Utilisation de fs-extra pour une création plus robuste des fichiers
async function initializeFiles() {
  try {
    // Vérification/création des fichiers avec fs-extra
    if (!await fs.pathExists(CONFIG_PATH)) {
      await fs.writeJson(CONFIG_PATH, { users: {}, owners: [] }, { spaces: 2 });
    }
    
    if (!await fs.pathExists(MODE_PREFIX_FILE)) {
      await fs.writeJson(MODE_PREFIX_FILE, { modeprefix: true }, { spaces: 2 });
    }
    
    if (!await fs.pathExists(GROUP_CONFIG_PATH)) {
      await fs.writeJson(GROUP_CONFIG_PATH, { groups: {} }, { spaces: 2 });
    }

    if (!await fs.pathExists(JID_FILE)) {
      await fs.writeJson(JID_FILE, { 
        ownerLid: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { spaces: 2 });
    }

    if (!await fs.pathExists(RESPONS_FILE)) {
      await fs.writeJson(RESPONS_FILE, { 
        audioUrl: "https://files.catbox.moe/mej4f0.mp3",
        type: "notification_sound",
        createdAt: new Date().toISOString()
      }, { spaces: 2 });
      logger.info("respons.json créé avec l'URL audio par défaut");
    }

    // Création du dossier session s'il n'existe pas
    await fs.ensureDir(config.DOSSIER_AUTH);
    
    logger.info("✅ Tous les fichiers de configuration sont initialisés");
  } catch (error) {
    logger.error(`❌ Erreur lors de l'initialisation des fichiers: ${error.message}`);
  }
}

// Appel de l'initialisation
await initializeFiles();

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
const saveOwnerLid = async (lid) => {
  try {
    const jidData = await fs.pathExists(JID_FILE) 
      ? await fs.readJson(JID_FILE)
      : {};
    jidData.ownerLid = lid;
    jidData.updatedAt = new Date().toISOString();
    await fs.writeJson(JID_FILE, jidData, { spaces: 2 });
    logger.info(`Lid de l'owner sauvegardé dans jid.json: ${lid}`);
  } catch (error) {
    logger.error(`Erreur lors de la sauvegarde du lid: ${error.message}`);
  }
};

const readOwnerLid = async () => {
  try {
    if (!await fs.pathExists(JID_FILE)) return null;
    const jidData = await fs.readJson(JID_FILE);
    return jidData.ownerLid || null;
  } catch (error) {
    logger.error(`Erreur lors de la lecture du lid: ${error.message}`);
    return null;
  }
};

const readAudioUrl = async () => {
  try {
    if (!await fs.pathExists(RESPONS_FILE)) return "https://files.catbox.moe/mej4f0.mp3";
    const responsData = await fs.readJson(RESPONS_FILE);
    return responsData.audioUrl || "https://files.catbox.moe/mej4f0.mp3";
  } catch (error) {
    logger.error(`Erreur lors de la lecture de l'URL audio: ${error.message}`);
    return "https://files.catbox.moe/mej4f0.mp3";
  }
};

// =================== CONFIG / SUDO / MODE ===================
const getConfig = async () => await fs.readJson(CONFIG_PATH);
const saveConfig = async (cfg) => await fs.writeJson(CONFIG_PATH, cfg, { spaces: 2 });

const setOwner = async (user) => {
  const cfg = await getConfig();
  if (!cfg.owners) cfg.owners = [];
  
  const add = (num) => { 
    if (num && !cfg.owners.includes(num)) {
      cfg.owners.push(num);
      logger.info(`Owner ajouté: ${num}`);
    }
  };
  
  if (user?.id) add(getBareNumber(user.id));
  if (user?.lid) add(getBareNumber(user.lid));
  
  await saveConfig(cfg);
  global.owners = cfg.owners;
  logger.info(`Owners: ${cfg.owners.join(", ")}`);
};

// =================== CHARGEMENT LID DEPUIS SESSION ===================
const loadLidFromSessionCreds = async () => {
  logger.info("🔍 Vérification du fichier session/creds.json pour le LID...");
  
  try {
    if (!await fs.pathExists(SESSION_CREDS_PATH)) {
      logger.warn(`⚠️ Fichier non trouvé: ${SESSION_CREDS_PATH}`);
      return false;
    }

    const credsData = await fs.readJson(SESSION_CREDS_PATH);
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

    const cfg = await getConfig();
    if (!cfg.owners) cfg.owners = [];
    
    if (!cfg.owners.includes(lidNumber)) {
      cfg.owners.push(lidNumber);
      await saveConfig(cfg);
      global.owners = cfg.owners;
      
      logger.info(`✅ LID ${lidNumber} ajouté à config.json depuis session/creds.json`);
      await saveOwnerLid(lidNumber);
      
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

const loadModePrefix = async () => {
  try {
    const data = await fs.readJson(MODE_PREFIX_FILE);
    return data.modeprefix ?? true;
  } catch { 
    return true; 
  }
};

const saveModePrefix = async (state) => {
  await fs.writeJson(MODE_PREFIX_FILE, { modeprefix: state }, { spaces: 2 });
  logger.info(`Mode prefix: ${state}`);
};
global.saveModePrefix = saveModePrefix;

export const loadSudo = async () => {
  if (!await fs.pathExists(SUDO_FILE)) return [];
  try { 
    return await fs.readJson(SUDO_FILE); 
  } catch { 
    return []; 
  }
};

export const isGroupAdmin = async (sock, groupJid, userJid) => {
  try {
    const meta = await sock.groupMetadata(groupJid);
    return meta.participants.find(p => p.id === userJid)?.admin !== null;
  } catch { 
    return false; 
  }
};

// =================== BANNER ===================
const afficherBanner = () => {
  try { console.clear(); } catch {}
  console.log(chalk.cyan(`
╔══════════════════════════════╗
║   KNUT MDX SYSTEM ONLINE     ║
╠══════════════════════════════╣
║  Compatible Node.js 18+      ║
║  AI, Security, Automation    ║
║  avec fs-extra ✨            ║
╚══════════════════════════════╝
  `));
};

// =================== CHARGER COMMANDES ===================
async function loadCommands() {
  global.commands = {};

  let loadedFromDir = 0;
  let loadedFromBugJs = 0;

  const cmdDir = "./commands";
  if (await fs.pathExists(cmdDir)) {
    const files = await fs.readdir(cmdDir);
    const jsFiles = files.filter(f => f.endsWith(".js"));
    
    for (const file of jsFiles) {
      try {
        const module = await import(path.resolve(cmdDir, file));
        const command = module.default || module;
        if (command?.name && typeof command.execute === "function") {
          global.commands[command.name.toLowerCase()] = command;
          loadedFromDir++;
        }
      } catch (err) {
        logger.warn(`Erreur chargement commands/${file} : ${err.message}`);
      }
    }
  }

  if (Array.isArray(bugCommands)) {
    for (const cmd of bugCommands) {
      if (cmd?.name && typeof cmd.execute === "function") {
        const name = cmd.name.toLowerCase();
        if (global.commands[name]) {
          logger.warn(`Conflit : ${name} (bug.js) ← écrasé`);
        }
        global.commands[name] = cmd;
        loadedFromBugJs++;
      }
    }
  }

  logger.info(
    `📚 Commandes chargées : ${loadedFromDir} (commands) + ` +
    `${loadedFromBugJs} (bug.js) = ` +
    `${Object.keys(global.commands).length} au total`
  );
  
  logger.info("🔄 Chargement du LID depuis session/creds.json...");
  await loadLidFromSessionCreds();
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
    // Vérification version Node.js
    const nodeVersion = process.versions.node;
    logger.info(`📦 Node.js version: ${nodeVersion}`);
    
    if (parseInt(nodeVersion.split('.')[0]) < 18) {
      logger.error("❌ Node.js 18+ est requis!");
      process.exit(1);
    }

    // Charger les configurations avec fs-extra
    global.isPrefixMode = await loadModePrefix();
    global.audioUrl = await readAudioUrl();
    logger.info(`🎵 URL audio chargée: ${global.audioUrl}`);

    const { state, saveCreds } = await useMultiFileAuthState(config.DOSSIER_AUTH);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      auth: state,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      msgRetryCounterCache: new Map(),
      fetchAgent: undefined
    });

    sock.ev.on("creds.update", saveCreds);

    let phoneNumber = null;

    if (!state.creds.registered) {
      console.log(chalk.yellow.bold("\n📲 Enter your WhatsApp number (ex: 2376XXXXXXXX)"));
      phoneNumber = await askQuestion("Enter your WhatsApp number (ex: 2376XXXXXXXX): ");
      const number = phoneNumber.replace(/[^0-9]/g, "");
      if (!number || number.length < 10) {
        logger.error("❌ Invalid number!");
        process.exit(1);
      }

      try {
        const pairingCode = await sock.requestPairingCode(number, "KNUT1204");
        logger.info("✅ Pairing code generated: " + pairingCode);
        console.log(chalk.greenBright("\n🔐 Pairing code: ") + chalk.yellowBright.bold(pairingCode.split("").join(" ")));
        console.log(chalk.cyan("→ WhatsApp → Linked devices → Link with code\n"));
      } catch (err) {
        logger.error("❌ Pairing code failure:", err.message);
        process.exit(1);
      }
    } else {
      console.log(chalk.green.bold("✅ Existing session found. Connecting..."));
    }

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        console.log(chalk.greenBright("✅ Connected to WhatsApp successfully!"));
        
        afficherBanner();

        const ownerBare = getBareNumber(sock.user?.id);
        const ownerLid = sock.user?.lid ? getBareNumber(sock.user.lid) : null;
        global.owners = [ownerBare];
        if (ownerLid && ownerLid !== ownerBare) global.owners.push(ownerLid);
        await setOwner(sock.user);

        if (ownerLid) {
          await saveOwnerLid(ownerLid);
        } else {
          logger.warn("⚠️ Aucun lid trouvé pour l'owner");
        }

        const ownerNumber = phoneNumber ? phoneNumber.replace(/[^0-9]/g, "") : ownerBare;

        await loadCommands();
        
        try { 
          initProtections(sock, ownerNumber); 
          logger.info("✅ Protections.js loaded successfully");
        } catch (e) { 
          logger.error("❌ Error loading protections.js:", e); 
        }
        
        try { 
          initProtections2(sock, ownerNumber); 
          logger.info("✅ Protections2.js loaded successfully");
        } catch (e) { 
          logger.error("❌ Error loading protections2.js:", e); 
        }

        try {
          const sudoList = await loadSudo();
          const ownerJid = normalizeJid(global.owners[0] + "@s.whatsapp.net");
          
          await sock.sendMessage(ownerJid, {
            image: { url: "https://files.catbox.moe/8dheuf.jpg" },
            caption: [
              "*KNUT MDX ACTIVE*",
              `🥷🏾 Mode: ${global.isPrefixMode ? 'Prefix' : 'Without prefix'}`,
              `☢️ Commands: ${Object.keys(global.commands).length}`,
              `🎵 Audio URL: ${global.audioUrl}`,
              `📦 Node.js: ${process.version}`,
              `👥 Sudo: ${sudoList.length}`,
              `✨ fs-extra: activé`,
              "",
              `⚫ Type ${global.isPrefixMode ? config.PREFIXE_COMMANDE : ''}menu`,
              `Thank you for choosing KNUT XMD. 🌌`,
              ``,
              `👨‍💻 Developer Contact:`,
              `📞 +237 673 941 535 — Dev Knut`,
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
        } catch (e) {
          logger.warn("⚠️ Owner message failed:", e.message);
        }
      }

      if (connection === "close") {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        console.log(chalk.red("❌ Connection closed. Reason:"), reason);
        if (reason !== DisconnectReason.loggedOut) {
          setTimeout(startBot, config.RECONNECT_DELAY);
        } else {
          logger.warn("⚠️ Disconnected (logged out). New session required.");
          await fs.remove(config.DOSSIER_AUTH);
          setTimeout(startBot, 3000);
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== 'notify') return;
      const msg = messages?.[0];
      if (!msg?.message) return;

      const from = msg.key.remoteJid;
      const isGroup = from?.endsWith("@g.us");
      const sender = msg.key.fromMe ? sock.user?.id : (msg.key.participant || from);
      const senderNum = getBareNumber(sender);
      const sudoList = await loadSudo();
      const isOwner = global.owners?.includes(senderNum);
      const isSudo = sudoList.includes(senderNum);
      
      if (!isOwner && !isSudo) return;

      if (isGroup && isOwner) registerGroupOnOwnerMessage(from, sock);

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

      if (cmd.ownerOnly && !isOwner) {
        await sock.sendMessage(from, { text: "❌ Owner only." });
        return;
      }

      try { await sock.sendMessage(from, { react: { text: "🐺", key: msg.key } }); } catch {}
      try { 
        await cmd.execute(sock, msg, args, from);
      } catch (err) {
        logger.error(`❌ Error in ${cmdName}:`, err);
      }
    });
  } catch (error) {
    logger.error("❌ Fatal error in startBot:", error);
    setTimeout(startBot, config.RECONNECT_DELAY);
  }
}

// =================== DÉMARRAGE ===================
startBot().catch(error => {
  logger.error("❌ Failed to start bot:", error);
  setTimeout(startBot, config.RECONNECT_DELAY);
});

// =================== ERREURS GLOBALES ===================
process.on("unhandledRejection", (reason, promise) => {
  logger.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("❌ Uncaught Exception:", error);
});
