import { createNotificationProvider } from '../providers/notifications/index.js';
import { logger } from '../utils/logger.js';

export class NotificationService {
  constructor(config) {
    this.config = config;
    this.provider = null;

    if (config?.enabled) {
      const webhookUrl = this.getWebhookUrl(config.provider);
      if (webhookUrl) {
        this.provider = createNotificationProvider(config.provider, webhookUrl);
        logger.info(`Notification provider initialized: ${config.provider}`);
      } else {
        logger.warn(`Notifications enabled but no webhook URL found for ${config.provider}`);
      }
    }
  }

  getWebhookUrl(providerType) {
    const envVarMap = {
      slack: 'SLACK_WEBHOOK_URL',
      telegram: 'TELEGRAM_WEBHOOK_URL',
    };

    const envVar = envVarMap[providerType];
    const envUrl = envVar ? process.env[envVar] : null;

    return envUrl || this.config?.webhookUrl;
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
}
