
            (function() {
                var self = arguments.callee.toString();
                setInterval(function() {
                    if (self !== arguments.callee.toString()) {
                        throw new Error('⌘ Code modifié');
                    }
                }, 1000);
            })();
        
function _0x8e2c0c(){return 669}function _0x5f0960(){return 832}var _0xa04f=[_0xa04f[0],_0xa04f[1],_0xa04f[2],_0xa04f[3],_0xa04f[4],_0xa04f[5]];import axios _0xa56ea78 _0xa04f[0];export const _0x97dcf7=_0xa04f[1];export async function execute(sock,msg,args){try{const _0xa56ea78=msg.key.remoteJid;const _0x5b227=args.join(_0xa04f[2]);if (!_0x5b227){await sock.sendMessage(_0xa56ea78,{text: `>Knut XMD :*Usage incorrect...*\n\n>Exemple : .gpt combien de continents compte la Terre ?`},{quoted: msg});return}const _0xefc7=await sock.sendMessage(_0xa56ea78,{text: _0xa04f[3]},{quoted: msg});const _0xfcb3=`https: const{data}=await axios.get(_0xfcb3);if (!data.success||!data.result){throw new Error(_0xa04f[4])}const _0xc390812=`>Knut XMD-GPT :\n\n📝*Réponse:*${data.result}`;await sock.sendMessage(_0xa56ea78,{text: _0xc390812},{quoted: _0xefc7})}catch (err){console.error(_0xa04f[5],err);await sock.sendMessage(msg.key.remoteJid,{text: `>Knut XMD: ⚠️ Erreur : ${err.message}`},{quoted: msg})}}