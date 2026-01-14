import { BaseAgent } from './base-agent.js';

export class StrategistAgent extends BaseAgent {
  constructor(provider, options = {}) {
    super('Strategist', provider, options);
  }

  async execute(context, options = {}) {
    const { issue, memory, isRetry, previousFailure } = context;
    const action = isRetry ? 'ReStrategize' : 'Analyze';

    this.logger.info(`Starting ${action} for issue #${issue.number}`);

    let prompt;
    if (isRetry) {
      prompt = this.buildRestrategizePrompt(issue, memory, previousFailure);
    } else {
      prompt = this.buildAnalyzePrompt(issue, memory);
    }

    const result = await this.provider.execute(prompt, {
      cwd: context.projectPath,
      ...options,
    });

    const parsed = this.parseResponse(result.output);

    await memory.addAgentEntry(this.name, result.provider, action, {
      duration: result.duration,
      content: result.output,
    });

    await this.notifyResponse(context, result, action);

    this.logger.info(`${action} completed in ${result.duration}s`);

    return {
      ...parsed,
      action,
      duration: result.duration,
    };
  }

  buildAnalyzePrompt(issue, memory) {
    return `You are a Strategist Agent. Analyze this GitHub issue and create an implementation strategy.

## Issue #${issue.number}: ${issue.title}

${issue.body || 'No description provided.'}

## Labels
${issue.labels.map(l => l.name || l).join(', ') || 'none'}

## Your Task
1. Analyze the issue requirements
2. Decide on the best approach to solve it
3. Identify potential risks and challenges
4. Consider alternative approaches

## Output Format
Provide your analysis in the following structure:

### Issue Analysis
[Summarize what needs to be done]

### Strategy Decision
**Approach**: [Your chosen approach]
**Technology**: [Key technologies/libraries to use]
**Risk**: [Main risks to consider]

### Alternatives Considered
1. [Alternative 1 and why not chosen]
2. [Alternative 2 and why not chosen]

### Success Criteria
- [Criterion 1]
- [Criterion 2]
`;
  }

  buildRestrategizePrompt(issue, memory, previousFailure) {
    return `You are a Strategist Agent. The previous implementation attempt failed. Analyze the failure and create a new strategy.

## Issue #${issue.number}: ${issue.title}

${issue.body || 'No description provided.'}

## Previous Attempt Context
${memory.getContent()}

## Previous Failure
${previousFailure.reason || 'Unknown failure reason'}

${previousFailure.feedback ? `### Reviewer Feedback\n${previousFailure.feedback.join('\n')}` : ''}

## Your Task
1. Analyze why the previous attempt failed
2. Identify the root cause
3. Develop a NEW strategy that avoids the previous pitfalls
4. Consider more robust approaches

## Output Format
Provide your analysis in the following structure:

### Failure Analysis
**Root Cause**: [What fundamentally went wrong]
**Contributing Factors**: [What led to the failure]

### Strategy Revision
**New Approach**: [How this differs from before]
**Why This Will Work**: [Evidence this approach is better]

### Risk Mitigation
- [How you'll avoid previous mistakes]
- [Additional safeguards]
`;
  }

  parseResponse(output) {
    const strategy = {
      raw: output,
      approach: this.extractSection(output, 'Approach'),
      risks: this.extractSection(output, 'Risk'),
      alternatives: this.extractSection(output, 'Alternatives Considered'),
    };
    return strategy;
  }

  extractSection(text, sectionName) {
    const regex = new RegExp(`\\*\\*${sectionName}\\*\\*:?\\s*(.+?)(?=\\n\\*\\*|\\n###|$)`, 's');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }
}
