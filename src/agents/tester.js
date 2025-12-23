import { BaseAgent } from './base-agent.js';

export class TesterAgent extends BaseAgent {
  constructor(provider, options = {}) {
    super('Tester', provider, options);
  }

  async execute(context, options = {}) {
    const { issue, memory, implementation } = context;

    this.logger.info(`Starting Testing for issue #${issue.number}`);

    const prompt = this.buildTestPrompt(issue, memory, implementation);

    const result = await this.provider.execute(prompt, {
      cwd: context.projectPath,
      ...options,
    });

    const parsed = this.parseResponse(result.output);

    await memory.addAgentEntry(this.name, result.provider, 'Test', {
      duration: result.duration,
      content: result.output,
    });

    this.logger.info(`Testing completed in ${result.duration}s`);

    return {
      ...parsed,
      duration: result.duration,
    };
  }

  buildTestPrompt(issue, memory, implementation) {
    return `You are a Tester Agent. Write and run tests for the implementation.

## Issue #${issue.number}: ${issue.title}

## Implementation Summary
${implementation.raw}

## Your Task
1. Write comprehensive tests for the new/modified code
2. Run the test suite
3. Report test results and coverage
4. Identify any issues found during testing

## Testing Guidelines
- Test happy path scenarios
- Test edge cases and error conditions
- Test integration between components
- Verify security requirements if applicable
- Aim for good coverage of new code

## Output Format
Provide test results in the following structure:

### Tests Written
- \`path/to/test.js\` - [what it tests]

### Test Results
- Total: X tests
- Passing: X
- Failing: X

### Coverage
[Coverage percentage or summary]

### Issues Found
[List any bugs or issues discovered during testing]

### Test Commands Used
\`\`\`bash
[Commands run to execute tests]
\`\`\`
`;
  }

  parseResponse(output) {
    return {
      raw: output,
      results: this.extractTestResults(output),
      issues: this.extractIssues(output),
    };
  }

  extractTestResults(text) {
    const results = {
      total: 0,
      passing: 0,
      failing: 0,
    };

    const totalMatch = text.match(/Total:\s*(\d+)/i);
    const passingMatch = text.match(/Passing:\s*(\d+)/i);
    const failingMatch = text.match(/Failing:\s*(\d+)/i);

    if (totalMatch) results.total = parseInt(totalMatch[1], 10);
    if (passingMatch) results.passing = parseInt(passingMatch[1], 10);
    if (failingMatch) results.failing = parseInt(failingMatch[1], 10);

    return results;
  }

  extractIssues(text) {
    const issuesSection = text.match(/### Issues Found\n([\s\S]*?)(?=\n###|$)/);
    if (!issuesSection) return [];

    const issues = [];
    const lines = issuesSection[1].split('\n').filter(l => l.trim().startsWith('-'));
    for (const line of lines) {
      issues.push(line.replace(/^-\s*/, '').trim());
    }
    return issues;
  }
}
