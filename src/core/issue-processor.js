import { MemoryFile } from '../memory/memory-file.js';
import { createAgents } from '../agents/index.js';
import { GitHubClient } from '../github/client.js';
import { logger } from '../utils/logger.js';
import { RateLimitError, waitForRateLimit } from '../utils/process.js';

export class IssueProcessor {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.maxIterations = options.maxIterations || 3;
    this.notificationService = options.notificationService;
  }

  async process(projectConfig, issue) {
    const projectPath = projectConfig.path;
    const baseBranch = projectConfig.base_branch || 'main';

    const github = new GitHubClient(projectPath, { baseBranch });
    await github.initialize();

    const agents = createAgents(this.provider, {
      notificationService: this.notificationService,
    });
    const branchName = `issue-forge/issue-${issue.number}`;

    logger.info(`Processing issue #${issue.number}: ${issue.title} (base: ${baseBranch})`);

    await github.addLabel(issue.number, 'issue-forge:in-progress');
    await github.createBranch(branchName);

    const memory = new MemoryFile(projectPath, issue.number);
    await memory.initialize(issue);

    let result = null;
    let iteration = 0;
    let previousFailure = null;

    try {
      while (iteration < this.maxIterations) {
        iteration = memory.startNewIteration();
        logger.info(`Starting iteration ${iteration}/${this.maxIterations}`);

        if (this.notificationService) {
          await this.notificationService.notifyIssueStart({
            issueNumber: issue.number,
            issueTitle: issue.title,
            projectPath,
            iteration,
            maxIterations: this.maxIterations,
          });
        }

        try {
          result = await this.runIteration({
            agents,
            issue,
            memory,
            projectPath,
            isRetry: iteration > 1,
            previousFailure,
          });

          if (result.approved) {
            logger.info(`Iteration ${iteration} approved!`);
            break;
          }

          previousFailure = {
            reason: result.reasons?.join(', ') || 'Unknown',
            feedback: result.feedback || [],
          };

          logger.warn(`Iteration ${iteration} rejected. Retrying...`);
        } catch (error) {
          if (error instanceof RateLimitError) {
            await waitForRateLimit(error.retryAfter);
            iteration--;
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      // Clean up on unexpected error
      logger.error(`Unexpected error during processing: ${error.message}`);
      await github.removeLabel(issue.number, 'issue-forge:in-progress');
      throw error;
    }

    if (result?.approved) {
      return await this.createPullRequest(github, issue, memory, branchName);
    }

    await this.escalateToHuman(github, issue, memory);
    return { status: 'escalated', issue: issue.number };
  }

  async runIteration(context) {
    const { agents, issue, memory, projectPath, isRetry, previousFailure } = context;

    const strategy = await agents.strategist.execute({
      issue,
      memory,
      projectPath,
      isRetry,
      previousFailure,
    });

    const design = await agents.architect.execute({
      issue,
      memory,
      projectPath,
      strategy,
    });

    const implementation = await agents.coder.execute({
      issue,
      memory,
      projectPath,
      design,
    });

    const testResults = await agents.tester.execute({
      issue,
      memory,
      projectPath,
      implementation,
    });

    const review = await agents.reviewer.execute({
      issue,
      memory,
      projectPath,
      testResults,
    });

    return review;
  }

  async createPullRequest(github, issue, memory, branchName) {
    const title = `Fix #${issue.number}: ${issue.title}`;
    const body = `## Summary
This PR addresses issue #${issue.number}.

## Changes
See the implementation details in the linked issue.

## Memory File
The full agent collaboration log is available in \`.issue-forge/issue-${issue.number}.md\`

---
*Automated by Issue Forge*`;

    await github.commitAndPush(`fix: resolve issue #${issue.number}`);
    const pr = await github.createPullRequest(title, body, branchName);
    await github.removeLabel(issue.number, 'issue-forge:in-progress');

    await memory.addFinalSummary({
      iterations: memory.currentIteration,
      result: 'APPROVED - PR Created',
    });

    if (this.notificationService) {
      await this.notificationService.notifyAnalysisComplete({
        issueNumber: issue.number,
        issueTitle: issue.title,
        status: 'success',
        prNumber: pr.number,
        prUrl: pr.html_url,
      });
    }

    return {
      status: 'success',
      issue: issue.number,
      pr: pr.number,
      url: pr.html_url,
    };
  }

  async escalateToHuman(github, issue, memory) {
    const comment = `## Issue Forge - Escalation Required

After ${this.maxIterations} attempts, Issue Forge was unable to fully resolve this issue automatically.

Please review the agent collaboration log in \`.issue-forge/issue-${issue.number}.md\` for details on what was attempted.

---
*Automated by Issue Forge*`;

    await github.addIssueComment(issue.number, comment);
    await github.removeLabel(issue.number, 'issue-forge:in-progress');
    await github.addLabel(issue.number, 'issue-forge:needs-human');

    await memory.addFinalSummary({
      iterations: memory.currentIteration,
      result: 'ESCALATED - Human intervention required',
    });

    if (this.notificationService) {
      await this.notificationService.notifyAnalysisComplete({
        issueNumber: issue.number,
        issueTitle: issue.title,
        status: 'escalated',
        iterationCount: memory.currentIteration,
      });
    }

    logger.warn(`Issue #${issue.number} escalated after ${this.maxIterations} failed attempts`);
  }
}
