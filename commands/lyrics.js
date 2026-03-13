import axios from "axios";

export const name = "lyrics";

export async function execute(sock, msg, args, from) {
  try {
    // === RÉCUPÉRER LE NOM DE LA CHANSON ===
    const songQuery = args.join(" ");
    
    if (!songQuery) {
      await sock.sendMessage(from, { 
        text: "❌ Utilisation: !lyrics <nom de la chanson>\n\nExemple: !lyrics imagine dragons believer" 
      }, { quoted: msg });
      return;
    }

    // === ENVOI D'UN MESSAGE DE CHARGEMENT ===
    const loadingMsg = await sock.sendMessage(from, { 
      text: `⏳ Recherche des paroles pour "${songQuery}"...` 
    }, { quoted: msg });

    // === APPEL À L'API LYRICS ===
    const apiUrl = `https://api.giftedtech.co.ke/api/search/lyrics?apikey=gifted&query=${encodeURIComponent(songQuery)}`;
    const response = await axios.get(apiUrl, { timeout: 15000 });

    // === VÉRIFICATION DE LA RÉPONSE ===
    if (!response.data || !response.data.status === 200) {
      throw new Error("Réponse invalide de l'API");
    }

    // === TRAITEMENT DES RÉSULTATS ===
    const result = response.data.result || {};
    
    if (!result || Object.keys(result).length === 0) {
      await sock.sendMessage(from, { 
        text: `❌ Aucune parole trouvée pour "${songQuery}".` 
      }, { quoted: msg });
      return;
    }

    // === CONSTRUCTION DU MESSAGE ===
    let messageText = `🎵 *RECHERCHE DE PAROLES* 🎵\n\n`;
    
    // Titre de la chanson
    if (result.title) {
      messageText += `*${result.title}*\n`;
    } else {
      messageText += `*${songQuery}*\n`;
    }
    
    // Artiste
    if (result.artist) {
      messageText += `👤 Artiste: ${result.artist}\n`;
    }
    
    // Album (si disponible)
    if (result.album) {
      messageText += `💿 Album: ${result.album}\n`;
    }
    
    // Année (si disponible)
    if (result.year) {
      messageText += `📅 Année: ${result.year}\n`;
    }
    
    messageText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Paroles
    if (result.lyrics) {
      // Limiter la longueur des paroles pour éviter un message trop long
      let lyrics = result.lyrics;
      if (lyrics.length > 3000) {
        lyrics = lyrics.substring(0, 3000) + "...\n\n[Paroles tronquées, trop longues]";
      }
      messageText += `${lyrics}\n`;
    } else {
      messageText += `_Aucune parole disponible_\n`;
    }
    
    messageText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    // Source (si disponible)
    if (result.source) {
      messageText += `\n📌 Source: ${result.source}`;
    }
    
    messageText += `\n> Knut XMD : Recherche de paroles`;

    // === ENVOYER LE RÉSULTAT ===
    await sock.sendMessage(from, { 
      text: messageText 
    }, { quoted: msg });

  } catch (error) {
    console.error("Erreur commande lyrics:", error);
    
    let errorMessage = "❌ Erreur lors de la recherche des paroles.\n";
    
    if (error.code === 'ECONNABORTED') {
      errorMessage += "⏱️ Délai d'attente dépassé.\n";
    } else if (error.response?.status === 403) {
      errorMessage += "🔒 Accès interdit à l'API. Vérifie la clé API.\n";
    } else if (error.response) {
      errorMessage += `Code: ${error.response.status}\n`;
    } else if (error.request) {
      errorMessage += "Le serveur ne répond pas.\n";
    } else {
      errorMessage += `${error.message}\n`;
    }
    
    errorMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    errorMessage += `> Knut XMD : Réessaie plus tard`;
    
    await sock.sendMessage(from, { 
      text: errorMessage 
    }, { quoted: msg });
  }
}