export const name = "ping";

export async function execute(sock, msg, args) {
  try {
    const from = msg.key.remoteJid;

    // Début test de latence
    const start = Date.now();
    const sentMsg = await sock.sendMessage(from, { text: "> 𝐼'𝑚 𝑐𝑟𝑎𝑧𝑦....𝑚𝑎𝑦𝑏𝑒..." }, { quoted: msg });
    const latency = Date.now() - start;

    // Réponse stylisée avec même largeur de cadre que le menu
    const reply = `> Knut XMD: 🫩 Latence : ${latency} ms`;

    await sock.sendMessage(from, { text: reply }, { quoted: sentMsg });

  } catch (err) {
    console.error("❌ Erreur ping :", err);
    await sock.sendMessage(msg.key.remoteJid, {
      text: "> ⚠️ KNUT XMD: Impossible de calculer la vitesse."
    }, { quoted: msg });
  }
};