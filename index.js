require('dotenv').config();
const express = require('express');
const { handleMessage } = require('./mcp/handler');
const SlackTool = require('./adapters/slack');

const app = express();

app.use('/mcp', express.json());
app.use('/slack/events', express.json());

const slackTool = new SlackTool();

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

// ✅ исправленный Slack endpoint
app.post('/slack/events', (req, res) => {
  slackTool.handleSlackEvent(req, res);
});

app.get('/slack/test', async (req, res) => {
  try {
    const channels = await slackTool.getChannels();
    res.json({ 
      status: 'OK', 
      message: 'Slack integration working',
      channels_count: channels.length,
      channels: channels.slice(0, 5).map(ch => ({ id: ch.id, name: ch.name }))
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      message: error.message 
    });
  }
});

app.post('/slack/send', express.json(), async (req, res) => {
  const { channel, text } = req.body;
  if (!channel || !text) {
    return res.status(400).json({ error: 'channel and text are required' });
  }
  try {
    const result = await slackTool.sendMessage(channel, text);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error sending Slack message:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send(`
    <h1>MCP Server is running</h1>
    <h2>Available endpoints:</h2>
    <ul>
      <li><code>POST /mcp</code> - MCP messages</li>
      <li><code>POST /slack/events</code> - Slack events webhook</li>
      <li><code>GET /slack/test</code> - Test Slack connection</li>
      <li><code>POST /slack/send</code> - Send Slack message</li>
    </ul>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () =>
  console.log(`MCP server listening on port ${PORT}`)
);