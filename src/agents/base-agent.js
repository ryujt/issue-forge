import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAgentLogger } from '../utils/logger.js';

export class BaseAgent {
  constructor(name, provider, options = {}) {
    this.name = name;
    this.provider = provider;
    this.logger = createAgentLogger(name);
    this.templateDir = options.templateDir || join(process.cwd(), 'templates', 'prompts');
    this.notificationService = options.notificationService;
  }

  async loadTemplate(templateName) {
    const templatePath = join(this.templateDir, `${templateName}.md`);
    try {
      return await readFile(templatePath, 'utf-8');
    } catch (error) {
      this.logger.warn(`Template not found: ${templateName}, using inline prompt`);
      return null;
    }
  }

  buildPrompt(template, variables = {}) {
    let prompt = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      prompt = prompt.replace(regex, value);
    }
    return prompt;
  }

  async execute(context, options = {}) {
    throw new Error('execute() must be implemented by subclass');
  }

  parseResponse(output) {
    return { raw: output };
  }

  async notifyResponse(context, result, action) {
    if (!this.notificationService) {
      return;
    }

    const { issue } = context;
    const outputPreview = result.output?.slice(0, 500);

    await this.notificationService.notifyAgentResponse({
      agentName: this.name,
      action,
      issueNumber: issue.number,
      issueTitle: issue.title,
      duration: result.duration,
      outputPreview,
    });
  }
}
