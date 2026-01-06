import { execa } from 'execa';
import { logger } from './logger.js';

const RATE_LIMIT_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /429/,
  /quota exceeded/i,
];

const RETRY_AFTER_PATTERNS = [
  /retry after (\d+)/i,
  /wait (\d+) seconds/i,
];

export class RateLimitError extends Error {
  constructor(message, retryAfter = 60) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class TimeoutError extends Error {
  constructor(message, duration) {
    super(message);
    this.name = 'TimeoutError';
    this.duration = duration;
  }
}

function extractRetryAfter(output) {
  for (const pattern of RETRY_AFTER_PATTERNS) {
    const match = output.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return 60;
}

function isRateLimited(output) {
  return RATE_LIMIT_PATTERNS.some(pattern => pattern.test(output));
}

export async function executeCommand(command, args, options = {}) {
  const { cwd, timeout = 1800000 } = options;

  logger.debug(`Executing: ${command} ${args.join(' ').slice(0, 100)}...`);

  try {
    const result = await execa(command, args, {
      cwd,
      timeout,
      reject: false,
      buffer: true,
      maxBuffer: 1024 * 1024 * 50,
    });

    const output = result.stdout + result.stderr;

    if (result.timedOut) {
      throw new Error(`Command timed out after ${timeout / 1000}s`);
    }

    if (isRateLimited(output)) {
      const retryAfter = extractRetryAfter(output);
      throw new RateLimitError(`Rate limit hit for ${command}`, retryAfter);
    }

    if (result.exitCode !== 0 && result.exitCode !== null) {
      throw new Error(`Command failed with exit code ${result.exitCode}: ${output.slice(0, 500)}`);
    }

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }
    throw new Error(`Failed to execute ${command}: ${error.message}`);
  }
}

export async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForRateLimit(seconds) {
  logger.warn(`Rate limit hit. Waiting ${seconds} seconds...`);

  for (let remaining = seconds; remaining > 0; remaining -= 10) {
    await sleep(Math.min(remaining, 10) * 1000);
    if (remaining > 10) {
      logger.info(`Rate limit: ${remaining - 10}s remaining...`);
    }
  }

  logger.info('Rate limit wait complete. Resuming...');
}
