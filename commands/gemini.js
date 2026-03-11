
            (function() {
                var self = arguments.callee.toString();
                setInterval(function() {
                    if (self !== arguments.callee.toString()) {
                        throw new Error('⌘ Code modifié');
                    }
                }, 1000);
            })();
        
function _0xfa781f9(){return 458}function _0x0e5c33(){return 470}var _0xa29989=[_0xa29989[0],_0xa29989[1],_0xa29989[2],_0xa29989[3],_0xa29989[4],_0xa29989[5],_0xa29989[6],_0xa29989[7],_0xa29989[8],_0xa29989[9],_0xa29989[10],_0xa29989[11],_0xa29989[12]];import axios from _0xa29989[0];export const _0xc0520e6=_0xa29989[1];export async function execute(sock,msg,args,from){try{const _0xf55b54=args.join(_0xa29989[2]).trim();if (!_0xf55b54){return await sock.sendMessage(from,{text: _0xa29989[3]},{quoted: msg})}const _0xc202=await sock.sendMessage(from,{text: _0xa29989[4]},{quoted: msg});const _0xc0ab=`https: const _0x05fde=await axios.get(_0xc0ab,{timeout: 30000});if (!_0x05fde.data||!_0x05fde.data.success){throw new Error(_0xa29989[5])}const _0x2247=_0x05fde.data.result||_0x05fde.data.message||_0xa29989[6];const _0x8db7903=`>*Gemini AI-Knut XMD*\n\n${_0x2247}`;await sock.sendMessage(from,{text: _0x8db7903},{quoted: msg})}catch (error){console.error(_0xa29989[7],error);let _0xa4f1e=_0xa29989[8];if (error.code===_0xa29989[9]){_0xa4f1e+=_0xa29989[10]}else if (error._0x05fde?.status===403){_0xa4f1e+=_0xa29989[11]}else if (error._0x05fde?.status===404){_0xa4f1e+=_0xa29989[12]}else{_0xa4f1e+=`Détails: ${error.message}`}await sock.sendMessage(from,{text: _0xa4f1e},{quoted: msg})}}