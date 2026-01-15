import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TimeScheduler } from '../src/utils/time-scheduler.js';

describe('TimeScheduler', () => {
  describe('parseTimeFromTitle', () => {
    it('should parse various time formats', () => {
      const testCases = [
        { title: 'PM7', expected: { hour: 7, period: 'PM' } },
        { title: 'PM 7', expected: { hour: 7, period: 'PM' } },
        { title: 'PM07', expected: { hour: 7, period: 'PM' } },
        { title: 'PM 07', expected: { hour: 7, period: 'PM' } },
        { title: 'AM9', expected: { hour: 9, period: 'AM' } },
        { title: 'pm7', expected: { hour: 7, period: 'PM' } },
        { title: 'PM7 Deployment', expected: { hour: 7, period: 'PM' } },
        { title: 'Deploy at PM 7', expected: { hour: 7, period: 'PM' } },
      ];

      for (const { title, expected } of testCases) {
        const result = TimeScheduler.parseTimeFromTitle(title);
        assert.deepStrictEqual(result, expected, `Failed for title: ${title}`);
      }
    });

    it('should return null for invalid times', () => {
      const invalidTitles = [
        'Invalid',
        'PM13',
        'PM25',
        'AM0',
        'PM',
        'AM',
        'Regular deployment',
      ];

      for (const title of invalidTitles) {
        const result = TimeScheduler.parseTimeFromTitle(title);
        assert.strictEqual(result, null, `Expected null for: ${title}`);
      }
    });

    it('should handle edge cases', () => {
      assert.deepStrictEqual(TimeScheduler.parseTimeFromTitle('PM12'), { hour: 12, period: 'PM' });
      assert.deepStrictEqual(TimeScheduler.parseTimeFromTitle('AM12'), { hour: 12, period: 'AM' });
      assert.deepStrictEqual(TimeScheduler.parseTimeFromTitle('PM1'), { hour: 1, period: 'PM' });
      assert.deepStrictEqual(TimeScheduler.parseTimeFromTitle('AM1'), { hour: 1, period: 'AM' });
    });
  });

  describe('calculateTargetTime', () => {
    it('should schedule for next day if more than 1 hour has passed', () => {
      const now = new Date('2024-01-15T11:00:00'); // 2 hours after 9 AM
      const target = TimeScheduler.calculateTargetTime(9, 'AM', now);

      assert.strictEqual(target.getDate(), 16);
      assert.strictEqual(target.getHours(), 9);
      assert.strictEqual(target.getMinutes(), 0);
    });

    it('should schedule AM time for same day if not passed', () => {
      const now = new Date('2024-01-15T07:30:00');
      const target = TimeScheduler.calculateTargetTime(9, 'AM', now);

      assert.strictEqual(target.getDate(), 15);
      assert.strictEqual(target.getHours(), 9);
    });

    it('should schedule PM time for same day if not passed', () => {
      const now = new Date('2024-01-15T14:00:00');
      const target = TimeScheduler.calculateTargetTime(7, 'PM', now);

      assert.strictEqual(target.getDate(), 15);
      assert.strictEqual(target.getHours(), 19);
    });

    it('should return same day target if within 1 hour after target time', () => {
      const now = new Date('2024-01-15T19:30:00'); // 30 min after 7 PM
      const target = TimeScheduler.calculateTargetTime(7, 'PM', now);

      assert.strictEqual(target.getDate(), 15);
      assert.strictEqual(target.getHours(), 19);
    });

    it('should schedule for next day if more than 1 hour after target time', () => {
      const now = new Date('2024-01-15T20:30:00'); // 1.5 hours after 7 PM
      const target = TimeScheduler.calculateTargetTime(7, 'PM', now);

      assert.strictEqual(target.getDate(), 16);
      assert.strictEqual(target.getHours(), 19);
    });

    it('should handle midnight (12 AM) correctly', () => {
      const now = new Date('2024-01-15T14:00:00');
      const target = TimeScheduler.calculateTargetTime(12, 'AM', now);

      assert.strictEqual(target.getHours(), 0);
    });

    it('should handle noon (12 PM) correctly', () => {
      const now = new Date('2024-01-15T10:00:00');
      const target = TimeScheduler.calculateTargetTime(12, 'PM', now);

      assert.strictEqual(target.getHours(), 12);
    });

    it('should convert PM hours correctly', () => {
      const now = new Date('2024-01-15T10:00:00');

      assert.strictEqual(TimeScheduler.calculateTargetTime(1, 'PM', now).getHours(), 13);
      assert.strictEqual(TimeScheduler.calculateTargetTime(6, 'PM', now).getHours(), 18);
      assert.strictEqual(TimeScheduler.calculateTargetTime(11, 'PM', now).getHours(), 23);
    });
  });

  describe('getWaitMilliseconds', () => {
    it('should return wait time and target for valid time', () => {
      const result = TimeScheduler.getWaitMilliseconds('PM7 Deployment');

      assert.notStrictEqual(result, null);
      assert.ok(result.waitMs >= 0);
      assert.ok(result.targetTime instanceof Date);
    });

    it('should return null for title without time', () => {
      const result = TimeScheduler.getWaitMilliseconds('Regular deployment');

      assert.strictEqual(result, null);
    });

    it('should not return negative wait time', () => {
      const result = TimeScheduler.getWaitMilliseconds('PM7');

      if (result !== null) {
        assert.ok(result.waitMs >= 0);
      }
    });
  });
});
