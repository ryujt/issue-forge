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

  async sendAgentResponse(message) {
    try {
      const text = this.formatAgentResponse(message);

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

      logger.debug(`Telegram agent response sent for ${message.agentName}`);
    } catch (error) {
      logger.error(`Failed to send Telegram agent response: ${error.message}`);
    }
  }

  formatAgentResponse(message) {
    const { agentName, action, issueNumber, issueTitle, duration, outputPreview } = message;

    const agentEmoji = {
      Strategist: '🎯',
      Architect: '🏗️',
      Coder: '💻',
      Tester: '🧪',
      Reviewer: '📝',
    };

    const emoji = agentEmoji[agentName] || '🤖';
    const preview = outputPreview ? `\n\n\`\`\`\n${outputPreview}\n\`\`\`` : '';

    return `${emoji} *${agentName} Agent*

*Issue:* #${issueNumber}: ${issueTitle}
*Action:* ${action}
*Duration:* ${duration}s${preview}`;
  }

  async sendIssueStart(message) {
    try {
      const text = this.formatIssueStart(message);

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

      logger.debug(`Telegram issue start notification sent for issue #${message.issueNumber}`);
    } catch (error) {
      logger.error(`Failed to send Telegram issue start notification: ${error.message}`);
    }
  }

  formatIssueStart(message) {
    const { issueNumber, issueTitle, projectPath, iteration, maxIterations } = message;

    return `🚀 *Issue Processing Started*

*Issue:* #${issueNumber}: ${issueTitle}
*Project:* \`${projectPath}\`
*Iteration:* ${iteration}/${maxIterations}`;
  }

  async sendScheduled(message) {
    try {
      const text = this.formatScheduled(message);

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

      logger.debug(`Telegram scheduled notification sent for issue #${message.issueNumber}`);
    } catch (error) {
      logger.error(`Failed to send Telegram scheduled notification: ${error.message}`);
    }
  }

  formatScheduled(message) {
    const { issueNumber, issueTitle, targetTime } = message;
    const timeStr = targetTime.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return `⏰ *Issue Scheduled*

*Issue:* #${issueNumber}: ${issueTitle}
*Scheduled Time:* ${timeStr}
*Status:* Waiting to execute`;
  }
}
