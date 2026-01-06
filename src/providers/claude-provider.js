import { BaseProvider } from './base-provider.js';
import { RateLimitError, TimeoutError, sleep } from '../utils/process.js';
import { logger } from '../utils/logger.js';
import { execa } from 'execa';

export class ClaudeProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.model = config.model || 'sonnet';
    this.maxTokens = config.maxTokens || 64000;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 30000;
  }

  async execute(prompt, options = {}) {
    const model = options.model || this.model;
    const maxRetries = options.maxRetries || this.maxRetries;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeOnce(prompt, { ...options, model, attempt });
        return result;
      } catch (error) {
        lastError = error;

        if (error instanceof RateLimitError) {
          throw error;
        }

        if (error instanceof TimeoutError && attempt < maxRetries) {
          const delay = this.retryDelay * attempt;
          logger.warn(`Timeout on attempt ${attempt}/${maxRetries}. Retrying in ${delay / 1000}s...`);
          await sleep(delay);
          continue;
        }

        if (attempt < maxRetries && this.isRetryableError(error)) {
          const delay = this.retryDelay * attempt;
          logger.warn(`Error on attempt ${attempt}/${maxRetries}: ${error.message}. Retrying in ${delay / 1000}s...`);
          await sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  isRetryableError(error) {
    const retryablePatterns = [
      /timed out/i,
      /timeout/i,
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /network/i,
      /socket hang up/i,
    ];
    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  async executeOnce(prompt, options = {}) {
    const startTime = Date.now();
    const model = options.model || this.model;
    const attempt = options.attempt || 1;

    logger.info(`Claude executing with model: ${model} (attempt ${attempt})`);
    logger.info(`Working directory: ${options.cwd}`);

    const args = [
      '--print',
      '--dangerously-skip-permissions',
      '--model', model,
      prompt,
    ];

    try {
      const result = await execa('claude', args, {
        cwd: options.cwd,
        timeout: options.timeout || 600000,
        reject: false,
        stdin: 'ignore',
        env: {
          ...process.env,
          NO_COLOR: '1',
        },
      });

      const duration = Math.round((Date.now() - startTime) / 1000);

      if (result.timedOut) {
        throw new TimeoutError(`Claude timed out after ${duration}s`, duration);
      }

      if (result.exitCode !== 0) {
        const output = result.stdout + result.stderr;
        if (/rate limit/i.test(output) || /429/.test(output)) {
          throw new RateLimitError('Rate limit hit', 60);
        }
        throw new Error(`Claude failed (exit ${result.exitCode}): ${output.slice(0, 200)}`);
      }

      logger.info(`Claude completed in ${duration}s`);

      return {
        output: result.stdout,
        duration,
        model,
        provider: 'claude',
      };
    } catch (error) {
      if (error instanceof RateLimitError || error instanceof TimeoutError) {
        throw error;
      }
      logger.error(`Claude execution failed: ${error.message}`);
      throw error;
    }
  }
}
