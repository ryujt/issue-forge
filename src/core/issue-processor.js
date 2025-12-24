import { MemoryFile } from '../memory/memory-file.js';
import { createAgents } from '../agents/index.js';
import { GitHubClient } from '../github/client.js';
import { logger } from '../utils/logger.js';
import { RateLimitError, waitForRateLimit } from '../utils/process.js';

export class IssueProcessor {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.maxIterations = options.maxIterations || 3;
  }

  async process(projectPath, issue) {
    const github = new GitHubClient(projectPath);
    await github.initialize();

    const memory = new MemoryFile(projectPath, issue.number);
    await memory.initialize(issue);

    const agents = createAgents(this.provider);
    const branchName = `issue-forge/issue-${issue.number}`;

    logger.info(`Processing issue #${issue.number}: ${issue.title}`);

    await github.createBranch(branchName);

    let result = null;
    let iteration = 0;
    let previousFailure = null;

    while (iteration < this.maxIterations) {
      iteration = memory.startNewIteration();
      logger.info(`Starting iteration ${iteration}/${this.maxIterations}`);

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

    await memory.addFinalSummary({
      iterations: memory.currentIteration,
      result: 'APPROVED - PR Created',
    });

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

    await memory.addFinalSummary({
      iterations: memory.currentIteration,
      result: 'ESCALATED - Human intervention required',
    });

    logger.warn(`Issue #${issue.number} escalated after ${this.maxIterations} failed attempts`);
  }
}
