export const name = "antidelete-ib";
export const description = "Gère le système anti-suppression pour les conversations privées (IB)";
export const usage = "!antidelete-ib [on/off/status/stats/last/clear/contacts/search]";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || from;
  const isGroup = from.endsWith("@g.us");
  
  try {
    // Vérifier si le système de protection est disponible
    if (!global.protectionSystem?.antiDeleteIB) {
      await sock.sendMessage(from, { 
        text: "> KNUT XMD : ❌ Système anti-delete ib non initialisé." 
      });
      return;
    }

    const antiDelete = global.protectionSystem.antiDeleteIB;
    const currentStatus = antiDelete.getStats().isEnabled;
    const botNumber = antiDelete.getStats().botNumber;

    // Afficher l'aide si pas d'arguments
    if (!args[0]) {
      const stats = antiDelete.getStats();
      const statusEmoji = currentStatus ? "✅" : "❌";
      const statusText = currentStatus ? "ACTIVÉ" : "DÉSACTIVÉ";
      
      const message = 
        `╭═══❰ *ANTI-DELETE IB* ❱═══╮\n` +
        `┃\n` +
        `┃ ${statusEmoji} *Statut :* ${statusText}\n` +
        `┃ 👥 *Contacts :* ${stats.totalContacts}\n` +
        `┃ 📊 *Messages :* ${stats.totalMessages}\n` +
        `┃ 📱 *Bot IB :* ${botNumber || 'Non défini'}\n` +
        `┃\n` +
        `┃ *Utilisation :*\n` +
        `┃ !antidelete-ib on           → Activer\n` +
        `┃ !antidelete-ib off          → Désactiver\n` +
        `┃ !antidelete-ib status       → Statut détaillé\n` +
        `┃ !antidelete-ib stats        → Statistiques\n` +
        `┃ !antidelete-ib contacts     → Liste des contacts\n` +
        `┃ !antidelete-ib last [n]     → Voir les n derniers\n` +
        `┃ !antidelete-ib search [nom] → Rechercher par nom\n` +
        `┃ !antidelete-ib clear        → Vider la base\n` +
        `┃ !antidelete-ib help         → Aide détaillée\n` +
        `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: message });
      return;
    }

    const command = args[0].toLowerCase();

    // Aide détaillée
    if (command === "help") {
      const message = 
        `╭═══❰ *AIDE ANTI-DELETE IB* ❱═══╮\n` +
        `┃\n` +
        `┃ 📌 *Description :*\n` +
        `┃ Protège les conversations privées contre\n` +
        `┃ la suppression de messages. Les messages\n` +
        `┃ supprimés sont restaurés dans l'IB du bot.\n` +
        `┃ L'expéditeur affiché est le nom WhatsApp\n` +
        `┃ de la personne qui a supprimé le message.\n` +
        `┃\n` +
        `┃ 📋 *Commandes :*\n` +
        `┃ • on           → Active la protection\n` +
        `┃ • off          → Désactive la protection\n` +
        `┃ • status       → Affiche le statut détaillé\n` +
        `┃ • stats        → Statistiques complètes\n` +
        `┃ • contacts     → Liste des contacts suivis\n` +
        `┃ • last [n]     → Derniers messages (défaut:5)\n` +
        `┃ • search [nom] → Rechercher par nom\n` +
        `┃ • clear        → Vide toute la base\n` +
        `┃\n` +
        `┃ ⚠️ *Note :* Les messages restaurés sont\n` +
        `┃ envoyés dans l'IB du bot (${botNumber || 'Non défini'})\n` +
        `┃ avec le nom WhatsApp de l'expéditeur.\n` +
        `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: message });
      return;
    }

    // Activer
    if (command === "on") {
      if (!botNumber) {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : ❌ Impossible d'activer : NUMÉRO du bot non défini dans .env" 
        });
        return;
      }

      if (currentStatus) {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : ⚠️ L'anti-delete ib est déjà activé." 
        });
        return;
      }

      antiDelete.setStatus(true);
      await sock.sendMessage(from, { 
        text: `> KNUT XMD : ✅ Anti-delete ib activé avec succès !\nLes messages supprimés seront restaurés dans l'IB du bot (${botNumber})\nL'expéditeur affiché sera le nom WhatsApp de la personne.` 
      });
      
      console.log(chalk.cyan(`[ANTIDELETE IB] Activé par ${sender}`));
      return;
    }

    // Désactiver
    if (command === "off") {
      if (!currentStatus) {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : ⚠️ L'anti-delete ib est déjà désactivé." 
        });
        return;
      }

      antiDelete.setStatus(false);
      await sock.sendMessage(from, { 
        text: "> KNUT XMD : ✅ Anti-delete ib désactivé avec succès." 
      });
      
      console.log(chalk.yellow(`[ANTIDELETE IB] Désactivé par ${sender}`));
      return;
    }

    // Statut détaillé
    if (command === "status") {
      const stats = antiDelete.getStats();
      const statusEmoji = currentStatus ? "✅" : "❌";
      
      const message = 
        `╭═══❰ *STATUT ANTI-DELETE IB* ❱═══╮\n` +
        `┃\n` +
        `┃ ${statusEmoji} *État :* ${currentStatus ? 'Actif' : 'Inactif'}\n` +
        `┃ 📱 *Bot IB :* ${stats.botNumber || 'Non défini'}\n` +
        `┃ 👥 *Contacts suivis :* ${stats.totalContacts}\n` +
        `┃ 📊 *Messages stockés :* ${stats.totalMessages}\n` +
        `┃ 🖼️ *Médias stockés :* ${stats.totalMedia}\n` +
        `┃ ℹ️ *Info :* Les messages restaurés affichent\n` +
        `┃ le nom WhatsApp de l'expéditeur.\n` +
        `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: message });
      return;
    }

    // Statistiques
    if (command === "stats") {
      const stats = antiDelete.getStats();
      
      const message = 
        `╭═══❰ *STATISTIQUES IB* ❱═══╮\n` +
        `┃\n` +
        `┃ 👥 *Contacts :* ${stats.totalContacts}\n` +
        `┃ 📈 *Messages :* ${stats.totalMessages}\n` +
        `┃ 🖼️ *Médias :* ${stats.totalMedia}\n` +
        `┃ 📦 *Capacité max :* ${stats.maxMessages}\n` +
        `┃ 🔁 *Rotations :* ${stats.totalRotations || 0}\n` +
        `┃\n` +
        `┃ 💾 *Base de données :*\n` +
        `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: message });
      return;
    }

    // Liste des contacts
    if (command === "contacts") {
      const db = antiDelete.loadDB();
      const contacts = Object.keys(db.messages || {}).sort();
      
      if (contacts.length === 0) {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : 📭 Aucun contact enregistré pour le moment." 
        });
        return;
      }

      let messageText = `╭═══❰ *CONTACTS SUIVIS (IB)* ❱═══╮\n┃\n`;
      
      contacts.forEach((contact, index) => {
        const msgCount = db.messages[contact]?.length || 0;
        const lastMsg = db.messages[contact]?.slice(-1)[0];
        const lastDate = lastMsg?.timestamp ? 
          new Date(lastMsg.timestamp * 1000).toLocaleString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
          }) : 'Jamais';
        const lastPushName = lastMsg?.pushName || 'Inconnu';
        
        messageText += 
          `┃ ${index + 1}. 📱 ${contact.split('@')[0]}\n` +
          `┃    👤 ${lastPushName}\n` +
          `┃    💬 ${msgCount} messages\n` +
          `┃    🕐 Dernier: ${lastDate}\n` +
          `┃\n`;
      });
      
      messageText += `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: messageText });
      return;
    }

    // Recherche par nom
    if (command === "search") {
      if (!args[1]) {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : ⚠️ Utilisation : !antidelete-ib search [nom]" 
        });
        return;
      }

      const searchTerm = args.slice(1).join(" ").toLowerCase();
      const db = antiDelete.loadDB();
      const results = [];
      
      for (const [senderJid, messages] of Object.entries(db.messages || {})) {
        messages.forEach(msg => {
          if (msg.pushName && msg.pushName.toLowerCase().includes(searchTerm)) {
            results.push({
              ...msg,
              senderJid
            });
          }
        });
      }

      if (results.length === 0) {
        await sock.sendMessage(from, { 
          text: `> KNUT XMD : 📭 Aucun message trouvé pour "${args.slice(1).join(" ")}".` 
        });
        return;
      }

      let messageText = `╭═══❰ *RÉSULTATS RECHERCHE* ❱═══╮\n┃\n`;
      results.slice(0, 10).forEach((msg, index) => {
        const date = msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit'
        }) : 'Date inconnue';
        
        messageText += 
          `┃ ${index + 1}. 👤 ${msg.pushName}\n` +
          `┃    📝 ${msg.content?.substring(0, 30)}${msg.content?.length > 30 ? '...' : ''}\n` +
          `┃    🕐 ${date}\n` +
          `┃\n`;
      });
      
      if (results.length > 10) {
        messageText += `┃ ... et ${results.length - 10} autres résultats\n┃\n`;
      }
      
      messageText += `╰═══════════════════╯`;
      
      await sock.sendMessage(from, { text: messageText });
      return;
    }

    // Voir les derniers messages
    if (command === "last") {
      const limit = args[1] ? parseInt(args[1]) : 5;
      if (isNaN(limit) || limit < 1 || limit > 20) {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : ⚠️ Utilisation : !antidelete-ib last [nombre (1-20)]" 
        });
        return;
      }

      const lastMessages = antiDelete.viewLastMessages(limit);
      
      if (!lastMessages || lastMessages.length === 0) {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : 📭 Aucun message ib stocké pour le moment." 
        });
        return;
      }

      let messageText = `╭═══❰ *DERNIERS MESSAGES IB* ❱═══╮\n┃\n`;
      
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
          `┃    📱 ${msg.senderJid?.split('@')[0] || 'Inconnu'}\n` +
          `┃    📝 ${msg.content?.substring(0, 30)}${msg.content?.length > 30 ? '...' : ''}\n` +
          `┃    🕐 ${date}\n` +
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
          text: "> KNUT XMD : ⚠️ *ATTENTION !*\nCette action supprimera TOUS les messages ib stockés.\n\nFaites `!antidelete-ib clear --force` pour confirmer." 
        });
        return;
      }

      const cleared = antiDelete.clearDB();
      if (cleared) {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : ✅ Base anti-delete ib vidée avec succès !" 
        });
        console.log(chalk.yellow(`[ANTIDELETE IB] Base vidée par ${sender}`));
      } else {
        await sock.sendMessage(from, { 
          text: "> KNUT XMD : ❌ Erreur lors du vidage de la base." 
        });
      }
      return;
    }

    // Commande inconnue
    await sock.sendMessage(from, { 
      text: `> KNUT XMD : ❌ Commande inconnue. Utilisez \`!antidelete-ib help\` pour voir l'aide.` 
    });

  } catch (error) {
    console.error("[ANTIDELETE IB] Erreur :", error);
    await sock.sendMessage(from, { 
      text: "> KNUT XMD : ❌ Erreur lors de l'exécution de la commande." 
    });
  }
}