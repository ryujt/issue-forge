import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TimeScheduler } from '../src/utils/time-scheduler.js';

describe('Scheduling End-to-End Flow', () => {
  describe('Complete workflow simulation', () => {
    it('should process issue with PM7 scheduling', async () => {
      const issueTitle = 'PM7 Deploy new feature to production';

      // Step 1: Parse time from issue title
      const parsed = TimeScheduler.parseTimeFromTitle(issueTitle);
      assert.notStrictEqual(parsed, null, 'Should parse time pattern');
      assert.strictEqual(parsed.hour, 7, 'Should extract hour');
      assert.strictEqual(parsed.period, 'PM', 'Should extract period');

      // Step 2: Calculate target time
      const now = new Date('2024-01-15T14:00:00'); // 2 PM
      const targetTime = TimeScheduler.calculateTargetTime(parsed.hour, parsed.period, now);

      assert.strictEqual(targetTime.getHours(), 19, 'Should convert to 7 PM (19:00)');
      assert.strictEqual(targetTime.getDate(), 15, 'Should be same day (not passed yet)');

      // Step 3: Calculate wait time
      const waitMs = targetTime.getTime() - now.getTime();
      assert.ok(waitMs > 0, 'Wait time should be positive');
      assert.strictEqual(waitMs, 5 * 60 * 60 * 1000, 'Should wait 5 hours');

      // Step 4: Simulate notification data
      const notificationData = {
        issueNumber: 123,
        issueTitle: issueTitle,
        targetTime: targetTime,
      };

      assert.ok(notificationData.issueNumber, 'Should have issue number');
      assert.ok(notificationData.issueTitle.includes('PM7'), 'Should include time pattern');
      assert.ok(notificationData.targetTime instanceof Date, 'Should have Date object');
    });

    it('should process issue with AM9 next-day scheduling', async () => {
      const issueTitle = 'AM9 Run database backup';

      // Current time: 11 PM (within 1 hour of AM9 tomorrow)
      const now = new Date('2024-01-15T23:00:00');

      // Step 1: Parse and calculate
      const parsed = TimeScheduler.parseTimeFromTitle(issueTitle);
      const targetTime = TimeScheduler.calculateTargetTime(parsed.hour, parsed.period, now);

      // Should schedule for next day
      assert.strictEqual(targetTime.getDate(), 16, 'Should schedule for next day');
      assert.strictEqual(targetTime.getHours(), 9, 'Should be 9 AM');

      // Step 2: Verify wait time
      const waitMs = targetTime.getTime() - now.getTime();
      assert.ok(waitMs > 0, 'Should have positive wait time');
      assert.ok(waitMs >= 10 * 60 * 60 * 1000, 'Should wait at least 10 hours');
    });

    it('should handle immediate execution for invalid time', async () => {
      const issueTitle = 'PM13 Invalid time test'; // Invalid hour

      // Step 1: Attempt to parse
      const parsed = TimeScheduler.parseTimeFromTitle(issueTitle);

      // Should return null for invalid time
      assert.strictEqual(parsed, null, 'Should reject invalid hour');

      // Step 2: Fall back to immediate execution
      const scheduleInfo = TimeScheduler.getWaitMilliseconds(issueTitle);
      assert.strictEqual(scheduleInfo, null, 'Should return null, triggering immediate execution');
    });

    it('should handle issue without time pattern', async () => {
      const issueTitle = 'Regular deployment without schedule';

      // Step 1: Attempt to parse
      const parsed = TimeScheduler.parseTimeFromTitle(issueTitle);
      assert.strictEqual(parsed, null, 'Should not find time pattern');

      // Step 2: Immediate execution path
      const scheduleInfo = TimeScheduler.getWaitMilliseconds(issueTitle);
      assert.strictEqual(scheduleInfo, null, 'Should trigger immediate execution');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle midnight deployment (AM12)', async () => {
      const issueTitle = 'AM12 Midnight maintenance window';
      const now = new Date('2024-01-15T20:00:00'); // 8 PM

      const parsed = TimeScheduler.parseTimeFromTitle(issueTitle);
      assert.strictEqual(parsed.hour, 12);
      assert.strictEqual(parsed.period, 'AM');

      const targetTime = TimeScheduler.calculateTargetTime(parsed.hour, parsed.period, now);
      assert.strictEqual(targetTime.getHours(), 0, 'Should be midnight (hour 0)');

      // Should be next day since current time is PM
      assert.ok(targetTime.getDate() === 16, 'Should be next day');
    });

    it('should handle noon deployment (PM12)', async () => {
      const issueTitle = 'PM12 Lunch time update';
      const now = new Date('2024-01-15T10:00:00'); // 10 AM

      const parsed = TimeScheduler.parseTimeFromTitle(issueTitle);
      assert.strictEqual(parsed.hour, 12);
      assert.strictEqual(parsed.period, 'PM');

      const targetTime = TimeScheduler.calculateTargetTime(parsed.hour, parsed.period, now);
      assert.strictEqual(targetTime.getHours(), 12, 'Should be noon (hour 12)');
      assert.strictEqual(targetTime.getDate(), 15, 'Should be same day');
    });

    it('should handle scheduling just before target time', async () => {
      const issueTitle = 'PM7 Last minute deployment';
      const now = new Date('2024-01-15T18:55:00'); // 6:55 PM, 5 minutes before 7 PM

      const parsed = TimeScheduler.parseTimeFromTitle(issueTitle);
      const targetTime = TimeScheduler.calculateTargetTime(parsed.hour, parsed.period, now);
      const waitMs = targetTime.getTime() - now.getTime();

      assert.ok(waitMs > 0, 'Should have positive wait time');
      assert.strictEqual(waitMs, 5 * 60 * 1000, 'Should wait exactly 5 minutes');
      assert.strictEqual(targetTime.getDate(), 15, 'Should be same day');
    });

    it('should handle scheduling just after target time', async () => {
      const issueTitle = 'PM7 Already passed deployment';
      const now = new Date('2024-01-15T19:05:00'); // 7:05 PM, 5 minutes after 7 PM

      const parsed = TimeScheduler.parseTimeFromTitle(issueTitle);
      const targetTime = TimeScheduler.calculateTargetTime(parsed.hour, parsed.period, now);
      const waitMs = targetTime.getTime() - now.getTime();

      // Should schedule for next day since target time has passed
      assert.ok(waitMs > 0, 'Should have positive wait time');
      assert.strictEqual(targetTime.getDate(), 16, 'Should be next day');
      assert.strictEqual(targetTime.getHours(), 19, 'Should be 7 PM');

      // Should wait approximately 23 hours 55 minutes
      const expectedWaitMs = (23 * 60 + 55) * 60 * 1000;
      assert.strictEqual(waitMs, expectedWaitMs, 'Should wait until 7 PM next day');
    });

    it('should handle early morning AM scheduling', async () => {
      const issueTitle = 'AM6 Early morning backup';
      const now = new Date('2024-01-15T03:00:00'); // 3 AM

      const scheduleInfo = TimeScheduler.getWaitMilliseconds(issueTitle);

      assert.notStrictEqual(scheduleInfo, null, 'Should schedule');
      assert.ok(scheduleInfo.waitMs > 0, 'Should have positive wait time');
      assert.ok(scheduleInfo.waitMs >= 3 * 60 * 60 * 1000, 'Should wait at least 3 hours');
      assert.strictEqual(scheduleInfo.targetTime.getHours(), 6, 'Should be 6 AM');
    });
  });

  describe('Edge case handling', () => {
    it('should handle multiple time patterns in title (use first)', () => {
      const issueTitle = 'PM7 deployment or AM9 backup';

      const parsed = TimeScheduler.parseTimeFromTitle(issueTitle);
      assert.notStrictEqual(parsed, null, 'Should parse first pattern');
      assert.strictEqual(parsed.hour, 7, 'Should use first time found');
      assert.strictEqual(parsed.period, 'PM', 'Should use first period');
    });

    it('should handle time pattern with extra spaces', () => {
      const titles = [
        'PM  7',    // Extra space
        'PM   7',   // Multiple spaces
        'PM\t7',    // Tab character (won't match, but should not crash)
      ];

      for (const title of titles) {
        const parsed = TimeScheduler.parseTimeFromTitle(title);
        // Some may parse, some may not, but should not throw
        assert.ok(true, `Handled: ${title}`);
      }
    });

    it('should handle time pattern at end of title', () => {
      const issueTitle = 'Deploy to production PM7';

      const parsed = TimeScheduler.parseTimeFromTitle(issueTitle);
      assert.notStrictEqual(parsed, null, 'Should parse time at end');
      assert.strictEqual(parsed.hour, 7);
      assert.strictEqual(parsed.period, 'PM');
    });

    it('should handle very long issue titles', () => {
      const issueTitle = 'PM7 ' + 'a'.repeat(1000) + ' very long title';

      const parsed = TimeScheduler.parseTimeFromTitle(issueTitle);
      assert.notStrictEqual(parsed, null, 'Should parse time in long title');
      assert.strictEqual(parsed.hour, 7);
    });
  });
});
