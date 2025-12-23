import { StrategistAgent } from './strategist.js';
import { ArchitectAgent } from './architect.js';
import { CoderAgent } from './coder.js';
import { TesterAgent } from './tester.js';
import { ReviewerAgent } from './reviewer.js';

export function createAgents(provider, options = {}) {
  return {
    strategist: new StrategistAgent(provider, options),
    architect: new ArchitectAgent(provider, options),
    coder: new CoderAgent(provider, options),
    tester: new TesterAgent(provider, options),
    reviewer: new ReviewerAgent(provider, options),
  };
}

export {
  StrategistAgent,
  ArchitectAgent,
  CoderAgent,
  TesterAgent,
  ReviewerAgent,
};
