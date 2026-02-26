// groupManager.js
// Gestion des configurations par groupe (protections activées/désactivées)

import fs from "fs";
import path from "path";

// ────────────────────────────────────────────────
// CONFIGURATION & CHEMINS
// ────────────────────────────────────────────────
const GROUP_CONFIG_PATH = path.join(process.cwd(), "group.json");

let groupConfig = {
  groups: {}
};

// ────────────────────────────────────────────────
// CHARGEMENT / SAUVEGARDE
// ────────────────────────────────────────────────
const loadGroupConfig = () => {
  if (fs.existsSync(GROUP_CONFIG_PATH)) {
    try {
      const rawData = fs.readFileSync(GROUP_CONFIG_PATH, "utf-8");
      groupConfig = JSON.parse(rawData);

      // Sécurité : s'assurer que groups existe
      if (!groupConfig.groups || typeof groupConfig.groups !== "object") {
        groupConfig.groups = {};
      }

      console.log("[groupManager] Configuration chargée depuis group.json");
    } catch (err) {
      console.error("[groupManager] Erreur lecture group.json :", err.message);
      groupConfig = { groups: {} };
    }
  } else {
    console.log("[groupManager] group.json introuvable → création config vide");
    groupConfig = { groups: {} };
  }
};

const saveGroupConfig = () => {
  try {
    fs.writeFileSync(
      GROUP_CONFIG_PATH,
      JSON.stringify(groupConfig, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("[groupManager] Échec sauvegarde group.json :", err.message);
  }
};

// Charger au démarrage du module
loadGroupConfig();

// ────────────────────────────────────────────────
// FONCTIONS PUBLIQUES
// ────────────────────────────────────────────────
export const getGroupProtections = (groupJid) => {
  if (!groupJid || typeof groupJid !== "string") return {};
  return groupConfig.groups[groupJid] || {};
};

export const setGroupProtection = (groupJid, protection, value) => {
  if (!groupJid || typeof groupJid !== "string") return;

  if (!groupConfig.groups[groupJid]) {
    groupConfig.groups[groupJid] = {};
  }

  groupConfig.groups[groupJid][protection] = !!value; // force boolean
  saveGroupConfig();
};

export const toggleGroupProtection = (groupJid, protection) => {
  const current = getGroupProtections(groupJid)[protection] ?? false;
  setGroupProtection(groupJid, protection, !current);
  return !current;
};

// ────────────────────────────────────────────────
// ENREGISTREMENT AUTOMATIQUE D'UN GROUPE
// (lorsque l'owner envoie un message dans un nouveau groupe)
// ────────────────────────────────────────────────
export const registerGroupOnOwnerMessage = (groupJid) => {
  if (!groupJid || typeof groupJid !== "string") return;
  if (groupConfig.groups[groupJid]) return; // déjà enregistré

  // Protections par défaut — triées alphabétiquement
  const defaultProtections = {
    alertAdmin:          false,
    antiBot:             false,
    antiDemote:          false,
    antiLink:            false,
    antiMessage:         false,
    antipromote:         true,          // ← clé utilisée dans !antipromote et listener
    antiSpam:            false,
    antiSticker:         false,
    antiVideo:           false,
    antiVoice:           false,
    autoKnutChat:        false,
    autoReact:           false,
    autoVV:              false,          // ← uniformisé (au lieu de autoVV2)
    goodbye:             false,
    knuta:               false,
    statusLike:          false,
    warnAdmin:           false,
    welcome:             false
  };

  groupConfig.groups[groupJid] = defaultProtections;
  saveGroupConfig();

  console.log(`[groupManager] Nouveau groupe enregistré : ${groupJid.split("@")[0]}`);
};

// ────────────────────────────────────────────────
// EXPORT MODULE
// ────────────────────────────────────────────────
export default {
  getGroupProtections,
  setGroupProtection,
  toggleGroupProtection,
  registerGroupOnOwnerMessage
};