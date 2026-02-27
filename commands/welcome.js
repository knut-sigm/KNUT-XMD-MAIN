import fs from "fs";
import path from "path";
import { getGroupProtections, setGroupProtection } from "../groupManager.js";
import { loadSudo } from "../index.js";

const GROUP_FILE = path.resolve("./group.json");

export const name = "welcome";

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
    const currentStatus = protections.welcome || false;

    // === ARGUMENT ===
    const arg = args[0]?.toLowerCase();

    if (!arg || !["on", "off", "status", "help"].includes(arg)) {
      const status = currentStatus ? "✅ activé" : "🛑 désactivé";
      
      await sock.sendMessage(from, { 
        text: `> Knut XMD: Welcome\n\n` +
              `État actuel : ${status}\n\n` +
              `🎉 Envoie un message de bienvenue avec\n` +
              `une image aléatoire quand un nouveau\n` +
              `membre rejoint le groupe.\n\n` +
              `🖼️ *22 images aléatoires*\n\n` +
              `Utilisation :\n` +
              `• welcome on    → ✅ Activer\n` +
              `• welcome off   → 🛑 Désactiver\n` +
              `• welcome status → 📊 Statut\n` +
              `• welcome help  → ℹ️ Aide`
      }, { quoted: msg });
      return;
    }

    // === HELP ===
    if (arg === "help") {
      await sock.sendMessage(from, { 
        text: `> Knut XMD: Aide Welcome\n\n` +
              `📌 *Description :*\n` +
              `Envoie un message de bienvenue personnalisé\n` +
              `quand un nouveau membre rejoint le groupe.\n\n` +
              `🖼️ *Images :* 22 images aléatoires\n` +
              `📝 *Message :* Mention + numéro du membre\n\n` +
              `📋 *Commandes :*\n` +
              `• on  → ✅ Activer\n` +
              `• off → 🛑 Désactiver\n` +
              `• status → 📊 Voir le statut`
      }, { quoted: msg });
      return;
    }

    // === STATUS ===
    if (arg === "status") {
      const statusEmoji = currentStatus ? "✅" : "🛑";
      const statusText = currentStatus ? "Activé" : "Désactivé";
      
      await sock.sendMessage(from, { 
        text: `> Knut XMD: Welcome - Statut\n\n` +
              `État : ${statusEmoji} ${statusText}\n` +
              `Groupe : ${from.split('@')[0]}\n` +
              `Images : 22 images aléatoires`
      }, { quoted: msg });
      return;
    }

    // === ON / OFF ===
    const newState = arg === "on";
    
    if (arg === "on" && currentStatus) {
      await sock.sendMessage(from, { 
        text: "> Knut XMD : ⚠️ Le welcome est déjà ✅ activé." 
      }, { quoted: msg });
      return;
    }
    
    if (arg === "off" && !currentStatus) {
      await sock.sendMessage(from, { 
        text: "> Knut XMD : ⚠️ Le welcome est déjà 🛑 désactivé." 
      }, { quoted: msg });
      return;
    }

    setGroupProtection(from, "welcome", newState);
    const statusEmoji = newState ? "✅" : "🛑";
    
    await sock.sendMessage(from, { 
      text: `> Knut XMD: Welcome ${statusEmoji} ${newState ? "activé" : "désactivé"} dans ce groupe.`
    }, { quoted: msg });

  } catch (err) {
    console.error("Erreur welcome:", err);
    await sock.sendMessage(from, { text: "> Knut XMD : Une erreur est survenue." }, { quoted: msg });
  }
}