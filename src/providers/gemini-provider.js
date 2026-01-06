import { BaseProvider } from './base-provider.js';
import { executeCommand, RateLimitError, TimeoutError, sleep } from '../utils/process.js';
import { logger } from '../utils/logger.js';

export class GeminiProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.model = config.model || 'pro';
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 30000;
  }

  buildArgs(prompt, options = {}) {
    const args = [];

    if (options.model || this.model) {
      args.push('-m', options.model || this.model);
    }

    args.push(prompt);

    return args;
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

  async execute(prompt, options = {}) {
    const maxRetries = options.maxRetries || this.maxRetries;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeOnce(prompt, { ...options, attempt });
        return result;
      } catch (error) {
        lastError = error;

        if (error instanceof RateLimitError) {
          throw error;
        }

        if (attempt < maxRetries && this.isRetryableError(error)) {
          const delay = this.retryDelay * attempt;
          logger.warn(`Gemini error on attempt ${attempt}/${maxRetries}: ${error.message}. Retrying in ${delay / 1000}s...`);
          await sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  async executeOnce(prompt, options = {}) {
    const args = this.buildArgs(prompt, options);
    const startTime = Date.now();
    const attempt = options.attempt || 1;

    logger.debug(`Gemini executing with model: ${options.model || this.model} (attempt ${attempt})`);

    try {
      const result = await executeCommand('gemini', args, {
        cwd: options.cwd,
        timeout: options.timeout || 600000,
      });

      const duration = Math.round((Date.now() - startTime) / 1000);

      return {
        output: result.stdout,
        duration,
        model: options.model || this.model,
        provider: 'gemini',
      };
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      logger.error(`Gemini execution failed: ${error.message}`);
      throw error;
    }
  }
}
