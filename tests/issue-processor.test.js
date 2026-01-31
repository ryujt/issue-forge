import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { IssueProcessor } from '../src/core/issue-processor.js';

describe('IssueProcessor', () => {
  describe('createPullRequest', () => {
    it('should add final summary before commit', async () => {
      const callOrder = [];

      const mockGithub = {
        commitAndPush: mock.fn(() => {
          callOrder.push('commitAndPush');
          return Promise.resolve();
        }),
        createPullRequest: mock.fn(() => {
          callOrder.push('createPullRequest');
          return Promise.resolve({ number: 1, html_url: 'https://github.com/test/repo/pull/1' });
        }),
        removeLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 1,
        addFinalSummary: mock.fn(() => {
          callOrder.push('addFinalSummary');
          return Promise.resolve();
        }),
      };

      const processor = new IssueProcessor({}, {});
      await processor.createPullRequest(
        mockGithub,
        { number: 1, title: 'Test Issue' },
        mockMemory,
        'test-branch'
      );

      assert.deepStrictEqual(callOrder, ['addFinalSummary', 'commitAndPush', 'createPullRequest']);
    });

    it('should call addFinalSummary with correct parameters', async () => {
      const mockGithub = {
        commitAndPush: mock.fn(() => Promise.resolve()),
        createPullRequest: mock.fn(() =>
          Promise.resolve({ number: 1, html_url: 'https://github.com/test/repo/pull/1' })
        ),
        removeLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 3,
        addFinalSummary: mock.fn(() => Promise.resolve()),
      };

      const processor = new IssueProcessor({}, {});
      await processor.createPullRequest(
        mockGithub,
        { number: 5, title: 'Test Issue' },
        mockMemory,
        'test-branch'
      );

      assert.strictEqual(mockMemory.addFinalSummary.mock.calls.length, 1);
      const summaryArg = mockMemory.addFinalSummary.mock.calls[0].arguments[0];
      assert.strictEqual(summaryArg.iterations, 3);
      assert.strictEqual(summaryArg.result, 'APPROVED - PR Created');
    });

    it('should return correct result object', async () => {
      const mockGithub = {
        commitAndPush: mock.fn(() => Promise.resolve()),
        createPullRequest: mock.fn(() =>
          Promise.resolve({ number: 42, html_url: 'https://github.com/test/repo/pull/42' })
        ),
        removeLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 1,
        addFinalSummary: mock.fn(() => Promise.resolve()),
      };

      const processor = new IssueProcessor({}, {});
      const result = await processor.createPullRequest(
        mockGithub,
        { number: 10, title: 'Test Issue' },
        mockMemory,
        'test-branch'
      );

      assert.strictEqual(result.status, 'success');
      assert.strictEqual(result.issue, 10);
      assert.strictEqual(result.pr, 42);
      assert.strictEqual(result.url, 'https://github.com/test/repo/pull/42');
    });

    it('should notify when notificationService is provided', async () => {
      const mockGithub = {
        commitAndPush: mock.fn(() => Promise.resolve()),
        createPullRequest: mock.fn(() =>
          Promise.resolve({ number: 1, html_url: 'https://github.com/test/repo/pull/1' })
        ),
        removeLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 1,
        addFinalSummary: mock.fn(() => Promise.resolve()),
      };

      const mockNotificationService = {
        notifyAnalysisComplete: mock.fn(() => Promise.resolve()),
      };

      const processor = new IssueProcessor({}, { notificationService: mockNotificationService });
      await processor.createPullRequest(
        mockGithub,
        { number: 5, title: 'Test Issue' },
        mockMemory,
        'test-branch'
      );

      assert.strictEqual(mockNotificationService.notifyAnalysisComplete.mock.calls.length, 1);
      const notifyArg = mockNotificationService.notifyAnalysisComplete.mock.calls[0].arguments[0];
      assert.strictEqual(notifyArg.issueNumber, 5);
      assert.strictEqual(notifyArg.status, 'success');
      assert.strictEqual(notifyArg.prNumber, 1);
    });
  });

  describe('escalateToHuman', () => {
    it('should commit memory file changes', async () => {
      const mockGithub = {
        commitAndPush: mock.fn(() => Promise.resolve()),
        addIssueComment: mock.fn(() => Promise.resolve()),
        removeLabel: mock.fn(() => Promise.resolve()),
        addLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 3,
        addFinalSummary: mock.fn(() => Promise.resolve()),
      };

      const processor = new IssueProcessor({}, { maxIterations: 3 });
      await processor.escalateToHuman(mockGithub, { number: 1 }, mockMemory);

      assert.strictEqual(mockGithub.commitAndPush.mock.calls.length, 1);
      assert.strictEqual(
        mockGithub.commitAndPush.mock.calls[0].arguments[0],
        'docs: issue #1 escalated - needs human intervention'
      );
    });

    it('should add final summary before commit', async () => {
      const callOrder = [];

      const mockGithub = {
        commitAndPush: mock.fn(() => {
          callOrder.push('commitAndPush');
          return Promise.resolve();
        }),
        addIssueComment: mock.fn(() => {
          callOrder.push('addIssueComment');
          return Promise.resolve();
        }),
        removeLabel: mock.fn(() => Promise.resolve()),
        addLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 3,
        addFinalSummary: mock.fn(() => {
          callOrder.push('addFinalSummary');
          return Promise.resolve();
        }),
      };

      const processor = new IssueProcessor({}, { maxIterations: 3 });
      await processor.escalateToHuman(mockGithub, { number: 1 }, mockMemory);

      assert.strictEqual(callOrder.indexOf('addFinalSummary'), 0);
      assert.strictEqual(callOrder.indexOf('commitAndPush'), 1);
      assert.ok(callOrder.indexOf('addIssueComment') > callOrder.indexOf('commitAndPush'));
    });

    it('should call addFinalSummary with correct parameters', async () => {
      const mockGithub = {
        commitAndPush: mock.fn(() => Promise.resolve()),
        addIssueComment: mock.fn(() => Promise.resolve()),
        removeLabel: mock.fn(() => Promise.resolve()),
        addLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 5,
        addFinalSummary: mock.fn(() => Promise.resolve()),
      };

      const processor = new IssueProcessor({}, { maxIterations: 5 });
      await processor.escalateToHuman(mockGithub, { number: 7 }, mockMemory);

      assert.strictEqual(mockMemory.addFinalSummary.mock.calls.length, 1);
      const summaryArg = mockMemory.addFinalSummary.mock.calls[0].arguments[0];
      assert.strictEqual(summaryArg.iterations, 5);
      assert.strictEqual(summaryArg.result, 'ESCALATED - Human intervention required');
    });

    it('should add needs-human label and remove in-progress label', async () => {
      const mockGithub = {
        commitAndPush: mock.fn(() => Promise.resolve()),
        addIssueComment: mock.fn(() => Promise.resolve()),
        removeLabel: mock.fn(() => Promise.resolve()),
        addLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 3,
        addFinalSummary: mock.fn(() => Promise.resolve()),
      };

      const processor = new IssueProcessor({}, { maxIterations: 3 });
      await processor.escalateToHuman(mockGithub, { number: 1 }, mockMemory);

      assert.strictEqual(mockGithub.removeLabel.mock.calls.length, 1);
      assert.strictEqual(mockGithub.removeLabel.mock.calls[0].arguments[0], 1);
      assert.strictEqual(mockGithub.removeLabel.mock.calls[0].arguments[1], 'issue-forge:in-progress');

      assert.strictEqual(mockGithub.addLabel.mock.calls.length, 1);
      assert.strictEqual(mockGithub.addLabel.mock.calls[0].arguments[0], 1);
      assert.strictEqual(mockGithub.addLabel.mock.calls[0].arguments[1], 'issue-forge:needs-human');
    });

    it('should notify when notificationService is provided', async () => {
      const mockGithub = {
        commitAndPush: mock.fn(() => Promise.resolve()),
        addIssueComment: mock.fn(() => Promise.resolve()),
        removeLabel: mock.fn(() => Promise.resolve()),
        addLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 3,
        addFinalSummary: mock.fn(() => Promise.resolve()),
      };

      const mockNotificationService = {
        notifyAnalysisComplete: mock.fn(() => Promise.resolve()),
      };

      const processor = new IssueProcessor({}, {
        maxIterations: 3,
        notificationService: mockNotificationService,
      });
      await processor.escalateToHuman(mockGithub, { number: 5, title: 'Test Issue' }, mockMemory);

      assert.strictEqual(mockNotificationService.notifyAnalysisComplete.mock.calls.length, 1);
      const notifyArg = mockNotificationService.notifyAnalysisComplete.mock.calls[0].arguments[0];
      assert.strictEqual(notifyArg.issueNumber, 5);
      assert.strictEqual(notifyArg.status, 'escalated');
      assert.strictEqual(notifyArg.iterationCount, 3);
    });

    it('should post escalation comment with correct content', async () => {
      let commentBody = null;

      const mockGithub = {
        commitAndPush: mock.fn(() => Promise.resolve()),
        addIssueComment: mock.fn((issueNumber, body) => {
          commentBody = body;
          return Promise.resolve();
        }),
        removeLabel: mock.fn(() => Promise.resolve()),
        addLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 3,
        addFinalSummary: mock.fn(() => Promise.resolve()),
      };

      const processor = new IssueProcessor({}, { maxIterations: 3 });
      await processor.escalateToHuman(mockGithub, { number: 42 }, mockMemory);

      assert.ok(commentBody.includes('Issue Forge - Escalation Required'));
      assert.ok(commentBody.includes('3 attempts'));
      assert.ok(commentBody.includes('.issue-forge/issue-42.md'));
    });

    it('should not notify when notificationService is not provided', async () => {
      const mockGithub = {
        commitAndPush: mock.fn(() => Promise.resolve()),
        addIssueComment: mock.fn(() => Promise.resolve()),
        removeLabel: mock.fn(() => Promise.resolve()),
        addLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 3,
        addFinalSummary: mock.fn(() => Promise.resolve()),
      };

      const processor = new IssueProcessor({}, { maxIterations: 3 });
      // Should not throw when notificationService is undefined
      await processor.escalateToHuman(mockGithub, { number: 1 }, mockMemory);

      // If we get here without error, the test passes
      assert.ok(true);
    });
  });

  describe('createPullRequest - edge cases', () => {
    it('should create PR with correct title format', async () => {
      let prTitle = null;

      const mockGithub = {
        commitAndPush: mock.fn(() => Promise.resolve()),
        createPullRequest: mock.fn((title) => {
          prTitle = title;
          return Promise.resolve({ number: 1, html_url: 'https://github.com/test/repo/pull/1' });
        }),
        removeLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 1,
        addFinalSummary: mock.fn(() => Promise.resolve()),
      };

      const processor = new IssueProcessor({}, {});
      await processor.createPullRequest(
        mockGithub,
        { number: 123, title: 'Add new feature' },
        mockMemory,
        'test-branch'
      );

      assert.strictEqual(prTitle, 'Fix #123: Add new feature');
    });

    it('should include memory file reference in PR body', async () => {
      let prBody = null;

      const mockGithub = {
        commitAndPush: mock.fn(() => Promise.resolve()),
        createPullRequest: mock.fn((title, body) => {
          prBody = body;
          return Promise.resolve({ number: 1, html_url: 'https://github.com/test/repo/pull/1' });
        }),
        removeLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 1,
        addFinalSummary: mock.fn(() => Promise.resolve()),
      };

      const processor = new IssueProcessor({}, {});
      await processor.createPullRequest(
        mockGithub,
        { number: 99, title: 'Test Issue' },
        mockMemory,
        'test-branch'
      );

      assert.ok(prBody.includes('.issue-forge/issue-99.md'));
      assert.ok(prBody.includes('Automated by Issue Forge'));
    });

    it('should use correct branch name when creating PR', async () => {
      let branchName = null;

      const mockGithub = {
        commitAndPush: mock.fn(() => Promise.resolve()),
        createPullRequest: mock.fn((title, body, branch) => {
          branchName = branch;
          return Promise.resolve({ number: 1, html_url: 'https://github.com/test/repo/pull/1' });
        }),
        removeLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 1,
        addFinalSummary: mock.fn(() => Promise.resolve()),
      };

      const processor = new IssueProcessor({}, {});
      await processor.createPullRequest(
        mockGithub,
        { number: 1, title: 'Test Issue' },
        mockMemory,
        'issue-forge/issue-42'
      );

      assert.strictEqual(branchName, 'issue-forge/issue-42');
    });

    it('should use correct commit message format', async () => {
      let commitMessage = null;

      const mockGithub = {
        commitAndPush: mock.fn((message) => {
          commitMessage = message;
          return Promise.resolve();
        }),
        createPullRequest: mock.fn(() =>
          Promise.resolve({ number: 1, html_url: 'https://github.com/test/repo/pull/1' })
        ),
        removeLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 1,
        addFinalSummary: mock.fn(() => Promise.resolve()),
      };

      const processor = new IssueProcessor({}, {});
      await processor.createPullRequest(
        mockGithub,
        { number: 77, title: 'Test Issue' },
        mockMemory,
        'test-branch'
      );

      assert.strictEqual(commitMessage, 'fix: resolve issue #77');
    });

    it('should not notify when notificationService is not provided', async () => {
      const mockGithub = {
        commitAndPush: mock.fn(() => Promise.resolve()),
        createPullRequest: mock.fn(() =>
          Promise.resolve({ number: 1, html_url: 'https://github.com/test/repo/pull/1' })
        ),
        removeLabel: mock.fn(() => Promise.resolve()),
      };

      const mockMemory = {
        currentIteration: 1,
        addFinalSummary: mock.fn(() => Promise.resolve()),
      };

      // No notificationService provided
      const processor = new IssueProcessor({}, {});
      const result = await processor.createPullRequest(
        mockGithub,
        { number: 1, title: 'Test Issue' },
        mockMemory,
        'test-branch'
      );

      // Should complete successfully without notification
      assert.strictEqual(result.status, 'success');
    });
  });

  describe('constructor', () => {
    it('should use default maxIterations when not provided', () => {
      const processor = new IssueProcessor({});
      assert.strictEqual(processor.maxIterations, 3);
    });

    it('should use provided maxIterations', () => {
      const processor = new IssueProcessor({}, { maxIterations: 5 });
      assert.strictEqual(processor.maxIterations, 5);
    });

    it('should store notificationService when provided', () => {
      const mockNotificationService = { notify: () => {} };
      const processor = new IssueProcessor({}, { notificationService: mockNotificationService });
      assert.strictEqual(processor.notificationService, mockNotificationService);
    });
  });
});
