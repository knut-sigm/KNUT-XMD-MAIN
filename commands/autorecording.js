import fs from "fs";
import path from "path";
import { loadSudo } from "../index.js";

export const name = "autorecording";

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

    const autoRecording = global.protectionSystem;
    const stats = autoRecording.getStats();
    const currentStatus = stats.status.autorecording;

    // === ARGUMENT ===
    const arg = args[0]?.toLowerCase();

    if (!arg || !["on", "off", "status"].includes(arg)) {
      const status = currentStatus ? "✅ activé" : "🛑 désactivé";
      
      await sock.sendMessage(from, { 
        text: `> Knut XMD: Auto Recording (Simulation d'enregistrement)\n\n` +
              `État actuel : ${status}\n` +
              `Simulations : ${stats.totalSimulations}\n` +
              `Durée : 10 secondes\n` +
              `Cooldown : 30 secondes\n\n` +
              `Utilisation :\n` +
              `• autorecording on    → ✅ Activer\n` +
              `• autorecording off   → 🛑 Désactiver\n` +
              `• autorecording status → 📊 Statut`
      }, { quoted: msg });
      return;
    }

    // === STATUS DÉTAILLÉ ===
    if (arg === "status") {
      const statusEmoji = currentStatus ? "✅" : "🛑";
      
      await sock.sendMessage(from, { 
        text: `> Knut XMD: Auto Recording - Statut\n\n` +
              `État : ${statusEmoji} ${currentStatus ? "Activé" : "Désactivé"}\n` +
              `Simulations effectuées : ${stats.totalSimulations}\n` +
              `Durée : 10 secondes\n` +
              `Cooldown : 30 secondes`
      }, { quoted: msg });
      return;
    }

    // === ON / OFF ===
    const newState = arg === "on";
    
    if (arg === "on" && currentStatus) {
      await sock.sendMessage(from, { 
        text: "> Knut XMD : ⚠️ L'auto recording est déjà ✅ activé." 
      }, { quoted: msg });
      return;
    }
    
    if (arg === "off" && !currentStatus) {
      await sock.sendMessage(from, { 
        text: "> Knut XMD : ⚠️ L'auto recording est déjà 🛑 désactivé." 
      }, { quoted: msg });
      return;
    }

    if (arg === "on") {
      autoRecording.setAutoRecordingStatus(true);
    } else {
      autoRecording.setAutoRecordingStatus(false);
    }

    const statusEmoji = newState ? "✅" : "🛑";
    await sock.sendMessage(from, { 
      text: `> Knut XMD: Auto Recording ${statusEmoji} ${newState ? "activé" : "désactivé"}.`
    }, { quoted: msg });

  } catch (err) {
    console.error("Erreur autorecording:", err);
    await sock.sendMessage(from, { text: "> Knut XMD : Une erreur est survenue." }, { quoted: msg });
  }
}