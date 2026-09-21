const express = require('express');
const path = require('path');
const fs = require('fs');
const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
let sock;
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  sock = makeWASocket({ auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P().child({level:'silent'})) }, browser: Browsers.ubuntu('Chrome'), logger: P({ level: 'silent' }) });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    if (u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot();
  });
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]; if (!m?.message || m.key.fromMe) return;
    const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
    const from = m.key.remoteJid;
    if (text === '.ping') await sock.sendMessage(from, { text: '🏓 Pong! WABOT Online ✅' });
    if (text === '.menu') await sock.sendMessage(from, { text: `*WABOT MENU 🤖*\n\n.ping\n.menu\n.alive\n.owner` });
    if (text === '.alive') await sock.sendMessage(from, { text: '🤖 WABOT Alive!' });
  });
}
startBot();
app.post('/api/pair', async (req, res) => {
  try {
    let num = req.body.number.replace(/[^0-9]/g, '');
    if (fs.existsSync('./auth')) fs.rmSync('./auth',{recursive:true,force:true});
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    const tempSock = makeWASocket({ auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P().child({level:'silent'})) }, browser: Browsers.ubuntu('Chrome'), logger: P({ level: 'silent' }) });
    tempSock.ev.on('creds.update', saveCreds);
    await new Promise(r => setTimeout(r, 2000));
    let code = await tempSock.requestPairingCode(num);
    code = code?.match(/.{1,4}/g)?.join('-') || code;
    res.json({ code });
  } catch (e) { res.json({ error: e.message }); }
});
app.get('/delete', (req,res)=>{ if(fs.existsSync('./auth')) fs.rmSync('./auth',{recursive:true,force:true}); res.send('Auth deleted, go back and pair again'); });
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(process.env.PORT || 10000);
