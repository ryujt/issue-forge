import { BaseProvider } from './base-provider.js';
import { RateLimitError } from '../utils/process.js';
import { logger } from '../utils/logger.js';
import { execa } from 'execa';

export class ClaudeProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.model = config.model || 'sonnet';
    this.maxTokens = config.maxTokens || 64000;
  }

  async execute(prompt, options = {}) {
    const startTime = Date.now();
    const model = options.model || this.model;

    logger.info(`Claude executing with model: ${model}`);
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
        throw new Error(`Claude timed out after ${duration}s`);
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
      if (error instanceof RateLimitError) {
        throw error;
      }
      logger.error(`Claude execution failed: ${error.message}`);
      throw error;
    }
  }
}
