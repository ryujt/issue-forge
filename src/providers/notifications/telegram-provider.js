import { NotificationProvider } from './notification-provider.js';
import { logger } from '../../utils/logger.js';

export class TelegramProvider extends NotificationProvider {
  constructor(config) {
    super();
    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
  }

  getName() {
    return 'telegram';
  }

  async send(message) {
    try {
      const text = this.formatMessage(message);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: 'Markdown',
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Telegram API returned ${response.status}: ${await response.text()}`);
      }

      logger.debug(`Telegram notification sent for issue #${message.issueNumber}`);
    } catch (error) {
      logger.error(`Failed to send Telegram notification for issue #${message.issueNumber}: ${error.message}`);
    }
  }

  formatMessage(message) {
    const { issueNumber, issueTitle, status, prNumber, prUrl, iterationCount } = message;

    if (status === 'success') {
      return `✅ *Issue Analysis Complete*

*Issue:* #${issueNumber}: ${issueTitle}
*Status:* Pull Request Created
*PR:* [#${prNumber}](${prUrl})`;
    } else {
      return `⚠️ *Issue Analysis Escalated*

*Issue:* #${issueNumber}: ${issueTitle}
*Status:* Escalated after ${iterationCount} iterations
*Action Required:* Manual review needed`;
    }
  }
}
