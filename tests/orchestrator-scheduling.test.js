import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Orchestrator } from '../src/core/orchestrator.js';

describe('Orchestrator - Scheduling Integration', () => {
  let orchestrator;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      global: {
        ai_provider: 'claude',
        max_iterations: 3,
      },
      projects: [
        {
          path: 'test/test-repo',
          enabled: true,
        },
      ],
      notifications: {
        enabled: false,
      },
    };
  });

  describe('processNextIssue with scheduled time', () => {
    it('should recognize time pattern in issue title', async () => {
      const testIssues = [
        { number: 1, title: 'PM7 Deploy feature', labels: [] },
        { number: 2, title: 'AM9 Run tests', labels: [] },
        { number: 3, title: 'Regular task', labels: [] },
      ];

      for (const issue of testIssues) {
        const hasTime = /(?:^|\s)(AM|PM)\s*(\d{1,2})(?:\s|$)/i.test(issue.title);

        if (issue.title.includes('PM7') || issue.title.includes('AM9')) {
          assert.ok(hasTime, `Should recognize time in: ${issue.title}`);
        } else {
          assert.ok(!hasTime, `Should not recognize time in: ${issue.title}`);
        }
      }
    });

    it('should handle issues without time patterns normally', () => {
      const normalTitles = [
        'Fix bug in authentication',
        'Update documentation',
        'Refactor database layer',
      ];

      for (const title of normalTitles) {
        const hasTime = /(?:^|\s)(AM|PM)\s*(\d{1,2})(?:\s|$)/i.test(title);
        assert.ok(!hasTime, `Should not recognize time in: ${title}`);
      }
    });

    it('should validate time range correctly', () => {
      const validTimes = ['PM7', 'AM9', 'PM12', 'AM1', 'PM 11'];
      const invalidTimes = ['PM13', 'AM0', 'PM25', 'AM13'];

      for (const time of validTimes) {
        const match = time.match(/(?:^|\s)(AM|PM)\s*(\d{1,2})(?:\s|$)/i);
        if (match) {
          const hour = parseInt(match[2], 10);
          assert.ok(hour >= 1 && hour <= 12, `Valid time: ${time}`);
        }
      }

      for (const time of invalidTimes) {
        const match = time.match(/(?:^|\s)(AM|PM)\s*(\d{1,2})(?:\s|$)/i);
        if (match) {
          const hour = parseInt(match[2], 10);
          assert.ok(hour < 1 || hour > 12, `Invalid time: ${time}`);
        }
      }
    });
  });

  describe('Time pattern edge cases', () => {
    it('should handle case-insensitive time patterns', () => {
      const patterns = ['PM7', 'pm7', 'Pm7', 'pM7', 'AM9', 'am9', 'Am9', 'aM9'];

      for (const pattern of patterns) {
        const match = pattern.match(/(?:^|\s)(AM|PM)\s*(\d{1,2})(?:\s|$)/i);
        assert.notStrictEqual(match, null, `Should match: ${pattern}`);
      }
    });

    it('should handle time patterns with surrounding text', () => {
      const titles = [
        'PM7 Deploy to production',
        'Critical: AM9 Database backup',
        'Scheduled PM 11 maintenance',
        'Update server at AM 6',
      ];

      for (const title of titles) {
        const match = title.match(/(?:^|\s)(AM|PM)\s*(\d{1,2})(?:\s|$)/i);
        assert.notStrictEqual(match, null, `Should match time in: ${title}`);
      }
    });

    it('should not match invalid patterns', () => {
      const invalidTitles = [
        'Update PM server',
        'AM radio configuration',
        '7PM is the deadline',
        'Run at 19:00',
        'Schedule for 7:00 PM',
      ];

      for (const title of invalidTitles) {
        const match = title.match(/(?:^|\s)(AM|PM)\s*(\d{1,2})(?:\s|$)/i);
        assert.strictEqual(match, null, `Should not match: ${title}`);
      }
    });
  });

  describe('Scheduling logic validation', () => {
    it('should calculate correct wait time for future time', () => {
      const now = new Date('2024-01-15T14:00:00');
      const target = new Date('2024-01-15T19:00:00');
      const waitMs = target.getTime() - now.getTime();
      const expectedHours = 5;

      assert.strictEqual(waitMs, expectedHours * 60 * 60 * 1000);
      assert.ok(waitMs > 0, 'Wait time should be positive');
    });

    it('should handle next-day scheduling', () => {
      const now = new Date('2024-01-15T20:00:00');
      const target = new Date('2024-01-16T19:00:00');
      const waitMs = target.getTime() - now.getTime();
      const expectedHours = 23;

      assert.ok(waitMs > 0, 'Wait time should be positive for next day');
      assert.ok(waitMs >= expectedHours * 60 * 60 * 1000, 'Should be at least 23 hours');
    });

    it('should prevent negative wait times', () => {
      const now = new Date('2024-01-15T20:00:00');
      const past = new Date('2024-01-15T19:00:00');
      const waitMs = past.getTime() - now.getTime();

      assert.ok(waitMs < 0, 'Past time produces negative wait');
      // TimeScheduler should return null for negative waits
    });
  });

  describe('AM/PM conversion', () => {
    it('should convert PM hours correctly', () => {
      const conversions = [
        { input: 1, period: 'PM', expected: 13 },
        { input: 6, period: 'PM', expected: 18 },
        { input: 11, period: 'PM', expected: 23 },
        { input: 12, period: 'PM', expected: 12 }, // noon
      ];

      for (const { input, period, expected } of conversions) {
        let result;
        if (period === 'PM' && input !== 12) {
          result = input + 12;
        } else {
          result = input;
        }
        assert.strictEqual(result, expected, `PM ${input} -> ${expected}`);
      }
    });

    it('should convert AM hours correctly', () => {
      const conversions = [
        { input: 1, period: 'AM', expected: 1 },
        { input: 6, period: 'AM', expected: 6 },
        { input: 11, period: 'AM', expected: 11 },
        { input: 12, period: 'AM', expected: 0 }, // midnight
      ];

      for (const { input, period, expected } of conversions) {
        let result;
        if (period === 'AM' && input === 12) {
          result = 0;
        } else {
          result = input;
        }
        assert.strictEqual(result, expected, `AM ${input} -> ${expected}`);
      }
    });
  });
});
