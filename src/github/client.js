import { Octokit } from '@octokit/rest';
import { executeCommand } from '../utils/process.js';
import { logger } from '../utils/logger.js';

async function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  try {
    const result = await executeCommand('gh', ['auth', 'token']);
    return result.stdout.trim();
  } catch (error) {
    logger.warn('Failed to get token from gh CLI. Run "gh auth login" first.');
    return null;
  }
}

export class GitHubClient {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.octokit = null;
    this.owner = null;
    this.repo = null;
  }

  async initialize() {
    const token = await getGitHubToken();
    this.octokit = new Octokit({ auth: token });

    const remote = await this.getRemoteUrl();
    const parsed = this.parseGitHubUrl(remote);
    this.owner = parsed.owner;
    this.repo = parsed.repo;
    logger.debug(`GitHub client initialized for ${this.owner}/${this.repo}`);
  }

  async getRemoteUrl() {
    const result = await executeCommand('git', ['remote', 'get-url', 'origin'], {
      cwd: this.projectPath,
    });
    return result.stdout.trim();
  }

  parseGitHubUrl(url) {
    const patterns = [
      /github\.com(?:-[^:]+)?[:/]([^/]+)\/(.+?)(?:\.git)?$/,
      /github\.com(?:-[^/]+)?\/([^/]+)\/(.+?)(?:\.git)?$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { owner: match[1], repo: match[2] };
      }
    }

    throw new Error(`Cannot parse GitHub URL: ${url}`);
  }

  async fetchOpenIssues() {
    const { data: issues } = await this.octokit.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      state: 'open',
      sort: 'created',
      direction: 'asc',
      per_page: 100,
    });

    return issues.filter(issue => !issue.pull_request);
  }

  async hasExistingPR(issueNumber) {
    const branchName = `issue-forge/issue-${issueNumber}`;

    const { data: prs } = await this.octokit.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: 'open',
      head: `${this.owner}:${branchName}`,
    });

    if (prs.length > 0) {
      return { exists: true, pr: prs[0] };
    }

    const { data: allPrs } = await this.octokit.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: 'open',
      per_page: 100,
    });

    const linkedPR = allPrs.find(pr =>
      pr.title.includes(`#${issueNumber}`) ||
      pr.body?.includes(`#${issueNumber}`)
    );

    if (linkedPR) {
      return { exists: true, pr: linkedPR };
    }

    return { exists: false };
  }

  async addLabel(issueNumber, label) {
    try {
      await this.octokit.issues.addLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        labels: [label],
      });
    } catch (error) {
      logger.debug(`Failed to add label: ${error.message}`);
    }
  }

  async removeLabel(issueNumber, label) {
    try {
      await this.octokit.issues.removeLabel({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        name: label,
      });
    } catch (error) {
      logger.debug(`Failed to remove label: ${error.message}`);
    }
  }

  async getIssue(issueNumber) {
    const { data: issue } = await this.octokit.issues.get({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
    });

    const { data: comments } = await this.octokit.issues.listComments({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
    });

    return { ...issue, comments };
  }

  async createBranch(branchName, baseBranch = 'main') {
    await executeCommand('git', ['fetch', 'origin'], { cwd: this.projectPath });

    // Clean up any uncommitted changes before switching branches
    await this.cleanWorkingDirectory();

    try {
      await executeCommand('git', ['checkout', branchName], { cwd: this.projectPath });
      logger.info(`Checked out existing branch: ${branchName}`);
      return;
    } catch (error) {
      // Branch doesn't exist locally, try to create it
    }

    try {
      const { data: ref } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${baseBranch}`,
      });

      await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${branchName}`,
        sha: ref.object.sha,
      });

      await executeCommand('git', ['fetch', 'origin'], { cwd: this.projectPath });
      await executeCommand('git', ['checkout', branchName], { cwd: this.projectPath });
      logger.info(`Created and checked out branch: ${branchName}`);
    } catch (error) {
      // Branch might exist remotely, try checking out from remote
      await executeCommand('git', ['checkout', '-b', branchName, `origin/${branchName}`], { cwd: this.projectPath });
      logger.info(`Checked out remote branch: ${branchName}`);
    }
  }

  async cleanWorkingDirectory() {
    try {
      // First, try to checkout main branch
      await executeCommand('git', ['checkout', 'main'], { cwd: this.projectPath });
    } catch (error) {
      // If checkout fails due to uncommitted changes, stash them first
      if (error.message.includes('overwritten') || error.message.includes('uncommitted')) {
        logger.debug('Stashing uncommitted changes before branch switch');
        await executeCommand('git', ['stash', '--include-untracked'], { cwd: this.projectPath });
        await executeCommand('git', ['checkout', 'main'], { cwd: this.projectPath });
        // Drop the stash since we don't need these changes
        try {
          await executeCommand('git', ['stash', 'drop'], { cwd: this.projectPath });
        } catch (e) {
          // Ignore if stash is empty
        }
      }
    }

    // Reset to clean state
    try {
      await executeCommand('git', ['reset', '--hard', 'HEAD'], { cwd: this.projectPath });
      await executeCommand('git', ['clean', '-fd'], { cwd: this.projectPath });
    } catch (error) {
      logger.debug(`Clean working directory warning: ${error.message}`);
    }
  }

  async commitAndPush(message) {
    await executeCommand('git', ['add', '-A'], { cwd: this.projectPath });

    try {
      await executeCommand('git', ['diff', '--cached', '--quiet'], { cwd: this.projectPath });
      logger.debug('No changes to commit');
      return;
    } catch (error) {
      // Exit code 1 means there are staged changes - proceed with commit
    }

    await executeCommand('git', ['commit', '-m', message], { cwd: this.projectPath });
    await executeCommand('git', ['push', '-u', 'origin', 'HEAD'], { cwd: this.projectPath });
  }

  async createPullRequest(title, body, branchName, baseBranch = 'main') {
    const { data: pr } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      head: branchName,
      base: baseBranch,
    });

    logger.info(`Created PR #${pr.number}: ${pr.html_url}`);
    return pr;
  }

  async addIssueComment(issueNumber, body) {
    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body,
    });
  }

  async checkCIStatus(prNumber) {
    const { data: pr } = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    const { data: checks } = await this.octokit.checks.listForRef({
      owner: this.owner,
      repo: this.repo,
      ref: pr.head.sha,
    });

    const pending = checks.check_runs.some(
      run => run.status === 'queued' || run.status === 'in_progress'
    );

    if (pending) {
      return { status: 'pending' };
    }

    const failed = checks.check_runs.some(run => run.conclusion === 'failure');

    if (failed) {
      return { status: 'failed', checks: checks.check_runs };
    }

    return { status: 'passed' };
  }

  async cleanupBranch(branchName) {
    await this.cleanWorkingDirectory();
    try {
      await executeCommand('git', ['branch', '-D', branchName], { cwd: this.projectPath });
    } catch (error) {
      logger.debug(`Failed to delete branch ${branchName}: ${error.message}`);
    }
  }
}
