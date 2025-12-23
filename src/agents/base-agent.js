import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAgentLogger } from '../utils/logger.js';

export class BaseAgent {
  constructor(name, provider, options = {}) {
    this.name = name;
    this.provider = provider;
    this.logger = createAgentLogger(name);
    this.templateDir = options.templateDir || join(process.cwd(), 'templates', 'prompts');
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
}
