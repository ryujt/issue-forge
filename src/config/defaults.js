export const DEFAULT_CONFIG = {
  global: {
    polling_interval: 600,
    ai_provider: 'claude',
    max_iterations: 3,
  },
  projects: [],
};

export const AI_MODELS = {
  claude: {
    model: 'opus',
    context: 200000,
    command: 'claude',
  },
  gemini: {
    model: 'pro',
    context: 1000000,
    command: 'gemini',
  },
};
