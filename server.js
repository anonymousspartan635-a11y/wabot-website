const express = require('express')
const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage, Browsers } = require('@whiskeysockets/baileys')
const P = require('pino')
const path = require('path')
const fs = require('fs')
const axios = require('axios')
const QRCode = require('qrcode')

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))

let bots = {} // store all active bots: { number: { sock, status } }

async function startBotForNumber(phoneNumber, io) {
  const authFolder = `auth_${phoneNumber}`
  const { state, saveCreds } = await useMultiFileAuthState(authFolder)

  const sock = makeWASocket({
    logger: P({ level: 'silent' }),
    auth: state,
    browser: Browsers.ubuntu("Chrome"),
    printQRInTerminal: false
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if(qr){
      let qrImage = await QRCode.toDataURL(qr)
      io.emit('qr', { number: phoneNumber, qr: qrImage })
      console.log(`QR for ${phoneNumber}`)
    }

    if(connection === 'open'){
      bots[phoneNumber] = { sock, status: 'online', number: phoneNumber }
      io.emit('connected', { number: phoneNumber })
      console.log(`✅ ${phoneNumber} Online`)
    }

    if(connection === 'close'){
      let shouldReconnect = lastDisconnect?.error?.output?.statusCode!== 401
      if(shouldReconnect){
        startBotForNumber(phoneNumber, io)
      }else{
        delete bots[phoneNumber]
        try{ fs.rmSync(authFolder, { recursive: true }) }catch(e){}
      }
    }
  })

  // MESSAGE HANDLER - Your bot logic here
  sock.ev.on('messages.upsert', async m => {
    const msg = m.messages[0]
    if(!msg.message) return
    const jid = msg.key.remoteJid
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || ""
    if(!text) return

    // Example commands
    if(text.toLowerCase() === '.menu'){
      await sock.sendMessage(jid, { text: `*BOT ONLINE* for ${phoneNumber}\n\n.alive\n.song name\n.ytmp3 link\n.tiktok link\n.ig link\n.fb link\n.sticker\n.ai question` })
    }
    if(text.toLowerCase() === '.alive'){
      await sock.sendMessage(jid, { text: `Bot alive ✅\nNumber: ${phoneNumber}\nWebsite: Hosted` })
    }
    if(text.toLowerCase().startsWith('.ai ')){
      let q = text.slice(4)
      try{
        let res = await axios.get(`https://api.popcat.xyz/chatbot?msg=${encodeURIComponent(q)}`)
        await sock.sendMessage(jid, { text: res.data.response })
      }catch(e){}
    }
    if(text.toLowerCase().startsWith('.song ') || text.toLowerCase().startsWith('.play ')){
      let q = text.slice(text.indexOf(' ')+1)
      try{
        let s = await axios.get(`https://api.popcat.xyz/ytsearch?q=${encodeURIComponent(q)}`)
        if(s.data[0]) await sock.sendMessage(jid, { text: `Found: ${s.data[0].title}\n${s.data[0].url}` })
      }catch(e){}
    }
  })

  // If user wants pairing code instead of QR
  if(!state.creds.registered){
    try{
      await new Promise(r=>setTimeout(r, 2000))
      let code = await sock.requestPairingCode(phoneNumber)
      io.emit('paircode', { number: phoneNumber, code })
    }catch(e){ console.log("Pair code failed, use QR") }
  }

  return sock
}

// WEBSITE ROUTES
app.get('/', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.get('/bots', (req,res)=>{
  res.json(Object.keys(bots).map(n=>({ number: n, status: bots[n].status })))
})

const http = require('http').createServer(app)
const { Server } = require('socket.io')
const io = new Server(http)

io.on('connection', (socket)=>{
  console.log('User connected to website')
  socket.on('startBot', async ({ number })=>{
    let clean = number.replace(/[^0-9]/g,'')
    if(!clean) return
    socket.emit('log', `Starting bot for ${clean}...`)
    startBotForNumber(clean, io)
  })
})

http.listen(PORT, ()=>{
  console.log(`🌐 Website running: http://localhost:${PORT}`)
})
