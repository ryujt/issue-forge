import { createNotificationProvider } from '../providers/notifications/index.js';
import { logger } from '../utils/logger.js';

export class NotificationService {
  constructor(config) {
    this.config = config;
    this.provider = null;

    if (config?.enabled) {
      const providerConfig = this.getProviderConfig(config.provider);
      try {
        this.provider = createNotificationProvider(config.provider, providerConfig);
        logger.info(`Notification provider initialized: ${config.provider}`);
      } catch (error) {
        logger.warn(`Failed to initialize ${config.provider} provider: ${error.message}`);
      }
    }
  }

  getProviderConfig(providerType) {
    switch (providerType) {
      case 'slack':
        return {
          webhookUrl: process.env.SLACK_WEBHOOK_URL || this.config?.webhookUrl,
        };
      case 'telegram':
        return {
          botToken: process.env.TELEGRAM_BOT_TOKEN || this.config?.botToken,
          chatId: process.env.TELEGRAM_CHAT_ID || this.config?.chatId,
        };
      default:
        return {};
    }
  }

  async notifyAnalysisComplete(message) {
    if (!this.config?.enabled || !this.provider) {
      return;
    }

    try {
      await this.provider.send(message);
    } catch (error) {
      logger.error(`Notification service error for issue #${message.issueNumber}: ${error.message}`);
    }
  }

  async notifyAgentResponse(message) {
    if (!this.config?.enabled || !this.provider || !this.config?.sendAllResponses) {
      return;
    }

    try {
      await this.provider.sendAgentResponse(message);
    } catch (error) {
      logger.error(`Notification service error for agent ${message.agentName}: ${error.message}`);
    }
  }

  async notifyIssueStart(message) {
    if (!this.config?.enabled || !this.provider) {
      return;
    }

    try {
      await this.provider.sendIssueStart(message);
    } catch (error) {
      logger.error(`Notification service error for issue start #${message.issueNumber}: ${error.message}`);
    }
  }
}
