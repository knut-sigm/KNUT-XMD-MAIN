export const name = "writetoall";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  // Vérifier si c'est bien une commande avec message
  if (!args || args.length === 0) {
    await sock.sendMessage(from, { text: "> Knut MD : Usage : .writetoall <message>" });
    return;
  }

  const textToSend = args.join(" "); // message à envoyer

  try {
    // Vérifier si c'est un groupe
    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, { text: "Cette commande doit être utilisée dans un groupe !" });
      return;
    }

    // Récupérer les participants du groupe
    const groupMetadata = await sock.groupMetadata(from);
    const participants = groupMetadata.participants.map(p => p.id);
    
    // Filtrer pour exclure le bot lui-même (optionnel)
    const botJid = (sock?.user?.id || sock?.user?.jid || "").split?.(":")?.[0] || "";
    const filteredParticipants = participants.filter(id => id !== botJid);

    // Message de début
    await sock.sendMessage(from, { 
      text: `> ⏳ Knut MD : Début de l'envoi à ${filteredParticipants.length} membres...\n> Veuillez patienter.` 
    });

    // Configuration pour éviter le spam
    const BATCH_SIZE = 5; // Nombre de messages par lot
    const DELAY_BETWEEN_BATCHES = 2000; // Délai entre chaque lot (2 secondes)
    const DELAY_BETWEEN_MESSAGES = 500; // Délai entre chaque message dans un lot (0.5 seconde)

    let successCount = 0;
    let failCount = 0;
    let errors = [];

    // Envoyer par lots pour éviter le spam
    for (let i = 0; i < filteredParticipants.length; i += BATCH_SIZE) {
      const batch = filteredParticipants.slice(i, i + BATCH_SIZE);
      
      // Envoyer les messages du lot actuel avec un petit délai entre chacun
      for (const participant of batch) {
        try {
          await sock.sendMessage(participant, { text: textToSend });
          successCount++;
          
          // Petit délai entre chaque message du lot
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MESSAGES));
        } catch (participantError) {
          console.error(`Erreur envoi à ${participant}:`, participantError);
          failCount++;
          errors.push(`${participant.split('@')[0]}: ${participantError.message}`);
        }
      }

      // Attendre entre les lots (sauf pour le dernier lot)
      if (i + BATCH_SIZE < filteredParticipants.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        
        // Message de progression tous les 3 lots
        if ((i / BATCH_SIZE) % 3 === 0) {
          const progress = Math.min(((i + BATCH_SIZE) / filteredParticipants.length) * 100, 100).toFixed(1);
          await sock.sendMessage(from, { 
            text: `> 📊 Knut MD : Progression : ${progress}% (${Math.min(i + BATCH_SIZE, filteredParticipants.length)}/${filteredParticipants.length})` 
          });
        }
      }
    }

    // Rapport final avec style Knut
    const rapportText = `> ╔════════════════════╗
        ⚫ KNUT-XMD ⚫
> ╚════════════════════╝

📬 *RAPPORT D'ENVOI*
━━━━━━━━━━━━━━━━━━
✅ Réussis : ${successCount}
❌ Échecs : ${failCount}
👥 Total : ${filteredParticipants.length}

${errors.length > 0 ? `\n⚠️ *Erreurs rencontrées:*\n${errors.slice(0, 5).map(e => `> • ${e}`).join('\n')}${errors.length > 5 ? `\n> ... et ${errors.length - 5} autre(s)` : ''}` : ''}

> Dev by Knut`;

    await sock.sendMessage(from, { text: rapportText });

  } catch (e) {
    console.error("Erreur writetoall:", e);
    await sock.sendMessage(from, { text: "❌ Une erreur est survenue lors de l'envoi du message." });
  }
};