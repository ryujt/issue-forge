import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { NotificationService } from '../src/services/notification-service.js';

describe('NotificationService', () => {
  it('should not send notifications when disabled', async () => {
    const config = { enabled: false, provider: 'slack' };
    const service = new NotificationService(config);

    await service.notifyAnalysisComplete({
      issueNumber: 1,
      issueTitle: 'Test Issue',
      status: 'success',
      prNumber: 10,
      prUrl: 'https://github.com/test/repo/pull/10',
    });
  });

  it('should not send notifications when provider is null', async () => {
    const config = { enabled: true, provider: 'none' };
    const service = new NotificationService(config);

    await service.notifyAnalysisComplete({
      issueNumber: 1,
      issueTitle: 'Test Issue',
      status: 'success',
      prNumber: 10,
      prUrl: 'https://github.com/test/repo/pull/10',
    });
  });

  it('should initialize provider when enabled with valid config', () => {
    const originalEnv = process.env.SLACK_WEBHOOK_URL;
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';

    const config = { enabled: true, provider: 'slack' };
    const service = new NotificationService(config);

    assert.notStrictEqual(service.provider, null);

    process.env.SLACK_WEBHOOK_URL = originalEnv;
  });

  it('should prefer environment variable over config webhook URL', () => {
    const originalEnv = process.env.SLACK_WEBHOOK_URL;
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/env-url';

    const config = {
      enabled: true,
      provider: 'slack',
      webhookUrl: 'https://hooks.slack.com/services/config-url',
    };

    const service = new NotificationService(config);
    const webhookUrl = service.getWebhookUrl('slack');

    assert.strictEqual(webhookUrl, 'https://hooks.slack.com/services/env-url');

    process.env.SLACK_WEBHOOK_URL = originalEnv;
  });

  it('should fall back to config webhook URL when no env var', () => {
    const originalEnv = process.env.SLACK_WEBHOOK_URL;
    delete process.env.SLACK_WEBHOOK_URL;

    const config = {
      enabled: true,
      provider: 'slack',
      webhookUrl: 'https://hooks.slack.com/services/config-url',
    };

    const service = new NotificationService(config);
    const webhookUrl = service.getWebhookUrl('slack');

    assert.strictEqual(webhookUrl, 'https://hooks.slack.com/services/config-url');

    process.env.SLACK_WEBHOOK_URL = originalEnv;
  });
});
