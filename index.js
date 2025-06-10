// index.js
require('dotenv').config();
const express = require('express');
const { handleMessage } = require('./mcp/handler');
const SlackTool = require('./slack'); // Подключаем Slack tool

const app = express();

// Middleware для обычных JSON запросов
app.use('/mcp', express.json());
app.use('/slack/events', express.raw({ type: 'application/json' }));

// Инициализируем Slack tool
const slackTool = new SlackTool();

// Существующий MCP endpoint
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

// Новые Slack endpoints
app.post('/slack/events', (req, res) => {
  try {
    // Парсим JSON из raw body
    const body = JSON.parse(req.body.toString());
    req.body = body;
    
    // Обрабатываем Slack события
    slackTool.handleSlackEvent(req, res);
  } catch (error) {
    console.error('Error handling Slack event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint для тестирования Slack интеграции
app.get('/slack/test', async (req, res) => {
  try {
    const channels = await slackTool.getChannels();
    res.json({ 
      status: 'OK', 
      message: 'Slack integration working',
      channels_count: channels.length,
      channels: channels.slice(0, 5).map(ch => ({ id: ch.id, name: ch.name })) // Показываем первые 5
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      message: error.message 
    });
  }
});

// Endpoint для отправки сообщения в Slack (для тестирования)
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

// Главная страница
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