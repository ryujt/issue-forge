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

  async sendAgentResponse(message) {
    try {
      const payload = this.formatAgentResponse(message);

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
      logger.error(`Failed to send Slack agent response: ${error.message}`);
    }
  }

  formatAgentResponse(message) {
    const { agentName, action, issueNumber, issueTitle, duration, outputPreview } = message;

    const agentEmoji = {
      Strategist: ':dart:',
      Architect: ':building_construction:',
      Coder: ':computer:',
      Tester: ':test_tube:',
      Reviewer: ':memo:',
    };

    const emoji = agentEmoji[agentName] || ':robot_face:';

    return {
      attachments: [{
        color: '#36a64f',
        title: `${emoji} ${agentName} Agent`,
        fields: [
          {
            title: 'Issue',
            value: `#${issueNumber}: ${issueTitle}`,
            short: false,
          },
          {
            title: 'Action',
            value: action,
            short: true,
          },
          {
            title: 'Duration',
            value: `${duration}s`,
            short: true,
          },
        ],
        text: outputPreview ? `\`\`\`${outputPreview}\`\`\`` : undefined,
      }],
    };
  }

  async sendIssueStart(message) {
    try {
      const payload = this.formatIssueStart(message);

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
      logger.error(`Failed to send Slack issue start notification: ${error.message}`);
    }
  }

  formatIssueStart(message) {
    const { issueNumber, issueTitle, projectPath, iteration, maxIterations } = message;

    return {
      attachments: [{
        color: '#3498db',
        title: ':rocket: Issue Processing Started',
        fields: [
          {
            title: 'Issue',
            value: `#${issueNumber}: ${issueTitle}`,
            short: false,
          },
          {
            title: 'Project',
            value: projectPath,
            short: true,
          },
          {
            title: 'Iteration',
            value: `${iteration}/${maxIterations}`,
            short: true,
          },
        ],
      }],
    };
  }

  async sendScheduled(message) {
    try {
      const payload = this.formatScheduled(message);

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
      logger.error(`Failed to send Slack scheduled notification: ${error.message}`);
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

    return {
      attachments: [{
        color: '#f39c12',
        title: ':alarm_clock: Issue Scheduled',
        fields: [
          {
            title: 'Issue',
            value: `#${issueNumber}: ${issueTitle}`,
            short: false,
          },
          {
            title: 'Scheduled Time',
            value: timeStr,
            short: true,
          },
          {
            title: 'Status',
            value: 'Waiting to execute',
            short: true,
          },
        ],
      }],
    };
  }
}
