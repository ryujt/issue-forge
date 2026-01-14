import { StrategistAgent } from './strategist.js';
import { ArchitectAgent } from './architect.js';
import { CoderAgent } from './coder.js';
import { TesterAgent } from './tester.js';
import { ReviewerAgent } from './reviewer.js';

export function createAgents(provider, options = {}) {
  const agentOptions = {
    ...options,
    notificationService: options.notificationService,
  };

  return {
    strategist: new StrategistAgent(provider, agentOptions),
    architect: new ArchitectAgent(provider, agentOptions),
    coder: new CoderAgent(provider, agentOptions),
    tester: new TesterAgent(provider, agentOptions),
    reviewer: new ReviewerAgent(provider, agentOptions),
  };
}

export {
  StrategistAgent,
  ArchitectAgent,
  CoderAgent,
  TesterAgent,
  ReviewerAgent,
};
