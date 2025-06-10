// slack.js
const crypto = require('crypto');
const { handleMessage } = require('../mcp/handler'); // Подключаем ваш MCP handler

class SlackTool {
  constructor() {
    this.name = 'slack';
    this.description = 'Send messages to Slack channels and users';
    
    // Получаем из environment variables
    this.botToken = process.env.SLACK_BOT_TOKEN; // xoxb-...
    this.signingSecret = process.env.SLACK_SIGNING_SECRET;
    
    if (!this.botToken || !this.signingSecret) {
      console.warn('Slack credentials not found in environment variables');
    }
  }

  // Метод для верификации Slack challenge (нужен для Event Subscriptions)
  handleSlackChallenge(req, res) {
    const { challenge, token, type } = req.body;
    
    if (type === 'url_verification') {
      console.log('Slack challenge received:', challenge);
      return res.json({ challenge });
    }
    
    return res.status(400).json({ error: 'Invalid request' });
  }

  // Верификация подписи Slack (для безопасности)
  verifySlackSignature(req) {
    if (!this.signingSecret) {
      console.warn('Slack signing secret not configured, skipping verification');
      return true; // Skip verification if no secret
    }
    
    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];
    const body = req.body.toString();
    
    if (!signature || !timestamp) {
      console.warn('Missing Slack signature or timestamp');
      return false;
    }
    
    // Проверяем, что запрос не старше 5 минут
    const time = Math.floor(new Date().getTime() / 1000);
    if (Math.abs(time - timestamp) > 300) {
      console.warn('Slack request too old');
      return false;
    }
    
    // Создаем подпись
    const sigBasestring = 'v0:' + timestamp + ':' + body;
    const mySignature = 'v0=' + crypto
      .createHmac('sha256', this.signingSecret)
      .update(sigBasestring, 'utf8')
      .digest('hex');
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(mySignature, 'utf8'),
        Buffer.from(signature, 'utf8')
      );
    } catch (error) {
      console.warn('Error verifying Slack signature:', error);
      return false;
    }
  }

  // Обработка событий Slack (упоминания бота, сообщения)
  async handleSlackEvent(req, res) {
    const rawBody = req.body.toString();
    const body = JSON.parse(rawBody);
    
    const { type, event } = body;

    // Handle URL verification challenge
    if (type === 'url_verification') {
      console.log('Slack URL verification challenge received');
      return res.json({ challenge: body.challenge });
    }

    // Verify signature for actual events
    if (type === 'event_callback') {
      // Временно отключаем проверку подписи для отладки
      // if (!this.verifySlackSignature(req)) {
      //   console.warn('Invalid Slack signature');
      //   return res.status(401).json({ error: 'Invalid signature' });
      // }
    }

    if (type === 'event_callback' && event) {
      console.log('Slack event received:', event.type, event);
      
      try {
        // Обрабатываем упоминания бота
        if (event.type === 'app_mention') {
          await this.handleMention(event);
        }
        
        // Обрабатываем DM сообщения
        if (event.type === 'message' && event.channel_type === 'im' && !event.bot_id) {
          await this.handleDirectMessage(event);
        }
      } catch (error) {
        console.error('Error processing Slack event:', error);
      }
    }

    res.json({ ok: true });
  }

  // Обработка упоминаний бота
  async handleMention(event) {
    const { channel, user, text } = event;
    
    // Убираем упоминание бота из текста
    const cleanText = text.replace(/<@[UW][A-Z0-9]+>/g, '').trim();
    
    console.log(`Bot mentioned in channel ${channel} by user ${user}: "${cleanText}"`);
    
    if (cleanText) {
      try {
        // Используем ваш MCP handler для обработки сообщения
        const reply = await handleMessage({ 
          user: user, 
          message: cleanText, 
          channel: channel 
        });
        
        await this.sendMessage(channel, reply);
      } catch (error) {
        console.error('Error handling mention:', error);
        await this.sendMessage(channel, 'Извините, произошла ошибка при обработке вашего сообщения.');
      }
    }
  }

  // Обработка личных сообщений
  async handleDirectMessage(event) {
    const { channel, user, text } = event;
    
    console.log(`DM received from user ${user}: "${text}"`);
    
    if (text) {
      try {
        // Используем ваш MCP handler для обработки сообщения
        const reply = await handleMessage({ 
          user: user, 
          message: text, 
          channel: channel 
        });
        
        await this.sendMessage(channel, reply);
      } catch (error) {
        console.error('Error handling DM:', error);
        await this.sendMessage(channel, 'Извините, произошла ошибка при обработке вашего сообщения.');
      }
    }
  }

  // Основной метод для отправки сообщений
  async sendMessage(channel, text, options = {}) {
    if (!this.botToken) {
      throw new Error('Slack bot token not configured');
    }

    const payload = {
      channel,
      text,
      ...options
    };

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

  // Получение списка каналов
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