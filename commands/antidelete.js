export const name = "antidelete";
export const description = "Active ou désactive le système anti-suppression";
export const usage = "!antidelete [on/off/status]";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || from;
  
  try {
    // Vérifier si le système de protection est disponible
    if (!global.protectionSystem?.antiDelete) {
      await sock.sendMessage(from, { 
        text: "> Knut XMD : ❌ Système de protection non initialisé." 
      });
      return;
    }

    const antiDelete = global.protectionSystem.antiDelete;
    const currentStatus = antiDelete.getStats().isEnabled;

    // Pas d'argument -> afficher le statut actuel
    if (!args[0]) {
      const stats = antiDelete.getStats();
      const statusEmoji = currentStatus ? "✅" : "❌";
      const statusText = currentStatus ? "ACTIVÉ" : "DÉSACTIVÉ";
      
      const message = 
        `╭═══❰ *ANTI-DELETE* ❱═══╮\n` +
        `┃\n` +
        `┃ ${statusEmoji} *Statut :* ${statusText}\n` +
        `┃ 📊 *Messages stockés :* ${stats.totalMessages}/${stats.maxMessages}\n` +
        `┃    ├─ *Groupes :* ${stats.groupMessages || 0}\n` +
        `┃    └─ *IB :* ${stats.privateMessages || 0}\n` +
        `┃ 🖼️ *Médias :* ${stats.totalMedia}\n` +
        `┃ 🔄 *Rotations :* ${stats.totalRotations || 0}\n` +
        `┃\n` +
        `┃ *Utilisation :*\n` +
        `┃ !antidelete on  → Activer\n` +
        `┃ !antidelete off → Désactiver\n` +
        `┃ !antidelete status → Voir ce menu\n` +
        `┃ !antidelete stats → Statistiques détaillées\n` +
        `┃ !antidelete last → Voir les 5 derniers messages\n` +
        `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: message });
      return;
    }

    const command = args[0].toLowerCase();

    // Commande: on/off
    if (command === "on" || command === "off") {
      const newStatus = command === "on";
      
      // Vérifier si c'est déjà dans cet état
      if (currentStatus === newStatus) {
        await sock.sendMessage(from, { 
          text: `> Knut XMD : ⚠️ L'anti-delete est déjà ${currentStatus ? 'activé' : 'désactivé'}.` 
        });
        return;
      }

      // Activer/désactiver
      antiDelete.setStatus(newStatus);
      
      await sock.sendMessage(from, { 
        text: `> Knut XMD : ✅ Anti-delete ${newStatus ? 'activé' : 'désactivé'} avec succès !` 
      });
      
      // Log pour le terminal
      console.log(chalk.green(`[ANTIDELETE] ${newStatus ? 'Activé' : 'Désactivé'} par ${sender}`));
    }

    // Commande: status (affiche le statut détaillé)
    else if (command === "status") {
      const stats = antiDelete.getStats();
      const statusEmoji = currentStatus ? "✅" : "❌";
      
      const message = 
        `╭═══❰ *STATUT ANTI-DELETE* ❱═══╮\n` +
        `┃\n` +
        `┃ ${statusEmoji} *État :* ${currentStatus ? 'Actif' : 'Inactif'}\n` +
        `┃ 📊 *Messages :* ${stats.totalMessages}/${stats.maxMessages}\n` +
        `┃ 🖼️ *Médias :* ${stats.totalMedia}\n` +
        `┃ 🔄 *Rotation :* ${stats.rotationEnabled ? 'Oui' : 'Non'}\n` +
        `┃ 🔁 *Rotations faites :* ${stats.totalRotations || 0}\n` +
        `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: message });
    }

    // Commande: stats (statistiques complètes)
    else if (command === "stats") {
      const stats = antiDelete.getStats();
      
      const message = 
        `╭═══❰ *STATISTIQUES* ❱═══╮\n` +
        `┃\n` +
        `┃ 📈 *Messages total :* ${stats.totalMessages}\n` +
        `┃    ├─ *Groupes :* ${stats.groupMessages || 0}\n` +
        `┃    └─ *IB :* ${stats.privateMessages || 0}\n` +
        `┃ 🖼️ *Médias :* ${stats.totalMedia}\n` +
        `┃ 📦 *Capacité max :* ${stats.maxMessages}\n` +
        `┃ 📊 *Taux remplissage :* ${Math.round((stats.totalMessages/stats.maxMessages)*100)}%\n` +
        `┃ 🔁 *Rotations :* ${stats.totalRotations || 0}\n` +
        `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: message });
    }

    // Commande: last (affiche les derniers messages)
    else if (command === "last") {
      const limit = args[1] ? parseInt(args[1]) : 5;
      if (isNaN(limit) || limit < 1 || limit > 20) {
        await sock.sendMessage(from, { 
          text: "> Knut XMD : ⚠️ Utilisation : !antidelete last [nombre (1-20)]" 
        });
        return;
      }

      const lastMessages = antiDelete.viewLastMessages(limit);
      
      if (!lastMessages || lastMessages.length === 0) {
        await sock.sendMessage(from, { 
          text: "> Knut XMD : 📭 Aucun message stocké pour le moment." 
        });
        return;
      }

      let messageText = `╭═══❰ *DERNIERS MESSAGES* ❱═══╮\n┃\n`;
      
      lastMessages.forEach((msg, index) => {
        const type = msg.chatId?.endsWith('@g.us') ? '👥 Groupe' : '👤 IB';
        const date = msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit'
        }) : 'Date inconnue';
        
        messageText += 
          `┃ ${index + 1}. ${type}\n` +
          `┃    👤 ${msg.sender || 'Inconnu'}\n` +
          `┃    💬 ${msg.content?.substring(0, 30)}${msg.content?.length > 30 ? '...' : ''}\n` +
          `┃    🕐 ${date}\n` +
          `┃\n`;
      });
      
      messageText += `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: messageText });
    }

    // Commande: clear (vider la base)
    else if (command === "clear") {
      // Demander confirmation
      if (args[1] !== "--force") {
        await sock.sendMessage(from, { 
          text: "> Knut XMD : ⚠️ Êtes-vous sûr de vouloir vider la base anti-delete ?\nFaites `!antidelete clear --force` pour confirmer." 
        });
        return;
      }

      const cleared = antiDelete.clearDB();
      if (cleared) {
        await sock.sendMessage(from, { 
          text: "> Knut XMD : ✅ Base anti-delete vidée avec succès !" 
        });
        console.log(chalk.yellow(`[ANTIDELETE] Base vidée par ${sender}`));
      } else {
        await sock.sendMessage(from, { 
          text: "> Knut XMD : ❌ Erreur lors du vidage de la base." 
        });
      }
    }

    // Commande inconnue
    else {
      await sock.sendMessage(from, { 
        text: "> Knut XMD : ❌ Commande inconnue. Utilisez `!antidelete` pour voir l'aide." 
      });
    }

  } catch (error) {
    console.error("[ANTIDELETE] Erreur :", error);
    await sock.sendMessage(from, { 
      text: "> Knut XMD : ❌ Erreur lors de l'exécution de la commande." 
    });
  }
}