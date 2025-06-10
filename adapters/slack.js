const crypto = require('crypto');
const { handleMessage } = require('../mcp/handler');

class SlackTool {
  constructor() {
    this.name = 'slack';
    this.description = 'Send messages to Slack channels and users';

    this.botToken = process.env.SLACK_BOT_TOKEN;
    this.signingSecret = process.env.SLACK_SIGNING_SECRET;

    if (!this.botToken || !this.signingSecret) {
      console.warn('Slack credentials not found in environment variables');
    }
  }

  verifySlackSignature(req) {
    if (!this.signingSecret) {
      console.warn('Slack signing secret not configured, skipping verification');
      return true;
    }

    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];
    const rawBody = req.rawBody; // см. примечание ниже

    if (!signature || !timestamp || !rawBody) {
      console.warn('Missing Slack signature, timestamp, or body');
      return false;
    }

    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
    if (parseInt(timestamp) < fiveMinutesAgo) {
      console.warn('Slack request too old');
      return false;
    }

    const sigBaseString = `v0:${timestamp}:${rawBody}`;
    const mySignature = 'v0=' + crypto
      .createHmac('sha256', this.signingSecret)
      .update(sigBaseString, 'utf8')
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(mySignature, 'utf8'),
        Buffer.from(signature, 'utf8')
      );
    } catch (err) {
      console.warn('Signature comparison failed:', err);
      return false;
    }
  }

  async handleSlackEvent(req, res) {
    const body = req.body;
    const { type, challenge, event } = body;
  
    // URL verification
    if (type === 'url_verification' && challenge) {
      console.log('Slack challenge received:', challenge);
      return res.status(200).json({ challenge });
    }
  
    // Только сообщения пользователей
    if (type === 'event_callback' && event?.type === 'message') {
      // Игнорируем ботов (включая самого себя)
      if (event.subtype === 'bot_message' || event.bot_id) {
        return res.status(200).json({ ok: true });
      }
  
      const { channel, user, text } = event;
  
      console.log(`📥 Message from ${user} in channel ${channel}: "${text}"`);
  
      if (text && user && channel) {
        try {
          const reply = await handleMessage({ user, message: text, channel });
          await this.sendMessage(channel, reply);
        } catch (error) {
          console.error('❌ Error in handleMessage:', error);
          await this.sendMessage(channel, 'Извините, произошла ошибка при обработке вашего сообщения.');
        }
      }
  
      return res.status(200).json({ ok: true });
    }
  
    // Все остальные случаи
    return res.status(200).json({ ignored: true });
  }

  async handleMention(event) {
    const { channel, user, text } = event;
    const cleanText = text.replace(/<@[UW][A-Z0-9]+>/g, '').trim();

    console.log(`Bot mentioned in channel ${channel} by user ${user}: "${cleanText}"`);

    if (cleanText) {
      try {
        const reply = await handleMessage({ user, message: cleanText, channel });
        await this.sendMessage(channel, reply);
      } catch (error) {
        console.error('Error handling mention:', error);
        await this.sendMessage(channel, 'Извините, произошла ошибка при обработке вашего сообщения.');
      }
    }
  }

  async handleDirectMessage(event) {
    const { channel, user, text } = event;

    console.log(`DM received from user ${user}: "${text}"`);

    if (text) {
      try {
        const reply = await handleMessage({ user, message: text, channel });
        await this.sendMessage(channel, reply);
      } catch (error) {
        console.error('Error handling DM:', error);
        await this.sendMessage(channel, 'Извините, произошла ошибка при обработке вашего сообщения.');
      }
    }
  }

  async sendMessage(channel, text, options = {}) {
    if (!this.botToken) {
      throw new Error('Slack bot token not configured');
    }

    const payload = { channel, text, ...options };

    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(`Slack API error: ${result.error}`);
      }

      console.log('Message sent to Slack successfully');
      return result;
    } catch (error) {
      console.error('Error sending Slack message:', error);
      throw error;
    }
  }

  async getChannels() {
    if (!this.botToken) {
      throw new Error('Slack bot token not configured');
    }

    try {
      const response = await fetch('https://slack.com/api/conversations.list', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(`Slack API error: ${result.error}`);
      }

      return result.channels;
    } catch (error) {
      console.error('Error getting Slack channels:', error);
      throw error;
    }
  }
}

module.exports = SlackTool;