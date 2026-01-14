import { NotificationProvider } from './notification-provider.js';
import { logger } from '../../utils/logger.js';

export class TelegramProvider extends NotificationProvider {
  constructor(webhookUrl) {
    super();
    this.webhookUrl = webhookUrl;
  }

  getName() {
    return 'telegram';
  }

  async send(message) {
    try {
      const text = this.formatMessage(message);

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          parse_mode: 'Markdown',
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Telegram API returned ${response.status}: ${await response.text()}`);
      }
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
