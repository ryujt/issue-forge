export class BaseProvider {
  constructor(config) {
    this.config = config;
  }

  async execute(prompt, options = {}) {
    throw new Error('execute() must be implemented by subclass');
  }

  buildArgs(prompt, options) {
    throw new Error('buildArgs() must be implemented by subclass');
  }
}
