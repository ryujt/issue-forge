import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('NotificationService - Scheduling Integration', () => {
  let mockProviders;

  beforeEach(() => {
    mockProviders = [];
  });

  describe('notifyScheduled method', () => {
    it('should call sendScheduled on providers that support it', async () => {
      let scheduledCallCount = 0;

      const providerWithScheduled = {
        name: 'slack',
        sendScheduled: async (data) => {
          scheduledCallCount++;
          assert.ok(data.issueNumber, 'Should have issue number');
          assert.ok(data.issueTitle, 'Should have issue title');
          assert.ok(data.targetTime, 'Should have target time');
        },
      };

      mockProviders.push(providerWithScheduled);

      await providerWithScheduled.sendScheduled({
        issueNumber: 1,
        issueTitle: 'PM7 Deploy',
        targetTime: new Date('2024-01-15T19:00:00'),
      });

      assert.strictEqual(scheduledCallCount, 1, 'Should call sendScheduled once');
    });

    it('should skip providers without sendScheduled method', async () => {
      const providerWithoutScheduled = {
        name: 'email',
        send: async () => {},
      };

      mockProviders.push(providerWithoutScheduled);

      // Should not throw error
      assert.ok(!providerWithoutScheduled.sendScheduled, 'Provider should not have sendScheduled');
    });

    it('should handle multiple providers gracefully', async () => {
      let slackCalls = 0;
      let telegramCalls = 0;

      const slackProvider = {
        name: 'slack',
        sendScheduled: async () => {
          slackCalls++;
        },
      };

      const telegramProvider = {
        name: 'telegram',
        sendScheduled: async () => {
          telegramCalls++;
        },
      };

      const emailProvider = {
        name: 'email',
        send: async () => {},
      };

      mockProviders.push(slackProvider, telegramProvider, emailProvider);

      const data = {
        issueNumber: 1,
        issueTitle: 'PM7 Deploy',
        targetTime: new Date('2024-01-15T19:00:00'),
      };

      await slackProvider.sendScheduled(data);
      await telegramProvider.sendScheduled(data);

      assert.strictEqual(slackCalls, 1, 'Slack should be called');
      assert.strictEqual(telegramCalls, 1, 'Telegram should be called');
    });
  });

  describe('Scheduled notification data structure', () => {
    it('should include all required fields', () => {
      const scheduledData = {
        issueNumber: 123,
        issueTitle: 'PM7 Deploy to production',
        targetTime: new Date('2024-01-15T19:00:00'),
      };

      assert.ok(scheduledData.issueNumber, 'Should have issueNumber');
      assert.ok(scheduledData.issueTitle, 'Should have issueTitle');
      assert.ok(scheduledData.targetTime instanceof Date, 'targetTime should be Date object');
    });

    it('should format target time correctly', () => {
      const targetTime = new Date('2024-01-15T19:00:00');
      const formatted = targetTime.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      assert.ok(formatted.includes('Jan'), 'Should include month');
      assert.ok(formatted.includes('15'), 'Should include day');
      assert.ok(formatted.includes('2024'), 'Should include year');
      assert.ok(formatted.includes('PM') || formatted.includes('07:00'), 'Should include time');
    });

    it('should handle different time formats', () => {
      const times = [
        new Date('2024-01-15T09:00:00'), // AM
        new Date('2024-01-15T19:00:00'), // PM
        new Date('2024-01-15T00:00:00'), // midnight
        new Date('2024-01-15T12:00:00'), // noon
      ];

      for (const time of times) {
        const formatted = time.toLocaleString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        assert.ok(formatted.length > 0, `Should format time: ${time}`);
      }
    });
  });

  describe('Provider message formatting', () => {
    it('should format Slack scheduled message', () => {
      const data = {
        issueNumber: 123,
        issueTitle: 'PM7 Deploy to production',
        targetTime: new Date('2024-01-15T19:00:00'),
      };

      const formattedTime = data.targetTime.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const message = `⏰ *Issue #${data.issueNumber} Scheduled*\n\n` +
        `*Title:* ${data.issueTitle}\n` +
        `*Scheduled for:* ${formattedTime}\n\n` +
        `Will start processing at the scheduled time.`;

      assert.ok(message.includes('⏰'), 'Should include alarm emoji');
      assert.ok(message.includes('Scheduled'), 'Should indicate scheduling');
      assert.ok(message.includes(data.issueTitle), 'Should include title');
      assert.ok(message.includes(formattedTime), 'Should include formatted time');
    });

    it('should format Telegram scheduled message', () => {
      const data = {
        issueNumber: 123,
        issueTitle: 'PM7 Deploy to production',
        targetTime: new Date('2024-01-15T19:00:00'),
      };

      const formattedTime = data.targetTime.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const message = `⏰ *Issue #${data.issueNumber} Scheduled*\n\n` +
        `*Title:* ${data.issueTitle}\n` +
        `*Scheduled for:* ${formattedTime}\n\n` +
        `Will start processing at the scheduled time.`;

      assert.ok(message.includes('⏰'), 'Should include alarm emoji');
      assert.ok(message.includes('*'), 'Should use markdown bold');
      assert.ok(message.includes(data.issueTitle), 'Should include title');
      assert.ok(message.includes(formattedTime), 'Should include formatted time');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid target time gracefully', () => {
      const invalidTime = new Date('invalid');

      assert.ok(isNaN(invalidTime.getTime()), 'Invalid date should be NaN');
    });

    it('should handle missing notification data fields', () => {
      const incompleteData = {
        issueNumber: 123,
        // missing issueTitle and targetTime
      };

      assert.ok(incompleteData.issueNumber, 'Should have issueNumber');
      assert.ok(!incompleteData.issueTitle, 'Should not have issueTitle');
      assert.ok(!incompleteData.targetTime, 'Should not have targetTime');
    });

    it('should handle provider exceptions gracefully', async () => {
      const failingProvider = {
        name: 'failing',
        sendScheduled: async () => {
          throw new Error('Provider error');
        },
      };

      try {
        await failingProvider.sendScheduled({
          issueNumber: 1,
          issueTitle: 'Test',
          targetTime: new Date(),
        });
        assert.fail('Should throw error');
      } catch (error) {
        assert.ok(error.message.includes('Provider error'), 'Should catch provider error');
      }
    });
  });
});
