import { downloadContentFromMessage } from "@whiskeysockets/baileys";

export const name = "vv2";
export async function execute(sock, m, args) {
  try {
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "> Knut XMD :⚠️Répondez à une photo, vidéo ou audio vue unique." },
        { quoted: m }
      );
      return;
    }

    // Extraction du vrai message (vue unique)
    const innerMsg =
      quoted.viewOnceMessageV2?.message ||
      quoted.viewOnceMessageV2Extension?.message ||
      quoted;

    // Récupérer le numéro de l'owner depuis .env
    const ownerNumber = process.env.NUMBER;
    if (!ownerNumber) {
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "> Knut XMD :❌ Le numéro de l'owner n'est pas configuré dans .env" },
        { quoted: m }
      );
      return;
    }

    // Formater le numéro pour l'IB (ajouter @s.whatsapp.net)
    const ownerJid = ownerNumber.includes('@') 
      ? ownerNumber 
      : `${ownerNumber}@s.whatsapp.net`;

    // Variables pour stocker le buffer
    let buffer = Buffer.from([]);
    let mediaType = null;
    let caption = `> Knut XMD : Media récupéré depuis ${m.key.remoteJid}`;

    // --- Image vue unique ---
    if (innerMsg.imageMessage) {
      const stream = await downloadContentFromMessage(innerMsg.imageMessage, "image");
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      mediaType = "image";
    }
    // --- Vidéo vue unique ---
    else if (innerMsg.videoMessage) {
      const stream = await downloadContentFromMessage(innerMsg.videoMessage, "video");
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      mediaType = "video";
    }
    // --- Audio vue unique ---
    else if (innerMsg.audioMessage) {
      const stream = await downloadContentFromMessage(innerMsg.audioMessage, "audio");
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      mediaType = "audio";
    }
    else {
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "> Knut XMD: ❌ Pas une photo, vidéo ou audio vue unique." },
        { quoted: m }
      );
      return;
    }

    // Envoyer le média dans l'IB de l'owner
    try {
      if (mediaType === "image") {
        await sock.sendMessage(ownerJid, { 
          image: buffer, 
          caption: caption 
        });
      } else if (mediaType === "video") {
        await sock.sendMessage(ownerJid, { 
          video: buffer, 
          caption: caption 
        });
      } else if (mediaType === "audio") {
        await sock.sendMessage(ownerJid, { 
          audio: buffer, 
          mimetype: "audio/mp4", 
          ptt: innerMsg.audioMessage?.ptt || false 
        });
      }

      // Confirmer à l'utilisateur
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "> Knut XMD : ✅ Media récupéré et envoyé dans l'IB de l'owner." },
        { quoted: m }
      );
    } catch (sendError) {
      console.error("Erreur lors de l'envoi à l'owner:", sendError);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: `> Knut XMD : ❌ Erreur lors de l'envoi à l'owner: ${sendError.message}` },
        { quoted: m }
      );
    }

  } catch (e) {
    await sock.sendMessage(
      m.key.remoteJid,
      { text: "❌ Erreur vv : " + e.message },
      { quoted: m }
    );
  }
}