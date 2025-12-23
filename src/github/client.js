import { Octokit } from '@octokit/rest';
import { executeCommand } from '../utils/process.js';
import { logger } from '../utils/logger.js';

export class GitHubClient {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
    this.owner = null;
    this.repo = null;
  }

  async initialize() {
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
      /github\.com[:/]([^/]+)\/([^/.]+)/,
      /github\.com\/([^/]+)\/([^/.]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { owner: match[1], repo: match[2].replace('.git', '') };
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
  }

  async commitAndPush(message) {
    await executeCommand('git', ['add', '-A'], { cwd: this.projectPath });
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
    await executeCommand('git', ['checkout', 'main'], { cwd: this.projectPath });
    await executeCommand('git', ['branch', '-D', branchName], { cwd: this.projectPath });
  }
}
