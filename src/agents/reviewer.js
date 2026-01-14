import { BaseAgent } from './base-agent.js';

export class ReviewerAgent extends BaseAgent {
  constructor(provider, options = {}) {
    super('Reviewer', provider, options);
  }

  async execute(context, options = {}) {
    const { issue, memory, testResults } = context;

    this.logger.info(`Starting Review for issue #${issue.number}`);

    const prompt = this.buildReviewPrompt(issue, memory, testResults);

    const result = await this.provider.execute(prompt, {
      cwd: context.projectPath,
      ...options,
    });

    const parsed = this.parseResponse(result.output);

    await memory.addAgentEntry(this.name, result.provider, 'Evaluate', {
      duration: result.duration,
      content: result.output,
    });

    await this.notifyResponse(context, result, 'Evaluate');

    if (parsed.decision) {
      await memory.addDecision(
        parsed.decision,
        parsed.reasons,
        parsed.feedback
      );
    }

    this.logger.info(`Review completed: ${parsed.decision?.toUpperCase()}`);

    return {
      ...parsed,
      duration: result.duration,
    };
  }

  buildReviewPrompt(issue, memory, testResults) {
    return `You are a Reviewer Agent. Evaluate the implementation and decide whether to approve or reject.

## Issue #${issue.number}: ${issue.title}

## Full Context
${memory.getContent()}

## Test Results Summary
${testResults.raw}

## Your Task
1. Review all changes made during this iteration
2. Verify the implementation meets the issue requirements
3. Check for code quality, security, and best practices
4. Make a final decision: APPROVE or REJECT

## Evaluation Criteria
- [ ] Meets issue requirements
- [ ] Code quality and maintainability
- [ ] Security best practices
- [ ] Error handling
- [ ] Test coverage adequate
- [ ] No obvious bugs or issues

## Output Format
Provide your evaluation:

### Code Review
[Your assessment of the code quality and implementation]

### Security Check
[Any security concerns or confirmation of security practices]

### Decision: **APPROVED** or **REJECTED**

### Reasons
1. [First reason for your decision]
2. [Second reason]
3. [Continue as needed]

### Feedback for Next Iteration (if REJECTED)
- [Specific improvement 1]
- [Specific improvement 2]
- [File:line if applicable]
`;
  }

  parseResponse(output) {
    const decision = this.extractDecision(output);
    const reasons = this.extractReasons(output);
    const feedback = this.extractFeedback(output);

    return {
      raw: output,
      decision,
      reasons,
      feedback,
      approved: decision === 'approved',
    };
  }

  extractDecision(text) {
    if (/Decision:\s*\*\*APPROVED\*\*/i.test(text)) {
      return 'approved';
    }
    if (/Decision:\s*\*\*REJECTED\*\*/i.test(text)) {
      return 'rejected';
    }
    return null;
  }

  extractReasons(text) {
    const reasons = [];
    const reasonsSection = text.match(/### Reasons\n([\s\S]*?)(?=\n###|$)/);
    if (!reasonsSection) return reasons;

    const regex = /^\d+\.\s+(.+)$/gm;
    let match;
    while ((match = regex.exec(reasonsSection[1])) !== null) {
      reasons.push(match[1].trim());
    }
    return reasons;
  }

  extractFeedback(text) {
    const feedback = [];
    const feedbackSection = text.match(/### Feedback for Next Iteration[^\n]*\n([\s\S]*?)(?=\n###|$)/);
    if (!feedbackSection) return feedback;

    const lines = feedbackSection[1].split('\n').filter(l => l.trim().startsWith('-'));
    for (const line of lines) {
      feedback.push(line.replace(/^-\s*/, '').trim());
    }
    return feedback;
  }
}
