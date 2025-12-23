import { BaseAgent } from './base-agent.js';

export class CoderAgent extends BaseAgent {
  constructor(provider, options = {}) {
    super('Coder', provider, options);
  }

  async execute(context, options = {}) {
    const { issue, memory, design } = context;

    this.logger.info(`Starting Implementation for issue #${issue.number}`);

    const prompt = this.buildImplementPrompt(issue, memory, design);

    const result = await this.provider.execute(prompt, {
      cwd: context.projectPath,
      ...options,
    });

    const parsed = this.parseResponse(result.output);

    await memory.addAgentEntry(this.name, result.provider, 'Implement', {
      duration: result.duration,
      content: result.output,
    });

    this.logger.info(`Implementation completed in ${result.duration}s`);

    return {
      ...parsed,
      duration: result.duration,
    };
  }

  buildImplementPrompt(issue, memory, design) {
    return `You are a Coder Agent. Implement the solution based on the design.

## Issue #${issue.number}: ${issue.title}

## Design to Implement
${design.raw}

## Your Task
1. Create and modify files according to the design
2. Write clean, well-structured code
3. Follow existing project conventions
4. Ensure code is ready for testing

## Important Guidelines
- Use best practices for the project's language/framework
- Handle edge cases appropriately
- Add proper error handling
- Follow security best practices
- Do NOT add comments to the code unless absolutely necessary
- Make code self-documenting through clear naming

## Output Format
After implementing, summarize what was done:

### Files Created/Modified
- \`path/to/file.js\` (X lines) - NEW/MODIFIED [brief description]

### Key Implementation Details
[Describe any important decisions made during implementation]

### Notes for Tester
[Any specific test scenarios to focus on]
`;
  }

  parseResponse(output) {
    return {
      raw: output,
      filesChanged: this.extractFilesChanged(output),
    };
  }

  extractFilesChanged(text) {
    const files = [];
    const regex = /- `([^`]+)`\s*\((\d+)\s*lines?\)\s*-\s*(NEW|MODIFIED)/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      files.push({
        path: match[1],
        lines: parseInt(match[2], 10),
        status: match[3].toUpperCase(),
      });
    }
    return files;
  }
}
