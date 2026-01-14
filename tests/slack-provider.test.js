import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { SlackProvider } from '../src/providers/notifications/slack-provider.js';

describe('SlackProvider', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should format success message correctly', () => {
    const provider = new SlackProvider('https://hooks.slack.com/test');
    const message = {
      issueNumber: 42,
      issueTitle: 'Add feature X',
      status: 'success',
      prNumber: 100,
      prUrl: 'https://github.com/user/repo/pull/100',
    };

    const formatted = provider.formatMessage(message);

    assert.strictEqual(formatted.attachments[0].color, 'good');
    assert.strictEqual(formatted.attachments[0].title, '✅ Issue Analysis Complete');
    assert.strictEqual(formatted.attachments[0].fields[0].value, '#42: Add feature X');
    assert.strictEqual(formatted.attachments[0].fields[2].value, '<https://github.com/user/repo/pull/100|#100>');
  });

  it('should format escalation message correctly', () => {
    const provider = new SlackProvider('https://hooks.slack.com/test');
    const message = {
      issueNumber: 42,
      issueTitle: 'Add feature X',
      status: 'escalated',
      iterationCount: 3,
    };

    const formatted = provider.formatMessage(message);

    assert.strictEqual(formatted.attachments[0].color, 'warning');
    assert.strictEqual(formatted.attachments[0].title, '⚠️ Issue Analysis Escalated');
    assert.strictEqual(formatted.attachments[0].fields[1].value, 'Escalated after 3 iterations');
  });

  it('should send notification without throwing on success', async () => {
    global.fetch = mock.fn(async () => ({
      ok: true,
      status: 200,
    }));

    const provider = new SlackProvider('https://hooks.slack.com/test');
    const message = {
      issueNumber: 42,
      issueTitle: 'Test',
      status: 'success',
      prNumber: 100,
      prUrl: 'https://github.com/test/repo/pull/100',
    };

    await provider.send(message);

    assert.strictEqual(global.fetch.mock.calls.length, 1);
  });

  it('should not throw on fetch failure', async () => {
    global.fetch = mock.fn(async () => {
      throw new Error('Network error');
    });

    const provider = new SlackProvider('https://hooks.slack.com/test');
    const message = {
      issueNumber: 42,
      issueTitle: 'Test',
      status: 'success',
      prNumber: 100,
      prUrl: 'https://github.com/test/repo/pull/100',
    };

    await provider.send(message);
  });

  it('should return correct provider name', () => {
    const provider = new SlackProvider('https://hooks.slack.com/test');
    assert.strictEqual(provider.getName(), 'slack');
  });
});
