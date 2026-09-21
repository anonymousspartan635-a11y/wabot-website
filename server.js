const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 10000;

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// API to generate 8-digit pairing code
app.post('/api/pair', (req, res) => {
  const { number } = req.body;
  if (!number) return res.json({ error: 'Enter number' });
  // Generate 8 digit code like ABCD-1234
  const code = Math.random().toString(36).substring(2,6).toUpperCase() + '-' + Math.floor(1000 + Math.random()*9000);
  console.log(`Pair request for ${number} -> ${code}`);
  res.json({ code, number });
});

app.get('/', (req,res) => res.sendFile(path.join(publicDir, 'index.html')));
app.listen(PORT, () => console.log('Running on '+PORT));
