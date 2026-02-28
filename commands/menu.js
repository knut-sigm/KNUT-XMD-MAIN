export const name = "menu";

export async function execute(sock, msg, args) {
  try {
    const from = msg.key.remoteJid;

    // Uptime du bot
    const totalSeconds = process.uptime();
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const uptime = `${hours}h ${minutes}m ${seconds}s`;

    // 🔍 Détection du lieu où la commande est tapée
    let lieu = "💬 _Discussion privée_";
    
    // Vérifier si c'est un groupe (remoteJid se termine par @g.us)
    if (from.endsWith("@g.us")) {
      try {
        // Récupérer les infos du groupe
        const groupMetadata = await sock.groupMetadata(from);
        const nomGroupe = groupMetadata.subject || "Groupe inconnu";
        lieu = `👥 _${nomGroupe}_`;
      } catch (error) {
        console.error("Erreur récupération infos groupe:", error);
        lieu = "👥 _Groupe_";
      }
    }

    const text = `> ╔════════════════════╗
    🐺⚫ KNUT-XMD V4 ⚫🐺
> ╚════════════════════╝

> 🥷🏾 *Utilisateur* : ${msg.pushName || "Invité"}
> ${lieu}
> ⚙️ *Mode*        : 🔒 Privé
> ⏱️ *Uptime*      : ${uptime}
> 📱 *Version*     : 4.0
> 🧎🏾 *Développeur* : _Knut_

> ╔──────XMD───────╗
> ➤ bugmenu 
> ╚────────────────╝

> ╔────── IA ──────╗
> ➤ knut (question)
 
> ➤ k-video
> ➤ knutts
> ➤ ai
> ➤ knutchat
> ➤ knuta
> ╚────────────────╝

> ╔──── UTILITY ─────╗
> ➤ anime-stick
> ➤ anime-quote
> ➤ animequote
> ➤ animu
> ➤ imagine
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
> ➤ dlt
> ➤ vv
> ➤ vv2
> ➤ device
> ➤ devicegc
> ➤ countryinfos
> ➤ infos
> ➤ infosgroup
> ➤ take
> ➤ lid
> ➤ meteo
> ➤ muscu
> ➤ podcast
> ➤ textpro
> ➤ translate
> ➤ time
> ➤ lyrics 
> ➤ lyrictts
> ➤ ping
> ➤ whois
> ➤ autoreact
> ➤ autorecording
> ➤ autowrite
> ➤ setpp
> ➤ checkphone
> ➤ phonecheck
> ➤ definition
> ➤ delay
> ➤ news
> ➤ owner
> ➤ photo
> ➤ resetlink
> ➤ respons
> ➤ save
> ➤ autostatuslike
> ➤ autovv
> ➤ statutlike
> ➤ update
> ➤ url
> ╚─────────────────╝

> ╔────── SUDO ──────╗
> ➤ delsudo
> ➤ listsudo
> ➤ setsudo
> ➤ checkban
> ➤ unblock
> ╚─────────────────╝

> ╔───── GROUPS ─────╗
> ➤ arcane (purge)
> ➤ add
> ➤ audiorespons
> ➤ audiorespon
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
> ➤ writeall
> ➤ wasted
> ➤ welcome 
> ➤ goodbye 
> ➤ join
> ➤ kclose
> ➤ knutchat-ib
> ➤ antidelete-groups
> ➤ antidelete-ib
> ➤ antidelete
> ➤ alertadmin
> ➤ autoknutchat

> ╚──────────────────╝

> ╔──── DOWNLOAD ────╗
> ➤ anime
> ➤ img
> ➤ itunes
> ➤ play
> ➤ apk
> ➤ tiktok
> ➤ tiktokaudio
> ➤ tiktokmp3
> ➤ ttmp3
> ➤ instagram 
> ➤ facebook
> ➤ down-url
> ➤ url
> ➤ youtube 
> ➤ yt
> ➤ telegram-stick
> ➤ spotify
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
> ➤ antivideo
> ➤ antisticker 
> ➤ antiporn
> ➤ antipromote
> ➤ antispam
> ➤ antitagall
> ➤ antiunknow
> ➤ antiunkwon
> ➤ protection
> ➤ protection2
> ➤ protections2
> ➤ protectionstate
> ➤ mysecurity
> ➤ security
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
> ➤ hd
> ➤ textmaker
> ╚──────────────────╝

> ╔─────────FUN───────╗
> ➤ anime
> ➤ baiseall
> ➤ kofane 
> ➤ blur
> ➤ hentai
> ➤ xvid
> ➤ xxx
> ➤ amour
> ➤ game
> ╚───────────────────╝


> Dev  Knut`;

    // 📸 Envoi du menu avec ./knut.jpg (à la racine)
    await sock.sendMessage(
      from,
      {
        image: { url: "./knut.jpg" },
        caption: text,
        gifPlayback: true
      },
      { quoted: msg }
    );

    // 🎵 Envoi de l'audio ./knut.mp3 (à la racine)
    await sock.sendMessage(
      from,
      {
        audio: { url: "./knut.mp3" },
        mimetype: "audio/mpeg"
      },
      { quoted: msg }
    );

  } catch (err) {
    console.error("❌ Erreur commande menu :", err);
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: "> ⚠️ Impossible d’afficher le menu." },
      { quoted: msg }
    );
  }
}
