const express = require('express');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 10000;

app.post('/api/pair', async (req, res) => {
  try {
    let { number } = req.body;
    number = number.replace(/[^0-9]/g,'');
    if(!number) return res.json({error:'Enter number'});

    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    const sock = makeWASocket({ auth: state, printQRInTerminal: false });
    
    sock.ev.on('creds.update', saveCreds);

    await new Promise(r => setTimeout(r, 1000));
    const code = await sock.requestPairingCode(number);
    res.json({ code: code });
  } catch(e){
    console.log(e);
    res.json({ error: 'Failed, try again: '+e.message });
  }
});

app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT, ()=> console.log('Real bot running on '+PORT));
