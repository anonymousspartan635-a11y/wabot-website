const express = require('express');
const path = require('path');
const fs = require('fs');
const P = require('pino');
const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers } = require('@whiskeysockets/baileys');
const app = express();
app.use(express.json());
app.use(express.static('public'));

// Force delete old session on start
if (fs.existsSync('./auth')) fs.rmSync('./auth',{recursive:true,force:true});

async function getPairingCode(number){
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P().child({level:'silent'})) },
    browser: Browsers.macOS('Chrome'),
    logger: P({level:'silent'}),
    printQRInTerminal: false
  });
  sock.ev.on('creds.update', saveCreds);
  await new Promise(r=>setTimeout(r,3000));
  const code = await sock.requestPairingCode(number);
  return code;
}

let mainSock;
async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  mainSock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P().child({level:'silent'})) },
    browser: Browsers.macOS('Chrome'),
    logger: P({level:'silent'})
  });
  mainSock.ev.on('creds.update', saveCreds);
  mainSock.ev.on('messages.upsert', async ({messages})=>{
    const m=messages[0]; if(!m?.message || m.key.fromMe) return;
    const txt=(m.message.conversation||m.message.extendedTextMessage?.text||'').trim();
    if(txt==='.ping') await mainSock.sendMessage(m.key.remoteJid,{text:'🏓 Pong! WABOT online ✅'});
    if(txt==='.menu') await mainSock.sendMessage(m.key.remoteJid,{text:'*WABOT MENU*\n\n.ping\n.menu\n.alive'});
  });
}

app.post('/api/pair', async (req,res)=>{
  try{
    let num=req.body.number.replace(/[^0-9]/g,'');
    console.log('Pair request for:',num);
    const code = await getPairingCode(num);
    res.json({code: code.match(/.{1,4}/g).join('-')});
    setTimeout(()=>startBot(),5000);
  }catch(e){ console.log(e); res.json({error:e.message}); }
});

app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(process.env.PORT||10000,()=>console.log('Ready'));
