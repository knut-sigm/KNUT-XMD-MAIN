export const name = "menu";
import fs from "fs";
import path from "path";

export async function execute(sock, msg, args) {

  try {

    const from = msg.key.remoteJid;

    let thumbBuffer;
    try {
      thumbBuffer = fs.readFileSync(path.resolve("knut.jpg"));
    } catch (err) {
      console.error("❌ knut.jpg not found:", err.message);
      thumbBuffer = null;
    }

    // Vérifier si le fichier audio existe
    let audioPath = path.resolve("knut.mp3");
    if (!fs.existsSync(audioPath)) {
      console.error("❌ knut.mp3 not found at:", audioPath);
    }

    // Uptime du bot
    const totalSeconds = process.uptime();
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const uptime = `${hours}h ${minutes}m ${seconds}s`;

    // Déterminer si c'est un groupe ou un privé
    const isGroup = from.endsWith("@g.us");
    let chatMode = "";
    
    if (isGroup) {
      try {
        const groupMetadata = await sock.groupMetadata(from);
        const groupName = groupMetadata.subject || "Groupe inconnu";
        chatMode = `👥 *Groupe* : ${groupName}`;
      } catch (error) {
        console.error("❌ Erreur lors de la récupération du groupe:", error);
        chatMode = "👥 *Groupe* : (nom indisponible)";
      }
    } else {
      chatMode = "💬 *Mode* : Privé";
    }

const text = `> ╔════════════════════╗
    🐺⚫ KNUT-XMD V4 ⚫🐺
> ╚════════════════════╝

> 🥷🏾 *Utilisateur* : ${msg.pushName || "Invité"}
> ${chatMode}
> ⏱️ *Uptime*      : ${uptime}
> 📱 *Version*     : 4.0
> 🧎🏾 *Développeur* : _Knut_

> ╔──────XMD───────╗
> ➤ bugmenu 
> ╚────────────────╝

> ╔────── IA ──────╗
> ➤ knut (question)
> ➤ imagine 
> ➤ k-video
> ➤ knutts
> ➤ ai
> ➤ knutchat
> ➤ knuta
> ➤ deepseek
> ➤ gemini
> ➤ gpt
> ╚────────────────╝

> ╔──── UTILITY ─────╗
> ➤ anime-stick
> ➤ anime-quote
> ➤ artist
> ➤ calc
> ➤ car
> ➤ cours
> ➤ dico
> ➤ fact
> ➤ film
> ➤ horoscope
> ➤ prefix
> ➤ delete
> ➤ vv
> ➤ vv2
> ➤ device
> ➤ countryinfos
> ➤ infos
> ➤ take
> ➤ lid
> ➤ meteo
> ➤ muscu
> ➤ podcast
> ➤ textpro
> ➤ translate
> ➤ time
> ➤ lyrics 
> ➤ lyrics2
> ➤ ping
> ➤ whois
> ➤ autoreact
> ➤ setpp
> ➤ autowrite
> ➤ autorecording
> ➤ autovv
> ➤ checkban
> ➤ checkphone
> ➤ definition
> ➤ delay
> ➤ dlt
> ➤ hd
> ➤ idgo
> ➤ idgc
> ➤ infosport
> ➤ phonecheck
> ➤ photo
> ➤ arcane
> ➤ nba
> ➤ livescore
> ➤ xbet
> ╚─────────────────╝

> ╔────── SUDO ──────╗
> ➤ delsudo
> ➤ listsudo
> ➤ setsudo
> ➤ owner
> ╚─────────────────╝

> ╔───── GROUPS ─────╗
> ➤ add
> ➤ audiorespons
> ➤ demote @
> ➤ demoteall
> ➤ gclink
> ➤ infosgroups
> ➤ kick @
> ➤ kickall
> ➤ left
> ➤ listonline
> ➤ mute
> ➤ unmute
> ➤ manga
> ➤ mute-time
> ➤ promote @
> ➤ promoteall
> ➤ purge
> ➤ principal 
> ➤ setppg
> ➤ setrespons
> ➤ settimeg 
> ➤ soulmate
> ➤ tag
> ➤ tagadmin
> ➤ tagall
> ➤ writetoall
> ➤ wasted
> ➤ welcome 
> ➤ goodbye 
> ➤ writeall
> ➤ join
> ➤ kclose
> ➤ resetlink
> ➤ devicegc
> ╚──────────────────╝

> ╔──── DOWNLOAD ────╗
> ➤ anime
> ➤ img
> ➤ itunes
> ➤ play
> ➤ apk
> ➤ tiktok
> ➤ Instagram 
> ➤ down-url
> ➤ url
> ➤ youtube 
> ➤ yt
> ➤ telegram-stick
> ➤ facebook
> ➤ tiktok-search
> ➤ tiktokaudio
> ➤ tiktokmp3
> ➤ spotify
> ➤ ttmp3
> ╚──────────────────╝

> ╔───── SECURITY ─────╗
> ➤ block
> ➤ unblock
> ➤ autoblock
> ➤ antibot
> ➤ antilink
> ➤ antimessage 
> ➤ antivoice 
> ➤ antiaudio 
> ➤ antisticker 
> ➤ anticall
> ➤ antiporn
> ➤ antipromote
> ➤ antispam
> ➤ antitagall
> ➤ antiunknow
> ➤ antiunkwon
> ➤ antivideo
> ➤ antidelete
> ➤ antidelete-groups
> ➤ antidelete-ib
> ➤ protectionstate
> ➤ mysecurity
> ➤ security
> ➤ protection
> ➤ protection2
> ➤ protections2
> ➤ warnadmin
> ╚───────────────────╝

> ╔───── MEDIAS ─────╗
> ➤ photo
> ➤ save
> ➤ sticker
> ➤ static-stick
> ➤ logo
> ➤ tts
> ➤ tomp4
> ➤ textmaker
> ╚──────────────────╝

> ╔─────────FUN───────╗
> ➤ anime
> ➤ baiseall
> ➤ blur
> ➤ hentai
> ➤ xvid
> ➤ xxx
> ➤ amour
> ➤ animu
> ➤ knutchat-ib
> ➤ kofane
> ➤ statutlike
> ➤ autostatuslike
> ➤ update
> ╚───────────────────╝

> Dev  Knut`;

    // Envoi du menu avec image locale + voir la chaîne
    await sock.sendMessage(
      from,
      {
        image: fs.readFileSync(path.resolve("knut.jpg")),
        caption: text,
        gifPlayback: true,
        contextInfo: {
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363422093642600@newsletter",
            newsletterName: "Knut XMD"
          },
          externalAdReply: {
            title: "⚫ KNUT-XMD-V4",
            body: "Rejoignez nous ici !!!",
            mediaType: 1,
            thumbnail: thumbBuffer,
            renderLargerThumbnail: false,
            mediaUrl: "knut.jpg",
            sourceUrl: "knut.jpg",
            thumbnailUrl: "https://whatsapp.com/channel/0029Vb75xwOADTOBVjSgJV0k"
          }
        }
      },
      { quoted: msg }
    );

    // Envoi de l'audio local (sans contextInfo)
    await sock.sendMessage(
      from,
      {
        audio: fs.readFileSync(path.resolve("./knut.mp3")),
        mimetype: "audio/mpeg"
      },
      { quoted: msg }
    );

  } catch (err) {

    console.error("❌ Erreur commande menu :", err);

    await sock.sendMessage(
      msg.key.remoteJid,
      { text: "> ⚠️ Impossible d'afficher le menu." },
      { quoted: msg }
    );

  }

}
