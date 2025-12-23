import { BaseProvider } from './base-provider.js';
import { executeCommand, RateLimitError } from '../utils/process.js';
import { logger } from '../utils/logger.js';

export class ClaudeProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.model = config.model || 'opus';
    this.maxTokens = config.maxTokens || 64000;
  }

  buildArgs(prompt, options = {}) {
    const args = [
      '--print',
      '--dangerously-skip-permissions',
    ];

    if (options.cwd) {
      args.push('--cwd', options.cwd);
    }

    if (options.model || this.model) {
      args.push('--model', options.model || this.model);
    }

    args.push(prompt);

    return args;
  }

  async execute(prompt, options = {}) {
    const args = this.buildArgs(prompt, options);
    const startTime = Date.now();

    logger.debug(`Claude executing with model: ${options.model || this.model}`);

    try {
      const result = await executeCommand('claude', args, {
        cwd: options.cwd,
        timeout: options.timeout || 600000,
      });

      const duration = Math.round((Date.now() - startTime) / 1000);

      return {
        output: result.stdout,
        duration,
        model: options.model || this.model,
        provider: 'claude',
      };
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      logger.error(`Claude execution failed: ${error.message}`);
      throw error;
    }
  }
}
