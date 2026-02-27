import fs from "fs";
import path from "path";
import { getGroupProtections, setGroupProtection } from "../groupManager.js";
import { loadSudo } from "../index.js";

const GROUP_FILE = path.resolve("./group.json");

export const name = "antispam";

export async function execute(sock, msg, args, from) {
  try {
    // === GROUPE UNIQUEMENT ===
    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, { text: "> Knut XMD : Cette commande est réservée aux groupes." }, { quoted: msg });
      return;
    }

    // === RÉCUPÉRER L'EXPÉDITEUR ===
    const sender = msg.key.participant || from;
    const senderNum = sender.split("@")[0].replace(/[^0-9]/g, "");

    // === VÉRIFICATION DES DROITS (OWNER ET SUDO UNIQUEMENT) ===
    const owners = (global.owners || []).map(n => n.replace(/[^0-9]/g, ""));
    const sudoList = loadSudo().map(n => n.replace(/[^0-9]/g, ""));

    const isOwner = owners.includes(senderNum);
    const isSudo = sudoList.includes(senderNum);

    if (!isOwner && !isSudo) {
      await sock.sendMessage(from, { text: "> Knut XMD : Accès refusé. Owner ou sudo requis." }, { quoted: msg });
      return;
    }

    // === RÉCUPÉRER LES PROTECTIONS DU GROUPE ===
    const protections = getGroupProtections(from);
    const currentStatus = protections.antiSpam || false;

    // === ARGUMENT ===
    const arg = args[0]?.toLowerCase();

    if (!arg || !["on", "off", "status", "help"].includes(arg)) {
      const status = currentStatus ? "✅ activé" : "🛑 désactivé";
      
      await sock.sendMessage(from, { 
        text: `> Knut XMD: Anti-Spam\n\n` +
              `État actuel : ${status}\n\n` +
              `⚙️ *Paramètres :*\n` +
              `• Limite : 5 messages\n` +
              `• Fenêtre : 3 secondes\n` +
              `• Action : Kick automatique\n\n` +
              `Utilisation :\n` +
              `• antispam on    → ✅ Activer\n` +
              `• antispam off   → 🛑 Désactiver\n` +
              `• antispam status → 📊 Statut\n` +
              `• antispam help  → ℹ️ Aide`
      }, { quoted: msg });
      return;
    }

    // === HELP ===
    if (arg === "help") {
      await sock.sendMessage(from, { 
        text: `> Knut XMD: Aide Anti-Spam\n\n` +
              `📌 *Description :*\n` +
              `Détecte et kick automatiquement les utilisateurs qui spamment.\n\n` +
              `⚙️ *Paramètres :*\n` +
              `• Limite : 5 messages en 3 secondes\n` +
              `• Action : Kick immédiat\n` +
              `• Réaction : 😼\n\n` +
              `⚠️ *Nécessite que le bot soit admin*\n\n` +
              `📋 *Commandes :*\n` +
              `• on  → ✅ Activer la protection\n` +
              `• off → 🛑 Désactiver la protection\n` +
              `• status → 📊 Voir le statut actuel`
      }, { quoted: msg });
      return;
    }

    // === STATUS ===
    if (arg === "status") {
      const statusEmoji = currentStatus ? "✅" : "🛑";
      const statusText = currentStatus ? "Activé" : "Désactivé";
      
      await sock.sendMessage(from, { 
        text: `> Knut XMD: Anti-Spam - Statut\n\n` +
              `État : ${statusEmoji} ${statusText}\n` +
              `Groupe : ${from.split('@')[0]}\n` +
              `Limite : 5 messages/3s\n` +
              `Action : Kick automatique`
      }, { quoted: msg });
      return;
    }

    // === ON / OFF ===
    const newState = arg === "on";
    
    if (arg === "on" && currentStatus) {
      await sock.sendMessage(from, { 
        text: "> Knut XMD : ⚠️ L'anti-spam est déjà ✅ activé." 
      }, { quoted: msg });
      return;
    }
    
    if (arg === "off" && !currentStatus) {
      await sock.sendMessage(from, { 
        text: "> Knut XMD : ⚠️ L'anti-spam est déjà 🛑 désactivé." 
      }, { quoted: msg });
      return;
    }

    setGroupProtection(from, "antiSpam", newState);
    const statusEmoji = newState ? "✅" : "🛑";
    
    await sock.sendMessage(from, { 
      text: `> Knut XMD: Anti-Spam ${statusEmoji} ${newState ? "activé" : "désactivé"} dans ce groupe.`
    }, { quoted: msg });

  } catch (err) {
    console.error("Erreur antispam:", err);
    await sock.sendMessage(from, { text: "> Knut XMD : Une erreur est survenue." }, { quoted: msg });
  }
}