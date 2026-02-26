export const name = "antidelete-groups";
export const description = "Gère le système anti-suppression pour les groupes (2 modes)";
export const usage = "!antidelete-groups [on/off/mode/status/stats/last/clear]";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || from;
  const isGroup = from.endsWith("@g.us");
  
  try {
    // Vérifier si le système de protection est disponible
    if (!global.protectionSystem?.antiDeleteGroupes) {
      await sock.sendMessage(from, { 
        text: "> KNUT XMD : ❌ Système anti-delete groupes non initialisé." 
      });
      return;
    }

    const antiDelete = global.protectionSystem.antiDeleteGroupes;
    const currentStatus = antiDelete.getStats().isEnabled;
    const currentMode = antiDelete.getMode();

    // Afficher l'aide si pas d'arguments
    if (!args[0]) {
      const stats = antiDelete.getStats();
      const statusEmoji = currentStatus ? "✅" : "❌";
      const statusText = currentStatus ? "ACTIVÉ" : "DÉSACTIVÉ";
      const modeText = currentMode === "simple" ? "📢 Dans le groupe" : "👤 Dans l'IB du owner";
      
      const message = 
        `╭═══❰ *ANTI-DELETE GROUPS* ❱═══╮\n` +
        `┃\n` +
        `┃ ${statusEmoji} *Statut :* ${statusText}\n` +
        `┃ 🎯 *Mode actuel :* ${modeText}\n` +
        `┃ 📊 *Messages :* ${stats.totalMessages}/${stats.maxMessages}\n` +
        `┃ 🖼️ *Médias :* ${stats.totalMedia}\n` +
        `┃ 🔄 *Rotations :* ${stats.totalRotations || 0}\n` +
        `┃\n` +
        `┃ *Utilisation :*\n` +
        `┃ !antidelete-groups on        → Activer\n` +
        `┃ !antidelete-groups off       → Désactiver\n` +
        `┃ !antidelete-groups mode      → Voir/changer le mode\n` +
        `┃ !antidelete-groups status    → Statut détaillé\n` +
        `┃ !antidelete-groups stats     → Statistiques\n` +
        `┃ !antidelete-groups last [n]  → Voir les n derniers\n` +
        `┃ !antidelete-groups clear     → Vider la base\n` +
        `┃ !antidelete-groups help      → Aide détaillée\n` +
        `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: message });
      return;
    }

    const command = args[0].toLowerCase();

    // Aide détaillée
    if (command === "help") {
      const message = 
        `╭═══❰ *AIDE ANTI-DELETE GROUPS* ❱═══╮\n` +
        `┃\n` +
        `┃ 📌 *Description :*\n` +
        `┃ Protège les groupes contre la suppression\n` +
        `┃ de messages. 2 modes disponibles :\n` +
        `┃\n` +
        `┃ 🎯 *MODES :*\n` +
        `┃ • *simple*  → Restaure dans le groupe\n` +
        `┃ • *owner*   → Restaure dans l'IB du owner\n` +
        `┃\n` +
        `┃ 📋 *Commandes :*\n` +
        `┃ • on           → Active la protection\n` +
        `┃ • off          → Désactive la protection\n` +
        `┃ • mode         → Affiche le mode actuel\n` +
        `┃ • mode simple  → Passe en mode simple\n` +
        `┃ • mode owner   → Passe en mode owner\n` +
        `┃ • status       → Affiche le statut détaillé\n` +
        `┃ • stats        → Statistiques complètes\n` +
        `┃ • last [n]     → Derniers messages (défaut:5)\n` +
        `┃ • clear        → Vide toute la base\n` +
        `┃\n` +
        `┃ ⚠️ *Note :* Les médias sont uploadés sur\n` +
        `┃ catbox.moe pour conservation permanente\n` +
        `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: message });
      return;
    }

    // Activer
    if (command === "on") {
      if (currentStatus) {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : ⚠️ L'anti-delete groups est déjà activé." 
        });
        return;
      }

      antiDelete.setStatus(true);
      const modeText = currentMode === "simple" ? "dans le groupe" : "dans l'IB du owner";
      await sock.sendMessage(from, { 
        text: `> KNUT XMD : ✅ Anti-delete groups activé avec succès !\nMode actuel : ${modeText}\n\nUtilisez "!antidelete-groups mode" pour changer le mode.` 
      });
      
      console.log(chalk.green(`[ANTIDELETE GROUPS] Activé par ${sender}`));
      return;
    }

    // Désactiver
    if (command === "off") {
      if (!currentStatus) {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : ⚠️ L'anti-delete groups est déjà désactivé." 
        });
        return;
      }

      antiDelete.setStatus(false);
      await sock.sendMessage(from, { 
        text: "> KNUT XMD : ✅ Anti-delete groups désactivé avec succès." 
      });
      
      console.log(chalk.yellow(`[ANTIDELETE GROUPS] Désactivé par ${sender}`));
      return;
    }

    // Gestion du mode
    if (command === "mode") {
      // Afficher le mode actuel
      if (!args[1]) {
        const modeText = currentMode === "simple" ? "📢 Simple (dans le groupe)" : "👤 Owner (dans l'IB du owner)";
        const message = 
          `╭═══❰ *MODE ANTI-DELETE GROUPS* ❱═══╮\n` +
          `┃\n` +
          `┃ 🎯 *Mode actuel :* ${modeText}\n` +
          `┃\n` +
          `┃ *Changer de mode :*\n` +
          `┃ • !antidelete-groups mode simple → Mode groupe\n` +
          `┃ • !antidelete-groups mode owner  → Mode owner\n` +
          `┃\n` +
          `┃ *Mode simple :* restaure dans le groupe\n` +
          `┃ *Mode owner :* restaure dans l'IB du owner\n` +
          `╰═══════════════════╯`;
        
        await sock.sendMessage(from, { text: message });
        return;
      }

      // Changer le mode
      const newMode = args[1].toLowerCase();
      if (newMode === "simple" || newMode === "owner") {
        if (currentMode === newMode) {
          await sock.sendMessage(from, { 
            text: `> KNUT XMD : ⚠️ Le mode est déjà en "${newMode}".` 
          });
          return;
        }

        antiDelete.setMode(newMode);
        const modeText = newMode === "simple" ? "📢 Simple (dans le groupe)" : "👤 Owner (dans l'IB du owner)";
        await sock.sendMessage(from, { 
          text: `> KNUT XMD : ✅ Mode changé avec succès !\nNouveau mode : ${modeText}` 
        });
        
        console.log(chalk.cyan(`[ANTIDELETE GROUPS] Mode changé pour ${newMode} par ${sender}`));
      } else {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : ❌ Mode invalide. Utilisez 'simple' ou 'owner'." 
        });
      }
      return;
    }

    // Statut détaillé
    if (command === "status") {
      const stats = antiDelete.getStats();
      const statusEmoji = currentStatus ? "✅" : "❌";
      const pourcentage = Math.round((stats.totalMessages/stats.maxMessages)*100);
      const modeText = currentMode === "simple" ? "Simple (groupe)" : "Owner (IB owner)";
      
      let barre = "";
      for (let i = 0; i < 10; i++) {
        barre += i < Math.floor(pourcentage/10) ? "█" : "░";
      }
      
      const message = 
        `╭═══❰ *STATUT ANTI-DELETE GROUPS* ❱═══╮\n` +
        `┃\n` +
        `┃ ${statusEmoji} *État :* ${currentStatus ? 'Actif' : 'Inactif'}\n` +
        `┃ 🎯 *Mode :* ${modeText}\n` +
        `┃ 📊 *Messages :* ${stats.totalMessages}/${stats.maxMessages}\n` +
        `┃ 📈 *Utilisation :* ${barre} ${pourcentage}%\n` +
        `┃ 🖼️ *Médias :* ${stats.totalMedia}\n` +
        `┃ 🔄 *Rotation auto :* ${stats.rotationEnabled ? 'Oui' : 'Non'}\n` +
        `┃ 🔁 *Rotations :* ${stats.totalRotations || 0}\n` +
        `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: message });
      return;
    }

    // Statistiques
    if (command === "stats") {
      const stats = antiDelete.getStats();
      const pourcentage = Math.round((stats.totalMessages/stats.maxMessages)*100);
      const modeText = currentMode === "simple" ? "Simple (groupe)" : "Owner (IB owner)";
      
      const message = 
        `╭═══❰ *STATISTIQUES GROUPS* ❱═══╮\n` +
        `┃\n` +
        `┃ 🎯 *Mode :* ${modeText}\n` +
        `┃ 📈 *Total messages :* ${stats.totalMessages}\n` +
        `┃ 🖼️ *Total médias :* ${stats.totalMedia}\n` +
        `┃ 📦 *Capacité max :* ${stats.maxMessages}\n` +
        `┃ 📊 *Taux remplissage :* ${pourcentage}%\n` +
        `┃ 🔁 *Rotations :* ${stats.totalRotations || 0}\n` +
        `┃\n` +
        `┃ 💾 *Base de données :*\n` +
        `┃ 📁 antidelete-groupes.json\n` +
        `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: message });
      return;
    }

    // Voir les derniers messages
    if (command === "last") {
      const limit = args[1] ? parseInt(args[1]) : 5;
      if (isNaN(limit) || limit < 1 || limit > 20) {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : ⚠️ Utilisation : !antidelete-groups last [nombre (1-20)]" 
        });
        return;
      }

      const lastMessages = antiDelete.viewLastMessages(limit);
      
      if (!lastMessages || lastMessages.length === 0) {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : 📭 Aucun message de groupe stocké pour le moment." 
        });
        return;
      }

      let messageText = `╭═══❰ *DERNIERS MESSAGES GROUPS* ❱═══╮\n┃\n`;
      
      lastMessages.forEach((msg, index) => {
        const date = msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit'
        }) : 'Date inconnue';
        
        const mediaIcon = msg.mediaType ? {
          image: "🖼️",
          video: "🎥",
          audio: "🎵",
          document: "📄",
          sticker: "🏷️"
        }[msg.mediaType] || "📎" : "💬";
        
        messageText += 
          `┃ ${index + 1}. ${mediaIcon} *${msg.pushName || 'Inconnu'}*\n` +
          `┃    📝 ${msg.content?.substring(0, 30)}${msg.content?.length > 30 ? '...' : ''}\n` +
          `┃    🕐 ${date}\n` +
          `┃    👥 Groupe: ${msg.groupJid?.split('@')[0] || 'Inconnu'}\n` +
          `┃\n`;
      });
      
      messageText += `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: messageText });
      return;
    }

    // Vider la base
    if (command === "clear") {
      if (args[1] !== "--force") {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : ⚠️ *ATTENTION !*\nCette action supprimera TOUS les messages stockés.\n\nFaites `!antidelete-groups clear --force` pour confirmer." 
        });
        return;
      }

      const cleared = antiDelete.clearDB();
      if (cleared) {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : ✅ Base anti-delete groups vidée avec succès !" 
        });
        console.log(chalk.yellow(`[ANTIDELETE GROUPS] Base vidée par ${sender}`));
      } else {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : ❌ Erreur lors du vidage de la base." 
        });
      }
      return;
    }

    // Commande inconnue
    await sock.sendMessage(from, { 
      text: `> KNUT XMD : ❌ Commande inconnue. Utilisez \`!antidelete-groups help\` pour voir l'aide.` 
    });

  } catch (error) {
    console.error("[ANTIDELETE GROUPS] Erreur :", error);
    await sock.sendMessage(from, { 
      text: "> KNUT XMD : ❌ Erreur lors de l'exécution de la commande." 
    });
  }
}