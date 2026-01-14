import { NotificationProvider } from './notification-provider.js';
import { logger } from '../../utils/logger.js';

export class SlackProvider extends NotificationProvider {
  constructor(webhookUrl) {
    super();
    this.webhookUrl = webhookUrl;
  }

  getName() {
    return 'slack';
  }

  async send(message) {
    try {
      const payload = this.formatMessage(message);

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Slack API returned ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      logger.error(`Failed to send Slack notification for issue #${message.issueNumber}: ${error.message}`);
    }
  }

  formatMessage(message) {
    const { issueNumber, issueTitle, status, prNumber, prUrl, iterationCount } = message;

    if (status === 'success') {
      return {
        attachments: [{
          color: 'good',
          title: '✅ Issue Analysis Complete',
          fields: [
            {
              title: 'Issue',
              value: `#${issueNumber}: ${issueTitle}`,
              short: false,
            },
            {
              title: 'Status',
              value: 'Pull Request Created',
              short: true,
            },
            {
              title: 'PR',
              value: `<${prUrl}|#${prNumber}>`,
              short: true,
            },
          ],
        }],
      };
    } else {
      return {
        attachments: [{
          color: 'warning',
          title: '⚠️ Issue Analysis Escalated',
          fields: [
            {
              title: 'Issue',
              value: `#${issueNumber}: ${issueTitle}`,
              short: false,
            },
            {
              title: 'Status',
              value: `Escalated after ${iterationCount} iterations`,
              short: true,
            },
            {
              title: 'Action Required',
              value: 'Manual review needed',
              short: true,
            },
          ],
        }],
      };
    }
  }
}
