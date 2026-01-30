import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { IssueProcessor } from '../src/core/issue-processor.js';

describe('IssueProcessor', () => {
  let mockProvider;
  let mockGitHub;
  let mockMemory;
  let mockAgents;
  let mockNotificationService;
  let callOrder;

  beforeEach(() => {
    callOrder = [];

    // Mock provider
    mockProvider = { name: 'test-provider' };

    // Mock GitHub client methods
    mockGitHub = {
      initialize: mock.fn(async () => {}),
      addLabel: mock.fn(async () => {}),
      removeLabel: mock.fn(async () => {
        callOrder.push('removeLabel');
      }),
      createBranch: mock.fn(async () => {}),
      commitAndPush: mock.fn(async () => {
        callOrder.push('commitAndPush');
      }),
      createPullRequest: mock.fn(async () => {
        callOrder.push('createPullRequest');
        return { number: 42, html_url: 'https://github.com/test/repo/pull/42' };
      }),
      addIssueComment: mock.fn(async () => {}),
    };

    // Mock memory file methods
    mockMemory = {
      initialize: mock.fn(async () => {}),
      startNewIteration: mock.fn(() => 1),
      addAgentEntry: mock.fn(async () => {}),
      addDecision: mock.fn(async () => {}),
      addFinalSummary: mock.fn(async () => {
        callOrder.push('addFinalSummary');
      }),
      currentIteration: 1,
      getFilePath: mock.fn(() => '.issue-forge/issue-1.md'),
    };

    // Mock agents
    mockAgents = {
      strategist: { execute: mock.fn(async () => ({ strategy: 'test' })) },
      architect: { execute: mock.fn(async () => ({ design: 'test' })) },
      coder: { execute: mock.fn(async () => ({ implementation: 'test' })) },
      tester: { execute: mock.fn(async () => ({ testResults: 'pass' })) },
      reviewer: { execute: mock.fn(async () => ({ approved: true, reasons: ['All tests pass'] })) },
    };

    // Mock notification service
    mockNotificationService = {
      notifyIssueStart: mock.fn(async () => {}),
      notifyAnalysisComplete: mock.fn(async () => {
        callOrder.push('notifyAnalysisComplete');
      }),
    };
  });

  describe('createPullRequest', () => {
    it('should call addFinalSummary BEFORE commitAndPush', async () => {
      const processor = new IssueProcessor(mockProvider, {
        notificationService: mockNotificationService,
      });

      const issue = {
        number: 1,
        title: 'Test issue',
        body: 'Test body',
        labels: [],
      };

      // Call createPullRequest directly with mocks
      const result = await processor.createPullRequest(
        mockGitHub,
        issue,
        mockMemory,
        'issue-forge/issue-1'
      );

      // Verify the order of operations
      const addFinalSummaryIndex = callOrder.indexOf('addFinalSummary');
      const commitAndPushIndex = callOrder.indexOf('commitAndPush');
      const createPullRequestIndex = callOrder.indexOf('createPullRequest');

      assert.ok(
        addFinalSummaryIndex < commitAndPushIndex,
        `addFinalSummary (index ${addFinalSummaryIndex}) should be called before commitAndPush (index ${commitAndPushIndex}). Order: ${callOrder.join(' -> ')}`
      );

      assert.ok(
        commitAndPushIndex < createPullRequestIndex,
        `commitAndPush (index ${commitAndPushIndex}) should be called before createPullRequest (index ${createPullRequestIndex}). Order: ${callOrder.join(' -> ')}`
      );
    });

    it('should include final summary in committed changes', async () => {
      const processor = new IssueProcessor(mockProvider);

      const issue = {
        number: 1,
        title: 'Test issue',
        body: 'Test body',
        labels: [],
      };

      await processor.createPullRequest(
        mockGitHub,
        issue,
        mockMemory,
        'issue-forge/issue-1'
      );

      // Verify addFinalSummary was called with correct parameters
      assert.strictEqual(mockMemory.addFinalSummary.mock.calls.length, 1);
      const summaryCall = mockMemory.addFinalSummary.mock.calls[0];
      assert.strictEqual(summaryCall.arguments[0].iterations, 1);
      assert.strictEqual(summaryCall.arguments[0].result, 'APPROVED - PR Created');
    });

    it('should return correct PR information', async () => {
      const processor = new IssueProcessor(mockProvider);

      const issue = {
        number: 5,
        title: 'Another test issue',
        body: 'Test body',
        labels: [],
      };

      const result = await processor.createPullRequest(
        mockGitHub,
        issue,
        mockMemory,
        'issue-forge/issue-5'
      );

      assert.strictEqual(result.status, 'success');
      assert.strictEqual(result.issue, 5);
      assert.strictEqual(result.pr, 42);
      assert.strictEqual(result.url, 'https://github.com/test/repo/pull/42');
    });

    it('should call notification service with correct PR info after PR creation', async () => {
      const processor = new IssueProcessor(mockProvider, {
        notificationService: mockNotificationService,
      });

      const issue = {
        number: 3,
        title: 'Notification test issue',
        body: 'Test body',
        labels: [],
      };

      await processor.createPullRequest(
        mockGitHub,
        issue,
        mockMemory,
        'issue-forge/issue-3'
      );

      // Verify notification was called after PR creation
      const createPRIndex = callOrder.indexOf('createPullRequest');
      const notifyIndex = callOrder.indexOf('notifyAnalysisComplete');

      assert.ok(
        createPRIndex < notifyIndex,
        `createPullRequest should be called before notifyAnalysisComplete. Order: ${callOrder.join(' -> ')}`
      );

      // Verify notification received correct PR info
      assert.strictEqual(mockNotificationService.notifyAnalysisComplete.mock.calls.length, 1);
      const notifyCall = mockNotificationService.notifyAnalysisComplete.mock.calls[0];
      assert.strictEqual(notifyCall.arguments[0].prNumber, 42);
      assert.strictEqual(notifyCall.arguments[0].prUrl, 'https://github.com/test/repo/pull/42');
      assert.strictEqual(notifyCall.arguments[0].status, 'success');
    });

    it('should remove in-progress label after PR creation', async () => {
      const processor = new IssueProcessor(mockProvider);

      const issue = {
        number: 7,
        title: 'Label test issue',
        body: 'Test body',
        labels: [],
      };

      await processor.createPullRequest(
        mockGitHub,
        issue,
        mockMemory,
        'issue-forge/issue-7'
      );

      // Verify removeLabel was called
      assert.strictEqual(mockGitHub.removeLabel.mock.calls.length, 1);
      const removeLabelCall = mockGitHub.removeLabel.mock.calls[0];
      assert.strictEqual(removeLabelCall.arguments[0], 7);
      assert.strictEqual(removeLabelCall.arguments[1], 'issue-forge:in-progress');

      // Verify it's called after createPullRequest
      const createPRIndex = callOrder.indexOf('createPullRequest');
      const removeLabelIndex = callOrder.indexOf('removeLabel');

      assert.ok(
        createPRIndex < removeLabelIndex,
        `createPullRequest should be called before removeLabel. Order: ${callOrder.join(' -> ')}`
      );
    });

    it('should work without notification service', async () => {
      const processor = new IssueProcessor(mockProvider);

      const issue = {
        number: 8,
        title: 'No notification test',
        body: 'Test body',
        labels: [],
      };

      // This should not throw
      const result = await processor.createPullRequest(
        mockGitHub,
        issue,
        mockMemory,
        'issue-forge/issue-8'
      );

      assert.strictEqual(result.status, 'success');
    });

    it('should generate correct PR title with issue number', async () => {
      const processor = new IssueProcessor(mockProvider);

      const issue = {
        number: 99,
        title: 'Fix authentication bug',
        body: 'Test body',
        labels: [],
      };

      await processor.createPullRequest(
        mockGitHub,
        issue,
        mockMemory,
        'issue-forge/issue-99'
      );

      const createPRCall = mockGitHub.createPullRequest.mock.calls[0];
      assert.strictEqual(createPRCall.arguments[0], 'Fix #99: Fix authentication bug');
    });

    it('should generate correct commit message with issue number', async () => {
      const processor = new IssueProcessor(mockProvider);

      const issue = {
        number: 123,
        title: 'Test commit message',
        body: 'Test body',
        labels: [],
      };

      await processor.createPullRequest(
        mockGitHub,
        issue,
        mockMemory,
        'issue-forge/issue-123'
      );

      const commitCall = mockGitHub.commitAndPush.mock.calls[0];
      assert.strictEqual(commitCall.arguments[0], 'fix: resolve issue #123');
    });
  });

  describe('escalateToHuman', () => {
    it('should call addFinalSummary with escalated result', async () => {
      const processor = new IssueProcessor(mockProvider, {
        maxIterations: 3,
        notificationService: mockNotificationService,
      });

      const issue = {
        number: 10,
        title: 'Escalation test',
        body: 'Test body',
        labels: [],
      };

      await processor.escalateToHuman(mockGitHub, issue, mockMemory);

      assert.strictEqual(mockMemory.addFinalSummary.mock.calls.length, 1);
      const summaryCall = mockMemory.addFinalSummary.mock.calls[0];
      assert.strictEqual(summaryCall.arguments[0].result, 'ESCALATED - Human intervention required');
    });

    it('should add issue comment explaining escalation', async () => {
      const processor = new IssueProcessor(mockProvider, {
        maxIterations: 3,
      });

      const issue = {
        number: 11,
        title: 'Comment test',
        body: 'Test body',
        labels: [],
      };

      await processor.escalateToHuman(mockGitHub, issue, mockMemory);

      assert.strictEqual(mockGitHub.addIssueComment.mock.calls.length, 1);
      const commentCall = mockGitHub.addIssueComment.mock.calls[0];
      assert.strictEqual(commentCall.arguments[0], 11);
      assert.ok(commentCall.arguments[1].includes('Escalation Required'));
    });

    it('should add needs-human label after removing in-progress label', async () => {
      const processor = new IssueProcessor(mockProvider, {
        maxIterations: 3,
      });

      const issue = {
        number: 12,
        title: 'Label management test',
        body: 'Test body',
        labels: [],
      };

      await processor.escalateToHuman(mockGitHub, issue, mockMemory);

      // Verify removeLabel was called
      assert.strictEqual(mockGitHub.removeLabel.mock.calls.length, 1);
      const removeLabelCall = mockGitHub.removeLabel.mock.calls[0];
      assert.strictEqual(removeLabelCall.arguments[1], 'issue-forge:in-progress');

      // Verify addLabel was called for needs-human
      assert.strictEqual(mockGitHub.addLabel.mock.calls.length, 1);
      const addLabelCall = mockGitHub.addLabel.mock.calls[0];
      assert.strictEqual(addLabelCall.arguments[1], 'issue-forge:needs-human');
    });

    it('should notify with escalated status', async () => {
      const processor = new IssueProcessor(mockProvider, {
        notificationService: mockNotificationService,
      });

      const issue = {
        number: 13,
        title: 'Notification escalation test',
        body: 'Test body',
        labels: [],
      };

      await processor.escalateToHuman(mockGitHub, issue, mockMemory);

      assert.strictEqual(mockNotificationService.notifyAnalysisComplete.mock.calls.length, 1);
      const notifyCall = mockNotificationService.notifyAnalysisComplete.mock.calls[0];
      assert.strictEqual(notifyCall.arguments[0].status, 'escalated');
      assert.strictEqual(notifyCall.arguments[0].issueNumber, 13);
    });
  });

  describe('Error handling in createPullRequest', () => {
    it('should propagate addFinalSummary errors', async () => {
      const failingMemory = {
        ...mockMemory,
        addFinalSummary: mock.fn(async () => {
          throw new Error('Failed to write final summary');
        }),
      };

      const processor = new IssueProcessor(mockProvider);

      const issue = {
        number: 20,
        title: 'Error test',
        body: 'Test body',
        labels: [],
      };

      await assert.rejects(
        async () => {
          await processor.createPullRequest(
            mockGitHub,
            issue,
            failingMemory,
            'issue-forge/issue-20'
          );
        },
        { message: 'Failed to write final summary' }
      );

      // Verify commitAndPush was NOT called (because addFinalSummary failed first)
      assert.strictEqual(mockGitHub.commitAndPush.mock.calls.length, 0);
    });

    it('should propagate commitAndPush errors after addFinalSummary succeeds', async () => {
      const failingGitHub = {
        ...mockGitHub,
        commitAndPush: mock.fn(async () => {
          throw new Error('Failed to commit');
        }),
      };

      const processor = new IssueProcessor(mockProvider);

      const issue = {
        number: 21,
        title: 'Commit error test',
        body: 'Test body',
        labels: [],
      };

      await assert.rejects(
        async () => {
          await processor.createPullRequest(
            failingGitHub,
            issue,
            mockMemory,
            'issue-forge/issue-21'
          );
        },
        { message: 'Failed to commit' }
      );

      // Verify addFinalSummary WAS called (before the commit failure)
      assert.strictEqual(mockMemory.addFinalSummary.mock.calls.length, 1);
    });
  });
});

describe('IssueProcessor - Operation Order Verification', () => {
  it('should maintain correct operation sequence: addFinalSummary -> commitAndPush -> createPullRequest -> removeLabel -> notify', async () => {
    const callSequence = [];

    const mockGitHub = {
      commitAndPush: mock.fn(async () => {
        callSequence.push('commitAndPush');
      }),
      createPullRequest: mock.fn(async () => {
        callSequence.push('createPullRequest');
        return { number: 1, html_url: 'https://example.com/pr/1' };
      }),
      removeLabel: mock.fn(async () => {
        callSequence.push('removeLabel');
      }),
    };

    const mockMemory = {
      currentIteration: 2,
      addFinalSummary: mock.fn(async () => {
        callSequence.push('addFinalSummary');
      }),
    };

    const mockNotificationService = {
      notifyAnalysisComplete: mock.fn(async () => {
        callSequence.push('notify');
      }),
    };

    const processor = new IssueProcessor({}, {
      notificationService: mockNotificationService,
    });

    await processor.createPullRequest(
      mockGitHub,
      { number: 1, title: 'Test' },
      mockMemory,
      'test-branch'
    );

    assert.deepStrictEqual(
      callSequence,
      ['addFinalSummary', 'commitAndPush', 'createPullRequest', 'removeLabel', 'notify'],
      `Expected order: addFinalSummary -> commitAndPush -> createPullRequest -> removeLabel -> notify. Got: ${callSequence.join(' -> ')}`
    );
  });
});
