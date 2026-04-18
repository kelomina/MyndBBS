const express = require('express');
const app = express();
app.get('/test', (req, res) => {
  res.sendFile(__dirname + '/../routes/tailwind.js');
});
console.log("Syntax is OK");
