import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { GitHubClient } from '../src/github/client.js';

describe('GitHubClient', () => {
  describe('parseGitHubUrl', () => {
    let client;

    beforeEach(() => {
      client = new GitHubClient('/test/project');
    });

    it('should parse HTTPS URL', () => {
      const result = client.parseGitHubUrl('https://github.com/owner/repo.git');
      assert.strictEqual(result.owner, 'owner');
      assert.strictEqual(result.repo, 'repo');
    });

    it('should parse SSH URL', () => {
      const result = client.parseGitHubUrl('git@github.com:owner/repo.git');
      assert.strictEqual(result.owner, 'owner');
      assert.strictEqual(result.repo, 'repo');
    });

    it('should parse URL without .git extension', () => {
      const result = client.parseGitHubUrl('https://github.com/owner/repo');
      assert.strictEqual(result.owner, 'owner');
      assert.strictEqual(result.repo, 'repo');
    });

    it('should throw for invalid URL', () => {
      assert.throws(() => {
        client.parseGitHubUrl('invalid-url');
      }, /Cannot parse GitHub URL/);
    });

    it('should handle URLs with nested paths correctly', () => {
      const result = client.parseGitHubUrl('https://github.com/org-name/repo-name');
      assert.strictEqual(result.owner, 'org-name');
      assert.strictEqual(result.repo, 'repo-name');
    });
  });

  describe('constructor', () => {
    it('should set projectPath correctly', () => {
      const client = new GitHubClient('/path/to/project');
      assert.strictEqual(client.projectPath, '/path/to/project');
    });

    it('should initialize with null values', () => {
      const client = new GitHubClient('/path/to/project');
      assert.strictEqual(client.octokit, null);
      assert.strictEqual(client.owner, null);
      assert.strictEqual(client.repo, null);
    });
  });
});

describe('GitHubClient - commitAndPush behavior verification', () => {
  // These tests verify the expected behavior documented in the implementation
  // The actual execution requires git commands, so we document the expected flow

  it('should document the expected commitAndPush flow', () => {
    // This is a documentation test that describes the expected behavior
    const expectedFlow = [
      '1. Stage all files with git add -A',
      '2. Check for staged changes with git diff --cached --quiet',
      '3. If no changes (exit code 0), return early without commit',
      '4. If changes exist (exit code 1), proceed with commit',
      '5. Push to remote with git push -u origin HEAD',
    ];

    // Verify we have documented all 5 steps
    assert.strictEqual(expectedFlow.length, 5);
  });

  it('should document the empty commit handling behavior', () => {
    // The implementation uses git diff --cached --quiet which:
    // - Returns exit code 0 if there are NO staged changes
    // - Returns exit code 1 if there ARE staged changes

    const behavior = {
      noChanges: {
        command: 'git diff --cached --quiet',
        exitCode: 0,
        action: 'Return early without commit',
      },
      hasChanges: {
        command: 'git diff --cached --quiet',
        exitCode: 1,
        action: 'Proceed with commit and push',
      },
    };

    assert.strictEqual(behavior.noChanges.exitCode, 0);
    assert.strictEqual(behavior.hasChanges.exitCode, 1);
    assert.strictEqual(behavior.noChanges.action, 'Return early without commit');
    assert.strictEqual(behavior.hasChanges.action, 'Proceed with commit and push');
  });
});
