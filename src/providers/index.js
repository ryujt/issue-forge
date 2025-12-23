import { ClaudeProvider } from './claude-provider.js';
import { GeminiProvider } from './gemini-provider.js';

export function createProvider(name, config = {}) {
  switch (name) {
    case 'claude':
      return new ClaudeProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    default:
      throw new Error(`Unknown AI provider: ${name}`);
  }
}

export { ClaudeProvider, GeminiProvider };
