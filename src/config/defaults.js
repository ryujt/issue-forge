export const DEFAULT_CONFIG = {
  global: {
    polling_interval: 600,
    ai_provider: 'claude',
    max_iterations: 3,
  },
  logging: {
    level: 'debug',
    file_enabled: false,
    file_path: './logs',
    max_files: 7,
  },
  notifications: {
    enabled: false,
    provider: 'none',
    webhookUrl: undefined,
    botToken: undefined,
    chatId: undefined,
    sendAllResponses: true,
  },
  projects: [],
};

export const AI_MODELS = {
  claude: {
    model: 'sonnet',
    context: 200000,
    command: 'claude',
  },
  gemini: {
    model: 'pro',
    context: 1000000,
    command: 'gemini',
  },
};
