const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 10000;

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, {recursive:true});
}
if (!fs.existsSync(path.join(publicDir, 'index.html'))) {
  fs.writeFileSync(path.join(publicDir, 'index.html'), '<h1>Bot Online ✅</h1><p>Deployed successfully!</p>');
}

app.use(express.static(publicDir));
app.get('/', (req,res) => res.sendFile(path.join(publicDir, 'index.html')));

app.listen(PORT, () => console.log('Website running: http://localhost:'+PORT));
