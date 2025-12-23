import { BaseProvider } from './base-provider.js';
import { executeCommand, RateLimitError } from '../utils/process.js';
import { logger } from '../utils/logger.js';

export class GeminiProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.model = config.model || 'pro';
  }

  buildArgs(prompt, options = {}) {
    const args = [];

    if (options.model || this.model) {
      args.push('-m', options.model || this.model);
    }

    args.push(prompt);

    return args;
  }

  async execute(prompt, options = {}) {
    const args = this.buildArgs(prompt, options);
    const startTime = Date.now();

    logger.debug(`Gemini executing with model: ${options.model || this.model}`);

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
