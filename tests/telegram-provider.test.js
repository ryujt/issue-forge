import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { TelegramProvider } from '../src/providers/notifications/telegram-provider.js';

describe('TelegramProvider', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should format success message correctly', () => {
    const provider = new TelegramProvider('https://api.telegram.org/test');
    const message = {
      issueNumber: 42,
      issueTitle: 'Add feature X',
      status: 'success',
      prNumber: 100,
      prUrl: 'https://github.com/user/repo/pull/100',
    };

    const formatted = provider.formatMessage(message);

    assert.match(formatted, /✅ \*Issue Analysis Complete\*/);
    assert.match(formatted, /#42: Add feature X/);
    assert.match(formatted, /\[#100\]\(https:\/\/github\.com\/user\/repo\/pull\/100\)/);
  });

  it('should format escalation message correctly', () => {
    const provider = new TelegramProvider('https://api.telegram.org/test');
    const message = {
      issueNumber: 42,
      issueTitle: 'Add feature X',
      status: 'escalated',
      iterationCount: 3,
    };

    const formatted = provider.formatMessage(message);

    assert.match(formatted, /⚠️ \*Issue Analysis Escalated\*/);
    assert.match(formatted, /#42: Add feature X/);
    assert.match(formatted, /Escalated after 3 iterations/);
  });

  it('should send notification with correct payload', async () => {
    global.fetch = mock.fn(async (url, options) => {
      const body = JSON.parse(options.body);
      assert.strictEqual(body.parse_mode, 'Markdown');
      assert.match(body.text, /✅/);
      return { ok: true, status: 200 };
    });

    const provider = new TelegramProvider('https://api.telegram.org/test');
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

    const provider = new TelegramProvider('https://api.telegram.org/test');
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
    const provider = new TelegramProvider('https://api.telegram.org/test');
    assert.strictEqual(provider.getName(), 'telegram');
  });
});
