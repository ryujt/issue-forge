import { SlackProvider } from './slack-provider.js';
import { TelegramProvider } from './telegram-provider.js';

export { NotificationProvider } from './notification-provider.js';
export { SlackProvider } from './slack-provider.js';
export { TelegramProvider } from './telegram-provider.js';

export function createNotificationProvider(type, config) {
  switch (type) {
    case 'slack':
      if (!config.webhookUrl) {
        throw new Error('Webhook URL is required for Slack provider');
      }
      return new SlackProvider(config.webhookUrl);
    case 'telegram':
      if (!config.botToken || !config.chatId) {
        throw new Error('Bot token and chat ID are required for Telegram provider');
      }
      return new TelegramProvider(config);
    case 'none':
      return null;
    default:
      throw new Error(`Unknown notification provider: ${type}`);
  }
}
