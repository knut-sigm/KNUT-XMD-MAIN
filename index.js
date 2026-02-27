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
import { initProtections } from "./protections.js";
import { initProtections as initProtections2 } from "./protections2.js";
import { registerGroupOnOwnerMessage } from "./groupManager.js";
import bugCommands from "./bug.js";

dotenv.config();

// =================== GESTION DE LA MÉMOIRE ===================
const MEMORY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MEMORY_LIMIT = 2500; // 2.5 GB
let lastMemoryCheck = Date.now();

function checkMemoryUsage() {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);
  
  console.log(chalk.gray(`📊 Mémoire: RSS=${rssMB}MB | Heap=${heapUsedMB}/${heapTotalMB}MB`));
  
  // Si la mémoire dépasse la limite, on force un redémarrage propre
  if (heapUsedMB > MEMORY_LIMIT) {
    console.log(chalk.red(`🚨 Mémoire critique: ${heapUsedMB}MB > ${MEMORY_LIMIT}MB`));
    console.log(chalk.yellow("🔄 Redémarrage forcé dans 3 secondes..."));
    
    setTimeout(() => {
      process.exit(1); // Le processus parent (pm2/ecosystem) redémarrera
    }, 3000);
  }
}

// Vérification périodique de la mémoire
setInterval(checkMemoryUsage, MEMORY_CHECK_INTERVAL);

// Nettoyage du cache toutes les heures
setInterval(() => {
  try {
    // Nettoie le cache des modules requis
    for (const key in require.cache) {
      if (key.includes('/commands/') || key.includes('/bug.js')) {
        delete require.cache[key];
      }
    }
    
    // Force le garbage collector (si exposé avec --expose-gc)
    if (global.gc) {
      global.gc();
      console.log(chalk.green("🧹 Garbage collector exécuté"));
    }
  } catch (e) {}
}, 60 * 60 * 1000); // 1 heure

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

// =================== CHARGER COMMANDES AVEC SUPPORT OBFUSCATION ===================
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
        let commandLoaded = false;
        
        // Cas 1: Export standard { name, execute }
        if (module.name && typeof module.execute === "function") {
          global.commands[module.name.toLowerCase()] = module;
          loadedFromDir++;
          commandLoaded = true;
          logger.info(`✅ Commande chargée (standard): ${module.name}`);
        }
        
        // Cas 2: Export default avec name et execute
        else if (module.default?.name && typeof module.default?.execute === "function") {
          global.commands[module.default.name.toLowerCase()] = module.default;
          loadedFromDir++;
          commandLoaded = true;
          logger.info(`✅ Commande chargée (default): ${module.default.name}`);
        }
        
        // Cas 3: Obfuscation - analyser l'objet exporté
        else {
          // Parcourir toutes les propriétés exportées
          for (const key of Object.keys(module)) {
            const potentialCmd = module[key];
            
            // Si c'est une fonction (cas où la commande est directement une fonction)
            if (typeof potentialCmd === 'function') {
              const cmdName = file.replace('.js', '').toLowerCase();
              global.commands[cmdName] = { 
                name: cmdName, 
                execute: potentialCmd 
              };
              loadedFromDir++;
              commandLoaded = true;
              logger.info(`✅ Commande chargée (fonction directe): ${cmdName}`);
              break;
            }
            
            // Si c'est un objet
            if (potentialCmd && typeof potentialCmd === 'object') {
              let cmdName = null;
              let cmdExecute = null;
              
              for (const prop of Object.keys(potentialCmd)) {
                const value = potentialCmd[prop];
                
                if (typeof value === 'string' && value.length < 30 && !value.includes(' ') && !value.includes('http')) {
                  cmdName = value.toLowerCase();
                }
                
                if (typeof value === 'function') {
                  cmdExecute = value;
                }
              }
              
              if (cmdExecute && !cmdName) {
                cmdName = file.replace('.js', '').toLowerCase();
              }
              
              if (cmdName && cmdExecute) {
                global.commands[cmdName] = { 
                  name: cmdName, 
                  execute: cmdExecute 
                };
                loadedFromDir++;
                commandLoaded = true;
                logger.info(`✅ Commande chargée (obfusquée): ${cmdName}`);
                break;
              }
            }
          }
        }
        
        if (!commandLoaded && module.default && typeof module.default === 'function') {
          const cmdName = file.replace('.js', '').toLowerCase();
          global.commands[cmdName] = { 
            name: cmdName, 
            execute: module.default 
          };
          loadedFromDir++;
          logger.info(`✅ Commande chargée (default function): ${cmdName}`);
        }
        
      } catch (err) {
        logger.warn(`⚠️ Erreur chargement ${file}: ${err.message}`);
      }
    }
  }

  // Chargement bug.js
  if (Array.isArray(bugCommands)) {
    for (const cmd of bugCommands) {
      if (cmd?.name && typeof cmd.execute === "function") {
        const name = cmd.name.toLowerCase();
        if (global.commands[name]) {
          logger.warn(`⚠️ Conflit: ${name} (bug.js) écrase commands/${name}`);
        }
        global.commands[name] = cmd;
        loadedFromBugJs++;
        logger.info(`✅ Commande bug.js: ${cmd.name}`);
      }
    }
  }

  logger.info(
    `📊 Commandes chargées : ${loadedFromDir} (commands) + ` +
    `${loadedFromBugJs} (bug.js) = ` +
    `${Object.keys(global.commands).length} au total`
  );
  
  if (Object.keys(global.commands).length > 0) {
    logger.info(`📝 Commandes disponibles: ${Object.keys(global.commands).join(', ')}`);
  } else {
    logger.warn(`⚠️ Aucune commande chargée!`);
  }
  
  logger.info("🔄 Chargement du LID depuis session/creds.json...");
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
    logger.info(`🎵 URL audio chargée: ${global.audioUrl}`);

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
        setOwner(sock.user);

        if (ownerLid) {
          saveOwnerLid(ownerLid);
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
          const ownerJid = normalizeJid(global.owners[0] + "@s.whatsapp.net");
          await sock.sendMessage(ownerJid, {
            image: { url: "https://files.catbox.moe/8dheuf.jpg" },
            caption: [
              "*KNUT MDX ACTIVE*",
              `🥷🏾 Mode: ${global.isPrefixMode ? 'Prefix' : 'Without prefix'}`,
              `☢️ Commands: ${Object.keys(global.commands).length}`,
              `🎵 Audio URL: ${global.audioUrl}`,
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
      if (!cmd) {
        logger.debug(`Commande non trouvée: ${cmdName}`);
        logger.debug(`Commandes disponibles: ${Object.keys(global.commands).join(', ')}`);
        return;
      }

      if (cmd.ownerOnly && !isOwner) {
        await sock.sendMessage(from, { text: "❌ Owner only." });
        return;
      }

      try { await sock.sendMessage(from, { react: { text: "🐺", key: msg.key } }); } catch {}
      try { 
        if (typeof cmd.execute === 'function') {
          await cmd.execute(sock, msg, args, from);
        } else {
          logger.error(`❌ ${cmdName}.execute n'est pas une fonction`);
        }
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
