import { GitHubClient } from '../github/client.js';
import { IssueProcessor } from './issue-processor.js';
import { createProvider } from '../providers/index.js';
import { logger } from '../utils/logger.js';
import { sleep, RateLimitError, waitForRateLimit } from '../utils/process.js';

export class Orchestrator {
  constructor(config) {
    this.config = config;
    this.provider = createProvider(config.global.ai_provider);
    this.processor = new IssueProcessor(this.provider, {
      maxIterations: config.global.max_iterations || 3,
    });
    this.running = false;
    this.projectStates = new Map();
  }

  async start() {
    this.running = true;
    logger.info('Issue Forge started');
    logger.info(`Monitoring ${this.config.projects.length} project(s)`);
    logger.info(`AI Provider: ${this.config.global.ai_provider}`);

    await this.initializeProjects();
    await this.runLoop();
  }

  stop() {
    this.running = false;
    logger.info('Issue Forge stopping...');
  }

  async initializeProjects() {
    for (const project of this.config.projects) {
      try {
        const github = new GitHubClient(project.path);
        await github.initialize();

        this.projectStates.set(project.path, {
          github,
          lastProcessedIssue: null,
          processedIssues: new Set(),
        });

        logger.info(`Initialized project: ${project.path}`);
      } catch (error) {
        logger.error(`Failed to initialize project ${project.path}: ${error.message}`);
      }
    }
  }

  async runLoop() {
    while (this.running) {
      let hasProcessedAny = false;

      for (const project of this.config.projects) {
        if (!this.running) break;

        const state = this.projectStates.get(project.path);
        if (!state) continue;

        try {
          const processed = await this.processNextIssue(project.path, state);
          if (processed) {
            hasProcessedAny = true;
          }
        } catch (error) {
          if (error instanceof RateLimitError) {
            await waitForRateLimit(error.retryAfter);
            hasProcessedAny = true;
          } else {
            logger.error(`Error processing project ${project.path}: ${error.message}`);
          }
        }
      }

      if (!hasProcessedAny) {
        logger.info(`No issues to process. Waiting ${this.config.global.polling_interval}s...`);
        await sleep(this.config.global.polling_interval * 1000);
      }
    }

    logger.info('Issue Forge stopped');
  }

  async processNextIssue(projectPath, state) {
    const issues = await state.github.fetchOpenIssues();

    let unprocessedIssue = null;

    for (const issue of issues) {
      if (state.processedIssues.has(issue.number)) {
        continue;
      }

      const labels = issue.labels?.map(l => l.name) || [];
      if (labels.includes('issue-forge:needs-human')) {
        logger.debug(`Issue #${issue.number} needs human intervention, skipping`);
        state.processedIssues.add(issue.number);
        continue;
      }

      const prCheck = await state.github.hasExistingPR(issue.number);
      if (prCheck.exists) {
        logger.debug(`Issue #${issue.number} already has PR #${prCheck.pr.number}, skipping`);
        state.processedIssues.add(issue.number);
        continue;
      }

      unprocessedIssue = issue;
      break;
    }

    if (!unprocessedIssue) {
      return false;
    }

    logger.info(`Processing issue #${unprocessedIssue.number}: ${unprocessedIssue.title}`);

    try {
      const result = await this.processor.process(projectPath, unprocessedIssue);

      state.processedIssues.add(unprocessedIssue.number);
      state.lastProcessedIssue = unprocessedIssue.number;

      if (result.status === 'success') {
        logger.info(`Issue #${unprocessedIssue.number} resolved → PR #${result.pr}`);
      } else {
        logger.warn(`Issue #${unprocessedIssue.number} escalated`);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to process issue #${unprocessedIssue.number}: ${error.message}`);
      state.processedIssues.add(unprocessedIssue.number);
      return true;
    }
  }

  getStatus() {
    const projects = [];

    for (const [path, state] of this.projectStates) {
      projects.push({
        path,
        processedCount: state.processedIssues.size,
        lastProcessed: state.lastProcessedIssue,
      });
    }

    return {
      running: this.running,
      provider: this.config.global.ai_provider,
      projects,
    };
  }
}
