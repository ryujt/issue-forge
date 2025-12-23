import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import dayjs from 'dayjs';

export class MemoryFile {
  constructor(projectPath, issueNumber) {
    this.projectPath = projectPath;
    this.issueNumber = issueNumber;
    this.memoryDir = join(projectPath, '.issue-forge');
    this.filePath = join(this.memoryDir, `issue-${issueNumber}.md`);
    this.content = '';
    this.currentIteration = 0;
    this.maxIterations = 3;
  }

  async initialize(issue) {
    if (!existsSync(this.memoryDir)) {
      await mkdir(this.memoryDir, { recursive: true });
    }

    const labels = issue.labels.map(l => l.name || l).join(', ');
    const created = dayjs(issue.created_at).format('YYYY-MM-DD');

    this.content = `# Issue Forge Memory - Issue #${this.issueNumber}

## Issue Summary
- **Title**: ${issue.title}
- **Labels**: ${labels || 'none'}
- **Created**: ${created}
- **Max Iterations**: ${this.maxIterations}

## Issue Body
${issue.body || 'No description provided.'}

---

`;

    this.currentIteration = 0;
    await this.save();
  }

  async load() {
    if (existsSync(this.filePath)) {
      this.content = await readFile(this.filePath, 'utf-8');
      this.currentIteration = this.parseCurrentIteration();
    }
  }

  async save() {
    await writeFile(this.filePath, this.content, 'utf-8');
  }

  parseCurrentIteration() {
    const matches = this.content.match(/# Iteration (\d+)/g);
    if (!matches) return 0;
    const numbers = matches.map(m => parseInt(m.match(/\d+/)[0], 10));
    return Math.max(...numbers);
  }

  startNewIteration() {
    this.currentIteration++;
    const header = `\n# Iteration ${this.currentIteration}\n\n`;
    this.content += header;
    return this.currentIteration;
  }

  async addAgentEntry(agentName, provider, action, data) {
    const timestamp = dayjs().format('YYYY-MM-DDTHH:mm:ssZ');
    const iteration = this.currentIteration;

    let entry = `## [${timestamp}] ${agentName} Agent (${provider}) - ${action}\n`;
    entry += `**Iteration**: ${iteration}/${this.maxIterations}\n`;

    if (data.duration) {
      entry += `**Duration**: ${data.duration}s\n`;
    }

    if (data.tokens) {
      entry += `**Tokens**: ${data.tokens.toLocaleString()}\n`;
    }

    entry += '\n';

    if (data.content) {
      entry += data.content + '\n';
    }

    entry += '\n---\n\n';

    this.content += entry;
    await this.save();
  }

  async addDecision(decision, reasons = [], feedback = []) {
    let entry = `### Decision: **${decision.toUpperCase()}**\n\n`;

    if (reasons.length > 0) {
      entry += `### ${decision === 'rejected' ? 'Rejection' : 'Approval'} Reasons\n`;
      reasons.forEach((reason, i) => {
        entry += `${i + 1}. ${reason}\n`;
      });
      entry += '\n';
    }

    if (feedback.length > 0 && decision === 'rejected') {
      entry += '### Feedback for Next Iteration\n';
      feedback.forEach(item => {
        entry += `- ${item}\n`;
      });
      entry += '\n';
    }

    this.content += entry;
    await this.save();
  }

  async addFailureAnalysis(analysis) {
    let entry = '### Failure Analysis\n';
    entry += `**Previous Failure Cause**: ${analysis.cause}\n\n`;

    if (analysis.details && analysis.details.length > 0) {
      analysis.details.forEach((detail, i) => {
        entry += `${i + 1}. ${detail}\n`;
      });
      entry += '\n';
    }

    this.content += entry;
    await this.save();
  }

  async addFinalSummary(summary) {
    let entry = '\n# Final Summary\n\n';
    entry += '| Metric | Value |\n';
    entry += '|--------|-------|\n';
    entry += `| Total Iterations | ${summary.iterations} |\n`;
    entry += `| Total Duration | ${summary.totalDuration}s |\n`;
    entry += `| Result | **${summary.result}** |\n`;
    entry += '\n';

    if (summary.strategyEvolution && summary.strategyEvolution.length > 0) {
      entry += '## Strategy Evolution\n';
      summary.strategyEvolution.forEach((evolution, i) => {
        entry += `${i + 1}. **Iteration ${i + 1}**: ${evolution}\n`;
      });
      entry += '\n';
    }

    this.content += entry;
    await this.save();
  }

  getContent() {
    return this.content;
  }

  getFilePath() {
    return this.filePath;
  }

  canRetry() {
    return this.currentIteration < this.maxIterations;
  }
}
