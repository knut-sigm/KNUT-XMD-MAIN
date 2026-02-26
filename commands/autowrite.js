import fs from "fs";
import path from "path";
import { loadSudo } from "../index.js";

export const name = "autowrite";

export async function execute(sock, msg, args, from) {
  try {
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

    // === VÉRIFIER SYSTÈME DE PROTECTION ===
    if (!global.protectionSystem) {
      await sock.sendMessage(from, { text: "> Knut XMD : Système de protection non initialisé." }, { quoted: msg });
      return;
    }

    const autoWrite = global.protectionSystem;
    const stats = autoWrite.getStats();
    const currentStatus = stats.status.autowrite;

    // === ARGUMENT ===
    const arg = args[0]?.toLowerCase();

    if (!arg || !["on", "off", "status"].includes(arg)) {
      const status = currentStatus ? "✅ activé" : "🛑 désactivé";
      
      await sock.sendMessage(from, { 
        text: `> Knut XMD: Auto Write (Simulation de frappe)\n\n` +
              `État actuel : ${status}\n` +
              `Simulations : ${stats.totalSimulations}\n` +
              `Durée : 10 secondes\n` +
              `Cooldown : 30 secondes\n\n` +
              `Utilisation :\n` +
              `• autowrite on    → ✅ Activer\n` +
              `• autowrite off   → 🛑 Désactiver\n` +
              `• autowrite status → 📊 Statut`
      }, { quoted: msg });
      return;
    }

    // === STATUS DÉTAILLÉ ===
    if (arg === "status") {
      const statusEmoji = currentStatus ? "✅" : "🛑";
      
      await sock.sendMessage(from, { 
        text: `> Knut XMD: Auto Write - Statut\n\n` +
              `État : ${statusEmoji} ${currentStatus ? "Activé" : "Désactivé"}\n` +
              `Simulations effectuées : ${stats.totalSimulations}\n` +
              `Durée : 10 secondes\n` +
              `Cooldown : 30 secondes\n` +
              `Prochaine simulation possible après cooldown`
      }, { quoted: msg });
      return;
    }

    // === ON / OFF ===
    const newState = arg === "on";
    
    if (arg === "on" && currentStatus) {
      await sock.sendMessage(from, { 
        text: "> Knut XMD : ⚠️ L'auto write est déjà ✅ activé." 
      }, { quoted: msg });
      return;
    }
    
    if (arg === "off" && !currentStatus) {
      await sock.sendMessage(from, { 
        text: "> Knut XMD : ⚠️ L'auto write est déjà 🛑 désactivé." 
      }, { quoted: msg });
      return;
    }

    if (arg === "on") {
      autoWrite.setAutoWriteStatus(true);
    } else {
      autoWrite.setAutoWriteStatus(false);
    }

    const statusEmoji = newState ? "✅" : "🛑";
    await sock.sendMessage(from, { 
      text: `> Knut XMD: Auto Write ${statusEmoji} ${newState ? "activé" : "désactivé"}.`
    }, { quoted: msg });

  } catch (err) {
    console.error("Erreur autowrite:", err);
    await sock.sendMessage(from, { text: "> Knut XMD : Une erreur est survenue." }, { quoted: msg });
  }
}