// index.js
require('dotenv').config();
const express = require('express');
const { handleMessage } = require('./mcp/handler');

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const { user, message, channel } = req.body;

  try {
    const reply = await handleMessage({ user, message, channel });
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'MCP failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MCP server listening on port ${PORT}`));