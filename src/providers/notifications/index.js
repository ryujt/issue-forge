import { SlackProvider } from './slack-provider.js';
import { TelegramProvider } from './telegram-provider.js';

export { NotificationProvider } from './notification-provider.js';
export { SlackProvider } from './slack-provider.js';
export { TelegramProvider } from './telegram-provider.js';

export function createNotificationProvider(type, webhookUrl) {
  if (!webhookUrl) {
    throw new Error(`Webhook URL is required for ${type} provider`);
  }

  switch (type) {
    case 'slack':
      return new SlackProvider(webhookUrl);
    case 'telegram':
      return new TelegramProvider(webhookUrl);
    case 'none':
      return null;
    default:
      throw new Error(`Unknown notification provider: ${type}`);
  }
}
