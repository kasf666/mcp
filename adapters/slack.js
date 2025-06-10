const crypto = require('crypto');
const { handleMessage } = require('../mcp/handler');

class SlackTool {
  constructor() {
    this.botToken = process.env.SLACK_BOT_TOKEN;
    this.signingSecret = process.env.SLACK_SIGNING_SECRET;
    this.botUserId = process.env.SLACK_BOT_USER_ID;

    if (!this.botToken || !this.signingSecret) {
      console.warn('⚠️ Slack credentials missing in .env');
    }
  }

  async handleSlackEvent(req, res) {
    const { type, challenge, event } = req.body;
  
    // ✅ Slack challenge
    if (type === 'url_verification' && challenge) {
      return res.status(200).json({ challenge });
    }
  
    // ✅ Только обработка текстовых сообщений
    if (type === 'event_callback' && event?.type === 'message') {
      
      // 🧱 Фильтр: игнорировать бот-сообщения, в том числе свои
      if (
        event.subtype === 'bot_message' ||
        event.bot_id ||
        (process.env.SLACK_BOT_USER_ID && event.user === process.env.SLACK_BOT_USER_ID) ||
        !event.client_msg_id // ← ключевой фильтр
      ) {
        console.log('⛔ Ignored: likely bot or system message');
        return res.status(200).json({ ignored: true });
      }
  
      const { user, channel, text } = event;
      console.log(`📩 Message from ${user}: "${text}"`);
  
      try {
        const reply = await handleMessage({ user, message: text, channel });
        await this.sendMessage(channel, reply);
      } catch (err) {
        console.error('❌ Error in handleMessage:', err);
        await this.sendMessage(channel, 'Извините, произошла ошибка при обработке запроса.');
      }
  
      return res.status(200).json({ ok: true });
    }
  
    // ✅ Остальное игнорируем
    return res.status(200).json({ ignored: true });
  }

  async sendMessage(channel, text, options = {}) {
    if (!this.botToken) throw new Error('Missing Slack bot token');

    const payload = { channel, text, ...options };

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.ok) throw new Error(`Slack API error: ${result.error}`);
    console.log('✅ Sent message to Slack');
    return result;
  }
}

module.exports = SlackTool;