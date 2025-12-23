import { BaseAgent } from './base-agent.js';

export class ArchitectAgent extends BaseAgent {
  constructor(provider, options = {}) {
    super('Architect', provider, options);
  }

  async execute(context, options = {}) {
    const { issue, memory, strategy } = context;

    this.logger.info(`Starting Design for issue #${issue.number}`);

    const prompt = this.buildDesignPrompt(issue, memory, strategy);

    const result = await this.provider.execute(prompt, {
      cwd: context.projectPath,
      ...options,
    });

    const parsed = this.parseResponse(result.output);

    await memory.addAgentEntry(this.name, result.provider, 'Design', {
      duration: result.duration,
      content: result.output,
    });

    this.logger.info(`Design completed in ${result.duration}s`);

    return {
      ...parsed,
      duration: result.duration,
    };
  }

  buildDesignPrompt(issue, memory, strategy) {
    return `You are an Architect Agent. Based on the strategy, create a detailed implementation design.

## Issue #${issue.number}: ${issue.title}

## Strategy Context
${strategy.raw}

## Your Task
1. Transform the strategy into a concrete implementation design
2. Define the file structure and changes needed
3. Specify API contracts if applicable
4. Create a step-by-step implementation plan

## Output Format
Provide your design in the following structure:

### Design Overview
[High-level description of the implementation]

### File Changes
List all files to create or modify:
- \`path/to/file.js\` - [description of changes]
- \`path/to/new-file.js\` - NEW [what this file does]

### Implementation Plan
1. [Step 1 with specific actions]
2. [Step 2 with specific actions]
3. [Continue...]

### API/Interface Design
[If applicable, define interfaces, types, or API contracts]

### Dependencies
[Any new dependencies needed and why]
`;
  }

  parseResponse(output) {
    return {
      raw: output,
      files: this.extractFileChanges(output),
      plan: this.extractPlan(output),
    };
  }

  extractFileChanges(text) {
    const files = [];
    const regex = /- `([^`]+)`\s*-\s*(NEW\s*)?(.+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      files.push({
        path: match[1],
        isNew: !!match[2],
        description: match[3].trim(),
      });
    }
    return files;
  }

  extractPlan(text) {
    const planSection = text.match(/### Implementation Plan\n([\s\S]*?)(?=\n###|$)/);
    if (!planSection) return [];

    const steps = [];
    const regex = /^\d+\.\s+(.+)$/gm;
    let match;
    while ((match = regex.exec(planSection[1])) !== null) {
      steps.push(match[1].trim());
    }
    return steps;
  }
}
