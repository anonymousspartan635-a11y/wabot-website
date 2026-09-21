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
  sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P().child({level:'silent'})) },
    browser: Browsers.ubuntu('Chrome'),
    logger: P({ level: 'silent' }),
    printQRInTerminal: false
  });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === 'open') console.log('✅ WABOT CONNECTED');
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    }
  });

  // BOT COMMANDS
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const m = messages[0];
      if (!m.message || m.key.fromMe) return;
      const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
      const from = m.key.remoteJid;

      if (text === '.ping' || text.toLowerCase() === 'ping') {
        await sock.sendMessage(from, { text: '🏓 Pong! WABOT is online ✅\nSpeed: ' + (Date.now() - m.messageTimestamp*1000) + 'ms' });
      }
      if (text === '.menu' || text === 'menu') {
        await sock.sendMessage(from, { text: `*WABOT MENU 🤖*

•.ping - Check bot speed
•.menu - Show this menu
•.owner - Owner info
•.alive - Bot status
•.sticker - Image to sticker

Powered by WABOT` });
      }
      if (text === '.alive') {
        await sock.sendMessage(from, { text: '🤖 WABOT is Alive and running 24/7 on Render!' });
      }
      if (text === '.owner') {
        await sock.sendMessage(from, { text: '👑 Owner: wa.me/233XXXXXXXX\nBot: WABOT' });
      }
    } catch(e){ console.log(e) }
  });
}

startBot();

// API FOR 8-DIGIT CODE
app.post('/api/pair', async (req, res) => {
  try {
    let num = req.body.number.replace(/[^0-9]/g, '');
    if (!num) return res.json({ error: 'Enter number' });

    // If already connected, delete old auth for new pairing
    if (fs.existsSync('./auth/creds.json')) {
       const { state } = await useMultiFileAuthState('./auth');
       if (state.creds.registered) return res.json({ error: 'Already paired! Delete auth folder to re-pair' });
    }

    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    const tempSock = makeWASocket({
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P().child({level:'silent'})) },
      browser: Browsers.ubuntu('Chrome'),
      logger: P({ level: 'silent' }),
      printQRInTerminal: false
    });
    tempSock.ev.on('creds.update', saveCreds);
    await new Promise(r => setTimeout(r, 2000));
    let code = await tempSock.requestPairingCode(num);
    code = code?.match(/.{1,4}/g)?.join('-') || code;
    res.json({ code });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(process.env.PORT || 10000, () => console.log('WABOT Server Running'));
