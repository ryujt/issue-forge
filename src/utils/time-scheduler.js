export class TimeScheduler {
  static TIME_PATTERNS = [
    /(?:^|\s)(AM|PM)\s*(\d{1,2})(?:\s|$)/i,
    /(?:^|\s)(AM|PM)(\d{1,2})(?:\s|$)/i,
  ];

  static parseTimeFromTitle(title) {
    for (const pattern of TimeScheduler.TIME_PATTERNS) {
      const match = title.match(pattern);
      if (match) {
        const period = match[1].toUpperCase();
        const hour = parseInt(match[2], 10);

        if (hour < 1 || hour > 12) {
          continue;
        }

        return { hour, period };
      }
    }

    return null;
  }

  static calculateTargetTime(hour, period, now = new Date()) {
    let targetHour;

    if (period === 'PM' && hour !== 12) {
      targetHour = hour + 12;
    } else if (period === 'AM' && hour === 12) {
      targetHour = 0;
    } else {
      targetHour = hour;
    }

    const target = new Date(now);
    target.setHours(targetHour, 0, 0, 0);

    const diffMs = now.getTime() - target.getTime();
    const oneHourMs = 60 * 60 * 1000;

    // If more than 1 hour has passed, schedule for next day
    if (diffMs > oneHourMs) {
      target.setDate(target.getDate() + 1);
    }

    return target;
  }

  static getWaitMilliseconds(title) {
    const parsed = TimeScheduler.parseTimeFromTitle(title);
    if (!parsed) {
      return null;
    }

    const { hour, period } = parsed;
    const now = new Date();
    const targetTime = TimeScheduler.calculateTargetTime(hour, period, now);

    const waitMs = targetTime.getTime() - now.getTime();

    if (waitMs < 0) {
      return null;
    }

    return {
      waitMs,
      targetTime,
    };
  }
}
